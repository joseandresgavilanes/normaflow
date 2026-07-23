import { z } from "zod";
import { SupplierCriticality } from "@prisma/client";
import { idSchema, optionalDateInputSchema, optionalText } from "./common";

export const supplierSecuritySchema = z.object({
  supplierId: idSchema,
  securityCriticality: z.nativeEnum(SupplierCriticality).default("MEDIUM"),
  dataProcessed: optionalText(8000),
  accessGranted: optionalText(8000),
  obligations: optionalText(8000),
  controls: optionalText(8000),
  riskLevel: optionalText(200),
  reviewDate: optionalDateInputSchema,
  nextReviewDate: optionalDateInputSchema,
  contractExpiry: optionalDateInputSchema,
  evidenceId: idSchema.optional().nullable(),
  notes: optionalText(8000),
}).strict();

export const supplierSecurityExportSchema = z.object({
  reportType: z.literal("critical-suppliers").default("critical-suppliers"),
  format: z.enum(["PDF", "EXCEL"]),
}).strict();
