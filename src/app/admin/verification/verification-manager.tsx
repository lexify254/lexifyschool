"use client";

import { useState } from "react";

type VerificationRequest = {
  id: string;
  teacherId: string;
  teacherName: string;
  claimNote: string | null;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
};

function date(value: string | null) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? value
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(parsed);
}

export function VerificationManager({
  requests,
}: {
  requests: VerificationRequest[];
}) {
  const [items, setItems] = useState(requests);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<
    Record<string, { text: string; ok: boolean }>
  >({});

  async function review(
    item: VerificationRequest,
    decision: "approved" | "rejected"
  ) {
    if (item.status !== "pending" || busyId) return;
    setBusyId(item.id);
    setMessages(current => ({ ...current, [item.id]: { text: "", ok: true } }));
    try {
      const response = await fetch(
        `/api/admin/verification-requests/${item.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, note: notes[item.id] ?? "" }),
        }
      );
      const result = (await response.json()) as {
        error?: string;
        data?: { reviewedAt?: string | null };
      };
      if (!response.ok)
        throw new Error(result.error || "Review could not be saved.");
      const reviewedAt = result.data?.reviewedAt ?? null;
      setItems(current =>
        current.map(entry =>
          entry.id === item.id
            ? {
                ...entry,
                status: decision,
                reviewedAt,
                reviewNote: (notes[item.id] ?? "").trim() || null,
              }
            : entry
        )
      );
      setMessages(current => ({
        ...current,
        [item.id]: {
          text:
            decision === "approved"
              ? "Approved. The verification record and badge award were updated."
              : "Rejected. The teacher was not marked as verified.",
          ok: true,
        },
      }));
    } catch (error) {
      setMessages(current => ({
        ...current,
        [item.id]: {
          text:
            error instanceof Error
              ? error.message
              : "Review could not be saved. Please try again.",
          ok: false,
        },
      }));
    } finally {
      setBusyId(null);
    }
  }

  if (!items.length)
    return (
      <div className="admin-empty">
        No verification requests have been submitted.
      </div>
    );

  return (
    <div aria-label="Teacher verification requests">
      {items.map(item => (
        <article className="admin-record" key={item.id}>
          <header className="admin-record__head">
            <div>
              <h2>{item.teacherName}</h2>
              <p>
                Teacher ID: <code>{item.teacherId}</code>
              </p>
              <p>
                Submitted {date(item.submittedAt)} ·{" "}
                <span
                  className={`admin-status ${item.status === "approved" ? "admin-status--on" : item.status === "rejected" ? "admin-status--off" : "admin-status--draft"}`}
                >
                  {item.status}
                </span>
              </p>
            </div>
            {item.reviewedAt ? <p>Reviewed {date(item.reviewedAt)}</p> : null}
          </header>
          <div className="admin-record__body">
            <h3>Teacher note</h3>
            <p className="admin-table-note">
              {item.claimNote || "No note provided."}
            </p>
            {item.reviewNote ? (
              <>
                <h3>Previous review note</h3>
                <p className="admin-table-note">{item.reviewNote}</p>
              </>
            ) : null}
            {item.status === "pending" ? (
              <>
                <div className="admin-field">
                  <label htmlFor={`review-note-${item.id}`}>
                    Optional Admin note
                  </label>
                  <textarea
                    id={`review-note-${item.id}`}
                    maxLength={2000}
                    rows={3}
                    value={notes[item.id] ?? ""}
                    onChange={event =>
                      setNotes(current => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                  />
                  <small>
                    Up to 2000 characters. This note is visible to the teacher.
                  </small>
                </div>
                <div className="verification-actions">
                  <button
                    className="admin-submit"
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void review(item, "approved")}
                  >
                    {busyId === item.id ? "Saving…" : "Approve"}
                  </button>
                  <button
                    className="admin-submit admin-submit--danger"
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void review(item, "rejected")}
                  >
                    {busyId === item.id ? "Saving…" : "Reject"}
                  </button>
                </div>
              </>
            ) : null}
            {messages[item.id]?.text ? (
              <p
                className="admin-form-message"
                data-ok={messages[item.id].ok}
                role="status"
                aria-live="polite"
              >
                {messages[item.id].text}
              </p>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
