export const ONBOARDING_CHECKLIST_IDS = ["org-profile", "process", "document", "gap", "risk", "action"] as const;

export function onboardingProgress(done: boolean[]) {
  if (!done.length) return 0;
  return Math.round((done.filter(Boolean).length / done.length) * 100);
}

export function trialDaysRemaining(trialEndsAt: Date | null, now = new Date()) {
  if (!trialEndsAt) return null;
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86_400_000));
}
