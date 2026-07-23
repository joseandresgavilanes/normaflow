import Stripe from "stripe";
import { PLAN_CATALOG, assertPlanCatalogIntegrity, type PlanKey } from "@/lib/constants";

let stripeClient: Stripe | null = null;

function configured(value: string | undefined) {
  return Boolean(value && !value.includes("...") && !value.endsWith("_") && !value.includes("placeholder"));
}

const PRICE_ENV_BY_PLAN: Record<Exclude<PlanKey, "ENTERPRISE">, "STRIPE_PRICE_STARTER" | "STRIPE_PRICE_GROWTH"> = {
  STARTER: "STRIPE_PRICE_STARTER",
  GROWTH: "STRIPE_PRICE_GROWTH",
};

export function stripePriceIdForPlan(plan: PlanKey, env: Record<string, string | undefined> = process.env): string | null {
  if (!PLAN_CATALOG[plan].checkout) return null;
  return env[PRICE_ENV_BY_PLAN[plan as Exclude<PlanKey, "ENTERPRISE">]]?.trim() || null;
}

export function assertStripePlanConfiguration(env: Record<string, string | undefined> = process.env): void {
  assertPlanCatalogIntegrity();
  for (const plan of ["STARTER", "GROWTH"] as const) {
    const priceId = stripePriceIdForPlan(plan, env);
    if (!priceId || !/^price_[A-Za-z0-9]+$/.test(priceId)) {
      throw new Error(`${PRICE_ENV_BY_PLAN[plan]} debe contener un Stripe Price ID válido para ${PLAN_CATALOG[plan].label}.`);
    }
  }
}

export function isStripeConfigured() {
  return configured(process.env.STRIPE_SECRET_KEY) && configured(process.env.STRIPE_WEBHOOK_SECRET) &&
    ["STARTER", "GROWTH"].every((plan) => Boolean(stripePriceIdForPlan(plan as "STARTER" | "GROWTH")));
}

export function getStripe() {
  if (!configured(process.env.STRIPE_SECRET_KEY)) {
    throw new Error("Stripe no está configurado en este entorno.");
  }
  stripeClient ??= new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-04-10",
    typescript: true,
  });
  return stripeClient;
}

export const PLANS = Object.fromEntries(
  (Object.keys(PLAN_CATALOG) as PlanKey[]).map((key) => {
    const plan = PLAN_CATALOG[key];
    return [key, {
      name: plan.label,
      price: plan.monthlyUsd,
      currency: plan.currency,
      priceId: stripePriceIdForPlan(key),
      features: plan.features,
      limits: { users: plan.maxUsers, storage: plan.storageGb, exports: plan.exportsPerMonth },
      modules: plan.modules,
      ai: plan.ai,
    }];
  }),
) as Record<PlanKey, { name: string; price: number | null; currency: "usd"; priceId: string | null; features: readonly string[]; limits: { users: number | null; storage: number | null; exports: number | null }; modules: readonly string[]; ai: boolean }>;

export function isPlanCheckoutConfigured(plan: PlanKey) {
  return PLAN_CATALOG[plan].checkout && configured(PLANS[plan].priceId ?? undefined);
}
