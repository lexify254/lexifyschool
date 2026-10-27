import Link from "next/link";
import { Logo } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer className="site-footer" id="contact">
      <div className="container site-footer__main">
        <div className="site-footer__brand">
          <Logo light />
          <p>Learning, tutoring and practical digital skills for students and families in Kenya.</p>
        </div>
        <div>
          <h3>Explore</h3>
          <nav className="site-footer__links" aria-label="Explore">
            <Link href="/teachers">Find a teacher</Link>
            <Link href="/academy">Computer Packages Academy</Link>
            <Link href="/projects">Projects Store</Link>
            <Link href="/curriculum">Curriculum guide</Link>
          </nav>
        </div>
        <div>
          <h3>Learn more</h3>
          <nav className="site-footer__links" aria-label="Learn more">
            <Link href="/how-it-works">How it works</Link>
            <Link href="/about">About Lexify</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/signup">Create an account</Link>
          </nav>
        </div>
        <div>
          <h3>Policies</h3>
          <nav className="site-footer__links" aria-label="Policies">
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/child-safety">Child safety</Link>
          </nav>
        </div>
      </div>
      <div className="container site-footer__bottom">
        <span>© {new Date().getFullYear()} Lexify School. All rights reserved.</span>
        <div className="site-footer__bottom-links"><span>Learn</span><span>Grow</span><span>Achieve</span></div>
      </div>
    </footer>
  );
}
