import { z } from "zod";
import { ACPMEfficacyStatus, ACPMOrigin, ACPMRootCauseMethod, CAPAEvidenceKind, CAPAStage, EvidenceStatus, EvidenceType, NotificationType, Plan, Priority, ReportFormat } from "@prisma/client";
import { boundedArray, dateInputSchema, emailSchema, finiteNumber, httpUrlSchema, idSchema, optionalDateInputSchema, optionalText, shortText } from "./common";

export const reportFiltersSchema = z.object({
  from: dateInputSchema,
  to: dateInputSchema,
  standardCode: optionalText(20),
  status: optionalText(80),
  recordId: idSchema.optional(),
  ownerId: idSchema.optional(),
  domain: optionalText(40),
  applicability: optionalText(40),
}).strict().superRefine((value, ctx) => {
  if (new Date(`${value.from}T00:00:00.000Z`) > new Date(`${value.to}T23:59:59.999Z`)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "La fecha final no puede ser anterior a la inicial." });
});

export const reportRequestSchema = z.object({ reportId: shortText(80), title: shortText(240), format: z.nativeEnum(ReportFormat), filters: reportFiltersSchema }).strict();
export const reportArtifactIdSchema = z.object({ id: idSchema });

export const uploadMetadataSchema = z.object({
  name: z.string().trim().min(1).max(255),
  type: z.string().trim().max(160),
  size: z.number().int().positive().max(50 * 1024 * 1024),
}).strict();

export const evidenceSchema = z.object({
  title: shortText(240), description: optionalText(8000), evidenceType: z.nativeEnum(EvidenceType), processId: idSchema.optional().nullable(), standardCode: optionalText(20), clauseId: idSchema.optional().nullable(), responsibleId: idSchema.optional().nullable(), issuedAt: optionalDateInputSchema, expiresAt: optionalDateInputSchema, status: z.nativeEnum(EvidenceStatus).optional(), links: z.object({ documentIds: boundedArray(idSchema, 100).optional(), riskIds: boundedArray(idSchema, 100).optional(), auditIds: boundedArray(idSchema, 100).optional(), findingIds: boundedArray(idSchema, 100).optional(), nonconformityIds: boundedArray(idSchema, 100).optional(), indicatorIds: boundedArray(idSchema, 100).optional(), managementReviewIds: boundedArray(idSchema, 100).optional() }).strict().optional(),
}).strict();

export const capaSchema = z.object({
  title: shortText(240), description: shortText(8000), origin: z.nativeEnum(ACPMOrigin), standardCode: optionalText(20), clauseId: idSchema.optional(), processId: idSchema.optional(), nonconformityId: idSchema.optional(), findingId: idSchema.optional(), severity: shortText(30), priority: z.nativeEnum(Priority), ownerId: idSchema.optional(), dueDate: optionalDateInputSchema, evidenceTitle: optionalText(240),
}).strict();
export const capaTransitionSchema = z.object({ id: idSchema, toStage: z.nativeEnum(CAPAStage), comment: optionalText(2000) }).strict();
export const capaVerificationSchema = z.object({ id: idSchema, status: z.nativeEnum(ACPMEfficacyStatus), comment: shortText(4000) }).strict();
export const capaRootCauseSchema = z.object({ method: z.nativeEnum(ACPMRootCauseMethod).optional(), fiveWhys: boundedArray(shortText(1000), 5).optional(), ishikawaAnalysis: optionalText(8000), rootCause: shortText(8000) }).strict();

export const notificationSchema = z.object({ organizationId: idSchema, userId: idSchema, title: shortText(240), body: shortText(8000), type: z.nativeEnum(NotificationType).optional(), link: httpUrlSchema.optional().nullable(), idempotencyKey: shortText(240).optional() }).strict();
export const billingPlanSchema = z.object({ plan: z.enum([Plan.STARTER, Plan.GROWTH]) }).strict();
export const personnelSchema = z.object({ firstName: shortText(120), lastName: shortText(120), email: emailSchema.optional().nullable(), positionId: idSchema.optional().nullable(), hiredAt: optionalDateInputSchema }).strict();
export const governanceSchema = z.object({ title: shortText(240), description: optionalText(8000), dueDate: optionalDateInputSchema, ownerId: idSchema.optional().nullable() }).strict();
export const adminIdSchema = z.object({ id: idSchema }).strict();

export function assertUploadMetadata(input: unknown) { return uploadMetadataSchema.parse(input); }
export function assertFiniteDate(value: string | null | undefined, field = "fecha") {
  if (value == null || value === "") return null;
  const parsed = dateInputSchema.safeParse(value);
  if (!parsed.success) throw new Error(`${field} no es válida.`);
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00.000Z` : value);
  if (Number.isNaN(date.getTime())) throw new Error(`${field} no es válida.`);
  return date;
}
