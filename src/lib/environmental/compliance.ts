/**
 * Environmental compliance state (ISO 14001:2015 §9.1.2 — evaluation of
 * compliance obligations). Pure helpers so overdue/non-compliant logic can be
 * unit-tested and shared by actions and reports.
 */
import type { EnvironmentalComplianceResult } from "@prisma/client";

/**
 * A compliance obligation's review is overdue when a review date has passed and
 * no evaluation has been performed on/after that date. `lastEvaluatedAt` is the
 * date of the most recent evaluation (null when never evaluated).
 */
export function isEvaluationOverdue(
  reviewDate: Date | null | undefined,
  lastEvaluatedAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!reviewDate) return false;
  if (reviewDate.getTime() > now.getTime()) return false;
  if (!lastEvaluatedAt) return true;
  return lastEvaluatedAt.getTime() < reviewDate.getTime();
}

/** A result that represents a compliance gap requiring a derived action. */
export function isNonCompliant(result: EnvironmentalComplianceResult | null | undefined): boolean {
  return result === "NON_COMPLIANT" || result === "PARTIAL";
}

export type ComplianceState = {
  overdue: boolean;
  nonCompliant: boolean;
  neverEvaluated: boolean;
};

export function complianceState(
  reviewDate: Date | null | undefined,
  lastEvaluatedAt: Date | null | undefined,
  lastResult: EnvironmentalComplianceResult | null | undefined,
  now: Date = new Date(),
): ComplianceState {
  return {
    overdue: isEvaluationOverdue(reviewDate, lastEvaluatedAt, now),
    nonCompliant: isNonCompliant(lastResult),
    neverEvaluated: !lastEvaluatedAt,
  };
}
