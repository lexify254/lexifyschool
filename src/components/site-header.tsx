"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";

const links = [
  { href: "/", label: "Home" },
  { href: "/#courses", label: "Courses" },
  { href: "/about", label: "About Us" },
  { href: "/#why-lexify", label: "Why Lexify" },
  { href: "/#community", label: "Community" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Logo light />
        <nav className={`site-nav${open ? " site-nav--open" : ""}`} aria-label="Main navigation">
          {links.map((link) => {
            const active = link.href === "/" ? pathname === "/" : link.href.startsWith("/#") ? false : pathname === link.href;
            return (
              <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="site-header__actions">
          <Link className="button button--outline" href="/login">Login</Link>
          <Link className="button button--gold" href="/signup">Get Started <span aria-hidden="true">→</span></Link>
          <button className="mobile-menu-toggle" type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>
    </header>
  );
}
