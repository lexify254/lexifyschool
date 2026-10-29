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
      throw new AdminOperationError(
        "That verification request could not be identified."
      );
    }

    const body = await jsonBody(request);
    let payload;
    try {
      payload = parseReviewPayload(body);
    } catch (error) {
      if (error instanceof VerificationInputError) {
        throw new AdminOperationError(error.message);
      }
      throw error;
    }

    const client = await getSupabaseServerClient();
    if (!client)
      throw new AdminOperationError(
        "Administrator database access is unavailable.",
        503
      );
    const { error } = await client.rpc("review_teacher_verification_request", {
      request_id: requestId,
      decision: payload.decision,
      note: payload.note,
    });
    if (error) throw new AdminOperationError(error.message, 400);
    const { data: reviewedRequest } = await client
      .from("teacher_verification_requests")
      .select("reviewed_at")
      .eq("id", requestId)
      .maybeSingle();
    return { ok: true, reviewedAt: reviewedRequest?.reviewed_at ?? null };
  });
}
