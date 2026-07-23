import { z } from "zod";

export const standardCodeSchema = z.enum(["ISO_9001", "ISO_27001"]);
export const adminRoleSchema = z.enum([
  "OWNER",
  "ADMIN",
  "MANAGER",
  "AUDITOR",
  "VIEWER",
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "COMPLIANCE_MANAGER",
  "CONTRIBUTOR",
]);

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const organizationSettingsSchema = z.object({
  name: z.string().trim().min(2, "El nombre de la organización es obligatorio.").max(160).optional(),
  country: z.string().trim().min(2).max(3).optional(),
  industry: optionalText(120),
  size: optionalText(50),
  logoUrl: z.string().trim().url("El logo debe ser una URL válida.").max(500).nullable().optional(),
  contactName: optionalText(120),
  contactEmail: z.string().trim().email("El email de contacto no es válido.").max(200).nullable().optional(),
  contactPhone: optionalText(50),
  website: z.string().trim().url("El sitio web debe ser una URL válida.").max(300).nullable().optional(),
  address: optionalText(240),
  standards: z.array(standardCodeSchema).min(1, "Selecciona al menos una norma.").optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().email("El email no es válido.").max(200),
  name: z.string().trim().min(2, "El nombre es obligatorio.").max(120),
  role: adminRoleSchema,
});

export const memberRoleSchema = z.object({ role: adminRoleSchema });

export const groupSchema = z.object({
  name: z.string().trim().min(2, "El nombre del grupo es obligatorio.").max(120),
  description: optionalText(500),
});

export const groupAssociationSchema = z.object({
  groupId: z.string().min(1),
  processIds: z.array(z.string().min(1)).default([]),
  modules: z.array(z.string().trim().min(1).max(80)).default([]),
});

export const adminCatalogKindSchema = z.enum([
  "DOCUMENT_TYPE",
  "STATUS",
  "PRIORITY",
  "RISK_CATEGORY",
  "FINDING_TYPE",
  "EVIDENCE_TYPE",
]);

export const catalogItemSchema = z.object({
  kind: adminCatalogKindSchema,
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(120),
  description: optionalText(500),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const catalogItemPatchSchema = catalogItemSchema.partial().extend({
  id: z.string().min(1),
});

export type AdminCatalogKind = z.infer<typeof adminCatalogKindSchema>;

export function parseActionInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Datos inválidos.");
  }
  return result.data;
}
