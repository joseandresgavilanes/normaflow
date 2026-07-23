import { z } from "zod";
import { ContinuityPlanStatus, ContinuityTestOutcome, ContinuityTestStatus, ContinuityTestType, ImprovementActionStatus } from "@prisma/client";
import { idSchema, optionalDateInputSchema, optionalText, shortText } from "./common";

export const CONTINUITY_REPORT_TYPES = ["continuity-plans", "bcp-dr-tests"] as const;

const minutes = z.number().int().min(0).max(1_000_000).optional().nullable();

export const bcpSchema = z.object({
  code: shortText(60),
  title: shortText(200),
  scope: optionalText(8000),
  ownerId: idSchema.optional().nullable(),
  status: z.nativeEnum(ContinuityPlanStatus).default("DRAFT"),
  rtoMinutes: minutes,
  rpoMinutes: minutes,
  dependencies: optionalText(8000),
  nextReviewDate: optionalDateInputSchema,
}).strict();
export const bcpUpdateSchema = bcpSchema.extend({ id: idSchema });

export const drpSchema = z.object({
  code: shortText(60),
  title: shortText(200),
  bcpId: idSchema.optional().nullable(),
  ownerId: idSchema.optional().nullable(),
  status: z.nativeEnum(ContinuityPlanStatus).default("DRAFT"),
  rtoMinutes: minutes,
  rpoMinutes: minutes,
  systems: optionalText(8000),
  dependencies: optionalText(8000),
  nextReviewDate: optionalDateInputSchema,
}).strict();
export const drpUpdateSchema = drpSchema.extend({ id: idSchema });

export const bcpProcessSchema = z.object({ planId: idSchema, processId: idSchema, rtoMinutes: minutes, rpoMinutes: minutes }).strict();
export const scenarioSchema = z.object({ planId: idSchema, title: shortText(200), description: optionalText(8000), type: optionalText(120) }).strict();

export const testSchema = z.object({
  planId: idSchema,
  scenarioId: idSchema.optional().nullable(),
  title: shortText(200),
  type: z.nativeEnum(ContinuityTestType).default("TABLETOP"),
  plannedDate: optionalDateInputSchema,
  responsibleId: idSchema.optional().nullable(),
}).strict();

export const testStatusSchema = z.object({ id: idSchema, status: z.nativeEnum(ContinuityTestStatus) }).strict();

export const testResultSchema = z.object({
  testId: idSchema,
  outcome: z.nativeEnum(ContinuityTestOutcome),
  rtoAchievedMinutes: minutes,
  rpoAchievedMinutes: minutes,
  summary: optionalText(8000),
  evidenceId: idSchema.optional().nullable(),
}).strict();

export const improvementSchema = z.object({
  testResultId: idSchema,
  description: shortText(8000),
  responsibleId: idSchema.optional().nullable(),
  targetDate: optionalDateInputSchema,
}).strict();

export const improvementStatusSchema = z.object({ id: idSchema, status: z.nativeEnum(ImprovementActionStatus) }).strict();

export const continuityExportSchema = z.object({
  reportType: z.enum(CONTINUITY_REPORT_TYPES).default("continuity-plans"),
  format: z.enum(["PDF", "EXCEL"]),
}).strict();
