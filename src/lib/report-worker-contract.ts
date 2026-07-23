export type ReportWorkerState = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

export function reportRetryDelayMs(attempt: number): number {
  const normalized = Math.max(1, Math.trunc(attempt));
  return Math.min(60 * 60_000, 5_000 * (2 ** (normalized - 1)));
}

export function canClaimReport(state: ReportWorkerState, nextAttemptAt: Date, now = new Date()): boolean {
  return state === "QUEUED" && nextAttemptAt.getTime() <= now.getTime();
}

export function nextReportState(attempt: number, maxAttempts: number): "QUEUED" | "FAILED" {
  return attempt < maxAttempts ? "QUEUED" : "FAILED";
}
