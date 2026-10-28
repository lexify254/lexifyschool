import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { AdminOperationError } from "@/lib/admin/operations";

export async function adminApi<T>(work: () => Promise<T>, successStatus = 200) {
  // Keep this outside the catch: requireAdmin intentionally throws Next's plain 404 for non-admins.
  await requireAdmin();
  try {
    return NextResponse.json({ data: await work() }, { status: successStatus });
  } catch (error) {
    if (error instanceof AdminOperationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "The administrator operation could not be completed." }, { status: 500 });
  }
}
export async function jsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AdminOperationError("Request body must be valid JSON.");
  }
}
