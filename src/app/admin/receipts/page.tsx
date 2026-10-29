import type { Metadata } from "next";
import {
  ReceiptManager,
  type SellerReceiptRow,
} from "@/components/receipts/ReceiptManager";
import { requireAdmin } from "@/lib/auth/guards";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Seller receipts | Admin" };

export default async function AdminReceiptsPage() {
  await requireAdmin();
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return (
      <section className="empty-state" role="status">
        <h1>Receipt service unavailable</h1>
        <p>The Supabase backend is not configured for this deployment.</p>
      </section>
    );
  }

  const { data, error } = await supabase
    .from("seller_receipts")
    .select(
      "id,receipt_number,public_token,seller_id,seller_name,buyer_name,item_title,item_description,quantity,unit_price_kes,total_kes,currency,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="admin-page">
      <header className="admin-heading">
        <div>
          <span className="admin-kicker">Seller records</span>
          <h1>Seller receipts</h1>
          <p>
            Review seller-reported receipts for external sales and issue a
            Lexify School receipt only after confirming an off-platform sale.
            This page does not record payment status or process payments.
          </p>
        </div>
      </header>
      {error ? (
        <p className="form-error" role="status">
          Receipt history could not be loaded. Please retry later.
        </p>
      ) : null}
      <ReceiptManager
        receipts={(data ?? []) as SellerReceiptRow[]}
        isAdmin
        loadError={Boolean(error)}
      />
    </div>
  );
}
