"use client";

import { useState, type FormEvent } from "react";
import styles from "./portal.module.css";

export function TeacherVerificationForm({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(
    null
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || disabled) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/teacher/verification-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error || "Your request could not be submitted.");
      setNote("");
      setSubmitted(true);
      setMessage({
        text: "Your request is submitted. An Admin will review it; verification is not automatic.",
        ok: true,
      });
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : "Your request could not be submitted. Please try again.",
        ok: false,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={`portal-panel ${styles.verificationForm}`}
      aria-labelledby="verification-request-heading"
    >
      <span className="section-kicker">Teacher verification</span>
      <h2 id="verification-request-heading">Request a verification review</h2>
      <p>
        Verification is free. Submitting a request does not verify your profile
        automatically; an Admin reviews each claim and records the outcome.
      </p>
      {submitted ? (
        <p className="form-success" role="status" aria-live="polite">
          Your request is under Admin review. Verification is not automatic.
        </p>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="verification-claim-note">
            Optional note for the Admin
          </label>
          <textarea
            id="verification-claim-note"
            name="note"
            value={note}
            onChange={event => setNote(event.target.value)}
            maxLength={2000}
            rows={4}
            aria-describedby="verification-note-help"
            disabled={busy || disabled}
          />
          <small id="verification-note-help">
            Share relevant context if helpful. Do not include passwords or
            sensitive personal documents. Up to 2000 characters.
          </small>
          <button
            className="button button--blue button--small"
            type="submit"
            disabled={busy || disabled}
          >
            {busy ? "Submitting…" : "Submit for Admin review"}
          </button>
          {message ? (
            <p
              className={message.ok ? "form-success" : "form-error"}
              role="status"
              aria-live="polite"
            >
              {message.text}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
