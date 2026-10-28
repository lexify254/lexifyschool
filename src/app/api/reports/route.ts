import { NextResponse } from "next/server";
import { createLearningReportPdf } from "@/lib/pdf/documents";
import {
  authorizeLearner,
  readLearningReport,
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
      .slice(0, 60) || "learner"
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedStudentId = url.searchParams.get("studentId");
    if (requestedStudentId && !UUID_PATTERN.test(requestedStudentId))
      return errorResponse("A valid learner ID is required.", 400);

    const client = await getSupabaseServerClient();
    if (!client)
      return errorResponse("Learning services are not configured.", 503);
    const learner = await authorizeLearner(client, requestedStudentId);
    const generatedAt = new Date().toISOString();
    const report = await readLearningReport(client, learner, generatedAt);
    const pdf = await createLearningReportPdf(report);
    const filename = `learning-report-${safeFilePart(learner.learnerName)}.pdf`;
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
    return errorResponse("The learning report could not be generated.", 500);
  }
}
