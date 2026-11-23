"use client";

import { useState } from "react";
import { formatVerificationFee, type VerificationFee } from "@/lib/verification/pricing";

export function VerificationPricing({ initialFee }: { initialFee: VerificationFee }) {
  const [amount, setAmount] = useState(initialFee.configured && initialFee.amount !== null ? String(initialFee.amount) : "");
  const [fee, setFee] = useState(initialFee);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/verification-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const result = await response.json() as { data?: VerificationFee; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error || "Pricing could not be saved.");
      setFee(result.data);
      setAmount(result.data.configured && result.data.amount !== null ? String(result.data.amount) : "");
      setMessage({ text: "Verification pricing saved.", ok: true });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Pricing could not be saved.", ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-record" aria-labelledby="verification-pricing-heading">
      <div className="admin-record__head">
        <div>
          <h2 id="verification-pricing-heading">Verification fee</h2>
          <p>Current setting: <strong>{formatVerificationFee(fee)}</strong></p>
        </div>
      </div>
      <form className="admin-form admin-form--content" onSubmit={save}>
        <div className="admin-field">
          <label htmlFor="verification-fee">Fee after the 14-day free trial (KES)</label>
          <input id="verification-fee" name="amount" type="number" min="0.01" max="999999999.99" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} />
          <small>Leave blank and save to clear the fee. No default is assumed.</small>
        </div>
        <button className="admin-submit" type="submit" disabled={busy}>{busy ? "Saving…" : "Save fee setting"}</button>
        {message ? <p className="admin-form-message" data-ok={message.ok} role="status" aria-live="polite">{message.text}</p> : null}
      </form>
      <p className="admin-table-note">Requests snapshot the configured amount. Lexify School does not collect cards, process checkout, bill automatically, or track payment status. Any fee arrangement is outside Lexify School.</p>
    </section>
  );
}
