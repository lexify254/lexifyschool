import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { VerificationManager } from "./verification-manager";

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
};

export default async function AdminVerificationPage() {
  await requireAdmin();
  const client = await getSupabaseServerClient();
  let requests: VerificationRow[] = [];
  let names = new Map<string, string>();
  let error: string | null = null;

  if (!client) {
    error = "Administrator database access is unavailable.";
  } else {
    const result = await client
      .from("teacher_verification_requests")
      .select(
        "id,teacher_id,claim_note,status,submitted_at,reviewed_at,review_note"
      )
      .order("submitted_at", { ascending: false })
      .limit(100);
    if (result.error) {
      error =
        "Verification requests could not be loaded. Apply the teacher-verification migration, then reload.";
    } else {
      requests = (result.data ?? []) as VerificationRow[];
      const teacherIds = [
        ...new Set(requests.map(request => request.teacher_id)),
      ];
      if (teacherIds.length) {
        const [profiles, details] = await Promise.all([
          client
            .from("profiles")
            .select("id,full_name")
            .in("id", teacherIds)
            .limit(100),
          client
            .from("teacher_details")
            .select("profile_id,public_name")
            .in("profile_id", teacherIds)
            .limit(100),
        ]);
        if (profiles.error || details.error) {
          error =
            "Teacher names could not be loaded. Check Admin database access and reload.";
        } else {
          names = new Map<string, string>();
          for (const row of (profiles.data ?? []) as {
            id: string;
            full_name: string | null;
          }[]) {
            names.set(row.id, row.full_name || "");
          }
          for (const row of (details.data ?? []) as {
            profile_id: string;
            public_name: string | null;
          }[]) {
            if (row.public_name) names.set(row.profile_id, row.public_name);
          }
        }
      }
    }
  }

  const mapped = requests.map(request => ({
    id: request.id,
    teacherId: request.teacher_id,
    teacherName: names.get(request.teacher_id) || "Teacher",
    claimNote: request.claim_note,
    status: request.status,
    submittedAt: request.submitted_at,
    reviewedAt: request.reviewed_at,
    reviewNote: request.review_note,
  }));
  return (
    <div className="admin-page">
      <header className="admin-heading">
        <div>
          <span className="admin-kicker">Operations · teacher claims</span>
          <h1>Teacher verification</h1>
          <p>
            Review teacher-submitted claims. Approval is an explicit Admin
            decision; submitted requests are never verified automatically.
          </p>
        </div>
      </header>
      <aside className="admin-warning">
        <strong>No fees or payment processing</strong>Teacher verification is
        free and requires an Admin review. Approving a request updates the
        existing teacher verification status and records a badge award;
        rejecting it does not mark the teacher verified.
      </aside>
      {error ? (
        <div className="admin-empty" role="status">
          {error}
        </div>
      ) : (
        <VerificationManager requests={mapped} />
      )}
    </div>
  );
}
