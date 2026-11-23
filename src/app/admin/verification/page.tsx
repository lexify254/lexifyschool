import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { VerificationFee } from "@/lib/verification/pricing";
import { VerificationManager } from "./verification-manager";
import { VerificationPricing } from "./verification-pricing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Teacher verification review" };

type VerificationRow = {
  id: string;
  teacher_id: string;
  claim_note: string | null;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  fee_snapshot: number | string | null;
  fee_currency: string | null;
};
type BadgeRow = {
  id: string;
  teacher_id: string;
  awarded_at: string;
  expires_at: string | null;
  revoked_at: string | null;
};

export default async function AdminVerificationPage() {
  await requireAdmin();
  const client = await getSupabaseServerClient();
  let requests: VerificationRow[] = [];
  let names = new Map<string, string>();
  let badges = new Map<string, BadgeRow>();
  let error: string | null = null;
  let fee: VerificationFee = { configured: false, amount: null, currency: "KES" };

  if (!client) {
    error = "Administrator database access is unavailable.";
  } else {
    const [result, feeResult] = await Promise.all([
      client.from("teacher_verification_requests")
        .select("id,teacher_id,claim_note,status,submitted_at,reviewed_at,review_note,fee_snapshot,fee_currency")
        .order("submitted_at", { ascending: false }).limit(100),
      client.rpc("get_admin_teacher_verification_fee"),
    ]);
    if (result.error) {
      error = "Verification requests could not be loaded. Apply the local teacher-verification pricing migration, then reload.";
    } else {
      requests = (result.data ?? []) as VerificationRow[];
      const teacherIds = [...new Set(requests.map(request => request.teacher_id))];
      if (teacherIds.length) {
        const [profiles, details, awards] = await Promise.all([
          client.from("profiles").select("id,full_name").in("id", teacherIds).limit(100),
          client.from("teacher_details").select("profile_id,public_name").in("profile_id", teacherIds).limit(100),
          client.from("badge_awards").select("id,teacher_id,awarded_at,expires_at,revoked_at").in("teacher_id", teacherIds).order("awarded_at", { ascending: false }).limit(200),
        ]);
        if (profiles.error || details.error || awards.error) {
          error = "Teacher review details could not be loaded. Check Admin database access and reload.";
        } else {
          for (const row of (profiles.data ?? []) as { id: string; full_name: string | null }[]) names.set(row.id, row.full_name || "");
          for (const row of (details.data ?? []) as { profile_id: string; public_name: string | null }[]) if (row.public_name) names.set(row.profile_id, row.public_name);
          for (const award of (awards.data ?? []) as BadgeRow[]) if (!badges.has(award.teacher_id)) badges.set(award.teacher_id, award);
        }
      }
    }
    if (feeResult.error) {
      error = error ?? "Fee configuration could not be loaded. Apply the local teacher-verification pricing migration, then reload.";
    } else if (feeResult.data && typeof feeResult.data === "object") {
      const value = feeResult.data as { configured?: boolean; amount?: number | string | null; currency?: string };
      const amount = value.amount == null ? null : Number(value.amount);
      fee = { configured: value.configured === true && amount !== null && Number.isFinite(amount), amount, currency: "KES" };
    }
  }

  const mapped = requests.map(request => {
    const badge = badges.get(request.teacher_id);
    return {
      id: request.id,
      teacherId: request.teacher_id,
      teacherName: names.get(request.teacher_id) || "Teacher",
      claimNote: request.claim_note,
      status: request.status,
      submittedAt: request.submitted_at,
      reviewedAt: request.reviewed_at,
      reviewNote: request.review_note,
      feeSnapshot: request.fee_snapshot === null ? null : Number(request.fee_snapshot),
      feeCurrency: request.fee_currency || "KES",
      latestBadge: badge ? { id: badge.id, awardedAt: badge.awarded_at, expiresAt: badge.expires_at, revokedAt: badge.revoked_at } : null,
    };
  });
  return (
    <div className="admin-page">
      <header className="admin-heading"><div>
        <span className="admin-kicker">Operations · teacher claims</span>
        <h1>Teacher verification</h1>
        <p>Review teacher-submitted claims. A badge begins a 14-day free trial only when an Admin approves the request.</p>
      </div></header>
      <VerificationPricing initialFee={fee} />
      <aside className="admin-warning"><strong>No checkout or payment tracking</strong>Fees are only informational configuration for an outside-platform arrangement. Lexify School does not process payment, collect card details, bill automatically, or record payment status. Admins manually continue or revoke badges.</aside>
      {error ? <div className="admin-empty" role="status">{error}</div> : <VerificationManager requests={mapped} />}
    </div>
  );
}
