import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account access suspended",
  description:
    "Information about restricted access to a Lexify School account.",
};

export default function AccountSuspendedPage() {
  return (
    <main className="page-content">
      <div className="container">
        <section className="empty-state" role="status">
          <span className="section-kicker">Account access</span>
          <h1>Access to this account is suspended</h1>
          <p>
            This account cannot currently access protected learning features. If
            you think this is a mistake, contact Lexify School for help.
          </p>
          <div className="portal-actions">
            <Link className="button button--blue" href="/contact">
              Contact Lexify School
            </Link>
            <Link className="button button--line" href="/">
              Return to home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
