"use client";

import { useState, type FormEvent } from "react";
import type { CommunityState } from "@/lib/community/service";
import styles from "./community.module.css";

type ReadyState = Extract<CommunityState, { status: "ready" }>;
type ActionResponse = { ok?: boolean; status?: string; message?: string };

function formattedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

export default function CommunityClient({
  initialState,
}: {
  initialState: ReadyState;
}) {
  const [state, setState] = useState<ReadyState>(initialState);
  const [fatalMessage, setFatalMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [acceptedRulesChannel, setAcceptedRulesChannel] = useState<
    string | null
  >(null);
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(
    null
  );
  const [reportReason, setReportReason] = useState("unsafe content");
  const [busy, setBusy] = useState(false);

  const selectedChannel =
    state.channels.find(channel => channel.id === state.selectedChannelId) ??
    null;

  async function refresh(channelId: string | null = state.selectedChannelId) {
    const query = channelId
      ? `?channelId=${encodeURIComponent(channelId)}`
      : "";
    const response = await fetch(`/api/community${query}`, {
      cache: "no-store",
    });
    const data = (await response.json()) as CommunityState;
    if (!response.ok || data.status !== "ready") {
      const message =
        "message" in data
          ? data.message
          : "Community access could not be verified. No content is being shown.";
      setFatalMessage(message);
      return false;
    }
    setState(data);
    setFatalMessage(null);
    return true;
  }

  async function postAction(payload: Record<string, unknown>) {
    const response = await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json().catch(() => ({}))) as ActionResponse;
    if (!response.ok || !data.ok) {
      if (
        [401, 403, 503].includes(response.status) ||
        data.status === "blocked" ||
        data.status === "unauthenticated"
      ) {
        setFatalMessage(
          data.message ??
            "Community access could not be verified. No content is being shown."
        );
        setNotice(null);
        return false;
      }
      setNotice(
        data.message ?? "That action could not be completed. Please try again."
      );
      return false;
    }
    setNotice(data.message ?? null);
    return true;
  }

  async function chooseChannel(channelId: string) {
    setBusy(true);
    setNotice(null);
    setAcceptedRulesChannel(null);
    setReportingMessageId(null);
    try {
      await refresh(channelId);
    } catch {
      setFatalMessage(
        "Community could not be refreshed. No channel content is being shown until access can be checked."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleMembership(action: "join" | "leave") {
    if (!selectedChannel) return;
    setBusy(true);
    setNotice(null);
    try {
      const ok = await postAction({
        action,
        channelId: selectedChannel.id,
        rulesAccepted:
          action === "join" && acceptedRulesChannel === selectedChannel.id,
      });
      if (ok) {
        if (action === "leave") setReportingMessageId(null);
        await refresh(action === "leave" ? null : selectedChannel.id);
      }
    } catch {
      setNotice(
        "The community service could not be reached. No change was made."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedChannel || !messageDraft.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const ok = await postAction({
        action: "send",
        channelId: selectedChannel.id,
        body: messageDraft,
      });
      if (ok) {
        setMessageDraft("");
        await refresh(selectedChannel.id);
      }
    } catch {
      setNotice(
        "The community service could not be reached. Your message was not confirmed as sent."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reportingMessageId) return;
    setBusy(true);
    setNotice(null);
    try {
      const ok = await postAction({
        action: "report",
        messageId: reportingMessageId,
        reason: reportReason,
      });
      if (ok) setReportingMessageId(null);
    } catch {
      setNotice(
        "The community service could not be reached. Your report was not confirmed as submitted."
      );
    } finally {
      setBusy(false);
    }
  }

  if (fatalMessage) {
    return (
      <section className="content-card" role="alert" aria-live="assertive">
        <h2 className={styles.sectionHeading}>Community access paused</h2>
        <p>{fatalMessage}</p>
        <p className={styles.lastParagraph}>
          No channel or message content is being shown until your access can be
          verified again.
        </p>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => void chooseChannel(state.selectedChannelId ?? "")}
          disabled={busy}
        >
          Try again
        </button>
      </section>
    );
  }

  return (
    <section className={styles.layout} aria-label="Community channels">
      <aside className={styles.channelPanel} aria-labelledby="channels-heading">
        <h2 id="channels-heading" className={styles.sectionHeading}>
          Channels
        </h2>
        {state.channels.length === 0 ? (
          <p className={styles.muted}>
            No active public channels have been published yet.
          </p>
        ) : (
          <ul className={styles.channelList}>
            {state.channels.map(channel => (
              <li key={channel.id}>
                <button
                  type="button"
                  className={`${styles.channelButton} ${channel.id === state.selectedChannelId ? styles.channelSelected : ""}`}
                  aria-current={
                    channel.id === state.selectedChannelId ? "page" : undefined
                  }
                  onClick={() => void chooseChannel(channel.id)}
                  disabled={busy}
                >
                  <span className={styles.channelName}>{channel.name}</span>
                  <span className={styles.channelMeta}>
                    {channel.joined ? "Joined" : "Open channel"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <div className={styles.conversationPanel}>
        {notice && (
          <p className={styles.notice} role="status" aria-live="polite">
            {notice}
          </p>
        )}
        {!selectedChannel ? (
          <div className={styles.emptyState}>
            <h2 className={styles.sectionHeading}>No channels available</h2>
            <p className={styles.lastParagraph}>
              There are no active public community channels to show right now.
            </p>
          </div>
        ) : (
          <>
            <header className={styles.channelHeader}>
              <div>
                <h2 className={styles.sectionHeading}>
                  {selectedChannel.name}
                </h2>
                <p className={styles.muted}>
                  {selectedChannel.description ||
                    "A shared space for learning and encouragement."}
                </p>
              </div>
              {selectedChannel.joined && (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => void handleMembership("leave")}
                  disabled={busy}
                >
                  Leave channel
                </button>
              )}
            </header>

            {!selectedChannel.joined ? (
              <div className={styles.emptyState}>
                <h3>Join to take part</h3>
                <p>
                  Channel conversations are visible only to members. Read the
                  community rules above and accept them before joining.
                </p>
                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={acceptedRulesChannel === selectedChannel.id}
                    onChange={event =>
                      setAcceptedRulesChannel(
                        event.target.checked ? selectedChannel.id : null
                      )
                    }
                    disabled={busy}
                  />
                  I have read and agree to follow the community rules.
                </label>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => void handleMembership("join")}
                  disabled={busy || acceptedRulesChannel !== selectedChannel.id}
                >
                  Join channel
                </button>
              </div>
            ) : (
              <>
                <div
                  className={styles.messages}
                  aria-label={`${selectedChannel.name} messages`}
                  aria-live="polite"
                >
                  {!state.messagesAvailable ? (
                    <div className={styles.emptyState}>
                      <p className={styles.lastParagraph}>
                        No messages to show yet. Start with a kind,
                        learning-focused post.
                      </p>
                    </div>
                  ) : state.messages.length === 0 ? (
                    <div className={styles.emptyState}>
                      <p className={styles.lastParagraph}>
                        No messages to show yet. Start with a kind,
                        learning-focused post.
                      </p>
                    </div>
                  ) : (
                    state.messages.map(message => (
                      <article className={styles.messageCard} key={message.id}>
                        <div className={styles.messageMeta}>
                          <span>
                            {message.sender_id === state.currentProfileId
                              ? "You"
                              : "Community member"}
                          </span>
                          <time dateTime={message.created_at}>
                            {formattedDate(message.created_at)}
                            {message.edited_at ? " · edited" : ""}
                          </time>
                        </div>
                        <p className={styles.messageBody}>
                          {message.body || "This message has no text."}
                        </p>
                        {message.sender_id !== state.currentProfileId && (
                          <button
                            type="button"
                            className={styles.reportButton}
                            onClick={() => {
                              setReportingMessageId(message.id);
                              setReportReason("unsafe content");
                            }}
                            disabled={busy}
                            aria-label={`Report message from ${formattedDate(message.created_at)}`}
                          >
                            Report message
                          </button>
                        )}
                        {reportingMessageId === message.id && (
                          <form
                            className={styles.reportForm}
                            onSubmit={event => void handleReport(event)}
                          >
                            <label htmlFor={`report-reason-${message.id}`}>
                              Why are you reporting this message?
                            </label>
                            <select
                              id={`report-reason-${message.id}`}
                              value={reportReason}
                              onChange={event =>
                                setReportReason(event.target.value)
                              }
                              disabled={busy}
                            >
                              <option value="unsafe content">
                                Unsafe content
                              </option>
                              <option value="bullying or harassment">
                                Bullying or harassment
                              </option>
                              <option value="spam">Spam</option>
                              <option value="other">Other</option>
                            </select>
                            <div className={styles.reportActions}>
                              <button
                                type="submit"
                                className={styles.primaryButton}
                                disabled={busy}
                              >
                                Submit report
                              </button>
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => setReportingMessageId(null)}
                                disabled={busy}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}
                      </article>
                    ))
                  )}
                </div>
                <form
                  className={styles.composer}
                  onSubmit={event => void handleSend(event)}
                >
                  <label htmlFor="community-message">
                    Write a message to this channel
                  </label>
                  <textarea
                    id="community-message"
                    value={messageDraft}
                    onChange={event =>
                      setMessageDraft(event.target.value.slice(0, 2000))
                    }
                    maxLength={2000}
                    rows={3}
                    placeholder="Keep it kind and focused on learning."
                    disabled={busy}
                    required
                  />
                  <div className={styles.composerFooter}>
                    <span className={styles.muted}>
                      {messageDraft.length}/2,000
                    </span>
                    <button
                      type="submit"
                      className={styles.primaryButton}
                      disabled={busy || !messageDraft.trim()}
                    >
                      Send message
                    </button>
                  </div>
                </form>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
