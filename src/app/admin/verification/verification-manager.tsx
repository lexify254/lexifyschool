"use client";

import { useState } from "react";
import { formatVerificationFee } from "@/lib/verification/pricing";

type VerificationRequest = {
  id: string;
  teacherId: string;
  teacherName: string;
  claimNote: string | null;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  feeSnapshot: number | null;
  feeCurrency: string;
  latestBadge: { id: string; awardedAt: string; expiresAt: string | null; revokedAt: string | null } | null;
};
function date(value: string | null) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}
function badgeState(badge: VerificationRequest["latestBadge"]) {
  if (!badge) return "No badge award";
  if (badge.revokedAt) return "Revoked";
  if (badge.expiresAt && Date.parse(badge.expiresAt) <= Date.now()) return "Trial expired";
  return badge.expiresAt ? "14-day trial active" : "Manually continued";
}

export function VerificationManager({ requests }: { requests: VerificationRequest[] }) {
  const [items, setItems] = useState(requests);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, { text: string; ok: boolean }>>({});

  async function send(item: VerificationRequest, payload: Record<string, string>) {
    if (busyId) return false;
    setBusyId(item.id);
    setMessages(current => ({ ...current, [item.id]: { text: "", ok: true } }));
    try {
      const response = await fetch(`/api/admin/verification-requests/${item.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string; data?: { reviewedAt?: string | null; action?: string; changedAt?: string | null; award?: { id: string; awarded_at: string; expires_at: string | null; revoked_at: string | null } | null } };
      if (!response.ok) throw new Error(result.error || "Admin action could not be saved.");
      if (payload.decision === "approved" || payload.decision === "rejected") {
        const decision = payload.decision;
        setItems(current => current.map(entry => entry.id === item.id ? {
          ...entry, status: decision, reviewedAt: result.data?.reviewedAt ?? null,
          reviewNote: (notes[item.id] ?? "").trim() || null,
          latestBadge: decision === "approved" && result.data?.award ? { id: result.data.award.id, awardedAt: result.data.award.awarded_at, expiresAt: result.data.award.expires_at, revokedAt: result.data.award.revoked_at } : entry.latestBadge,
        } : entry));
        setMessages(current => ({ ...current, [item.id]: { text: decision === "approved" ? "Approved. The 14-day free trial starts now." : "Rejected. The teacher was not marked verified.", ok: true } }));
      } else if (payload.action === "continue" || payload.action === "revoke") {
        setItems(current => current.map(entry => entry.id === item.id && entry.latestBadge ? {
          ...entry, latestBadge: payload.action === "continue"
            ? { ...entry.latestBadge, awardedAt: result.data?.changedAt ?? new Date().toISOString(), expiresAt: null }
            : { ...entry.latestBadge, revokedAt: result.data?.changedAt ?? new Date().toISOString() },
        } : entry));
        setMessages(current => ({ ...current, [item.id]: { text: payload.action === "continue" ? "Badge manually continued without payment tracking." : "Badge revoked.", ok: true } }));
      }
      return true;
    } catch (error) {
      setMessages(current => ({ ...current, [item.id]: { text: error instanceof Error ? error.message : "Admin action could not be saved.", ok: false } }));
      return false;
    } finally { setBusyId(null); }
  }

  if (!items.length) return <div className="admin-empty">No verification requests have been submitted.</div>;
  return <div aria-label="Teacher verification requests">
    {items.map(item => {
      const badge = item.latestBadge;
      const active = badge && !badge.revokedAt && (!badge.expiresAt || Date.parse(badge.expiresAt) > Date.now());
      return <article className="admin-record" key={item.id}>
        <header className="admin-record__head"><div>
          <h2>{item.teacherName}</h2><p>Teacher ID: <code>{item.teacherId}</code></p>
          <p>Submitted {date(item.submittedAt)} · <span className={`admin-status ${item.status === "approved" ? "admin-status--on" : item.status === "rejected" ? "admin-status--off" : "admin-status--draft"}`}>{item.status}</span></p>
        </div>{item.reviewedAt ? <p>Reviewed {date(item.reviewedAt)}</p> : null}</header>
        <div className="admin-record__body">
          <h3>Fee snapshot</h3><p className="admin-table-note">{item.feeSnapshot === null ? "Unconfigured when requested" : `${new Intl.NumberFormat("en-KE", { style: "currency", currency: item.feeCurrency || "KES", maximumFractionDigits: 2 }).format(item.feeSnapshot)} after the free trial`}</p>
          <h3>Trial / badge state</h3><p className="admin-table-note">{badgeState(badge)}{badge?.awardedAt ? ` · awarded ${date(badge.awardedAt)}` : ""}{badge?.expiresAt ? ` · expires ${date(badge.expiresAt)}` : ""}</p>
          <h3>Teacher note</h3><p className="admin-table-note">{item.claimNote || "No note provided."}</p>
          {item.reviewNote ? <><h3>Previous review note</h3><p className="admin-table-note">{item.reviewNote}</p></> : null}
          {item.status === "pending" ? <>
            <div className="admin-field"><label htmlFor={`review-note-${item.id}`}>Optional Admin note</label><textarea id={`review-note-${item.id}`} maxLength={2000} rows={3} value={notes[item.id] ?? ""} onChange={event => setNotes(current => ({ ...current, [item.id]: event.target.value }))} /><small>Up to 2000 characters. This note is visible to the teacher.</small></div>
            <div className="verification-actions"><button className="admin-submit" type="button" disabled={busyId !== null || item.feeSnapshot === null} onClick={() => void send(item, { decision: "approved", note: notes[item.id] ?? "" })}>{busyId === item.id ? "Saving…" : "Approve · start 14-day trial"}</button><button className="admin-submit admin-submit--danger" type="button" disabled={busyId !== null} onClick={() => void send(item, { decision: "rejected", note: notes[item.id] ?? "" })}>Reject</button></div>
          </> : null}
          {item.status === "approved" && badge && !badge.revokedAt ? <div className="verification-actions">
            {badge.expiresAt ? <button className="admin-submit" type="button" disabled={busyId !== null} onClick={() => void send(item, { action: "continue", badgeAwardId: badge.id })}>{busyId === item.id ? "Saving…" : "Manually continue (no payment tracking)"}</button> : null}
            {active ? <button className="admin-submit admin-submit--danger" type="button" disabled={busyId !== null} onClick={() => void send(item, { action: "revoke", badgeAwardId: badge.id })}>Revoke badge</button> : null}
          </div> : null}
          {messages[item.id]?.text ? <p className="admin-form-message" data-ok={messages[item.id].ok} role="status" aria-live="polite">{messages[item.id].text}</p> : null}
        </div>
      </article>;
    })}
  </div>;
}
