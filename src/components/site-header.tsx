"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Menu, UserRound, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { roleHome, type AppRole } from "@/lib/auth/roles";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const links = [
  { href: "/", label: "Home" },
  { href: "/#courses", label: "Courses" },
  { href: "/about", label: "About Us" },
  { href: "/#why-lexify", label: "Why Lexify" },
  { href: "/#community", label: "Community" },
  { href: "/contact", label: "Contact" },
];

type HeaderAccount = { name: string; avatarUrl: string | null; workspaceHref: string };

export function SiteHeader() {
  const pathname = usePathname();
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<HeaderAccount | null>(null);

  useEffect(() => {
    if (!client) return;
    let active = true;
    async function loadAccount() {
      const { data: auth } = await client!.auth.getUser();
      if (!active) return;
      if (!auth.user) {
        setAccount(null);
        return;
      }
      const { data: profile } = await client!
        .from("profiles")
        .select("full_name,avatar_url,is_suspended,role")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (!active) return;
      if (!profile || profile.is_suspended) {
        setAccount(null);
        return;
      }
      let avatarUrl: string | null = null;
      if (typeof profile.avatar_url === "string" && profile.avatar_url.startsWith(`${auth.user.id}/`)) {
        const { data } = await client!.storage.from("profile-photos").createSignedUrl(profile.avatar_url, 3600);
        if (!active) return;
        avatarUrl = data?.signedUrl ?? null;
      }
      const role = String(profile.role ?? "");
      const workspaceHref = Object.hasOwn(roleHome, role)
        ? roleHome[role as AppRole]
        : "/profile";
      setAccount({
        name: profile.full_name || auth.user.email || "Account",
        avatarUrl,
        workspaceHref,
      });
    }
    const refresh = () => { window.setTimeout(() => { void loadAccount(); }, 0); };
    void loadAccount();
    const { data: { subscription } } = client.auth.onAuthStateChange(refresh);
    window.addEventListener("lexify:profile-updated", refresh);
    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener("lexify:profile-updated", refresh);
    };
  }, [client, pathname]);

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
          {account ? (
            <Link
              className="site-account site-account--workspace"
              href={account.workspaceHref}
              aria-label={`Open ${account.name}'s workspace`}
              title="My workspace"
              onClick={() => setOpen(false)}
            >
              {account.avatarUrl ? <img src={account.avatarUrl} alt="" width={40} height={40} /> : <span className="site-account__fallback" aria-hidden="true"><UserRound size={20} /></span>}
            </Link>
          ) : null}
          {!account ? (
            <>
              <Link className="button button--outline" href={`/login?next=${encodeURIComponent(pathname || "/")}`}>Login</Link>
              <Link className="button button--gold" href="/signup">Get Started <span aria-hidden="true">→</span></Link>
            </>
          ) : null}
          <button className="mobile-menu-toggle" type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>
    </header>
  );
}
