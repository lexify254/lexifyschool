import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact Lexify School",
  description: "Contact Lexify School about learning, tutoring and platform support.",
};

export default function ContactPage() {
  const email = process.env.BUSINESS_EMAIL?.trim();
  const phone = process.env.BUSINESS_PHONE?.trim();
  const town = process.env.BUSINESS_TOWN?.trim();
  return (
    <main>
      <section className="page-hero"><div className="container"><span className="section-kicker">Contact</span><h1>How can we help?</h1><p>For learning or platform enquiries, use the verified contact details configured by Lexify School.</p></div></section>
      <section className="page-content"><div className="container"><div className="auth-layout">
        <div className="content-card"><h2>Get in touch</h2><p>Contact information is shown only after an administrator configures and verifies it. This prevents the site from displaying placeholder addresses or numbers.</p>
          {email ? <p><Mail size={17} aria-hidden="true" /> <a href={`mailto:${email}`}>{email}</a></p> : <p className="teacher-empty"><strong>Email support is not configured yet.</strong>The site administrator can add the verified support email in the deployment environment.</p>}
          {phone ? <p><Phone size={17} aria-hidden="true" /> <a href={`tel:${phone}`}>{phone}</a></p> : null}
          {town ? <p><MapPin size={17} aria-hidden="true" /> {town}, Kenya</p> : null}
        </div>
        <aside className="content-card"><h2>What to include</h2><p>When you contact the school, include your account role, the page or feature you need help with, and a brief description. Do not send passwords, payment PINs, card details or a learner's sensitive records over public channels.</p><p>For child-safety concerns, contact a parent/guardian and use the reporting controls available in the relevant community space.</p></aside>
      </div></div></section>
    </main>
  );
}
