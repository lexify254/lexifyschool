import { NextResponse } from "next/server";
import {
  buildProjectInquiryMessage,
  formatProjectPrice,
  type ProjectRow,
} from "@/lib/data/projects";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { whatsappHref } from "@/lib/whatsapp/links";
import {
  isWhatsAppHandoffItemId,
  isWhatsAppHandoffKind,
  type WhatsAppHandoffKind,
} from "@/lib/whatsapp/handoff";

type Row = Record<string, any>;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function unavailable(status: number, message: string) {
  const safeMessage = message.replace(/[<>]/g, "");
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WhatsApp contact unavailable | Lexify School</title><body style="font-family:Arial,sans-serif;max-width:42rem;margin:4rem auto;padding:0 1.25rem;color:#17243a"><main><h1>WhatsApp contact unavailable</h1><p>${safeMessage}</p><p><a href="/">Return to Lexify School</a></p></main></body></html>`,
    {
      status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "private, no-store",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
      },
    }
  );
}

async function readTeacherContact(client: any, teacherId: string) {
  const { data, error } = await client
    .from("teacher_details")
    .select("profile_id,public_name,public_whatsapp,is_accepting_students")
    .eq("profile_id", teacherId)
    .eq("is_accepting_students", true)
    .maybeSingle();
  if (error) {
    console.warn(
      `[Lexify] WhatsApp seller lookup failed (${error.code ?? "query"}).`
    );
    return null;
  }
  return (data as Row | null) ?? null;
}

async function resolveDestination(
  client: any,
  kind: WhatsAppHandoffKind,
  itemId: string
): Promise<string | null> {
  if (kind === "teacher_profile") {
    const teacher = await readTeacherContact(client, itemId);
    if (!teacher) return null;
    const name = String(teacher.public_name || "Lexify teacher");
    return whatsappHref(
      typeof teacher.public_whatsapp === "string"
        ? teacher.public_whatsapp
        : null,
      `Hello ${name}, I found your teacher profile on Lexify School and would like to ask about your classes. This is an enquiry only; Lexify School does not take payment or confirm a booking.`
    );
  }

  if (kind === "class") {
    const { data: classRow, error } = await client
      .from("public_class_listings")
      .select("id,title,teacher_id,is_active,is_published")
      .eq("id", itemId)
      .eq("is_active", true)
      .eq("is_published", true)
      .maybeSingle();
    if (error || !classRow) return null;
    const teacher = await readTeacherContact(
      client,
      String(classRow.teacher_id)
    );
    if (!teacher) return null;
    const name = String(teacher.public_name || "the teacher");
    const title = String(classRow.title || "the class");
    return whatsappHref(
      typeof teacher.public_whatsapp === "string"
        ? teacher.public_whatsapp
        : null,
      `Hello ${name}, I found “${title}” on Lexify School and would like to ask about its availability and current pricing. This is an enquiry only; no booking or payment is made through Lexify School.`
    );
  }

  if (kind === "course") {
    const { data: course, error } = await client
      .from("courses")
      .select("id,code,title,instructor_id,status")
      .eq("id", itemId)
      .eq("status", "published")
      .maybeSingle();
    if (error || !course) return null;
    const title = String(course.title || "the course");
    const instructorId =
      typeof course.instructor_id === "string" ? course.instructor_id : null;
    const teacher = instructorId
      ? await readTeacherContact(client, instructorId)
      : null;
    if (instructorId && !teacher) return null;
    const sellerName = String(teacher?.public_name || "Lexify School");
    const phone = instructorId
      ? teacher?.public_whatsapp
      : process.env.WHATSAPP_ADMIN_NUMBER;
    return whatsappHref(
      typeof phone === "string" ? phone : null,
      `Hello ${sellerName}, I found the ${title} course on Lexify School and would like to ask about its availability, course access, and current price. This is an enquiry only; Lexify School does not take payment or grant access from this chat.`
    );
  }

  const { data: product, error } = await client
    .from("products")
    .select(
      "id,code,title,price_kes,sale_price_kes,sale_starts_at,sale_ends_at,is_free,status"
    )
    .eq("id", itemId)
    .eq("status", "published")
    .maybeSingle();
  if (error || !product) return null;
  const title = String(product.title || "this resource");
  const code = String(product.code || "not listed");
  const listedPrice = formatProjectPrice(product as ProjectRow);
  const message = buildProjectInquiryMessage({ code, title, listedPrice });
  return whatsappHref(process.env.WHATSAPP_ADMIN_NUMBER, message);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kindValue = url.searchParams.get("kind");
  const itemId = url.searchParams.get("id");
  if (!isWhatsAppHandoffKind(kindValue) || !isWhatsAppHandoffItemId(itemId)) {
    return unavailable(
      404,
      "This listing no longer has a valid WhatsApp contact link."
    );
  }

  const client = await getSupabaseServerClient();
  if (!client) {
    return unavailable(
      503,
      "The listing and seller could not be checked right now. Please return and try again later."
    );
  }

  try {
    const destination = await resolveDestination(client, kindValue, itemId);
    if (!destination) {
      return unavailable(
        503,
        "The seller has not configured a valid WhatsApp number for this listing."
      );
    }

    const target = new URL(destination);
    if (
      target.protocol !== "https:" ||
      target.hostname !== "wa.me" ||
      !/^\d{8,15}$/.test(target.pathname.replace(/^\//, ""))
    ) {
      return unavailable(
        503,
        "The seller WhatsApp contact could not be validated."
      );
    }

    // Eligibility is checked independently from the best-effort counter so a
    // suspended or reclassified seller never receives a new handoff.
    const { data: eligibilityRows, error: eligibilityError } = await (
      client as any
    ).rpc("resolve_whatsapp_handoff", {
      p_item_type: kindValue,
      p_item_id: itemId,
    });
    if (eligibilityError) {
      console.warn(
        `[Lexify] WhatsApp seller eligibility check failed (${eligibilityError.code ?? "rpc"}).`
      );
      return unavailable(
        503,
        "The listing and seller could not be verified right now. Please try again later."
      );
    }
    const eligibility = Array.isArray(eligibilityRows)
      ? eligibilityRows[0]
      : eligibilityRows;
    if (eligibility?.eligible !== true) {
      return unavailable(
        404,
        "This listing or seller is no longer eligible for WhatsApp inquiries."
      );
    }

    // The counter rechecks eligibility atomically. If that recheck rejects the
    // listing, block it; transient logging errors do not block an already
    // verified seller chat.
    const { data: recorded, error: recordingError } = await (client as any).rpc(
      "record_whatsapp_handoff",
      {
        p_item_type: kindValue,
        p_item_id: itemId,
      }
    );
    if (!recordingError && recorded !== true) {
      return unavailable(
        404,
        "This listing or seller is no longer eligible for WhatsApp inquiries."
      );
    }
    if (recordingError) {
      console.warn("[Lexify] WhatsApp handoff count was not recorded.");
    }

    const response = NextResponse.redirect(target, 302);
    response.headers.set("cache-control", "private, no-store");
    response.headers.set("referrer-policy", "no-referrer");
    return response;
  } catch {
    return unavailable(
      503,
      "The WhatsApp handoff could not be completed right now. Please try again later."
    );
  }
}
