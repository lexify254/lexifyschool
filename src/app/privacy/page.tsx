import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description: "Learn what information Lexify School plans to use and how role-based access is intended to protect it.",
};

export default function PrivacyPage() {
  return (
    <main>
      <section className="page-hero"><div className="container"><span className="section-kicker">Privacy</span><h1>Privacy notice</h1><p>How Lexify School intends to handle account, learning and inquiry information.</p></div></section>
      <section className="page-content"><div className="container content-card">
        <p className="form-error"><strong>Draft for review:</strong> This notice describes intended product behavior and is not legal advice. Before production, confirm actual processing, retention, data-subject rights, cross-border transfers, vendors and a verified privacy contact with qualified Kenyan counsel.</p>
        <h2>Information we may process</h2><p>Depending on how you use the platform, this can include your name, email, phone or WhatsApp contact, role, grade or education system, account preferences, learning activity, uploaded materials, messages and security logs. Lexify School does not collect payment-card details or mobile-money PINs and does not process payments.</p>
        <h2>Why it is used</h2><p>Information supports account access, learner and guardian features, teacher listings, class administration, course progress, support, safety moderation and legal obligations. The platform should collect only what is needed for each feature.</p>
        <h2>Who may receive it</h2><p>Teachers may see information needed to deliver a class. A parent may see information about a child only after a confirmed parent-child link. A click-to-chat inquiry opens WhatsApp and necessarily uses the teacher's public number and the user's chosen WhatsApp account; any transaction is arranged directly between them, outside Lexify School. Configured infrastructure and email providers may process data on the platform's behalf.</p>
        <h2>Children and community features</h2><p>Community access for minors is designed to require guardian consent, parent controls and moderation. Do not include a child's private contact details in public messages. Direct messages between strangers are not part of the intended design.</p>
        <h2>Access, retention and requests</h2><p>Role-based authorization and database row-level security are intended to limit access. Production retention periods, account export/deletion workflows, incident response contacts and jurisdiction-specific disclosures still need to be finalized and tested before launch.</p>
        <h2>Contact</h2><p>Verified privacy contact details will appear on the Contact page once configured by Lexify School.</p>
      </div></section>
    </main>
  );
}
