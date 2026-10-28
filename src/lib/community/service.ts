import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateCommunityAccess } from "@/lib/community/policy";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isAccountSuspended } from "@/lib/auth/suspension";

const SAFETY_UNAVAILABLE =
  "We couldn't verify the required safety settings. Community access is temporarily unavailable.";
const COMMUNITY_UNAVAILABLE =
  "The community is temporarily unavailable. Please try again later.";

export type CommunityChannel = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  joined: boolean;
};

export type CommunityMessage = {
  id: string;
  channel_id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
  edited_at: string | null;
};

export type CommunityState =
  | { status: "unauthenticated" }
  | { status: "blocked"; message: string }
  | { status: "error"; message: string }
  | {
      status: "ready";
      channels: CommunityChannel[];
      selectedChannelId: string | null;
      messages: CommunityMessage[];
      messagesAvailable: boolean;
      currentProfileId: string;
    };

type GateResult =
  | { status: "ready"; client: SupabaseClient; profileId: string }
  | { status: "unauthenticated" }
  | { status: "blocked"; message: string }
  | { status: "error"; message: string };

async function checkCommunityGate(client: SupabaseClient): Promise<GateResult> {
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError)
    return {
      status: "error",
      message: "We couldn't verify your sign-in. Please try again.",
    };
  const user = authData.user;
  if (!user) return { status: "unauthenticated" };

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id,role,is_suspended")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return { status: "error", message: SAFETY_UNAVAILABLE };
  if (!profile)
    return {
      status: "blocked",
      message: "A valid learner profile is required to use the community.",
    };
  if (profile.role !== "student") {
    return {
      status: "blocked",
      message:
        "Community participation is currently limited to eligible student accounts.",
    };
  }
  if (isAccountSuspended(profile)) {
    return {
      status: "blocked",
      message: "This account cannot access the community at this time.",
    };
  }

  const [studentResult, guardianResult, consentResult, parentControlResult] =
    await Promise.all([
      client
        .from("student_details")
        .select("community_enabled")
        .eq("profile_id", user.id)
        .maybeSingle(),
      client
        .from("parent_student_links")
        .select("parent_id,confirmed_at")
        .eq("student_id", user.id)
        .not("confirmed_at", "is", null),
      client
        .from("consent_records")
        .select("guardian_id,granted,withdrawn_at")
        .eq("subject_id", user.id)
        .eq("consent_type", "community"),
      client.rpc("parent_allows_community", { child_id: user.id }),
    ]);

  if (
    studentResult.error ||
    guardianResult.error ||
    consentResult.error ||
    parentControlResult.error
  ) {
    return { status: "error", message: SAFETY_UNAVAILABLE };
  }

  const facts = {
    role: profile.role ?? null,
    suspended:
      typeof profile.is_suspended === "boolean" ? profile.is_suspended : null,
    learnerSettingEnabled:
      typeof studentResult.data?.community_enabled === "boolean"
        ? studentResult.data.community_enabled
        : null,
    parentAccessAllowed:
      typeof parentControlResult.data === "boolean"
        ? parentControlResult.data
        : null,
    confirmedGuardianIds:
      guardianResult.data?.map(link => String(link.parent_id)) ?? null,
    consents:
      consentResult.data?.map(consent => ({
        guardianId:
          consent.guardian_id === null ? null : String(consent.guardian_id),
        granted: consent.granted === true,
        withdrawnAt:
          consent.withdrawn_at === null ? null : String(consent.withdrawn_at),
      })) ?? null,
  };
  const decision = evaluateCommunityAccess(facts);
  if (!decision.allowed) {
    if (decision.reason === "safeguard_unavailable")
      return { status: "error", message: SAFETY_UNAVAILABLE };
    return {
      status: "blocked",
      message:
        "Community access is off until a confirmed parent or guardian has enabled access and active community consent is on file.",
    };
  }

  return { status: "ready", client, profileId: user.id };
}

