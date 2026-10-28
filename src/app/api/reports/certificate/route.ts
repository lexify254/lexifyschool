import { NextResponse } from "next/server";
import { createCertificatePdf } from "@/lib/pdf/documents";
import {
  authorizeLearner,
  readIssuedCertificate,
  ReportRequestError,
} from "@/lib/pdf/report-service";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function safeFilePart(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "course"
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedStudentId = url.searchParams.get("studentId");
    const courseId = url.searchParams.get("courseId");
    if (requestedStudentId && !UUID_PATTERN.test(requestedStudentId))
      return errorResponse("A valid learner ID is required.", 400);
    if (!courseId || !UUID_PATTERN.test(courseId))
      return errorResponse("A valid course ID is required.", 400);

    const client = await getSupabaseServerClient();
    if (!client)
      return errorResponse("Learning services are not configured.", 503);
    const learner = await authorizeLearner(client, requestedStudentId);
    const certificate = await readIssuedCertificate(
      client,
      learner,
      courseId,
      new Date().toISOString()
    );
    const pdf = await createCertificatePdf(certificate);
    const filename = `certificate-${safeFilePart(certificate.courseTitle)}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ReportRequestError)
      return errorResponse(error.message, error.status);
    return errorResponse("The certificate record could not be rendered.", 500);
  }
}
