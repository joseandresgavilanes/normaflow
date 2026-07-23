import { z } from "zod";
import { RemediationStatus, VerificationResult, VulnerabilitySeverity, VulnerabilityStatus } from "@prisma/client";
import { idSchema, optionalDateInputSchema, optionalText, shortText } from "./common";

export const VULN_REPORT_TYPES = ["open-vulnerabilities", "remediation-plan"] as const;

export const vulnFiltersSchema = z.object({
  query: z.string().trim().max(120).optional(),
  status: z.nativeEnum(VulnerabilityStatus).optional(),
  severity: z.nativeEnum(VulnerabilitySeverity).optional(),
}).strict();

export const vulnCreateSchema = z.object({
  code: shortText(60),
  source: shortText(200),
  cve: z.string().trim().max(40).optional().nullable(),
  severity: z.nativeEnum(VulnerabilitySeverity).default("MEDIUM"),
  exposure: optionalText(4000),
  description: optionalText(8000),
  responsibleId: idSchema.optional().nullable(),
  targetDate: optionalDateInputSchema,
}).strict();

export const vulnUpdateSchema = vulnCreateSchema.extend({ id: idSchema, status: z.nativeEnum(VulnerabilityStatus) });

export const vulnAssetSchema = z.object({ vulnerabilityId: idSchema, assetId: idSchema, exposure: optionalText(2000) }).strict();

export const remediationSchema = z.object({
  vulnerabilityId: idSchema,
  description: shortText(8000),
  responsibleId: idSchema.optional().nullable(),
  targetDate: optionalDateInputSchema,
  status: z.nativeEnum(RemediationStatus).default("PLANNED"),
  evidenceId: idSchema.optional().nullable(),
}).strict();

export const remediationUpdateSchema = z.object({
  id: idSchema,
  description: shortText(8000),
  responsibleId: idSchema.optional().nullable(),
  targetDate: optionalDateInputSchema,
  status: z.nativeEnum(RemediationStatus),
  evidenceId: idSchema.optional().nullable(),
}).strict();

export const verificationSchema = z.object({
  remediationId: idSchema,
  result: z.nativeEnum(VerificationResult),
  notes: optionalText(8000),
  evidenceId: idSchema.optional().nullable(),
}).strict();

export const vulnExportSchema = z.object({
  reportType: z.enum(VULN_REPORT_TYPES).default("open-vulnerabilities"),
  format: z.enum(["PDF", "EXCEL"]),
}).strict();

export function parseVulnFilters(input: unknown) { return vulnFiltersSchema.parse(input ?? {}); }
