import { expect, test } from "@playwright/test";
import { NotificationDeliveryStatus } from "@prisma/client";
import { deliveryFailureTransition, deliverySuccessTransition, externalDeliveryIdempotencyKey, retryAt } from "@/lib/notification-delivery-policy";

test.describe("notification delivery queue policy", () => {
  const now = new Date("2026-07-23T12:00:00.000Z");

  test("records provider message ID after a successful send", () => {
    expect(deliverySuccessTransition("re_123", now)).toEqual({ status: NotificationDeliveryStatus.SENT, providerMessageId: "re_123", sentAt: now });
  });

  test("schedules transient failures with exponential backoff", () => {
    const transition = deliveryFailureTransition({ attempts: 2, maxAttempts: 5, error: new Error("timeout from provider"), now });
    expect(transition.status).toBe(NotificationDeliveryStatus.RETRYING);
    expect(transition.nextAttemptAt).toEqual(retryAt(2, now));
    expect(transition.error).toContain("timeout");
  });

  test("marks invalid recipients and exhausted retries permanently failed", () => {
    expect(deliveryFailureTransition({ attempts: 1, maxAttempts: 5, error: new Error("422 invalid recipient"), now }).status).toBe(NotificationDeliveryStatus.PERMANENTLY_FAILED);
    expect(deliveryFailureTransition({ attempts: 5, maxAttempts: 5, error: new Error("timeout"), now }).status).toBe(NotificationDeliveryStatus.PERMANENTLY_FAILED);
  });

  test("uses stable idempotency keys without crossing organization boundaries", () => {
    const base = { to: "person@example.com", title: "Aviso", body: "Contenido", link: "/app/actions" };
    expect(externalDeliveryIdempotencyKey({ organizationId: "org-a", ...base })).toBe(externalDeliveryIdempotencyKey({ organizationId: "org-a", ...base }));
    expect(externalDeliveryIdempotencyKey({ organizationId: "org-a", ...base })).not.toBe(externalDeliveryIdempotencyKey({ organizationId: "org-b", ...base }));
  });
});
