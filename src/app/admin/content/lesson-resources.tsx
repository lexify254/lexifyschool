"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createPrivateObjectPath, getMaxUploadBytes, validateUploadHeader } from "@/lib/security/file-upload";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export type AdminLessonResource = {
  id: string;
  title: string;
  mime_type: string | null;
  is_downloadable: boolean;
};

const MAX_BYTES = 100 * 1024 * 1024;
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp";

export function LessonResources({
  lessonId,
  resources,
}: {
  lessonId: string;
  resources: AdminLessonResource[];
}) {
  const inputId = useId();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");
    const title = String(formData.get("title") ?? "").trim();
    if (!(file instanceof File) || file.size === 0) {
      setOk(false);
      setMessage("Choose a file to upload.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setOk(false);
      setMessage("Files must be 100 MiB or smaller.");
      return;
    }
    if (!title || title.length > 160) {
      setOk(false);
      setMessage("Enter a file title of 1–160 characters.");
      return;
    }

    setPending(true);
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    let uploadedPath: string | null = null;
    let attachmentRequestPending = false;
    let attachmentRejected = false;
    try {
      if (!supabase) throw new Error("Upload service is not configured.");
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Sign in as an administrator to upload files.");
      const configuredLimit = getMaxUploadBytes(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB);
      const maxBytes = configuredLimit ?? MAX_BYTES;
      const header = new Uint8Array(await file.slice(0, 32).arrayBuffer());
      const extension = validateUploadHeader(file.name, file.type, header, file.size, maxBytes);
      if (!extension) throw new Error("File type, extension, signature, or size is not allowed.");
      const path = createPrivateObjectPath(auth.user.id, "course-content", extension);
      if (!path) throw new Error("A secure upload path could not be created.");

      const { error: storageError } = await supabase.storage
        .from("course-content")
        .upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
      if (storageError) throw new Error(storageError.message || "The file could not be uploaded to private storage.");
      uploadedPath = path;

      attachmentRequestPending = true;
      const response = await fetch("/api/lesson-resources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonId, title, path }),
      });
      attachmentRequestPending = false;
      const result = await response.json().catch(() => null) as { error?: unknown } | null;
      if (!response.ok) {
        attachmentRejected = true;
        const fallback = response.status === 413
          ? "Upload details exceed the request limit."
          : "The file could not be verified or attached to this lesson.";
        throw new Error(typeof result?.error === "string" ? result.error : fallback);
      }
      uploadedPath = null;
      setOk(true);
      setMessage("File uploaded and attached to this lesson.");
      form.reset();
      router.refresh();
    } catch (error) {
      if (uploadedPath && supabase && (!attachmentRequestPending || attachmentRejected)) {
        const { error: cleanupError } = await supabase.storage.from("course-content").remove([uploadedPath]);
        if (cleanupError) console.error("[Lexify] Failed to clean up an unreferenced course upload.");
      }
      setOk(false);
      setMessage(attachmentRequestPending
        ? "Upload status is uncertain. Refresh this lesson before retrying to check whether the file was attached."
        : error instanceof Error ? error.message : "The file could not be uploaded.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="admin-lesson-resources" aria-label={`Files for lesson ${lessonId}`}>
      <h4>Lesson files</h4>
      {resources.length ? (
        <ul className="admin-lesson-resources__list">
          {resources.map(resource => (
            <li key={resource.id}>
              {resource.is_downloadable ? (
                <a href={`/api/lesson-resources/${encodeURIComponent(resource.id)}/download`}>{resource.title}</a>
              ) : (
                <span>{resource.title} (download disabled)</span>
              )}
              <small>{resource.mime_type || "Learning file"}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="admin-lesson-resources__empty">No files attached yet.</p>
      )}
      <form className="admin-lesson-resources__form" onSubmit={submit}>
        <div className="admin-field">
          <label htmlFor={`${inputId}-title`}>File title</label>
          <input id={`${inputId}-title`} name="title" type="text" maxLength={160} required placeholder="e.g. Week 1 revision notes" disabled={pending} />
        </div>
        <div className="admin-field">
          <label htmlFor={`${inputId}-file`}>Choose PDF, Office document, text, or image (max 100 MiB)</label>
          <input id={`${inputId}-file`} name="file" type="file" accept={ACCEPT} required disabled={pending} />
        </div>
        <button className="admin-submit" type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload and attach file"}
        </button>
        {message ? <p className="admin-form-message" data-ok={ok ? "true" : "false"} role="status">{message}</p> : null}
      </form>
      <p className="admin-lesson-resources__note">Files upload directly to private storage (not through the website server), are checked for type and signature, and are not malware-scanned.</p>
    </section>
  );
}
