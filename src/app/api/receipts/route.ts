import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length <= maxLength ? text : null;
}

function errorResponse(status: number, message: string) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "cache-control": "private, no-store" } }
  );
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 12_000) {
    return errorResponse(413, "Receipt details are too large.");
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return errorResponse(400, "Receipt details must be a JSON object.");
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return errorResponse(400, "Receipt details could not be read.");
  }

  if (body.confirmedExternalSale !== true) {
    return errorResponse(
      400,
      "Confirm that the sale was completed directly outside Lexify School before issuing a receipt."
    );
  }

  const itemTitle = cleanText(body.itemTitle, 180);
  const itemDescription = cleanText(body.itemDescription ?? "", 400);
  const buyerName = cleanText(body.buyerName ?? "", 120);
  const quantity = Number(body.quantity);
  const unitPriceKes = Number(body.unitPriceKes);
  if (!itemTitle) {
    return errorResponse(
      400,
      "Enter an item or service name up to 180 characters."
    );
  }
  if (itemDescription === null || buyerName === null) {
    return errorResponse(
      400,
      "Optional receipt details are too long or invalid."
    );
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
    return errorResponse(
      400,
      "Quantity must be a whole number between 1 and 1,000."
    );
  }
  if (
    !Number.isFinite(unitPriceKes) ||
    unitPriceKes < 0 ||
    unitPriceKes > 10_000_000
  ) {
    return errorResponse(
      400,
      "Unit price must be between KES 0 and KES 10,000,000."
    );
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return errorResponse(503, "The receipt service is not configured.");
  }

  const { data, error } = await (supabase as any).rpc("create_seller_receipt", {
    p_confirm_external_sale: true,
    p_buyer_name: buyerName || null,
    p_item_title: itemTitle,
    p_item_description: itemDescription || null,
    p_quantity: quantity,
    p_unit_price_kes: unitPriceKes,
  });

  if (error) {
    const status =
      error.code === "42501" ? 403 : error.code === "22023" ? 400 : 503;
    console.warn(
      `[Lexify] Seller receipt creation failed (${error.code ?? "database"}).`
    );
    return errorResponse(
      status,
      status === 403
        ? "Only an active teacher or administrator can issue a seller receipt."
        : status === 400
          ? "Receipt details were rejected. Check the item, quantity, and price."
          : "The receipt service is temporarily unavailable. Please try again later."
    );
  }

  const record = Array.isArray(data) ? data[0] : data;
  if (
    !record ||
    typeof record.id !== "string" ||
    typeof record.receipt_number !== "string"
  ) {
    return errorResponse(
      503,
      "The receipt was not returned by the receipt service."
    );
  }

  return NextResponse.json(
    {
      receiptId: record.id,
      receiptNumber: record.receipt_number,
      pdfUrl: `/api/receipts/${encodeURIComponent(record.id)}/pdf`,
    },
    { headers: { "cache-control": "private, no-store" } }
  );
}
