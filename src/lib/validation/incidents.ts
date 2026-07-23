import { z } from "zod";
import { IncidentCategory, IncidentSeverity, IncidentStatus } from "@prisma/client";
import { boundedArray, idSchema, optionalDateInputSchema, optionalText, shortText } from "./common";

export const INCIDENT_REPORT_TYPES = ["incident-log", "incident-report"] as const;

/** Canonical incident workflow order — no skipping or reversing. */
export const INCIDENT_ORDER: IncidentStatus[] = ["DETECTED", "TRIAGED", "INVESTIGATING", "CONTAINED", "ERADICATED", "RECOVERED", "CLOSED"];

export function nextIncidentStatus(current: IncidentStatus): IncidentStatus | null {
  const i = INCIDENT_ORDER.indexOf(current);
  return i >= 0 && i < INCIDENT_ORDER.length - 1 ? INCIDENT_ORDER[i + 1] : null;
}

export const incidentFiltersSchema = z.object({
  query: z.string().trim().max(120).optional(),
  status: z.nativeEnum(IncidentStatus).optional(),
  severity: z.nativeEnum(IncidentSeverity).optional(),
  category: z.nativeEnum(IncidentCategory).optional(),
}).strict();

export const incidentCreateSchema = z.object({
  code: shortText(60),
  detectedAt: optionalDateInputSchema,
  occurredAt: optionalDateInputSchema,
  reporterId: idSchema.optional().nullable(),
  responsibleId: idSchema.optional().nullable(),
  severity: z.nativeEnum(IncidentSeverity).default("MEDIUM"),
  category: z.nativeEnum(IncidentCategory).default("OTHER"),
  description: shortText(8000),
  impact: optionalText(8000),
  notificationRequired: z.boolean().default(false),
  notificationDetails: optionalText(8000),
  affectedAssetIds: boundedArray(idSchema, 100).optional(),
}).strict();

export const incidentUpdateSchema = z.object({
  id: idSchema,
  occurredAt: optionalDateInputSchema,
  responsibleId: idSchema.optional().nullable(),
  severity: z.nativeEnum(IncidentSeverity),
  category: z.nativeEnum(IncidentCategory),
  impact: optionalText(8000),
  notificationRequired: z.boolean(),
  notificationDetails: optionalText(8000),
  lessonsLearned: optionalText(8000),
}).strict();

export const incidentTransitionSchema = z.object({
  id: idSchema,
  toStatus: z.nativeEnum(IncidentStatus),
}).strict();

export const incidentAssetSchema = z.object({ incidentId: idSchema, assetId: idSchema }).strict();
export const incidentEvidenceSchema = z.object({ incidentId: idSchema, evidenceId: idSchema }).strict();

export const incidentExportSchema = z.object({
  reportType: z.enum(INCIDENT_REPORT_TYPES).default("incident-log"),
  format: z.enum(["PDF", "EXCEL"]),
}).strict();

export type IncidentCreateInput = z.infer<typeof incidentCreateSchema>;
export function parseIncidentFilters(input: unknown) { return incidentFiltersSchema.parse(input ?? {}); }
