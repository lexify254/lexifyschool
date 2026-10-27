import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, GraduationCap, Laptop, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "About Lexify School",
  description: "Learn about Lexify School's vision for accessible learning support and practical digital skills in Kenya.",
};

const values = [
  { title: "Learning that fits", text: "Explore flexible tutoring and self-paced computer courses that can work around a learner's day.", icon: BookOpen },
  { title: "Clear curriculum choices", text: "Browse learning systems, levels and subject information from an editable catalogue, with guidance clearly labelled as guidance.", icon: GraduationCap },
  { title: "Practical digital skills", text: "Discover computer-package courses and learning resources as they are published by Lexify School administrators.", icon: Laptop },
  { title: "Safety by design", text: "Role-specific spaces, privacy controls and parent involvement are central to how the platform is being built.", icon: ShieldCheck },
];

export default function AboutPage() {
  return (
    <main>
      <section className="page-hero"><div className="container"><span className="section-kicker">About Lexify School</span><h1>Learning support for every next step</h1><p>Lexify School is being built as an online learning hub for Kenyan students, families and teachers—bringing tutoring, practical digital skills and learning resources together.</p></div></section>
      <section className="page-content"><div className="container">
        <div className="content-card"><h2>Our purpose</h2><p>Help learners find clear, useful support—whether they are exploring a subject, looking for a teacher, or learning how to use everyday digital tools. The platform is designed to grow with the needs of students and their families.</p></div>
        <div className="card-grid" style={{ marginTop: 22 }}>{values.map(({ title, text, icon: Icon }) => <article className="content-card" key={title}><div className="category-card__icon"><Icon size={24} /></div><h2>{title}</h2><p>{text}</p></article>)}</div>
        <div className="market-strip" style={{ marginTop: 28 }}><div><h3>Explore the learning hub</h3><p>Browse teacher profiles, computer courses and the curriculum guide.</p></div><div className="market-strip__links"><Link className="button button--gold button--small" href="/teachers">Find a teacher</Link><Link className="button button--outline button--small" href="/curriculum">View curriculum</Link></div></div>
      </div></section>
    </main>
  );
}
