import { z } from "zod";
import { RiskTreatment } from "@prisma/client";
import { finiteNumber, idSchema, optionalDateInputSchema, optionalText, shortText } from "./common";

export const RISK_REPORT_TYPES = ["risk-matrix", "risk-treatment-plan", "residual-risks"] as const;

const scaleSchema = z
  .array(z.object({ level: finiteNumber(1, 5, "El nivel"), label: shortText(120) }))
  .min(1)
  .max(5);

export const methodologySchema = z.object({
  title: shortText(200),
  description: optionalText(8000),
  acceptanceCriteria: shortText(8000),
  acceptanceThreshold: z.number().int().min(1).max(25).optional().nullable(),
  probabilityScale: scaleSchema.optional(),
  impactScale: scaleSchema.optional(),
  ownerId: idSchema.optional().nullable(),
}).strict();

export const planCreateSchema = z.object({
  title: shortText(200),
  methodologyId: idSchema.optional().nullable(),
  soaId: idSchema.optional().nullable(),
}).strict();

export const planApprovalSchema = z.object({
  id: idSchema,
  comment: optionalText(8000),
  evidenceId: idSchema.optional().nullable(),
  nextReviewDate: optionalDateInputSchema,
}).strict();

const scoreField = z.number().int().min(1).max(5);

export const itemCreateSchema = z.object({
  planId: idSchema,
  title: shortText(200),
  description: optionalText(8000),
  riskId: idSchema.optional().nullable(),
  asset: optionalText(2000),
  threat: optionalText(2000),
  vulnerability: optionalText(2000),
  impact: scoreField,
  probability: scoreField,
  existingControls: optionalText(8000),
  proposedControls: optionalText(8000),
  treatment: z.nativeEnum(RiskTreatment).default("MITIGATE"),
  ownerId: idSchema.optional().nullable(),
  targetDate: optionalDateInputSchema,
}).strict();

export const itemUpdateSchema = itemCreateSchema.extend({ id: idSchema }).omit({ planId: true });

export const residualAssessmentSchema = z.object({
  itemId: idSchema,
  residualImpact: scoreField,
  residualProbability: scoreField,
  rationale: optionalText(8000),
}).strict();

export const residualApproveSchema = z.object({ id: idSchema }).strict();

export const acceptanceSchema = z.object({
  itemId: idSchema,
  residualAssessmentId: idSchema.optional().nullable(),
  justification: shortText(8000),
  comment: optionalText(8000),
  evidenceId: idSchema.optional().nullable(),
  validUntil: optionalDateInputSchema,
}).strict();

export const closeItemSchema = z.object({ id: idSchema }).strict();

export const itemControlLinkSchema = z.object({
  itemId: idSchema,
  organizationControlId: idSchema,
  role: z.enum(["EXISTING", "PROPOSED"]).default("PROPOSED"),
}).strict();

export const riskExportSchema = z.object({
  reportType: z.enum(RISK_REPORT_TYPES).default("risk-matrix"),
  format: z.enum(["PDF", "EXCEL"]),
}).strict();

export type MethodologyInput = z.infer<typeof methodologySchema>;
export type ItemCreateInput = z.infer<typeof itemCreateSchema>;
export type ResidualAssessmentInput = z.infer<typeof residualAssessmentSchema>;
export type AcceptanceInput = z.infer<typeof acceptanceSchema>;