export async function loadCommunityState(
  selectedChannelId?: string | null
): Promise<CommunityState> {
  const client = await getSupabaseServerClient();
  if (!client) return { status: "error", message: COMMUNITY_UNAVAILABLE };
  const gate = await checkCommunityGate(client);
  if (gate.status !== "ready") return gate;

  const { data: channelRows, error: channelError } = await client
    .from("community_channels")
    .select("id,code,name,description")
    .eq("is_active", true)
    .eq("is_public", true)
    .order("name", { ascending: true })
    .limit(100);
  if (channelError || !channelRows)
    return { status: "error", message: COMMUNITY_UNAVAILABLE };

  const { data: memberRows, error: memberError } = await client
    .from("community_members")
    .select("channel_id,joined_at,rules_accepted_at")
    .eq("profile_id", gate.profileId)
    .limit(100);
  if (memberError || !memberRows)
    return { status: "error", message: COMMUNITY_UNAVAILABLE };

  const memberships = new Set(memberRows.map(row => String(row.channel_id)));
  const channels: CommunityChannel[] = channelRows.map(row => ({
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    description: row.description === null ? null : String(row.description),
    joined: memberships.has(String(row.id)),
  }));

  const preferredChannel =
    selectedChannelId &&
    channels.some(channel => channel.id === selectedChannelId)
      ? selectedChannelId
      : (channels.find(channel => channel.joined)?.id ??
        channels[0]?.id ??
        null);
  const selectedMembership = preferredChannel
    ? memberships.has(preferredChannel)
    : false;
  if (!preferredChannel || !selectedMembership) {
    return {
      status: "ready",
      channels,
      selectedChannelId: preferredChannel,
      messages: [],
      messagesAvailable: false,
      currentProfileId: gate.profileId,
    };
  }

  const { data: messageRows, error: messageError } = await client
    .from("community_messages")
    .select("id,channel_id,sender_id,body,created_at,edited_at")
    .eq("channel_id", preferredChannel)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (messageError || !messageRows)
    return { status: "error", message: COMMUNITY_UNAVAILABLE };

  return {
    status: "ready",
    channels,
    selectedChannelId: preferredChannel,
    messages: messageRows.reverse().map(row => ({
      id: String(row.id),
      channel_id: String(row.channel_id),
      sender_id: String(row.sender_id),
      body: row.body === null ? null : String(row.body),
      created_at: String(row.created_at),
      edited_at: row.edited_at === null ? null : String(row.edited_at),
    })),
    messagesAvailable: true,
    currentProfileId: gate.profileId,
  };
}

export type CommunityAction = "join" | "leave" | "send" | "report";
export type CommunityActionResult =
  | { ok: true; message?: string }
  | {
      ok: false;
      status: "unauthenticated" | "blocked" | "error" | "invalid" | "not_found";
      message: string;
    };

