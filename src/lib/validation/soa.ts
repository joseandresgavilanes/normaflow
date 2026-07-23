import { z } from "zod";
import { ControlApplicability, OrganizationControlStatus } from "@prisma/client";
import { idSchema, optionalDateInputSchema, optionalText } from "./common";

export const SOA_REPORT_TYPES = ["soa", "excluded-controls", "pending-controls", "control-evidence"] as const;

export const createSoADraftSchema = z.object({
  scope: optionalText(4000),
  ownerId: idSchema.optional().nullable(),
}).strict();

export const soaEntryUpdateSchema = z.object({
  id: idSchema,
  applicability: z.nativeEnum(ControlApplicability),
  justification: optionalText(8000),
  implementationStatus: z.nativeEnum(OrganizationControlStatus),
  relatedRiskItemId: idSchema.optional().nullable(),
  evidenceId: idSchema.optional().nullable(),
  responsibleId: idSchema.optional().nullable(),
  reviewDate: optionalDateInputSchema,
  notes: optionalText(8000),
}).strict().superRefine((value, ctx) => {
  if (value.applicability === "EXCLUDED" && !value.justification?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["justification"], message: "Un control excluido requiere justificación." });
  }
});

export const soaSubmitReviewSchema = z.object({ id: idSchema }).strict();

export const soaApprovalSchema = z.object({
  id: idSchema,
  comment: optionalText(8000),
  evidenceId: idSchema.optional().nullable(),
  nextReviewDate: optionalDateInputSchema,
}).strict();

export const soaExportSchema = z.object({
  reportType: z.enum(SOA_REPORT_TYPES).default("soa"),
  format: z.enum(["PDF", "EXCEL"]),
}).strict();

export type CreateSoADraftInput = z.infer<typeof createSoADraftSchema>;
export type SoAEntryUpdateInput = z.infer<typeof soaEntryUpdateSchema>;
export type SoAApprovalInput = z.infer<typeof soaApprovalSchema>;
