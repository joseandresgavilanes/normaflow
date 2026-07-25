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

// ─── Paquete de continuidad del negocio (ISO 22301) ──

const impact = z.number().int().min(0).max(5).default(0);

export const biaSchema = z.object({
  code: shortText(60),
  title: shortText(200),
  scope: optionalText(8000),
  methodology: optionalText(8000),
  version: shortText(20).default("1.0"),
  ownerId: idSchema.optional().nullable(),
  performedAt: optionalDateInputSchema,
  nextReviewDate: optionalDateInputSchema,
}).strict();
export const biaUpdateSchema = biaSchema.partial().extend({ id: idSchema });

export const criticalActivitySchema = z.object({
  biaId: idSchema,
  code: shortText(60),
  name: shortText(200),
  description: optionalText(8000),
  processId: idSchema.optional().nullable(),
  ownerId: idSchema.optional().nullable(),
  mtpdMinutes: minutes,
  rtoMinutes: minutes,
  rpoMinutes: minutes,
  minimumServiceLevel: optionalText(2000),
  financialImpact: impact,
  operationalImpact: impact,
  legalImpact: impact,
  reputationalImpact: impact,
  peopleImpact: impact,
  peakPeriods: optionalText(2000),
  notes: optionalText(4000),
}).strict();
export const criticalActivityUpdateSchema = criticalActivitySchema.partial().extend({ id: idSchema });

export const productPrioritySchema = z.object({
  biaId: idSchema,
  code: shortText(60),
  name: shortText(200),
  description: optionalText(4000),
  criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("LOW"),
  mtpdMinutes: minutes,
  rtoMinutes: minutes,
  minimumServiceLevel: optionalText(2000),
  revenueShare: z.number().min(0).max(100).optional().nullable(),
  customersAffected: z.number().int().min(0).optional().nullable(),
  notes: optionalText(4000),
}).strict();

export const dependencySchema = z.object({
  activityId: idSchema,
  type: z.enum(["PEOPLE", "FACILITY", "TECHNOLOGY", "SUPPLIER", "DATA", "EQUIPMENT", "UTILITY", "PROCESS", "OTHER"]),
  name: shortText(200),
  description: optionalText(4000),
  processId: idSchema.optional().nullable(),
  assetId: idSchema.optional().nullable(),
  supplierId: idSchema.optional().nullable(),
  personnelId: idSchema.optional().nullable(),
  locationId: idSchema.optional().nullable(),
  criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  maxOutageMinutes: minutes,
  alternative: optionalText(4000),
  singlePointOfFailure: z.boolean().default(false),
  notes: optionalText(4000),
}).strict();

export const resourceSchema = z.object({
  activityId: idSchema,
  type: z.enum(["PEOPLE", "FACILITY", "TECHNOLOGY", "EQUIPMENT", "DATA", "SUPPLIER", "FINANCIAL", "TRANSPORT", "OTHER"]),
  name: shortText(200),
  description: optionalText(4000),
  normalQuantity: z.number().int().min(0).optional().nullable(),
  minimumQuantity: z.number().int().min(0).optional().nullable(),
  unit: optionalText(40),
  availableAt: optionalText(400),
  alternativeResource: optionalText(4000),
  leadTimeMinutes: minutes,
  supplierId: idSchema.optional().nullable(),
  assetId: idSchema.optional().nullable(),
  notes: optionalText(4000),
}).strict();

export const strategySchema = z.object({
  code: shortText(60),
  title: shortText(200),
  activityId: idSchema.optional().nullable(),
  planId: idSchema.optional().nullable(),
  type: z.enum(["PREVENT", "MITIGATE", "REDUNDANCY", "RELOCATION", "OUTSOURCING", "MANUAL_WORKAROUND", "INSURANCE", "ACCEPT"]).default("MITIGATE"),
  description: optionalText(8000),
  achievesRtoMinutes: minutes,
  achievesRpoMinutes: minutes,
  cost: z.number().min(0).optional().nullable(),
  ownerId: idSchema.optional().nullable(),
  resourcesNeeded: optionalText(4000),
  notes: optionalText(4000),
}).strict();
export const strategyStatusSchema = z.object({
  id: idSchema,
  status: z.enum(["PROPOSED", "APPROVED", "IMPLEMENTED", "REJECTED", "RETIRED"]),
}).strict();

export const recoveryProcedureSchema = z.object({
  code: shortText(60),
  title: shortText(200),
  planId: idSchema.optional().nullable(),
  activityId: idSchema.optional().nullable(),
  objective: optionalText(4000),
  steps: optionalText(20000),
  documentId: idSchema.optional().nullable(),
  responsibleId: idSchema.optional().nullable(),
  estimatedMinutes: minutes,
  prerequisites: optionalText(4000),
  order: z.number().int().min(0).default(0),
  version: shortText(20).default("1.0"),
}).strict();

export const crisisTeamSchema = z.object({
  code: shortText(60),
  name: shortText(200),
  purpose: optionalText(4000),
  planId: idSchema.optional().nullable(),
  leaderId: idSchema.optional().nullable(),
  deputyId: idSchema.optional().nullable(),
  activationRule: optionalText(4000),
  meetingPoint: optionalText(400),
}).strict();

export const crisisContactSchema = z.object({
  teamId: idSchema,
  name: shortText(200),
  role: optionalText(160),
  type: z.enum(["INTERNAL", "EXTERNAL", "SUPPLIER", "AUTHORITY", "CUSTOMER"]).default("INTERNAL"),
  userId: idSchema.optional().nullable(),
  personnelId: idSchema.optional().nullable(),
  supplierId: idSchema.optional().nullable(),
  primaryPhone: optionalText(60),
  altPhone: optionalText(60),
  email: optionalText(254),
  escalationOrder: z.number().int().min(0).default(0),
  isDeputy: z.boolean().default(false),
  availability: optionalText(400),
  notes: optionalText(2000),
}).strict();

export const communicationNodeSchema = z.object({
  teamId: idSchema,
  contactId: idSchema.optional().nullable(),
  parentId: idSchema.optional().nullable(),
  label: shortText(200),
  audience: optionalText(400),
  channel: optionalText(120),
  messageTemplate: optionalText(8000),
  order: z.number().int().min(0).default(0),
  maxDelayMinutes: minutes,
}).strict();

export const planVersionSchema = z.object({
  planId: idSchema,
  version: shortText(20),
  changeSummary: optionalText(4000),
  content: optionalText(50000),
  evidenceId: idSchema.optional().nullable(),
}).strict();

export const planApprovalSchema = z.object({ id: idSchema, version: shortText(20).optional() }).strict();

export const planActivationSchema = z.object({
  planId: idSchema,
  reason: shortText(2000),
  scenarioId: idSchema.optional().nullable(),
  incidentId: idSchema.optional().nullable(),
}).strict();

export const planDeactivationSchema = z.object({
  id: idSchema,
  outcome: optionalText(4000),
  lessonsLearned: optionalText(8000),
  evidenceId: idSchema.optional().nullable(),
}).strict();