type CommunityActionInput = {
  action?: unknown;
  channelId?: unknown;
  body?: unknown;
  messageId?: unknown;
  reason?: unknown;
  rulesAccepted?: unknown;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REPORT_REASONS = new Set([
  "unsafe content",
  "bullying or harassment",
  "spam",
  "other",
]);

function invalid(message: string): CommunityActionResult {
  return { ok: false, status: "invalid", message };
}

async function activePublicChannel(client: SupabaseClient, channelId: string) {
  const { data, error } = await client
    .from("community_channels")
    .select("id")
    .eq("id", channelId)
    .eq("is_active", true)
    .eq("is_public", true)
    .maybeSingle();
  return !error && data ? String(data.id) : null;
}

async function isMember(
  client: SupabaseClient,
  profileId: string,
  channelId: string
) {
  const { data, error } = await client
    .from("community_members")
    .select("channel_id")
    .eq("profile_id", profileId)
    .eq("channel_id", channelId)
    .maybeSingle();
  return { member: Boolean(data), error: Boolean(error) };
}

export async function performCommunityAction(
  input: CommunityActionInput
): Promise<CommunityActionResult> {
  const client = await getSupabaseServerClient();
  if (!client)
    return { ok: false, status: "error", message: COMMUNITY_UNAVAILABLE };
  const gate = await checkCommunityGate(client);
  if (gate.status !== "ready") {
    return {
      ok: false,
      status: gate.status,
      message:
        gate.status === "unauthenticated"
          ? "Please sign in to continue."
          : gate.message,
    };
  }

  if (
    input.action === "join" ||
    input.action === "leave" ||
    input.action === "send"
  ) {
    if (typeof input.channelId !== "string" || !UUID.test(input.channelId)) {
      return invalid("Choose a valid community channel.");
    }
    const channelId = await activePublicChannel(client, input.channelId);
    if (!channelId)
      return {
        ok: false,
        status: "not_found",
        message: "That active community channel could not be found.",
      };

    if (input.action === "join") {
      if (input.rulesAccepted !== true)
        return invalid(
          "Please read and accept the community rules before joining."
        );
      const membership = await isMember(client, gate.profileId, channelId);
      if (membership.error)
        return { ok: false, status: "error", message: COMMUNITY_UNAVAILABLE };
      if (membership.member)
        return { ok: true, message: "You already joined this channel." };
      const { error } = await client.from("community_members").insert({
        channel_id: channelId,
        profile_id: gate.profileId,
        rules_accepted_at: new Date().toISOString(),
      });
      if (error)
        return {
          ok: false,
          status: "error",
          message:
            "We couldn't join this channel. Your access checks may need review.",
        };
      return { ok: true };
    }

    if (input.action === "leave") {
      const { error } = await client
        .from("community_members")
        .delete()
        .eq("profile_id", gate.profileId)
        .eq("channel_id", channelId);
      if (error)
        return { ok: false, status: "error", message: COMMUNITY_UNAVAILABLE };
      return { ok: true };
    }

    if (typeof input.body !== "string")
      return invalid("Write a message before sending.");
    const body = input.body.trim();
    if (!body || body.length > 2000)
      return invalid("Messages must be between 1 and 2,000 characters.");
    const membership = await isMember(client, gate.profileId, channelId);
    if (membership.error)
      return { ok: false, status: "error", message: COMMUNITY_UNAVAILABLE };
    if (!membership.member)
      return {
        ok: false,
        status: "blocked",
        message: "Join this channel before posting.",
      };
    const { error } = await client.from("community_messages").insert({
      channel_id: channelId,
      sender_id: gate.profileId,
      body,
    });
    if (error)
      return {
        ok: false,
        status: "error",
        message: "We couldn't send that message. Please try again.",
      };
    return { ok: true };
  }

  if (input.action === "report") {
    if (typeof input.messageId !== "string" || !UUID.test(input.messageId)) {
      return invalid("Choose a valid message to report.");
    }
    if (typeof input.reason !== "string" || !REPORT_REASONS.has(input.reason)) {
      return invalid("Choose a reason for reporting this message.");
    }
    const { data: message, error: messageError } = await client
      .from("community_messages")
      .select("id,channel_id")
      .eq("id", input.messageId)
      .is("deleted_at", null)
      .maybeSingle();
    if (messageError)
      return { ok: false, status: "error", message: COMMUNITY_UNAVAILABLE };
    if (!message)
      return {
        ok: false,
        status: "not_found",
        message: "That message is no longer available to report.",
      };
    const channelId = await activePublicChannel(
      client,
      String(message.channel_id)
    );
    if (!channelId)
      return {
        ok: false,
        status: "not_found",
        message: "That message is no longer available to report.",
      };
    const membership = await isMember(client, gate.profileId, channelId);
    if (membership.error)
      return { ok: false, status: "error", message: COMMUNITY_UNAVAILABLE };
    if (!membership.member)
      return {
        ok: false,
        status: "blocked",
        message: "Join the channel before reporting its messages.",
      };

    const { error } = await client.from("message_reports").insert({
      reporter_id: gate.profileId,
      community_message_id: input.messageId,
      reason: input.reason,
    });
    if (error)
      return {
        ok: false,
        status: "error",
        message: "We couldn't submit that report. Please try again.",
      };
    return {
      ok: true,
      message: "Thanks. Your report has been submitted for review.",
    };
  }

  return invalid("That community action is not supported.");
}

export function communityActionHttpStatus(
  result: CommunityActionResult
): number {
  if (result.ok) return 200;
  if (result.status === "unauthenticated") return 401;
  if (result.status === "blocked") return 403;
  if (result.status === "not_found") return 404;
  if (result.status === "invalid") return 400;
  return 503;
}
