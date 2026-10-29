import { getSupabaseServerClient } from "@/lib/supabase/server";
import { createSellerReceiptPdf } from "@/lib/pdf/seller-receipt";
import { getPublicSiteOrigin } from "@/lib/site/public-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorResponse(status: number, message: string) {
  return new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ receiptId: string }> }
) {
  const { receiptId } = await params;
  if (!UUID_PATTERN.test(receiptId))
    return errorResponse(404, "Receipt not found.");

  const supabase = await getSupabaseServerClient();
  if (!supabase)
    return errorResponse(503, "Receipt service is not configured.");

  const { data: receipt, error } = await supabase
    .from("seller_receipts")
    .select(
      "id,receipt_number,public_token,seller_id,seller_name,buyer_name,item_title,item_description,quantity,unit_price_kes,total_kes,currency,created_at"
    )
    .eq("id", receiptId)
    .maybeSingle();
  if (error) {
    console.warn(
      `[Lexify] Seller receipt read failed (${error.code ?? "query"}).`
    );
    return errorResponse(503, "Receipt could not be loaded right now.");
  }
  if (!receipt) return errorResponse(404, "Receipt not found.");

  try {
    const verificationUrl = new URL(
      `/receipts/verify/${encodeURIComponent(String(receipt.public_token))}`,
      getPublicSiteOrigin()
    ).toString();
    const pdf = await createSellerReceiptPdf({
      receiptNumber: String(receipt.receipt_number),
      sellerName: String(receipt.seller_name),
      buyerName:
        typeof receipt.buyer_name === "string" ? receipt.buyer_name : undefined,
      itemTitle: String(receipt.item_title),
      itemDescription:
        typeof receipt.item_description === "string"
          ? receipt.item_description
          : undefined,
      quantity: Number(receipt.quantity),
      unitPriceKes: Number(receipt.unit_price_kes),
      totalKes: Number(receipt.total_kes),
      issuedAt: String(receipt.created_at),
      verificationUrl,
    });
    const safeNumber = String(receipt.receipt_number).replace(
      /[^a-z0-9_-]/gi,
      "-"
    );
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="lexify-receipt-${safeNumber}.pdf"`,
        "cache-control": "private, no-store",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return errorResponse(503, "Receipt PDF could not be generated right now.");
  }
}
