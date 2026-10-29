import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/guards";
import { isAccountSuspended } from "@/lib/auth/suspension";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  parseVerificationNote,
  VerificationInputError,
} from "@/lib/verification/validation";

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile)
    return NextResponse.json(
      { error: "Sign in to continue." },
      { status: 401 }
    );
  if (profile.role !== "teacher" || isAccountSuspended(profile)) {
    return NextResponse.json(
      { error: "An active teacher account is required." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Claim details must be an object." },
      { status: 400 }
    );
  }

  try {
    const note = parseVerificationNote((body as Record<string, unknown>).note);
    const client = await getSupabaseServerClient();
    if (!client)
      return NextResponse.json(
        { error: "Verification requests are temporarily unavailable." },
        { status: 503 }
      );
    const { error } = await client.rpc("submit_teacher_verification_request", {
      note,
    });
    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof VerificationInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "The request could not be submitted. Please try again." },
      { status: 500 }
    );
  }
}
