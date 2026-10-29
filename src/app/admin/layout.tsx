import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import "./admin.css";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireAdmin();

  return (
    <main className="admin-shell">
      <div className="admin-wrap">
        <header className="admin-topbar">
          <div>
            <span className="admin-eyebrow">Lexify School · Operations</span>
            <strong>Administrator workspace</strong>
          </div>
          <nav aria-label="Administrator navigation">
            <Link href="/admin">Overview</Link>
            <Link href="/admin/content">Content</Link>
            <Link href="/admin/curriculum">Curriculum</Link>
            <Link href="/admin/users">Users</Link>
            <Link href="/admin/verification">Teacher verification</Link>
            <Link href="/admin/receipts">Receipts</Link>
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}
