import { describe, expect, it } from "vitest";
import { evaluateCommunityAccess, type CommunityAccessFacts } from "./policy";

const allowedFacts: CommunityAccessFacts = {
  role: "student",
  suspended: false,
  learnerSettingEnabled: true,
  parentAccessAllowed: true,
  confirmedGuardianIds: ["guardian-1"],
  consents: [{ guardianId: "guardian-1", granted: true, withdrawnAt: null }],
};

describe("evaluateCommunityAccess", () => {
  it("allows a student only when all required safeguards are satisfied", () => {
    expect(evaluateCommunityAccess(allowedFacts)).toEqual({ allowed: true });
  });

  it.each([
    ["role", { role: "parent" }],
    ["suspension", { suspended: true }],
    ["learner setting", { learnerSettingEnabled: false }],
    ["parent setting", { parentAccessAllowed: false }],
    ["missing guardian link", { confirmedGuardianIds: [] }],
    [
      "withdrawn consent",
      {
        consents: [
          {
            guardianId: "guardian-1",
            granted: true,
            withdrawnAt: "2026-01-01",
          },
        ],
      },
    ],
    [
      "denied consent",
      {
        consents: [
          { guardianId: "guardian-1", granted: false, withdrawnAt: null },
        ],
      },
    ],
    [
      "unlinked guardian consent",
      {
        consents: [
          { guardianId: "stranger", granted: true, withdrawnAt: null },
        ],
      },
    ],
    [
      "no guardian id",
      { consents: [{ guardianId: null, granted: true, withdrawnAt: null }] },
    ],
  ])("denies access when %s is not satisfied", (_case, changes) => {
    expect(
      evaluateCommunityAccess({
        ...allowedFacts,
        ...changes,
      } as CommunityAccessFacts).allowed
    ).toBe(false);
  });

  it.each([
    ["role", { role: null }],
    ["suspension state", { suspended: null }],
    ["learner setting", { learnerSettingEnabled: null }],
    ["parent setting", { parentAccessAllowed: null }],
    ["guardian links", { confirmedGuardianIds: null }],
    ["consent records", { consents: null }],
  ])("fails closed when %s cannot be verified", (_case, changes) => {
    expect(
      evaluateCommunityAccess({
        ...allowedFacts,
        ...changes,
      } as CommunityAccessFacts)
    ).toEqual({
      allowed: false,
      reason: "safeguard_unavailable",
    });
  });
});
