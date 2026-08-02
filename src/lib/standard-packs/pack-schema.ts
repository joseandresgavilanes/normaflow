/**
 * Standard Pack manifest format (see docs/standard-packs.md).
 *
 * A pack is the installable, data-only unit of the Standard Pack Engine. It
 * describes a norm family, one or more editions, their requirement trees and the
 * companion artifacts (evidence rules, GAP questions, audit checklists, templates)
 * plus cross-standard mappings.
 *
 * LICENSING: a manifest carries only codes, structure, OWN titles/summaries and
 * metadata — never the protected full text of a standard. Licensed content is
 * imported separately through the `content` fields once authorized.
 */
import { z } from "zod";
import type {
  EvidenceFrequency,
  EvidenceType,
  RequirementRelationType,
  StandardEditionStatus,
  TemplateType,
} from "@prisma/client";
import { PACK_LIFECYCLE_STATUSES, type PackLifecycleStatus } from "./lifecycle";

const evidenceType: z.ZodType<EvidenceType> = z.enum([
  "POLICY", "PROCEDURE", "RECORD", "REPORT", "CERTIFICATE", "LOG", "PHOTO", "SCREENSHOT", "MINUTES", "OTHER",
]);
const evidenceFrequency: z.ZodType<EvidenceFrequency> = z.enum([
  "ON_DEMAND", "ONCE", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL",
]);
const templateType: z.ZodType<TemplateType> = z.enum([
  "DOCUMENT", "POLICY", "PROCEDURE", "RECORD", "CHECKLIST", "GAP", "OTHER",
]);
const relationType: z.ZodType<RequirementRelationType> = z.enum([
  "EQUIVALENT", "PARTIAL", "RELATED", "SUPERSEDES",
]);
const editionStatus: z.ZodType<StandardEditionStatus> = z.enum([
  "DRAFT", "ACTIVE", "SUPERSEDED", "WITHDRAWN",
]);
const lifecycleStatus: z.ZodType<PackLifecycleStatus> = z.enum(
  PACK_LIFECYCLE_STATUSES as unknown as [PackLifecycleStatus, ...PackLifecycleStatus[]],
);

export const packRequirementSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().optional(),
  description: z.string().optional(),
  /** Parent requirement code (e.g. "4" for "4.1"). */
  parent: z.string().optional(),
  mandatory: z.boolean().default(true),
  /** Optional explicit level; derived from code depth when omitted. */
  level: z.number().int().positive().optional(),
});

export const packEvidenceRuleSchema = z.object({
  requirementCode: z.string().min(1),
  expectedType: evidenceType.default("OTHER"),
  mandatory: z.boolean().default(true),
  frequency: evidenceFrequency.default("ON_DEMAND"),
  retentionMonths: z.number().int().positive().optional(),
  note: z.string().optional(),
});

export const packGapQuestionSchema = z.object({
  requirementCode: z.string().min(1),
  question: z.string().min(1),
  guidance: z.string().optional(),
  weight: z.number().int().positive().default(1),
  options: z.array(z.object({ label: z.string(), score: z.number() })).optional(),
  version: z.string().default("1"),
});

export const packAuditChecklistSchema = z.object({
  requirementCode: z.string().min(1),
  question: z.string().min(1),
  expectedEvidence: z.string().optional(),
  criterion: z.string().optional(),
  version: z.string().default("1"),
});

export const packTemplateSchema = z.object({
  requirementCode: z.string().optional(),
  templateType: templateType.default("DOCUMENT"),
  name: z.string().min(1),
  content: z.string(),
  version: z.string().default("1"),
});

export const packEditionSchema = z.object({
  familyCode: z.string().min(1),
  familyName: z.string().min(1),
  category: z.string().optional(),
  familyDescription: z.string().optional(),
  editionCode: z.string().min(1), // "2015", "2022"
  name: z.string().min(1),
  version: z.string().min(1),
  year: z.number().int().optional(),
  description: z.string().optional(),
  catalogVersion: z.string().optional(),
  publishedAt: z.string().optional(),
  status: editionStatus.default("ACTIVE"),
  requirements: z.array(packRequirementSchema).min(1),
  evidenceRules: z.array(packEvidenceRuleSchema).optional(),
  gapQuestions: z.array(packGapQuestionSchema).optional(),
  auditChecklist: z.array(packAuditChecklistSchema).optional(),
  templates: z.array(packTemplateSchema).optional(),
});

export const packMappingSchema = z.object({
  sourceFamily: z.string().min(1),
  sourceCode: z.string().min(1),
  targetFamily: z.string().min(1),
  targetCode: z.string().min(1),
  relationType: relationType.default("RELATED"),
  equivalencePercent: z.number().int().min(0).max(100).optional(),
  notes: z.string().optional(),
});

export const standardPackSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  /** Ciclo comercial. Objetivo de producto: LIVE. */
  lifecycleStatus: lifecycleStatus.default("DEVELOPMENT"),
  requiredModules: z.array(z.string()).default([]),
  featureFlags: z.record(z.union([z.boolean(), z.string(), z.number()])).default({}),
  editions: z.array(packEditionSchema).min(1),
  mappings: z.array(packMappingSchema).default([]),
});

/** Output type (after defaults applied) — what installers work with. */
export type StandardPackManifest = z.infer<typeof standardPackSchema>;
/** Input type (defaults optional) — what authored `.pack.ts` files satisfy. */
export type StandardPackInput = z.input<typeof standardPackSchema>;
export type PackEdition = z.infer<typeof packEditionSchema>;
export type PackRequirement = z.infer<typeof packRequirementSchema>;
/** Un mapeo de correspondencia entre requisitos de dos normas (entrada, con defaults opcionales). */
export type PackMapping = z.input<typeof packMappingSchema>;

/** Parse + validate an untrusted manifest, throwing a readable error on failure. */
export function parsePackManifest(input: unknown): StandardPackManifest {
  return standardPackSchema.parse(input);
}

/**
 * Deterministic requirement id. ISO 9001 / 27001 keep the legacy `cl-9001-…` /
 * `cl-27001-…` ids already present in production; every other family uses a
 * stable `req-<family>-<code>` slug so packs can be installed idempotently.
 */
export function requirementIdFor(familyCode: string, requirementCode: string): string {
  if (familyCode === "ISO_9001") return `cl-9001-${requirementCode}`;
  if (familyCode === "ISO_27001") return `cl-27001-${requirementCode}`;
  const slug = familyCode.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `req-${slug}-${requirementCode}`;
}
