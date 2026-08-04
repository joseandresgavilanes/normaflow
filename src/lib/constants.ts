export const ROLES = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  SUPER_ADMIN: "Super Admin",
  ORG_ADMIN: "Admin de Organización",
  COMPLIANCE_MANAGER: "Compliance Manager",
  AUDITOR: "Auditor",
  CONTRIBUTOR: "Contribuidor",
  VIEWER: "Visor",
} as const;

// Re-export the canonical permission matrix. Kept here as `PERMISSIONS`
// for backward compatibility with existing client-side imports.
export { ROLE_PERMISSIONS as PERMISSIONS } from "@/lib/permissions/matrix";

/**
 * Single source of truth for per-plan quotas + pricing.
 * Precios en USD para mercado LATAM / internacional.
 * `maxUsers: null` significa ilimitado.
 */
export type PlanKey = "STARTER" | "GROWTH" | "ENTERPRISE";

export interface CommercialPlan {
  key: PlanKey;
  label: string;
  monthlyUsd: number | null;
  currency: "usd";
  maxUsers: number | null;
  storageGb: number | null;
  exportsPerMonth: number | null;
  ai: boolean;
  /** Tope mensual de tokens del asistente IA (null = sin tope). Solo aplica si `ai` es true. */
  aiMonthlyTokenBudget: number | null;
  modules: readonly string[];
  features: readonly string[];
  checkout: boolean;
  lifetimeUsd: number | null;
  maintenanceYearlyUsd: number | null;
}

export const ESSENTIAL_MODULES = [
  "dashboard", "setup", "gap", "documents", "records", "processes", "risks",
  "audit-program", "audits", "nonconformities", "actions", "indicators",
  "evidence", "reporting", "activity", "notifications", "billing", "settings",
  // Clause 4.2/6.2 (interested parties, objectives) and the operational
  // requirements below are mandatory for a *single* standard (9001 or 27001
  // alone) — never gated behind a higher-tier "integrated system" plan.
  "context", "quality-ops", "design-dev", "training", "management-review",
  // Starter comercializa ISO 27001 además de ISO 9001. Estos módulos son
  // parte inseparable del SGSI anunciado, no add-ons de Growth.
  "security-controls", "soa", "risk-treatment", "assets", "incidents",
] as const;

export const ALL_MODULES = [
  ...ESSENTIAL_MODULES, "training", "changes", "opportunities", "suppliers",
  "management-review", "integrations", "security-controls", "soa", "risk-treatment", "assets",
  "incidents", "vulnerabilities", "continuity",
  // Standard Pack Engine + módulos especializados por norma + Sistema Integrado.
  "standards", "environment", "safety", "integrated", "aims", "compliance", "antibribery", "energy",
  "food-safety", "itsm", "medical-devices",
] as const;

/** The only commercial-plan catalog. UI, limits and Stripe must derive from it. */
export const PLAN_CATALOG: Record<PlanKey, CommercialPlan> = {
  STARTER: {
    key: "STARTER", label: "Starter", monthlyUsd: 149, currency: "usd", maxUsers: 5, storageGb: 10, exportsPerMonth: 10, ai: false, aiMonthlyTokenBudget: 0, modules: ESSENTIAL_MODULES, checkout: true,
    lifetimeUsd: 2500, maintenanceYearlyUsd: 690,
    features: ["Hasta 5 usuarios", "ISO 9001 + ISO 27001", "Módulos esenciales", "10 GB de almacenamiento", "Soporte por correo"],
  },
  GROWTH: {
    key: "GROWTH", label: "Growth", monthlyUsd: 449, currency: "usd", maxUsers: 20, storageGb: 50, exportsPerMonth: 100, ai: true, aiMonthlyTokenBudget: 300_000, modules: ALL_MODULES, checkout: true,
    lifetimeUsd: 6900, maintenanceYearlyUsd: 1490,
    features: ["Hasta 20 usuarios", "Todos los módulos", "Asistente IA", "50 GB de almacenamiento", "Soporte prioritario", "Onboarding"],
  },
  ENTERPRISE: {
    key: "ENTERPRISE", label: "Enterprise", monthlyUsd: null, currency: "usd", maxUsers: null, storageGb: null, exportsPerMonth: null, ai: true, aiMonthlyTokenBudget: null, modules: ALL_MODULES, checkout: false,
    lifetimeUsd: null, maintenanceYearlyUsd: null,
    // "SSO" y "API e integraciones" se anunciaban como incluidas y no existen
    // en el código: no hay ninguna implementación de SAML/OIDC (el único
    // resultado es un dato simulado del seed demo) y src/app/api solo expone
    // auth, health, internal, ai, cron y webhooks — nada público. Venderlas
    // como disponibles es riesgo contractual, no solo de marketing, así que
    // quedan marcadas hasta que se implementen o se retiren por decisión de
    // negocio.
    features: [
      "Usuarios ilimitados",
      "Multi-organización",
      "SLA",
      "CSM dedicado",
      "API e integraciones (en preparación)",
      "SSO (en preparación)",
    ],
  },
};

