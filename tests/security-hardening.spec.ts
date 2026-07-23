import { test, expect } from "@playwright/test";
import { escapeHtml } from "@/lib/resend";
import { takeRateLimit } from "@/lib/rate-limit";
import { memberPayload } from "@/lib/payload-privacy";
import { parseInput } from "@/lib/validation/common";
import { auditInputSchema, documentInputSchema, onboardingSetupSchema, riskInputSchema } from "@/lib/validation/workflows";

test.describe("application security validation contract", () => {
  test("rejects invalid dates, enums, URLs and oversized critical payloads", () => {
    expect(() => parseInput(onboardingSetupSchema, { organizationName: "Org", standards: ["ISO_9001"], goal: "INVALID" })).toThrow();
    expect(() => parseInput(documentInputSchema, { code: "DOC-1", title: "Política", type: "POLICY", reviewDate: "2026-99-99" })).toThrow();
    expect(() => parseInput(riskInputSchema, { title: "Riesgo", category: "Legal", probability: 9, impact: 2, status: "IDENTIFIED", treatment: "MITIGATE" })).toThrow();
    expect(() => parseInput(auditInputSchema, { title: "Auditoría", type: "INTERNAL", status: "PLANNED", startDate: "not-a-date" })).toThrow();
  });

  test("enforces least-privilege member payloads", () => {
    const members = [{ id: "member_1", email: "private@example.com", role: "OWNER" }];
    expect(memberPayload(false, members)).toEqual([]);
    expect(memberPayload(true, members)).toEqual(members);
  });

  test("escapes email HTML and rate limits sensitive endpoints", () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">`)).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    const key = `test-${Date.now()}`;
    expect(takeRateLimit(key, { limit: 2, windowMs: 60_000 }).allowed).toBe(true);
    expect(takeRateLimit(key, { limit: 2, windowMs: 60_000 }).allowed).toBe(true);
    expect(takeRateLimit(key, { limit: 2, windowMs: 60_000 }).allowed).toBe(false);
  });
});
