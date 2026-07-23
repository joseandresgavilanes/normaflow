import { test, expect } from "@playwright/test";
import { PLAN_CATALOG, PLAN_LIMITS, assertPlanCatalogIntegrity, planAllowsAI, planHasModule } from "@/lib/constants";
import { assertStripePlanConfiguration } from "@/lib/stripe";
import { isTrialActive } from "@/lib/plan-entitlements";
import { subscriptionStatus, subscriptionPlan } from "@/lib/stripe-webhook";

test.describe("billing comercial y Stripe", () => {
  test("has one validated catalog and requires Stripe IDs for each self-serve plan", () => {
    expect(() => assertPlanCatalogIntegrity()).not.toThrow();
    expect(PLAN_CATALOG.STARTER.monthlyUsd).toBe(149);
    expect(PLAN_CATALOG.GROWTH.monthlyUsd).toBe(449);
    expect(PLAN_CATALOG.ENTERPRISE.monthlyUsd).toBeNull();
    expect(() => assertStripePlanConfiguration({ STRIPE_PRICE_STARTER: "price_starter123", STRIPE_PRICE_GROWTH: "price_growth123" })).not.toThrow();
    expect(() => assertStripePlanConfiguration({ STRIPE_PRICE_STARTER: "price_starter123" })).toThrow(/STRIPE_PRICE_GROWTH/i);
  });

  test("expone las cuotas comerciales solicitadas", () => {
    expect(PLAN_LIMITS.STARTER.saasMonthlyUsd).toBe(149);
    expect(PLAN_LIMITS.STARTER.maxUsers).toBe(5);
    expect(PLAN_LIMITS.STARTER.storageGb).toBe(10);
    expect(PLAN_LIMITS.GROWTH.saasMonthlyUsd).toBe(449);
    expect(PLAN_LIMITS.GROWTH.maxUsers).toBe(20);
    expect(PLAN_LIMITS.GROWTH.storageGb).toBe(50);
    expect(planAllowsAI("STARTER", false)).toBe(false);
    expect(planAllowsAI("STARTER", true)).toBe(true);
    expect(planHasModule("STARTER", "documents")).toBe(true);
    expect(planHasModule("STARTER", "integrations")).toBe(false);
  });

  test("reconoce trial y estados críticos de suscripción", () => {
    expect(isTrialActive(new Date("2026-07-30"), new Date("2026-07-22"))).toBe(true);
    expect(isTrialActive(new Date("2026-07-21"), new Date("2026-07-22"))).toBe(false);
    expect(subscriptionStatus("active")).toBe("ACTIVE");
    expect(subscriptionStatus("past_due")).toBe("PAST_DUE");
    expect(subscriptionStatus("canceled")).toBe("CANCELLED");
  });

  test("infiere el plan del metadata de Stripe", () => {
    const subscription = { metadata: { plan: "GROWTH" }, items: { data: [{ price: { id: "price-not-used" } }] } } as never;
    expect(subscriptionPlan(subscription)).toBe("GROWTH");
  });

  test("billing demo muestra precios USD y límites", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "demo@normaflow.io");
    await page.fill("input[type='password']", "NormaFlow2025!");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/app\/dashboard/);
    await page.goto("/app/billing");
    await expect(page.getByText(/Billing y suscripción/i)).toBeVisible();
    await expect(page.getByText(/\$149/).first()).toBeVisible();
    await expect(page.getByText(/\$449/).first()).toBeVisible();
    await expect(page.getByText(/Hasta 20 usuarios/)).toBeVisible();
  });
});
