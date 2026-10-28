import { describe, expect, it } from "vitest";
import {
  createPrivateObjectPath,
  getMalwareScannerConfig,
  getMaxUploadBytes,
  isExplicitlyPrivateBucket,
  isSafePrivateObjectPath,
  UPLOAD_BUCKET_ROLES,
  validateUploadFile,
} from "./file-upload";

const userId = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";
const objectId = "6ba7b811-9dad-41d1-80b4-00c04fd430c8";

describe("secure upload policy", () => {
  it("requires an explicit, bounded upload-size configuration", () => {
    expect(getMaxUploadBytes(undefined)).toBeNull();
    expect(getMaxUploadBytes("0")).toBeNull();
    expect(getMaxUploadBytes("51")).toBeNull();
    expect(getMaxUploadBytes("invalid")).toBeNull();
    expect(getMaxUploadBytes("12")).toBe(12 * 1024 * 1024);
  });

  it("fails closed unless an HTTPS malware scanner is configured", () => {
    expect(
      getMalwareScannerConfig({ MALWARE_SCAN_PROVIDER: "none" })
    ).toBeNull();
    expect(
      getMalwareScannerConfig({
        MALWARE_SCAN_PROVIDER: "http",
        MALWARE_SCAN_API_URL: "http://scanner.example/scan",
        MALWARE_SCAN_API_KEY: "test-key",
      })
    ).toBeNull();
    expect(
      getMalwareScannerConfig({
        MALWARE_SCAN_PROVIDER: "http",
        MALWARE_SCAN_API_URL: "https://scanner.example/scan",
        MALWARE_SCAN_API_KEY: "test-key",
      })
    ).toEqual({ url: "https://scanner.example/scan", apiKey: "test-key" });
  });

  it("allows only the explicitly assigned private-storage roles", () => {
    expect(UPLOAD_BUCKET_ROLES).toEqual({
      materials: "teacher",
      homework: "student",
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
