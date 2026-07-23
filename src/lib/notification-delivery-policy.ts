export const DELIVERY_MAX_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;

/** Exponential backoff: 1m, 2m, 4m, ... capped at six hours. */
export function retryAt(attempts: number, now = new Date()): Date {
  const delay = Math.min(60_000 * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
  return new Date(now.getTime() + delay);
}

/** Provider validation/bounce errors cannot become healthy through retrying. */
export function isPermanentDeliveryError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /\b(400|401|403|404|422)\b|invalid (email|recipient|address)|malformed|unsubscribed|suppressed|not configured/i.test(message);
}

export function deliveryErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error);
  return message.slice(0, 1000);
}

export function deliveryFailureTransition(input: { attempts: number; maxAttempts: number; error: unknown; now?: Date }) {
  const now = input.now ?? new Date();
  const permanent = isPermanentDeliveryError(input.error) || input.attempts >= input.maxAttempts;
  return {
    status: permanent ? NotificationDeliveryStatus.PERMANENTLY_FAILED : NotificationDeliveryStatus.RETRYING,
    nextAttemptAt: permanent ? now : retryAt(input.attempts, now),
    error: deliveryErrorMessage(input.error),
  };
}

export function deliverySuccessTransition(providerMessageId: string | null | undefined, now = new Date()) {
  return { status: NotificationDeliveryStatus.SENT, providerMessageId: providerMessageId ?? null, sentAt: now };
}

export function externalDeliveryIdempotencyKey(input: { organizationId: string; to: string; title: string; body: string; link?: string | null; idempotencyKey?: string }) {
  if (input.idempotencyKey) return input.idempotencyKey;
  return createHash("sha256").update(`${input.organizationId}\0${input.to}\0${input.title}\0${input.body}\0${input.link ?? ""}`).digest("hex");
}
import { createHash } from "crypto";
import { NotificationDeliveryStatus } from "@prisma/client";
