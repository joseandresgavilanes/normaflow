import { z } from "zod";
import { ControlApplicability, ControlEffectiveness, ControlEvidenceStatus, ControlReviewResult, OrganizationControlStatus, SecurityControlDomain } from "@prisma/client";
import { dateInputSchema, idSchema, optionalDateInputSchema, optionalText, parseInput, shortText } from "./common";

export const securityControlFiltersSchema = z.object({
  query: z.string().trim().max(120).optional(),
  domain: z.nativeEnum(SecurityControlDomain).optional(),
  status: z.nativeEnum(OrganizationControlStatus).optional(),
  applicability: z.nativeEnum(ControlApplicability).optional(),
  responsibleId: idSchema.optional(),
  overdue: z.boolean().optional(),
}).strict();

export const organizationControlUpdateSchema = z.object({
  id: idSchema,
  applicability: z.nativeEnum(ControlApplicability),
  status: z.nativeEnum(OrganizationControlStatus),
  responsibleId: idSchema.optional().nullable(),
  reviewDate: optionalDateInputSchema,
  nextReviewDate: optionalDateInputSchema,
  implementationLevel: z.number().int().min(0).max(100),
  notes: optionalText(8000),
}).strict().superRefine((value, ctx) => {
  if (value.nextReviewDate && value.reviewDate && new Date(value.nextReviewDate) < new Date(value.reviewDate)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nextReviewDate"], message: "La próxima revisión no puede ser anterior a la revisión actual." });
  }
});

export const controlEvidenceLinkSchema = z.object({
  organizationControlId: idSchema,
  evidenceId: idSchema,
  period: z.string().trim().regex(/^\d{4}(-\d{2})?$/, "El periodo debe ser YYYY o YYYY-MM."),
}).strict();

export const controlEvidenceValidationSchema = z.object({
  id: idSchema,
  status: z.nativeEnum(ControlEvidenceStatus),
}).strict();

export const controlReviewSchema = z.object({
  organizationControlId: idSchema,
  result: z.nativeEnum(ControlReviewResult),
  effectiveness: z.nativeEnum(ControlEffectiveness),
  comments: optionalText(8000),
}).strict();

export const riskControlLinkSchema = z.object({
  organizationControlId: idSchema,
  riskId: idSchema,
  purpose: shortText(2000),
  expectedEffectiveness: optionalText(2000),
  observedEffectiveness: optionalText(2000),
}).strict();

export const securityControlExportSchema = z.object({
  format: z.enum(["PDF", "EXCEL"]),
  filters: securityControlFiltersSchema.default({}),
}).strict();

export type SecurityControlFilters = z.infer<typeof securityControlFiltersSchema>;
export type OrganizationControlUpdate = z.infer<typeof organizationControlUpdateSchema>;

export function parseSecurityControlFilters(input: unknown) { return parseInput(securityControlFiltersSchema, input ?? {}); }

export function parseControlDate(value: string | null | undefined, label: string) {
  if (!value) return null;
  const parsed = dateInputSchema.safeParse(value);
  if (!parsed.success) throw new Error(`${label} no es válida.`);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00.000Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} no es válida.`);
  return date;
}
