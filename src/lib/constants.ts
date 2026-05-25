export const DEMO_CREDENTIALS = {
  email: "demo@normaflow.io",
  password: "NormaFlow2025!",
};

export const CUSTOMER_CREDENTIALS = {
  email: "cliente@normaflow.io",
  password: "NormaFlow2025!",
};

export const ROLES = {
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

export interface PlanLimits {
  maxUsers: number | null;
  label: string;
  // Precios en USD
  saasMonthlyUsd: number | null;
  lifetimeUsd: number | null;
  maintenanceYearlyUsd: number | null;
}

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  STARTER:    { label: "Starter",    maxUsers: 5,    saasMonthlyUsd: 149, lifetimeUsd: 2500,  maintenanceYearlyUsd: 690 },
  GROWTH:     { label: "Growth",     maxUsers: 20,   saasMonthlyUsd: 449, lifetimeUsd: 6900,  maintenanceYearlyUsd: 1490 },
  ENTERPRISE: { label: "Enterprise", maxUsers: null, saasMonthlyUsd: null, lifetimeUsd: null, maintenanceYearlyUsd: null },
};

/** Precio base para Enterprise lifetime (desde) */
export const ENTERPRISE_LIFETIME_FROM_USD = 15000;
export const ENTERPRISE_MAINTENANCE_FROM_USD = 3490;

export function planMaxUsers(plan: string): number | null {
  return PLAN_LIMITS[plan as PlanKey]?.maxUsers ?? null;
}

export const STANDARDS = {
  ISO_9001: { code: "ISO_9001", name: "ISO 9001", version: "2015", color: "#123C66" },
  ISO_27001: { code: "ISO_27001", name: "ISO 27001", version: "2022", color: "#2E8B57" },
  ISO_14001: { code: "ISO_14001", name: "ISO 14001", version: "2015", color: "#6B3FB5" },
  ISO_45001: { code: "ISO_45001", name: "ISO 45001", version: "2018", color: "#D68A1A" },
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
