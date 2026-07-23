import { z } from "zod";

/** IDs are opaque application identifiers (CUID/UUID/Supabase UUID). */
export const idSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{3,128}$/, "El identificador no es válido.");
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
