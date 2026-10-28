export type CommunityConsentFact = {
  guardianId: string | null;
  granted: boolean;
  withdrawnAt: string | null;
};

export type CommunityAccessFacts = {
  role: string | null;
  suspended: boolean | null;
  learnerSettingEnabled: boolean | null;
  parentAccessAllowed: boolean | null;
  confirmedGuardianIds: string[] | null;
  consents: CommunityConsentFact[] | null;
};

export type CommunityAccessDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | "not_student"
        | "suspended"
        | "learner_setting_off"
        | "parent_control_off"
        | "guardian_consent_missing"
        | "safeguard_unavailable";
    };

/**
 * Community entry is deliberately fail-closed. A consent record counts only
 * when it is active and was granted by a currently confirmed guardian.
 */
export function evaluateCommunityAccess(
  facts: CommunityAccessFacts
): CommunityAccessDecision {
  if (
    facts.role === null ||
    facts.suspended === null ||
    facts.learnerSettingEnabled === null ||
    facts.parentAccessAllowed === null ||
    facts.confirmedGuardianIds === null ||
    facts.consents === null
  ) {
    return { allowed: false, reason: "safeguard_unavailable" };
  }

  if (facts.role !== "student")
    return { allowed: false, reason: "not_student" };
  if (facts.suspended) return { allowed: false, reason: "suspended" };
  if (!facts.learnerSettingEnabled)
    return { allowed: false, reason: "learner_setting_off" };
  if (!facts.parentAccessAllowed)
    return { allowed: false, reason: "parent_control_off" };

  const confirmedGuardianIds = new Set(facts.confirmedGuardianIds);
  const hasCurrentGuardianConsent = facts.consents.some(
    consent =>
      consent.granted &&
      consent.withdrawnAt === null &&
      consent.guardianId !== null &&
      confirmedGuardianIds.has(consent.guardianId)
  );

  return hasCurrentGuardianConsent
    ? { allowed: true }
    : { allowed: false, reason: "guardian_consent_missing" };
}
