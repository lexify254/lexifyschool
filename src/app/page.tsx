import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, BookOpen, GraduationCap, Laptop, ShieldCheck, Monitor,
  ChartNoAxesColumnIncreasing, Headset, Gamepad2, Music2, Trophy,
  Camera, Palette, UsersRound, Sparkles, Play,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Your Online School for a Brighter Future",
  description: "Find tutoring, learn computer packages and discover practical learning resources with Lexify School in Kenya.",
  openGraph: { title: "Your Online School for a Brighter Future", description: "A learning hub for students, families and teachers in Kenya." },
};

const categories = [
  { title: "Junior School · CBE", subtitle: "Grades 7–9", body: "Explore learning areas and find tutoring support aligned to Junior School.", icon: GraduationCap, href: "/teachers?system=junior-cbe", action: "Find Junior School support" },
  { title: "Senior School · CBE", subtitle: "Grades 10–12", body: "Browse pathways, learning areas and tutoring options for Senior School.", icon: BookOpen, href: "/curriculum#senior-school", action: "Explore Senior School" },
  { title: "8-4-4 Secondary", subtitle: "Forms 3–4", body: "Find support for the final 8-4-4 cohorts and their KCSE subject groups.", icon: Sparkles, href: "/curriculum#secondary-844", action: "Explore 8-4-4" },
  { title: "Computer Packages", subtitle: "Academy", body: "Learn practical computer packages through admin-published courses.", icon: Laptop, href: "/academy", action: "Explore the Academy" },
];

const benefits = [
  { title: "Learn at your pace", body: "Find learning options that can fit around your schedule.", icon: Monitor },
  { title: "Track your progress", body: "Keep lessons, practice and learning goals together.", icon: ChartNoAxesColumnIncreasing },
  { title: "Support from teachers", body: "Browse teacher profiles and contact them to discuss a class.", icon: Headset },
  { title: "A safer learning space", body: "Role-aware access and child-safety controls are part of the platform design.", icon: ShieldCheck },
];

const interests = [
  { label: "Gaming", icon: Gamepad2 },
  { label: "Music", icon: Music2 },
  { label: "Sports", icon: Trophy },
  { label: "Photography", icon: Camera },
  { label: "Art & Design", icon: Palette },
  { label: "And more", icon: UsersRound },
];

