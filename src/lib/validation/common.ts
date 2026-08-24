import { z } from "zod";

/**
 * IDs are opaque application identifiers: database CUID/UUIDs plus the
 * deterministic slugs the standard packs mint, which carry the clause code —
 * dots included — inside the id (`cl-9001-8.2`, `req-14001-6.1.2`). Hence the
 * dot; `..` stays rejected so no id can climb a Storage path.
 */
export const idSchema = z.string().trim()
  .regex(/^[A-Za-z0-9_.-]{3,128}$/, "El identificador no es válido.")
  .refine((value) => !value.includes(".."), "El identificador no es válido.");
export const emailSchema = z.string().trim().toLowerCase().email("El email no es válido.").max(254);
export const shortText = (max = 160) => z.string().trim().min(1, "Este campo es obligatorio.").max(max);
export const optionalText = (max = 500) => z.string().trim().max(max).optional();
export const optionalNullableText = (max = 500) => z.string().trim().max(max).nullable().optional();
export const httpUrlSchema = z.string().trim().url("La URL no es válida.").max(2048).refine(
  (value) => ["http:", "https:"].includes(new URL(value).protocol),
  "La URL debe usar HTTP o HTTPS.",
);

/** Keeps dates as strings for action signatures while rejecting impossible dates. */
export const dateInputSchema = z.string().trim().max(40).refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isNaN(Date.parse(value))) return false;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00.000Z`) : new Date(value);
  return !Number.isNaN(normalized.getTime());
}, "La fecha no es válida.");
export const optionalDateInputSchema = dateInputSchema.optional().nullable();
export const finiteNumber = (min: number, max: number, label = "El número") => z.number().finite(`${label} no es válido.`).min(min).max(max);
export const boundedArray = <T extends z.ZodTypeAny>(schema: T, max = 100) => z.array(schema).max(max, `Se permiten como máximo ${max} elementos.`);

export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  return parsed.data;
}

export function parseId(input: unknown): string {
  return parseInput(idSchema, input);
}

/** Uppercase machine codes: pack codes (PACK_ISO_9001), family codes (ISO_9001), edition codes. */
export const codeSchema = z.string().trim().toUpperCase().regex(
  /^[A-Z0-9][A-Z0-9_.-]{1,79}$/,
  "El código debe usar mayúsculas, números, guiones y guiones bajos.",
);

/** A single-line status/enum-ish token validated against an explicit allowlist. */
export function statusSchema<T extends [string, ...string[]]>(values: T) {
  return z.enum(values, { errorMap: () => ({ message: "Estado no válido." }) });
}

export const commentSchema = z.string().trim().min(1, "El comentario no puede estar vacío.").max(4000);

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(25),
}).strict();
export type Pagination = z.infer<typeof paginationSchema>;

/** Free-text search + date range, the shape almost every list/report filter needs. */
export const baseFiltersSchema = z.object({
  query: z.string().trim().max(200).optional(),
  from: optionalDateInputSchema,
  to: optionalDateInputSchema,
}).strict();

/** Merge a domain-specific filters shape with pagination + the common query/date range. */
export function withPagination<T extends z.ZodRawShape>(shape: T) {
  return z.object({ ...shape, ...paginationSchema.shape }).strict();
}

export const fileMetaSchema = z.object({
  name: z.string().trim().min(1, "El nombre de archivo es obligatorio.").max(255),
  size: z.number().int().min(1, "El archivo está vacío.").max(50 * 1024 * 1024, "El archivo supera 50 MB."),
  mimeType: z.string().trim().min(1).max(120).optional(),
}).strict();
export type FileMeta = z.infer<typeof fileMetaSchema>;
