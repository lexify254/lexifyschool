import type { Metadata } from "next";
import {
  PortalFrame,
  PortalHeading,
  PortalUnavailable,
} from "@/components/portal/portal-ui";
import {
  ReceiptManager,
  type SellerReceiptRow,
} from "@/components/receipts/ReceiptManager";
import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sales receipts | Teacher portal" };

export default async function TeacherReceiptsPage() {
  const profile = await requireRole("teacher");
  const supabase = await getSupabaseServerClient();
  if (!supabase) return <PortalUnavailable />;

  const { data, error } = await supabase
    .from("seller_receipts")
    .select(
      "id,receipt_number,public_token,seller_id,seller_name,buyer_name,item_title,item_description,quantity,unit_price_kes,total_kes,currency,created_at"
    )
    .eq("seller_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <PortalFrame
      role="teacher"
      profile={profile}
      activeHref="/teacher/receipts"
    >
      <PortalHeading
        eyebrow="Teacher portal"
        title="Sales receipts"
        description="Issue a seller-reported receipt only after confirming a sale directly with the buyer outside Lexify School."
      />
      {error ? (
        <p className="form-error" role="status">
          Receipt history could not be loaded. You can retry this page later.
        </p>
      ) : null}
      <ReceiptManager
        receipts={(data ?? []) as SellerReceiptRow[]}
        loadError={Boolean(error)}
      />
    </PortalFrame>
  );
}