export default function HomePage() {
  return (
    <main>
      <section className="hero" aria-labelledby="home-title">
        <Image
          className="hero__background-image"
          src="/manus-storage/async-images/uSflFX4PjAkPhLbDDFXvw6/image-1.webp"
          alt="A student in school uniform studying in a library"
          fill
          priority
          sizes="100vw"
        />
        <div className="hero__content">
          <div className="hero__copy">
            <div className="hero__eyebrow">Learn <span>•</span> Grow <span>•</span> Achieve</div>
            <h1 id="home-title">Your Online School <span>for a Brighter Future</span></h1>
            <p className="hero__lead">Lexify School brings tutoring, computer packages and practical learning resources together for students and families in Kenya.</p>
            <div className="hero__actions">
              <Link className="button button--gold" href="/signup">Start Learning <ArrowRight size={17} /></Link>
              <a className="button button--outline" href="#why-lexify"><Play size={17} fill="currentColor" /> How it works</a>
            </div>
            <div className="hero__note"><ShieldCheck size={17} /> Clear choices for learners, parents and teachers.</div>
          </div>
          <div className="hero__tagline" aria-hidden="true">Better learners<br />Brighter futures</div>
        </div>
      </section>

      <section className="section" id="courses" aria-labelledby="offer-title">
        <div className="container">
          <div className="section-head">
            <div className="section-head__copy">
              <span className="section-kicker">Learning pathways</span>
              <h2 className="section-title" id="offer-title">Find the support you need</h2>
              <p className="section-copy">Browse tutoring and learning resources across Kenya’s CBE and 8-4-4 categories, or build practical computer skills.</p>
            </div>
            <Link className="button button--line" href="/teachers">Browse teachers <ArrowRight size={16} /></Link>
          </div>
          <div className="category-grid">
            {categories.map(({ title, subtitle, body, icon: Icon, href, action }) => (
              <article className="category-card" key={title}>
                <div className="category-card__icon"><Icon size={25} /></div>
                <span className="category-card__meta">{subtitle}</span>
                <h3>{title}</h3>
                <p>{body}</p>
                <Link className="category-card__link" href={href}>{action} <ArrowRight size={15} /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--soft" id="why-lexify" aria-labelledby="why-title">
        <div className="container">
          <div className="split-panel">
            <div className="split-panel__intro">
              <span className="section-kicker">Why Lexify School</span>
              <h2 className="section-title" id="why-title">Learning built around your next step</h2>
              <p>Explore a class, talk with a teacher, or choose a computer package course. As the platform grows, your learning activity and resources can stay together in one place.</p>
              <Link className="button button--line" href="/how-it-works">See how it works <ArrowRight size={16} /></Link>
            </div>
            <div className="benefit-grid">
              {benefits.map(({ title, body, icon: Icon }) => (
                <article className="benefit" key={title}>
                  <div className="benefit__icon"><Icon size={19} /></div>
                  <div><h3>{title}</h3><p>{body}</p></div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="market-title">
        <div className="container">
          <div className="market-strip">
            <div>
              <span className="section-kicker" style={{ color: "#ffe27a" }}>Tutoring marketplace</span>
              <h3 id="market-title">Meet teachers and explore practical projects</h3>
              <p>Compare teacher profiles and class details, or browse admin-published templates in the Projects Store. Prices and availability appear on listings once published.</p>
            </div>
            <div className="market-strip__links">
              <Link className="button button--gold button--small" href="/teachers">Find a teacher <ArrowRight size={15} /></Link>
              <Link className="button button--outline button--small" href="/projects">Projects Store</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--soft" aria-labelledby="teacher-title">
        <div className="container">
          <div className="section-head">
            <div className="section-head__copy">
              <span className="section-kicker">Teacher marketplace</span>
              <h2 className="section-title" id="teacher-title">Find a teacher for your learning goals</h2>
              <p className="section-copy">Review available subjects, class formats and pricing bases before you get in touch.</p>
            </div>
            <Link className="button button--line" href="/teachers">Browse teachers <ArrowRight size={16} /></Link>
          </div>
          <div className="teacher-empty teacher-empty__row">
            <div><strong>Teacher profiles are published as teachers complete their profiles.</strong><span>Browse the marketplace to see current listings and availability.</span></div>
            <Link className="button button--blue button--small" href="/teachers">View teacher listings <ArrowRight size={15} /></Link>
          </div>
        </div>
      </section>

      <section className="section" id="community" aria-labelledby="community-title">
        <div className="container">
          <div className="community-panel">
            <div className="community-panel__copy">
              <span className="section-kicker">Student community</span>
              <h2 className="section-title" id="community-title">Connect · Share · Grow</h2>
              <p>Explore interest-based channels alongside your learning. Community features are designed with parent controls and safety rules.</p>
              <Link className="button button--gold" href="/signup">Join Lexify School <ArrowRight size={16} /></Link>
            </div>
            <div className="interest-grid" aria-label="Example community interests">
              {interests.map(({ label, icon: Icon }) => <span className="interest-chip" key={label}><Icon size={18} /> {label}</span>)}
            </div>
          </div>
        </div>
      </section>

      <section className="section section--soft" aria-labelledby="stories-title">
        <div className="container">
          <span className="section-kicker">Learner stories</span>
          <h2 className="section-title" id="stories-title">Real experiences, shared with care</h2>
          <div className="story-empty"><strong>Verified stories will appear here.</strong>We will publish learner and parent feedback only after it has been collected and approved.</div>
        </div>
      </section>

      <section className="container" aria-label="Create your account">
        <div className="cta-banner">
          <div className="cta-banner__mark"><GraduationCap size={34} /></div>
          <div><h2>Ready to start your learning journey?</h2><p>Create an account to explore classes, courses and learning resources.</p></div>
          <Link className="button button--gold" href="/signup">Create your account <ArrowRight size={16} /></Link>
        </div>
      </section>
    </main>
  );
}
