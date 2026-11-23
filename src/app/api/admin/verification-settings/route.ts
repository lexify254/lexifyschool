import { NextResponse } from "next/server";
import { adminApi } from "@/lib/admin/http";
import { AdminOperationError } from "@/lib/admin/operations";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { parseVerificationFeeInput } from "@/lib/verification/pricing";

export async function GET() {
  return adminApi(async () => {
    const client = await getSupabaseServerClient();
    if (!client) throw new AdminOperationError("Administrator database access is unavailable.", 503);
    const { data, error } = await client.rpc("get_admin_teacher_verification_fee");
    if (error) throw new AdminOperationError("Verification pricing could not be loaded.", 503);
    return data;
  });
}

export async function POST(request: Request) {
  return adminApi(async () => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AdminOperationError("Request body must be valid JSON.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body) || !("amount" in body)) {
      throw new AdminOperationError("Provide an amount or leave it blank to clear the fee.");
    }
    let amount: number | null;
    try {
      amount = parseVerificationFeeInput((body as { amount: unknown }).amount);
    } catch (error) {
      throw new AdminOperationError(error instanceof Error ? error.message : "Enter a valid fee amount.");
    }
    const client = await getSupabaseServerClient();
    if (!client) throw new AdminOperationError("Administrator database access is unavailable.", 503);
    const { data, error } = await client.rpc("set_admin_teacher_verification_fee", {
      amount,
      currency: "KES",
    });
    if (error) throw new AdminOperationError(error.message, 400);
    return data;
  });
}
