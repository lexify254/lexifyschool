import { adminApi, jsonBody } from "@/lib/admin/http";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  isVerificationRequestId,
  parseReviewPayload,
  VerificationInputError,
} from "@/lib/verification/validation";
import { AdminOperationError } from "@/lib/admin/operations";

type Context = { params: Promise<{ requestId: string }> };

export async function POST(request: Request, { params }: Context) {
  return adminApi(async () => {
    const { requestId } = await params;
    if (!isVerificationRequestId(requestId)) {
      throw new AdminOperationError("That verification request could not be identified.");
    }

    const body = await jsonBody(request);
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const action = (body as Record<string, unknown>).action;
      if (action === "continue" || action === "revoke") {
        const awardId = (body as Record<string, unknown>).badgeAwardId;
        if (!isVerificationRequestId(awardId)) {
          throw new AdminOperationError("That badge award could not be identified.");
        }
        const client = await getSupabaseServerClient();
        if (!client) throw new AdminOperationError("Administrator database access is unavailable.", 503);
        const rpc = action === "continue"
          ? "continue_teacher_verification_badge"
          : "revoke_teacher_verification_badge";
        const { data, error } = await client.rpc(rpc, { badge_award_id: awardId });
        if (error) throw new AdminOperationError(error.message, 400);
        return { ok: true, action, changedAt: data };
      }
    }

    let payload;
    try {
      payload = parseReviewPayload(body);
    } catch (error) {
      if (error instanceof VerificationInputError) throw new AdminOperationError(error.message);
      throw error;
    }

    const client = await getSupabaseServerClient();
    if (!client) throw new AdminOperationError("Administrator database access is unavailable.", 503);
    const { error } = await client.rpc("review_teacher_verification_request", {
      request_id: requestId,
      decision: payload.decision,
      note: payload.note,
    });
    if (error) throw new AdminOperationError(error.message, 400);
    const { data: reviewedRequest } = await client
      .from("teacher_verification_requests")
      .select("reviewed_at,teacher_id")
      .eq("id", requestId)
      .maybeSingle();
    const { data: award } = payload.decision === "approved" && reviewedRequest?.teacher_id
      ? await client.from("badge_awards")
          .select("id,awarded_at,expires_at,revoked_at")
          .eq("teacher_id", reviewedRequest.teacher_id)
          .order("awarded_at", { ascending: false }).limit(1).maybeSingle()
      : { data: null };
    return { ok: true, reviewedAt: reviewedRequest?.reviewed_at ?? null, award };
  });
}
