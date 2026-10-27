import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Eye, LockKeyhole, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Child Safety",
  description: "Read Lexify School's child-safety principles for parent consent, community access and reporting.",
};

const safeguards = [
  { title: "Parents stay involved", text: "A confirmed parent/guardian link is intended to control a learner's access to community features and show learning activity to the right adult.", icon: Eye },
  { title: "No stranger direct messages", text: "The platform is designed around public interest channels and teacher-run class groups rather than private messages between strangers.", icon: LockKeyhole },
  { title: "Report and review", text: "Community messages are intended to have report controls and an administrator moderation queue for review and action.", icon: AlertTriangle },
  { title: "Clear boundaries", text: "Contact information should be shared only where necessary; users should never post passwords, payment PINs or a learner's private records.", icon: ShieldCheck },
];

export default function ChildSafetyPage() {
  return (
    <main>
      <section className="page-hero"><div className="container"><span className="section-kicker">Child safety</span><h1>A safer space for young learners</h1><p>Safety is part of the product—not an optional add-on. These principles guide parent controls, community access and moderation.</p></div></section>
      <section className="page-content"><div className="container">
        <p className="form-error"><strong>Implementation note:</strong> This page describes the safety model the platform is being built to enforce. Community features must remain unavailable until guardian consent, authorization, moderation and reporting controls are operational.</p>
        <div className="card-grid">{safeguards.map(({ title, text, icon: Icon }) => <article className="content-card" key={title}><div className="category-card__icon"><Icon size={23} /></div><h2>{title}</h2><p>{text}</p></article>)}</div>
        <div className="content-card" style={{ marginTop: 22 }}><h2>If a learner needs help</h2><p>Tell a parent or trusted adult. If you encounter unsafe content in a Lexify School community, use the message report control and contact a parent/guardian. The platform operator should review safety reports promptly using its moderation process.</p><Link className="category-card__link" href="/contact">See configured contact details</Link></div>
      </div></section>
    </main>
  );
}
