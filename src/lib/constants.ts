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
