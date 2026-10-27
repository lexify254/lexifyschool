import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, Search, UserRoundPlus } from "lucide-react";

export const metadata: Metadata = {
  title: "How Lexify School Works",
  description: "See how learners and families can explore tutoring, computer courses and learning resources on Lexify School.",
};

const steps = [
  { n: "01", title: "Choose your learning route", text: "Browse CBE and 8-4-4 curriculum information, or explore practical computer-package courses.", icon: BookOpenCheck },
  { n: "02", title: "Find a teacher or course", text: "Compare published teacher profiles and class details, or review courses and resources that administrators have published.", icon: Search },
  { n: "03", title: "Create the right account", text: "Students, parents, teachers and guests have separate account roles and dedicated spaces.", icon: UserRoundPlus },
];

export default function HowItWorksPage() {
  return (
    <main>
      <section className="page-hero"><div className="container"><span className="section-kicker">How it works</span><h1>A clearer path from curiosity to practice</h1><p>Lexify School brings curriculum-aware tutoring discovery and practical digital learning into one place. Availability depends on what has been published to the platform.</p></div></section>
      <section className="page-content"><div className="container"><div className="card-grid">{steps.map(({ n, title, text, icon: Icon }) => <article className="content-card" key={n}><div className="category-card__icon"><Icon size={24} /></div><span className="category-card__meta">Step {n}</span><h2>{title}</h2><p>{text}</p></article>)}</div>
        <div className="content-card" style={{ marginTop: 22 }}><h2>Families and learner safety</h2><p>Parents can create their own account and link to a learner's account. Community participation is designed to depend on parent/guardian consent and safety controls. Lexify curriculum guidance is informational and should be checked against official KICD/KNEC materials.</p><Link className="category-card__link" href="/child-safety">Read the child-safety policy <ArrowRight size={15} /></Link></div>
      </div></section>
    </main>
  );
}
