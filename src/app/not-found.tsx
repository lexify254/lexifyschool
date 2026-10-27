import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

export default function NotFoundPage() {
  return (
    <main className="page-content container" style={{ minHeight: "55vh", display: "grid", placeItems: "center" }}>
      <section className="empty-state" style={{ maxWidth: 620 }}>
        <span className="section-kicker">404 · Not found</span>
        <h1 style={{ color: "var(--navy)", fontSize: "clamp(32px,5vw,48px)", margin: "14px 0 8px" }}>This page isn’t here.</h1>
        <p>The page may have moved, or you may not have access to it.</p>
        <Link className="button button--blue" href="/">Return to Lexify School</Link>
      </section>
    </main>
  );
}
