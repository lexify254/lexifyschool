"use client";

import Link from "next/link";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function PasswordResetForm() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);

    const client = getSupabaseBrowserClient();
    if (!client) {
      setError("Account services are not configured. Please contact support.");
      setBusy(false);
      return;
    }

    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", "/password/update");
    try {
      const { error: resetError } = await client.auth.resetPasswordForEmail(email, { redirectTo: callback.toString() });
      if (resetError) {
        setError("We could not send a password reset request right now. Please try again later.");
        return;
      }
      setSuccess("If the address belongs to an account, password reset instructions have been sent. Check your inbox.");
    } catch {
      setError("We could not reach account services to request a reset. Please try again later.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="container">
        <section className="auth-card" style={{ maxWidth: 520, margin: "0 auto" }}>
          <h1>Reset your password</h1>
          <p className="auth-card__intro">We’ll email a secure reset link if this address has an account.</p>
          {error && <div className="form-error" role="alert">{error}</div>}
          {success && <div className="form-success" role="status">{success}</div>}
          <form className="form-grid" onSubmit={submit}>
            <div className="form-field">
              <label htmlFor="email">Account email</label>
              <input id="email" type="email" name="email" autoComplete="email" required />
            </div>
            <button className="button button--primary" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
          </form>
          <p><Link href="/login">Back to sign in</Link></p>
        </section>
      </div>
    </main>
  );
}
