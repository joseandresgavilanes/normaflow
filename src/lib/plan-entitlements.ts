import type { LiveAppContext } from "@/lib/app-context";
import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS, planHasModule, planAllowsAI, type PlanKey } from "@/lib/constants";

export class PlanLimitError extends Error {
  constructor(public readonly feature: string, message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

export function isTrialActive(trialEndsAt: Date | null | undefined, now = new Date()) {
  return Boolean(trialEndsAt && trialEndsAt > now);
}

export function canUseModule(organization: { plan: string; trialEndsAt?: Date | null }, module: string) {
  return planHasModule(organization.plan, module, isTrialActive(organization.trialEndsAt));
}

export function canUseAI(organization: { plan: string; trialEndsAt?: Date | null }) {
  return planAllowsAI(organization.plan, isTrialActive(organization.trialEndsAt));
}

export async function assertSubscriptionUsable(organizationId: string, now = new Date()) {
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { trialEndsAt: true, subscription: { select: { status: true, gracePeriodEndsAt: true } } } });
  if (!organization) throw new PlanLimitError("organization", "La organización no existe.");
  if (isTrialActive(organization.trialEndsAt, now)) return;
  const status = organization.subscription?.status;
  if (status === "ACTIVE" || status === "TRIALING") return;
  if (status === "GRACE_PERIOD" && organization.subscription?.gracePeriodEndsAt && organization.subscription.gracePeriodEndsAt > now) return;
  throw new PlanLimitError("billing", "La suscripción no está activa. Actualiza Billing para continuar.");
}

export function assertPlanModule(ctx: LiveAppContext, module: string) {
  if (!canUseModule(ctx.organization, module)) {
    throw new PlanLimitError(module, `El módulo ${module} está incluido desde Growth. Actualiza tu plan para continuar.`);
  }
}

export async function assertExportQuota(organizationId: string, plan: PlanKey, now = new Date()) {
  await assertSubscriptionUsable(organizationId, now);
  const limit = PLAN_LIMITS[plan].exportsPerMonth;
  if (limit == null) return;
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const count = await prisma.reportExport.count({ where: { organizationId, createdAt: { gte: from } } });
  if (count >= limit) {
    throw new PlanLimitError("reporting:export", `Has alcanzado el límite de ${limit} exportes mensuales del plan ${PLAN_LIMITS[plan].label}. Actualiza tu plan para continuar.`);
  }
}

/**
 * Monthly per-org token budget for the AI assistant. Independent of the
 * per-minute rate limit (src/app/api/ai/route.ts) — this caps cumulative
 * spend across the month, not burst rate. Backed by `AIGeneratedOutput.tokensUsed`,
 * the same governance ledger every AI call now writes to (see recordAIOutput).
 */
export async function assertAIBudget(organizationId: string, plan: PlanKey, now = new Date()) {
  const limit = PLAN_LIMITS[plan].aiMonthlyTokenBudget;
  if (limit == null) return;
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const usage = await prisma.aIGeneratedOutput.aggregate({
    where: { organizationId, generatedAt: { gte: from } },
    _sum: { tokensUsed: true },
  });
  const used = usage._sum.tokensUsed ?? 0;
  if (used >= limit) {
    throw new PlanLimitError("aims:budget", `Has alcanzado el presupuesto mensual de ${limit.toLocaleString()} tokens de IA del plan ${PLAN_LIMITS[plan].label}. Actualiza tu plan para continuar.`);
  }
}

export function planEntitlements(plan: string, trialEndsAt?: Date | null) {
  const key = (plan in PLAN_LIMITS ? plan : "STARTER") as PlanKey;
  const trial = isTrialActive(trialEndsAt);
  const limits = PLAN_LIMITS[key];
  return {
    plan: key,
    trialActive: trial,
    maxUsers: limits.maxUsers,
    storageGb: limits.storageGb,
    exportsPerMonth: limits.exportsPerMonth,
    ai: trial || limits.ai,
    modules: trial ? ["*"] : limits.modules,
  };
}
