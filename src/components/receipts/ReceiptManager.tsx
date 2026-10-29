"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "./receipts.module.css";

export type SellerReceiptRow = {
  id: string;
  receipt_number: string;
  seller_id?: string;
  seller_name: string;
  buyer_name: string | null;
  item_title: string;
  item_description: string | null;
  quantity: number;
  unit_price_kes: number | string;
  total_kes: number | string;
  currency: string;
  created_at: string;
  public_token: string;
};

function kes(value: number | string) {
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

function dateLabel(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-KE", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(parsed);
}

export function ReceiptManager({
  receipts,
  isAdmin = false,
  loadError = false,
}: {
  receipts: SellerReceiptRow[];
  isAdmin?: boolean;
  loadError?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [latestDownload, setLatestDownload] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError("");
    setNotice("");
    setLatestDownload(null);
    setSaving(true);

    const form = new FormData(formElement);
    const payload = {
      buyerName: String(form.get("buyerName") ?? ""),
      itemTitle: String(form.get("itemTitle") ?? ""),
      itemDescription: String(form.get("itemDescription") ?? ""),
      quantity: Number(form.get("quantity")),
      unitPriceKes: Number(form.get("unitPriceKes")),
      confirmedExternalSale: form.get("confirmedExternalSale") === "on",
    };

    try {
      const response = await fetch("/api/receipts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.receiptId || !result?.receiptNumber) {
        setError(
          typeof result?.error === "string"
            ? result.error
            : "The receipt could not be created. Check the details and try again."
        );
        return;
      }
      setLatestDownload(String(result.receiptId));
      setNotice(`Receipt ${String(result.receiptNumber)} was created.`);
      formElement.reset();
      router.refresh();
    } catch {
      setError(
        "The receipt service could not be reached. Check your connection and try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.manager}>
      <section
        className={styles.formPanel}
        aria-labelledby="receipt-create-title"
      >
        <h2 id="receipt-create-title">Issue a seller receipt</h2>
        <p>
          Use this only after you have independently confirmed that the sale was
          completed outside Lexify School. The platform does not process or
          verify payment. Buyer name is optional; do not enter a buyer phone
          number or other unnecessary personal information. Review the details
          before issuing; saved receipts are not editable.
        </p>
        <form className={styles.form} onSubmit={submit}>
          <div className={styles.fields}>
            <label className={styles.field}>
              Item or service <span aria-hidden="true">*</span>
              <input
                name="itemTitle"
                required
                maxLength={180}
                autoComplete="off"
                placeholder="e.g. Grade 10 Chemistry tutoring"
              />
            </label>
            <label className={styles.field}>
              Buyer name (optional)
              <input
                name="buyerName"
                maxLength={120}
                autoComplete="off"
                placeholder="Leave blank if not needed"
              />
            </label>
            <label className={styles.field}>
              Quantity <span aria-hidden="true">*</span>
              <input
                name="quantity"
                type="number"
                min="1"
                max="1000"
                step="1"
                defaultValue="1"
                required
              />
            </label>
            <label className={styles.field}>
              Unit price (KES) <span aria-hidden="true">*</span>
              <input
                name="unitPriceKes"
                type="number"
                min="0"
                max="10000000"
                step="0.01"
                required
              />
            </label>
          </div>
          <label className={`${styles.field} ${styles.description}`}>
            Description (optional)
            <textarea
              name="itemDescription"
              maxLength={400}
              rows={3}
              placeholder="Add only useful sale details; do not include sensitive payment information."
            />
          </label>
          <label className={styles.confirmation}>
            <input name="confirmedExternalSale" type="checkbox" required />
            <span>
              I confirm that this sale was completed directly with the buyer
              outside Lexify School, and that the receipt details are accurate.
            </span>
          </label>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className={styles.success} role="status">
              {notice}
            </p>
          ) : null}
          <div className={styles.actions}>
            <button
              className="button button--blue"
              type="submit"
              disabled={saving}
            >
              {saving ? "Creating receipt…" : "Create receipt PDF"}
            </button>
            {latestDownload ? (
              <a
                className="button button--line"
                href={`/api/receipts/${encodeURIComponent(latestDownload)}/pdf`}
              >
                Download PDF
              </a>
            ) : null}
          </div>
        </form>
      </section>

      <section aria-labelledby="receipt-history-title">
        <div className={styles.listHeading}>
          <div>
            <h2 id="receipt-history-title">Issued receipts</h2>
            <p>
              {isAdmin
                ? "All seller-reported receipts"
                : "Receipts issued by your seller account"}
            </p>
          </div>
        </div>
        {loadError ? (
          <div className={styles.empty} role="status">
            Receipt history is temporarily unavailable. You can retry this page
            later.
          </div>
        ) : receipts.length ? (
          <div className={styles.list}>
            {receipts.map(receipt => (
              <article className={styles.receiptCard} key={receipt.id}>
                <div className={styles.receiptTop}>
                  <div>
                    <strong>{receipt.receipt_number}</strong>
                    <span>{dateLabel(receipt.created_at)}</span>
                  </div>
                  <strong className={styles.total}>
                    {kes(receipt.total_kes)}
                  </strong>
                </div>
                {isAdmin ? (
                  <p className={styles.seller}>Seller: {receipt.seller_name}</p>
                ) : null}
                <p className={styles.item}>{receipt.item_title}</p>
                {receipt.item_description ? (
                  <p>{receipt.item_description}</p>
                ) : null}
                <p className={styles.detail}>
                  Quantity {receipt.quantity} · {kes(receipt.unit_price_kes)}{" "}
                  per item
                  {receipt.buyer_name
                    ? ` · Buyer: ${receipt.buyer_name}`
                    : " · Buyer name not provided"}
                </p>
                <div className={styles.actions}>
                  <a
                    className="button button--line button--small"
                    href={`/api/receipts/${encodeURIComponent(receipt.id)}/pdf`}
                  >
                    Download PDF
                  </a>
                  <a
                    className={styles.verifyLink}
                    href={`/receipts/verify/${encodeURIComponent(receipt.public_token)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Public QR verification
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            No receipts have been issued yet. Receipts are created manually
            after a seller confirms an external sale.
          </div>
        )}
      </section>
    </div>
  );
}
