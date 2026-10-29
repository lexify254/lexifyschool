import { describe, expect, it } from "vitest";
import { resolveSupabaseConfig } from "./config";

const projectUrl = "https://example.supabase.co";
const publishableKey = "sb_publishable_example123";
const legacyAnonKey = "eyJhbGciOiJIUzI1NiJ9.payload.signature";

describe("resolveSupabaseConfig", () => {
  it("keeps a correctly ordered URL and publishable key", () => {
    expect(resolveSupabaseConfig(projectUrl, publishableKey)).toEqual({
      url: projectUrl,
      key: publishableKey,
    });
  });

  it("repairs the configured URL and publishable key when they are reversed", () => {
    expect(resolveSupabaseConfig(publishableKey, projectUrl)).toEqual({
      url: projectUrl,
      key: publishableKey,
    });
  });

  it("supports a correctly ordered legacy anon JWT", () => {
    expect(resolveSupabaseConfig(projectUrl, legacyAnonKey)).toEqual({
      url: projectUrl,
      key: legacyAnonKey,
    });
  });

  it("repairs a reversed legacy anon JWT", () => {
    expect(resolveSupabaseConfig(legacyAnonKey, projectUrl)).toEqual({
      url: projectUrl,
      key: legacyAnonKey,
    });
  });

  it("rejects incomplete values and service-role keys", () => {
    expect(resolveSupabaseConfig(undefined, publishableKey)).toBeNull();
    expect(resolveSupabaseConfig(projectUrl, "sb_secret_do_not_use")).toBeNull();
  });
});
