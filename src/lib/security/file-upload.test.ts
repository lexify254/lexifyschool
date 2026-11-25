import { describe, expect, it } from "vitest";
import {
  createPrivateObjectPath,
  getMaxUploadBytes,
  isExplicitlyPrivateBucket,
  isSafePrivateObjectPath,
  UPLOAD_BUCKET_ROLES,
  validateUploadHeader,
  validateUploadFile,
} from "./file-upload";

const userId = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";
const objectId = "6ba7b811-9dad-41d1-80b4-00c04fd430c8";

describe("secure upload policy", () => {
  it("defaults to 100 MiB and rejects invalid or over-cap overrides", () => {
    expect(getMaxUploadBytes(undefined)).toBe(100 * 1024 * 1024);
    expect(getMaxUploadBytes("0")).toBeNull();
    expect(getMaxUploadBytes("101")).toBeNull();
    expect(getMaxUploadBytes("invalid")).toBeNull();
    expect(getMaxUploadBytes("12")).toBe(12 * 1024 * 1024);
    expect(getMaxUploadBytes("100")).toBe(100 * 1024 * 1024);
  });

  it("allows only the explicitly assigned private-storage roles", () => {
    expect(UPLOAD_BUCKET_ROLES).toEqual({
      materials: "teacher",
      homework: "student",
      "course-content": "admin",
    });
    expect(isExplicitlyPrivateBucket({ public: false })).toBe(true);
    expect(isExplicitlyPrivateBucket({ public: true })).toBe(false);
    expect(isExplicitlyPrivateBucket({})).toBe(false);
    expect(isExplicitlyPrivateBucket(null)).toBe(false);
  });

  it("generates owner-scoped object paths and rejects traversal or malformed identities", () => {
    const path = createPrivateObjectPath(userId, "materials", "pdf", objectId);
    expect(path).toBe(`${userId}/${objectId}.pdf`);
    expect(isSafePrivateObjectPath(path!, userId)).toBe(true);
    expect(isSafePrivateObjectPath(`${userId}/${objectId}.html`, userId)).toBe(false);
    expect(
      isSafePrivateObjectPath(`${userId}/../${objectId}.pdf`, userId)
    ).toBe(false);
    expect(isSafePrivateObjectPath(`/${userId}/${objectId}.pdf`, userId)).toBe(
      false
    );
    expect(
      createPrivateObjectPath("not-a-uuid", "materials", "pdf", objectId)
    ).toBeNull();
    expect(
      createPrivateObjectPath(userId, "avatars", "pdf", objectId)
    ).toBeNull();
    expect(
      createPrivateObjectPath(userId, "constructor", "pdf", objectId)
    ).toBeNull();
  });

  it("requires an allowed filename, matching MIME/extension, size, and file signature", () => {
    const pdf = new TextEncoder().encode("%PDF-1.7 sample");
    expect(
      validateUploadFile("lesson.pdf", "application/pdf", pdf, pdf.length, 1024)
    ).toBe("pdf");
    expect(
      validateUploadFile("lesson.png", "application/pdf", pdf, pdf.length, 1024)
    ).toBeNull();
    const officeDocument = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    expect(validateUploadHeader(
      "notes.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      officeDocument,
      100,
      1024
    )).toBe("docx");
    expect(validateUploadFile(
      "notes.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      officeDocument,
      officeDocument.length,
      1024
    )).toBe("docx");
    expect(validateUploadFile("notes.docx", "application/pdf", officeDocument, officeDocument.length, 1024)).toBeNull();
    const legacyOffice = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(validateUploadFile("notes.doc", "application/msword", legacyOffice, legacyOffice.length, 1024)).toBe("doc");
    const csv = new TextEncoder().encode("subject,score\nmath,90");
    expect(validateUploadFile("scores.csv", "text/csv", csv, csv.length, 1024)).toBe("csv");
    expect(
      validateUploadFile(
        "../../lesson.pdf",
        "application/pdf",
        pdf,
        pdf.length,
        1024
      )
    ).toBeNull();
    expect(
      validateUploadFile(
        "lesson.pdf",
        "application/pdf",
        new TextEncoder().encode("not a pdf"),
        9,
        1024
      )
    ).toBeNull();
    expect(
      validateUploadFile(
        "lesson.pdf",
        "application/pdf",
        pdf,
        pdf.length,
        pdf.length - 1
      )
    ).toBeNull();
    expect(
      validateUploadFile(
        "payload.html",
        "text/html",
        new TextEncoder().encode("<script>"),
        8,
        1024
      )
    ).toBeNull();
  });
});
