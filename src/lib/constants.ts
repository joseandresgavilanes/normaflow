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
    key: "STARTER", label: "Starter", monthlyUsd: 149, currency: "usd", maxUsers: 5, storageGb: 10, exportsPerMonth: 10, ai: false, modules: ESSENTIAL_MODULES, checkout: true,
    lifetimeUsd: 2500, maintenanceYearlyUsd: 690,
    features: ["Hasta 5 usuarios", "ISO 9001 + ISO 27001", "Módulos esenciales", "10 GB de almacenamiento", "Soporte por correo"],
  },
  GROWTH: {
    key: "GROWTH", label: "Growth", monthlyUsd: 449, currency: "usd", maxUsers: 20, storageGb: 50, exportsPerMonth: 100, ai: true, modules: ALL_MODULES, checkout: true,
    lifetimeUsd: 6900, maintenanceYearlyUsd: 1490,
    features: ["Hasta 20 usuarios", "Todos los módulos", "Asistente IA", "50 GB de almacenamiento", "Soporte prioritario", "Onboarding"],
  },
  ENTERPRISE: {
    key: "ENTERPRISE", label: "Enterprise", monthlyUsd: null, currency: "usd", maxUsers: null, storageGb: null, exportsPerMonth: null, ai: true, modules: ALL_MODULES, checkout: false,
    lifetimeUsd: null, maintenanceYearlyUsd: null,
    features: ["Usuarios ilimitados", "Multi-organización", "SLA", "CSM dedicado", "API e integraciones", "SSO"],
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

export const STANDARDS = {
  ISO_9001: { code: "ISO_9001", name: "ISO 9001", version: "2015", color: "#123C66" },
  ISO_27001: { code: "ISO_27001", name: "ISO 27001", version: "2022", color: "#2E8B57" },
  ISO_14001: { code: "ISO_14001", name: "ISO 14001", version: "2015", color: "#6B3FB5" },
  ISO_45001: { code: "ISO_45001", name: "ISO 45001", version: "2018", color: "#D68A1A" },
  ISO_42001: { code: "ISO_42001", name: "ISO/IEC 42001", version: "2023", color: "#0F7B8A" },
  ISO_37301: { code: "ISO_37301", name: "ISO 37301", version: "2021", color: "#8C2F39" },
  ISO_37001: { code: "ISO_37001", name: "ISO 37001", version: "2016", color: "#9F1239" },
  ISO_50001: { code: "ISO_50001", name: "ISO 50001", version: "2018", color: "#CA8A04" },
  ISO_22000: { code: "ISO_22000", name: "ISO 22000", version: "2018", color: "#0F766E" },
  ISO_20000: { code: "ISO_20000", name: "ISO/IEC 20000", version: "2018", color: "#1D4ED8" },
  ISO_13485: { code: "ISO_13485", name: "ISO 13485", version: "2016", color: "#0E7490" },
} as const;

export const COLORS = {
  primary: "#123C66",
  primaryDark: "#0D2E4E",
  accent: "#2E8B57",
  bg: "#F7F9FC",
  surface: "#FFFFFF",
  border: "#E5EAF2",
  textMain: "#142033",
  textMuted: "#5E6B7A",
  danger: "#C93C37",
  warning: "#D68A1A",
  success: "#2E8B57",
};
