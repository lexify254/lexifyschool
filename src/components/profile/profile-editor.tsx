"use client";

import { useMemo, useState, type FormEvent, type ChangeEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AppRole } from "@/lib/auth/roles";

type ProfileEditorProps = {
  profile: { id: string; full_name: string; role: AppRole };
  avatarUrl: string | null;
  studentCode: string | null;
  linkState: string;
};

type Notice = { text: string; ok: boolean } | null;

export function ProfileEditor({ profile, avatarUrl, studentCode, linkState }: ProfileEditorProps) {
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [fullName, setFullName] = useState(profile.full_name);
  const [photoUrl, setPhotoUrl] = useState(avatarUrl);
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [studentId, setStudentId] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [studentCodeNotice, setStudentCodeNotice] = useState("");
  const [linkNotice, setLinkNotice] = useState<Notice>(
    linkState === "requested"
      ? { text: "Your link request was sent. Your child must confirm it before you can view their school information.", ok: true }
      : linkState === "retry"
        ? { text: "We could not submit that link request. Check the student ID and try again below.", ok: false }
        : null
  );

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || savingName) return;
    const value = fullName.trim();
    if (!value || value.length > 120) {
      setNotice({ text: "Enter a name using 1 to 120 characters.", ok: false });
      return;
    }
    setSavingName(true);
    setNotice(null);
    try {
      const { data: auth } = await client.auth.getUser();
      if (!auth.user || auth.user.id !== profile.id) throw new Error("Sign in again to update your profile.");
      const { data, error } = await client.from("profiles")
        .update({ full_name: value })
        .eq("id", profile.id)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("Your profile name could not be saved. Please try again.");
      setNotice({ text: "Your profile name has been saved.", ok: true });
      window.dispatchEvent(new Event("lexify:profile-updated"));
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Your profile could not be saved.", ok: false });
    } finally {
      setSavingName(false);
    }
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !client) return;
    setUploading(true);
    setNotice(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/profile/avatar", { method: "POST", body });
      const result = await response.json() as { error?: string; avatarPath?: string };
      if (!response.ok || !result.avatarPath) throw new Error(result.error || "Your profile photo could not be uploaded.");
      const { data, error } = await client.storage.from("profile-photos").createSignedUrl(result.avatarPath, 3600);
      if (error || !data?.signedUrl) throw new Error("Photo uploaded, but its private preview could not be created. Reload your profile to check it.");
      setPhotoUrl(data.signedUrl);
      setNotice({ text: "Your profile photo has been updated.", ok: true });
      window.dispatchEvent(new Event("lexify:profile-updated"));
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Your profile photo could not be uploaded.", ok: false });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function requestStudentLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || linkBusy) return;
    const code = studentId.trim().toUpperCase();
    if (!/^LEX-[A-F0-9]{16}$/.test(code)) {
      setLinkNotice({ text: "Enter the student ID exactly as shown on the learner’s profile.", ok: false });
      return;
    }
    setLinkBusy(true);
    setLinkNotice(null);
    try {
      const { data: auth } = await client.auth.getUser();
      if (!auth.user || auth.user.id !== profile.id) throw new Error("Sign in again to request a child link.");
      const { error } = await client.rpc("request_parent_student_link_by_code", { p_student_code: code });
      if (error) throw new Error("That student ID could not be linked. Check it and try again.");
      setStudentId("");
      setLinkNotice({ text: "Your link request was sent. Your child must confirm it before you can view their school information.", ok: true });
    } catch (error) {
      setLinkNotice({ text: error instanceof Error ? error.message : "The link request could not be sent.", ok: false });
    } finally {
      setLinkBusy(false);
    }
  }

  async function copyStudentCode() {
    if (!studentCode) return;
    try {
      await navigator.clipboard.writeText(studentCode);
      setStudentCodeNotice("Student ID copied. Share it only with your parent or guardian.");
    } catch {
      setStudentCodeNotice("Copy is unavailable in this browser. Select the student ID and copy it manually.");
    }
  }

  return (
    <div className="profile-editor">
      <section className="portal-panel" aria-labelledby="profile-details-heading">
        <span className="section-kicker">Account</span>
        <h2 id="profile-details-heading">Your profile</h2>
        <div className="profile-editor__photo-row" style={{ display: "flex", alignItems: "center", gap: 16, marginBlock: 18 }}>
          {photoUrl ? (
            <img src={photoUrl} alt="Your profile" width={76} height={76} style={{ width: 76, height: 76, objectFit: "cover", borderRadius: "50%" }} />
          ) : (
            <div aria-hidden="true" style={{ width: 76, height: 76, borderRadius: "50%", display: "grid", placeItems: "center", background: "#dbeafe", color: "#1e3a8a", fontSize: 28, fontWeight: 700 }}>
              {profile.full_name.slice(0, 1).toUpperCase() || "L"}
            </div>
          )}
          <div className="form-field">
            <label htmlFor="profile-photo">Profile picture</label>
            <input id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={uploading} />
            <small>JPEG, PNG or WebP; up to 4 MB. Your account photo is private.</small>
          </div>
        </div>
        <form className="form-grid" onSubmit={saveName}>
          <div className="form-field">
            <label htmlFor="profile-full-name">Full name</label>
            <input id="profile-full-name" value={fullName} onChange={event => setFullName(event.target.value)} maxLength={120} required />
          </div>
          <div className="form-field">
            <span className="field-label">Account type</span>
            <p>{profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}</p>
          </div>
          <button className="button button--blue" type="submit" disabled={savingName}>{savingName ? "Saving…" : "Save profile"}</button>
          {notice ? <p className={notice.ok ? "form-success" : "form-error"} role="status" aria-live="polite">{notice.text}</p> : null}
        </form>
      </section>

      {profile.role === "student" ? (
        <section className="portal-panel" aria-labelledby="student-id-heading">
          <span className="section-kicker">Parent linking</span>
          <h2 id="student-id-heading">Your student ID</h2>
          {studentCode ? <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}><p>Share <strong><code>{studentCode}</code></strong> with your parent or guardian so they can request a link.</p><button className="button button--line button--small" type="button" onClick={copyStudentCode}>Copy student ID</button></div> : <p>Your student ID is being prepared. Reload this page in a moment.</p>}
          {studentCodeNotice ? <p role="status" aria-live="polite">{studentCodeNotice}</p> : null}
          <p>A parent link stays pending until you confirm it in your Student portal. Your school information is not shared before confirmation.</p>
        </section>
      ) : null}

      {profile.role === "parent" ? (
        <section className="portal-panel" aria-labelledby="parent-link-heading">
          <span className="section-kicker">Parent account</span>
          <h2 id="parent-link-heading">Link to your child</h2>
          <p>Enter the student ID shown on your child’s profile. The child must confirm the request before their information is shared with you.</p>
          <form className="form-grid" onSubmit={requestStudentLink}>
            <div className="form-field">
              <label htmlFor="parent-student-id">Student ID</label>
              <input id="parent-student-id" value={studentId} onChange={event => setStudentId(event.target.value)} autoComplete="off" maxLength={20} placeholder="LEX-1234ABCD5678EF90" required />
            </div>
            <button className="button button--blue" type="submit" disabled={linkBusy}>{linkBusy ? "Sending…" : "Request student link"}</button>
            {linkNotice ? <p className={linkNotice.ok ? "form-success" : "form-error"} role="status" aria-live="polite">{linkNotice.text}</p> : null}
          </form>
        </section>
      ) : null}
    </div>
  );
}
