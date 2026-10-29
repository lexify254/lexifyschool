import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Receipt verification | Lexify School",
  robots: { index: false, follow: false },
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function kes(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: "KES",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount)
    : "Amount unavailable";
}

function dateLabel(value: unknown) {
  const date = new Date(String(value));
  return Number.isNaN(date.valueOf())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-KE", {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(date);
}

export default async function ReceiptVerificationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!UUID_PATTERN.test(token)) notFound();
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return (
      <main className="page-content">
        <div className="container">
          <section className="empty-state" role="status">
            <h1>Receipt verification is temporarily unavailable</h1>
            <p>
              Please try again later. No buyer details are displayed on this
              page.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const { data, error } = await (supabase as any).rpc("verify_seller_receipt", {
    p_token: token,
  });
  if (error) {
    console.warn(
      `[Lexify] Public receipt verification failed (${error.code ?? "query"}).`
    );
    return (
      <main className="page-content">
        <div className="container">
          <section className="empty-state" role="status">
            <h1>Receipt verification is temporarily unavailable</h1>
            <p>
              Please try again later. No buyer details are displayed on this
              page.
            </p>
          </section>
        </div>
      </main>
    );
  }
  const receipt = Array.isArray(data) ? data[0] : data;
  if (!receipt) notFound();

  return (
    <main className="page-content">
      <div className="container">
        <section
          className="detail-hero"
          aria-labelledby="receipt-verified-title"
        >
          <div>
            <span className="section-kicker">Lexify School record</span>
            <h1 id="receipt-verified-title">Seller receipt record found</h1>
            <p>
              The information below matches a seller-issued record in Lexify
              School. Lexify did not process or independently verify a payment;
              this record is not a tax invoice.
            </p>
          </div>
          <aside className="detail-aside">
            <strong>Receipt number</strong>
            <p>{String(receipt.receipt_number)}</p>
          </aside>
        </section>
        <section className="content-card" aria-label="Public receipt details">
          <dl className="details-list">
            <dt>Seller</dt>
            <dd>{String(receipt.seller_name)}</dd>
            <dt>Item or service</dt>
            <dd>{String(receipt.item_title)}</dd>
            <dt>Reported total</dt>
            <dd>{kes(receipt.total_kes)}</dd>
            <dt>Issue date</dt>
            <dd>{dateLabel(receipt.issued_at)}</dd>
          </dl>
        </section>
        <p className="disclaimer">
          Buyer names and contact details are intentionally not available on the
          public verification page. Confirm the underlying sale directly with
          the seller if you have questions.
        </p>
      </div>
    </main>
  );
}
