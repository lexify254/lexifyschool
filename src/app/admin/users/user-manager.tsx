"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export type AdminUser = { id: string; full_name: string; email: string | null; role: string; is_suspended: boolean; created_at: string };
function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Unknown" : date.toLocaleDateString();
}
export function UserManager({ users }: { users: AdminUser[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [success, setSuccess] = useState(false);
  async function update(user: AdminUser) {
    const next = !user.is_suspended;
    const verb = next ? "suspend" : "restore";
    if (!window.confirm(`Confirm ${verb} for ${user.full_name || user.email || "this account"}?`)) return;
    setPendingId(user.id); setFeedback("");
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ is_suspended: next }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Account status could not be updated.");
      setSuccess(true); setFeedback(next ? "Suspension status saved." : "Account status restored."); router.refresh();
    } catch (error) {
      setSuccess(false); setFeedback(error instanceof Error ? error.message : "Account status could not be updated.");
    } finally { setPendingId(null); }
  }
  if (!users.length) return <div className="admin-empty">No profile records are available.</div>;
  return <>
    <p className="admin-table-note">Showing the latest {users.length} profile records. Email and role are read-only here.</p>
    {feedback && <p className="admin-form-message" data-ok={success ? "true" : "false"} role="status">{feedback}</p>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">Account</th><th scope="col">Role</th><th scope="col">Joined</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
      <tbody>{users.map((user) => <tr key={user.id}>
        <td><strong>{user.full_name || "Unnamed account"}</strong><small>{user.email || "No email on profile"}</small></td>
        <td><span className="admin-role">{user.role}</span></td><td>{displayDate(user.created_at)}</td>
        <td><span className={`admin-status${user.is_suspended ? " admin-status--off" : " admin-status--on"}`}>{user.is_suspended ? "Suspended" : "Active"}</span></td>
        <td><button type="button" className="admin-submit admin-submit--quiet" onClick={() => update(user)} disabled={pendingId !== null || user.role === "admin"} aria-label={`${user.is_suspended ? "Restore" : "Suspend"} ${user.full_name || user.email || "account"}`}>
          {pendingId === user.id ? "Saving…" : user.is_suspended ? "Restore" : "Suspend"}
        </button></td>
      </tr>)}</tbody></table></div>
  </>;
}
