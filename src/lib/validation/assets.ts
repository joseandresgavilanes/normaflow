import { z } from "zod";
import { AssetCategory, AssetCriticality, AssetDependencyType, AssetStatus, CIARating, InformationClassification, OrganizationControlStatus } from "@prisma/client";
import { idSchema, optionalDateInputSchema, optionalText, shortText } from "./common";

export const ASSET_REPORT_TYPES = ["assets", "asset-classification", "asset-risks", "asset-controls"] as const;

export const assetFiltersSchema = z.object({
  query: z.string().trim().max(120).optional(),
  category: z.nativeEnum(AssetCategory).optional(),
  status: z.nativeEnum(AssetStatus).optional(),
  criticality: z.nativeEnum(AssetCriticality).optional(),
  overdue: z.boolean().optional(),
}).strict();

const assetCore = {
  code: shortText(60),
  name: shortText(200),
  description: optionalText(8000),
  category: z.nativeEnum(AssetCategory),
  ownerId: idSchema.optional().nullable(),
  custodianId: idSchema.optional().nullable(),
  processId: idSchema.optional().nullable(),
  locationId: idSchema.optional().nullable(),
  status: z.nativeEnum(AssetStatus).default("ACTIVE"),
  criticality: z.nativeEnum(AssetCriticality).default("MEDIUM"),
  reviewDate: optionalDateInputSchema,
  nextReviewDate: optionalDateInputSchema,
};

export const assetCreateSchema = z.object(assetCore).strict();
export const assetUpdateSchema = z.object({ id: idSchema, ...assetCore }).strict();

export const classificationSchema = z.object({
  assetId: idSchema,
  confidentiality: z.nativeEnum(CIARating),
  integrity: z.nativeEnum(CIARating),
  availability: z.nativeEnum(CIARating),
  classification: z.nativeEnum(InformationClassification),
  legalRequirements: optionalText(8000),
  retention: optionalText(2000),
}).strict();

export const dependencySchema = z.object({
  sourceAssetId: idSchema,
  dependentAssetId: idSchema,
  type: z.nativeEnum(AssetDependencyType).default("DEPENDS_ON"),
  description: optionalText(2000),
}).strict().superRefine((value, ctx) => {
  if (value.sourceAssetId === value.dependentAssetId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dependentAssetId"], message: "Un activo no puede depender de sí mismo." });
  }
});

export const assetRiskSchema = z.object({
  assetId: idSchema,
  riskId: idSchema.optional().nullable(),
  threat: optionalText(2000),
  vulnerability: optionalText(2000),
  description: optionalText(4000),
}).strict();

export const assetControlSchema = z.object({
  assetId: idSchema,
  organizationControlId: idSchema,
  status: z.nativeEnum(OrganizationControlStatus).default("NOT_ASSESSED"),
  evidenceId: idSchema.optional().nullable(),
  note: optionalText(4000),
}).strict();

export const assetReviewSchema = z.object({
  id: idSchema,
  nextReviewDate: optionalDateInputSchema,
}).strict();

export const assetImportSchema = z.object({
  csv: z.string().min(1, "El CSV está vacío.").max(1_000_000),
}).strict();

export const assetExportSchema = z.object({
  reportType: z.enum(ASSET_REPORT_TYPES).default("assets"),
  format: z.enum(["PDF", "EXCEL"]),
}).strict();

export type AssetFilters = z.infer<typeof assetFiltersSchema>;
export type AssetCreateInput = z.infer<typeof assetCreateSchema>;

export function parseAssetFilters(input: unknown) {
  return assetFiltersSchema.parse(input ?? {});
}

/** Minimal RFC-4180-ish CSV parser (comma-separated, double-quote escaping). */
export function parseAssetCsv(csv: string): { code: string; name: string; category: string; criticality?: string; description?: string }[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (inQuotes) {
      if (c === '"') {
        if (csv[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else { field += c; }
    } else if (c === '"') { inQuotes = true; }
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && csv[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else { field += c; }
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((v) => v.trim() !== "")) rows.push(row); }
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const iCode = idx("code"); const iName = idx("name"); const iCat = idx("category"); const iCrit = idx("criticality"); const iDesc = idx("description");
  if (iCode < 0 || iName < 0 || iCat < 0) throw new Error("El CSV debe incluir las columnas: code, name, category.");
  return rows.slice(1).map((r) => ({
    code: (r[iCode] ?? "").trim(),
    name: (r[iName] ?? "").trim(),
    category: (r[iCat] ?? "").trim().toUpperCase(),
    criticality: iCrit >= 0 ? (r[iCrit] ?? "").trim().toUpperCase() : undefined,
    description: iDesc >= 0 ? (r[iDesc] ?? "").trim() : undefined,
  }));
}