/** Backwards-compatible alias for existing entitlement consumers. */
export const PLAN_LIMITS = Object.fromEntries(
  Object.entries(PLAN_CATALOG).map(([key, plan]) => [key, {
    label: plan.label,
    maxUsers: plan.maxUsers,
    saasMonthlyUsd: plan.monthlyUsd,
    lifetimeUsd: plan.lifetimeUsd,
    maintenanceYearlyUsd: plan.maintenanceYearlyUsd,
    storageGb: plan.storageGb,
    exportsPerMonth: plan.exportsPerMonth,
    ai: plan.ai,
    aiMonthlyTokenBudget: plan.aiMonthlyTokenBudget,
    modules: plan.modules,
  }]),
) as Record<PlanKey, Omit<CommercialPlan, "key" | "monthlyUsd" | "currency" | "features" | "checkout"> & { saasMonthlyUsd: number | null }>;

export function assertPlanCatalogIntegrity(catalog: Record<PlanKey, CommercialPlan> = PLAN_CATALOG): void {
  const required: PlanKey[] = ["STARTER", "GROWTH", "ENTERPRISE"];
  for (const key of required) {
    const plan = catalog[key];
    if (!plan || plan.key !== key || !plan.label || !plan.features.length || !plan.modules.length) {
      throw new Error(`El catálogo comercial de ${key} está incompleto.`);
    }
  }
  if (catalog.STARTER.monthlyUsd !== 149 || catalog.GROWTH.monthlyUsd !== 449) {
    throw new Error("Los precios mensuales comerciales deben ser Starter USD 149 y Growth USD 449.");
  }
  if (catalog.ENTERPRISE.monthlyUsd !== null || catalog.ENTERPRISE.checkout) {
    throw new Error("Enterprise debe ser un plan personalizado sin Checkout automático.");
  }
  if (catalog.STARTER.maxUsers !== 5 || catalog.GROWTH.maxUsers !== 20 || catalog.STARTER.storageGb !== 10 || catalog.GROWTH.storageGb !== 50) {
    throw new Error("Los límites comerciales de usuarios o almacenamiento son inconsistentes.");
  }
}

/** Precio base para Enterprise lifetime (desde) */
export const ENTERPRISE_LIFETIME_FROM_USD = 15000;
export const ENTERPRISE_MAINTENANCE_FROM_USD = 3490;

export function planMaxUsers(plan: string): number | null {
  return PLAN_CATALOG[plan.toUpperCase() as PlanKey]?.maxUsers ?? null;
}

export function planHasModule(plan: string, module: string, trialActive = false): boolean {
  if (trialActive) return true;
  return PLAN_CATALOG[plan.toUpperCase() as PlanKey]?.modules.includes(module) ?? false;
}

export function planAllowsAI(plan: string, trialActive = false): boolean {
  return trialActive || PLAN_CATALOG[plan.toUpperCase() as PlanKey]?.ai === true;
}

