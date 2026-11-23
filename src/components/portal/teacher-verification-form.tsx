"use client";

import { useState, type FormEvent } from "react";
import styles from "./portal.module.css";
import { formatVerificationFee } from "@/lib/verification/pricing";

export function TeacherVerificationForm({
  disabled = false,
  feeConfigured = false,
  feeAmount = null,
  feeSnapshot = null,
  feeCurrency = "KES",
}: {
  disabled?: boolean;
  feeConfigured?: boolean;
  feeAmount?: number | null;
  feeSnapshot?: number | null;
  feeCurrency?: string;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const fee = { configured: feeConfigured, amount: feeAmount, currency: feeCurrency as "KES" };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || disabled || !feeConfigured) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/teacher/verification-requests", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Your request could not be submitted.");
      setNote("");
      setSubmitted(true);
      setMessage({ text: "Your request is submitted. An Admin will review it; verification is not automatic.", ok: true });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Your request could not be submitted. Please try again.", ok: false });
    } finally { setBusy(false); }
  }

  return <section className={`portal-panel ${styles.verificationForm}`} aria-labelledby="verification-request-heading">
    <span className="section-kicker">Teacher verification</span>
    <h2 id="verification-request-heading">Request a verification review</h2>
    <p>Verification may help students and parents recognize your profile; it does not guarantee inquiries.</p>
    <p><strong>Fee after the two-week (14-day) free trial:</strong> {formatVerificationFee(fee)}.</p>
    {feeSnapshot !== null ? <p>Your submitted request snapshots a fee of <strong>{new Intl.NumberFormat("en-KE", { style: "currency", currency: feeCurrency, maximumFractionDigits: 2 }).format(feeSnapshot)}</strong>.</p> : null}
    <p>Trial starts only if an Admin approves your request. Any fee arrangement is outside Lexify School; no checkout, card collection, automatic billing, or payment-status tracking is provided here.</p>
    {!feeConfigured ? <p role="status">An Admin has not configured the fee yet. You can request verification once pricing is configured.</p> : null}
    {submitted ? <p className="form-success" role="status" aria-live="polite">Your request is under Admin review. Verification is not automatic.</p> : <form onSubmit={submit}>
      <label htmlFor="verification-claim-note">Optional note for the Admin</label>
      <textarea id="verification-claim-note" name="note" value={note} onChange={event => setNote(event.target.value)} maxLength={2000} rows={4} aria-describedby="verification-note-help" disabled={busy || disabled || !feeConfigured} />
      <small id="verification-note-help">Share relevant context if helpful. Do not include passwords or sensitive personal documents. Up to 2000 characters.</small>
      <button className="button button--blue button--small" type="submit" disabled={busy || disabled || !feeConfigured}>{busy ? "Submitting…" : feeConfigured ? "Submit for Admin review" : "Pricing not configured"}</button>
      {message ? <p className={message.ok ? "form-success" : "form-error"} role="status" aria-live="polite">{message.text}</p> : null}
    </form>}
  </section>;
}
