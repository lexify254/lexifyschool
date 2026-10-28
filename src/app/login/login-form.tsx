"use client";

import Link from "next/link";
import { useState } from "react";
import { APP_ROLES } from "@/lib/auth/roles";
import { safeRoleDestination } from "@/lib/auth/redirects";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginForm({
  nextPath,
  initialError,
  initialStatus,
}: {
  nextPath?: string;
  initialError?: string;
  initialStatus?: string;
}) {
  const [error, setError] = useState(initialError ?? "");
  const [status, setStatus] = useState(initialStatus ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    setBusy(true);

    const client = getSupabaseBrowserClient();
    if (!client) {
      setError("Account services are not configured. Please contact support.");
      setBusy(false);
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      const { data, error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError || !data.user) {
        setError("Email or password was not accepted. Check your details and try again.");
        setBusy(false);
        return;
      }

      const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();
      const role = profile?.role;
      if (profileError || typeof role !== "string" || !APP_ROLES.includes(role as (typeof APP_ROLES)[number])) {
        const { error: signOutError } = await client.auth.signOut();
        setError(signOutError
          ? "We could not verify your account role or end this session. Access is blocked; please contact support."
          : "We could not verify your account role. Your session was ended; please contact support.");
        setBusy(false);
        return;
      }

      const destination = safeRoleDestination(nextPath, window.location.origin, role as (typeof APP_ROLES)[number]);
      window.location.replace(destination);
    } catch {
      try {
        await client.auth.signOut();
      } catch {
        // Report the failure without claiming the session was successfully ended.
      }
      setError("We could not complete sign-in because account services did not respond. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="container">
        <section className="auth-card" style={{ maxWidth: 520, margin: "0 auto" }}>
          <h1>Sign in</h1>
          <p className="auth-card__intro">Welcome back to Lexify School.</p>
          {error && <div role="alert" className="form-error">{error}</div>}
          {status && <div role="status" className="form-success">{status}</div>}
          <form className="form-grid" onSubmit={submit}>
            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="form-field">
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            <button className="button button--primary" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="auth-card__intro" style={{ marginTop: 16 }}>
            <Link href="/password/reset">Forgot your password?</Link> · <Link href="/signup">Create account</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
