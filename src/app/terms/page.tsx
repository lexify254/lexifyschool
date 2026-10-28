import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Read the initial terms for using Lexify School learning and marketplace features.",
};

export default function TermsPage() {
  return (
    <main>
      <section className="page-hero"><div className="container"><span className="section-kicker">Terms</span><h1>Terms of use</h1><p>Initial service terms for learners, parents, teachers and guests.</p></div></section>
      <section className="page-content"><div className="container content-card">
        <p className="form-error"><strong>Draft for review:</strong> These initial terms are a product-development draft, not legal advice. Have them reviewed by qualified Kenyan counsel and complete the business and consumer-protection details before a wider launch.</p>
        <h2>1. Using the service</h2><p>Lexify School is being developed to help learners and families discover tutoring, computer-package courses and learning resources. Users must provide accurate account information, keep credentials private and use the service lawfully.</p>
        <h2>2. Accounts and guardians</h2><p>Account roles have different permissions. Parents or guardians are responsible for helping minors use the service and for granting any consent required before a minor joins community features. Do not create an account for another person without their authority.</p>
        <h2>3. Teachers and learning content</h2><p>Teacher profiles, classes, courses and products are displayed only when published. Curriculum and assessment information is guidance for learning; it is not a substitute for current official KICD/KNEC material or school guidance. Lexify tutoring assessments are not national examination results.</p>
        <h2>4. Seller inquiries</h2><p>Prices shown on listings are informational. Lexify School does not process payments or confirm off-site bookings or sales. An inquiry link opens the relevant seller's WhatsApp with a prefilled message; availability, terms and any transaction are agreed directly with that seller.</p>
        <h2>5. Projects and academic integrity</h2><p>Projects and templates are sample, reference and learning materials. Users must follow the stated licence and must not submit another person's work as their own in a school assessment or examination.</p>
        <h2>6. Safety, misuse and service availability</h2><p>Users must not harass, impersonate, upload unlawful or malicious files, evade access controls or misuse community features. The service may restrict access to protect users and preserve platform integrity. Availability depends on published content and configured services.</p>
        <h2>7. Changes and contact</h2><p>These terms will need versioning, effective dates, a complaints process, governing-law wording and verified contact details before production launch. Until then, they should be treated as an initial draft.</p>
      </div></section>
    </main>
  );
}
