"use client";

import Link from "next/link";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function PasswordUpdateForm() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess(false);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const repeat = String(form.get("repeat") ?? "");
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== repeat) {
      setError("The passwords do not match.");
      return;
    }

    const client = getSupabaseBrowserClient();
    if (!client) {
      setError("Account services are not configured. Please contact support.");
      return;
    }

    setBusy(true);
    try {
      const { data, error: userError } = await client.auth.getUser();
      if (userError || !data.user) {
        setError("This reset link is invalid or has expired. Request a fresh link and try again.");
        return;
      }
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) {
        setError("We could not update your password. Please check the password requirements and try again.");
        return;
      }
      const { error: signOutError } = await client.auth.signOut();
      if (signOutError) {
        setError("Your password changed, but we could not end this session. Use the sign-out link before continuing.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("We could not reach account services to update your password. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="container">
        <section className="auth-card" style={{ maxWidth: 520, margin: "0 auto" }}>
          <h1>Choose a new password</h1>
          <p className="auth-card__intro">Open this page from the secure password reset link sent to your email.</p>
          {error && <div className="form-error" role="alert">{error}</div>}
          {success && <div className="form-success" role="status">Your password has been updated. Sign in with your new password.</div>}
          {!success && <form className="form-grid" onSubmit={submit}>
            <div className="form-field">
              <label htmlFor="password">New password</label>
              <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <div className="form-field">
              <label htmlFor="repeat">Confirm new password</label>
              <input id="repeat" name="repeat" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <button className="button button--primary" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
          </form>}
          {success && <p><Link href="/login">Continue to sign in</Link></p>}
        </section>
      </div>
    </main>
  );
}
