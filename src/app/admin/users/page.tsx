import type { Metadata } from "next";
import { AdminOperationError, listAdminUsers } from "@/lib/admin/operations";
import { UserManager, type AdminUser } from "./user-manager";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "User operations" };
export default async function AdminUsersPage() {
  let users: AdminUser[] = [];
  let error: string | null = null;
  try {
    users = (await listAdminUsers()) as AdminUser[];
  } catch (cause) {
    error = cause instanceof AdminOperationError ? cause.message : "Users could not be loaded. Check administrator database access and reload.";
  }
  return <div className="admin-page">
    <header className="admin-heading"><div><span className="admin-kicker">Operations · accounts</span><h1>User operations</h1><p>Review account role and suspension status. This workspace cannot change roles or promote accounts.</p></div></header>
    <aside className="admin-warning"><strong>Suspension scope</strong>Changing this flag records the account status in the profile. Authentication enforcement depends on the existing application policies; roles are never changed here.</aside>
    {error ? <div className="admin-empty" role="status">{error}</div> : <UserManager users={users} />}
  </div>;
}
