import "server-only";
import { Prisma } from "@prisma/client";
import { getSupabaseAdmin } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { PLANS } from "@/lib/stripe";
import { assertTenantStoragePath } from "@/lib/storage-path";
import { documentMagicMatches } from "@/lib/document-file-signatures";
import { assertSubscriptionUsable } from "@/lib/plan-entitlements";
export { assertTenantStoragePath } from "@/lib/storage-path";

/**
 * Capa de almacenamiento sobre Supabase Storage para documentos del SGC.
 *
 * Convención de rutas (multitenancy):
 *   org-{orgId}/documents/{documentId}/v{version}-{filename}
 *
 * Esto garantiza que:
 *   - Cada tenant tiene su carpeta aislada
 *   - Cada documento agrupa sus versiones bajo su propio prefijo
 *   - El nombre original del archivo se preserva para descargas
 *
 * Variables de entorno requeridas:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_DOCUMENTS_BUCKET  (default: "documents")
 */

export const DOCUMENTS_BUCKET =
  process.env.SUPABASE_DOCUMENTS_BUCKET ?? "documents";
export const EVIDENCE_BUCKET =
  process.env.SUPABASE_EVIDENCE_BUCKET ?? "evidence";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

const DOCUMENT_EXTENSION_MIME: Record<string, readonly string[]> = {
  pdf: ["application/pdf"], doc: ["application/msword"], docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"], xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ppt: ["application/vnd.ms-powerpoint"], pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  png: ["image/png"], jpg: ["image/jpeg"], jpeg: ["image/jpeg"], gif: ["image/gif"], webp: ["image/webp"],
  txt: ["text/plain"], csv: ["text/csv", "text/plain"], md: ["text/markdown", "text/plain"], markdown: ["text/markdown", "text/plain"],
};

const ALLOWED_MIME_PREFIXES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "image/",
  "text/plain",
  "text/csv",
  "text/markdown",
];

export class StorageError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "StorageError";
  }
}

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p));
}

function extensionOf(name: string) { return name.toLowerCase().split(".").pop() ?? ""; }

/** Validates extension, declared MIME and file signature before storage receives bytes. */
export async function validateDocumentFile(file: { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> }) {
  if (!file.name || file.name.length > 255) throw new StorageError("El nombre del archivo no es válido.");
  if (file.size <= 0) throw new StorageError("El archivo está vacío.");
  if (file.size > MAX_FILE_SIZE_BYTES) throw new StorageError(`El archivo supera el tamaño máximo permitido (${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB).`);
  const extension = extensionOf(file.name);
  const expected = DOCUMENT_EXTENSION_MIME[extension];
  if (!expected) throw new StorageError("La extensión del archivo no está permitida.");
  if (file.type && !expected.includes(file.type)) throw new StorageError("El MIME declarado no coincide con la extensión permitida.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const validMagic = documentMagicMatches(extension, buffer);
  if (!validMagic) throw new StorageError("El contenido del archivo no coincide con su tipo declarado.");
  return { buffer, mime: file.type || expected[0] };
}

/**
 * Cuota de almacenamiento por plan (límites de PLANS en GB).
 * El uso se calcula desde los tamaños registrados en la DB (versiones de
 * documentos, evidencias y entradas de registros), no listando el bucket.
 */
export async function assertStorageQuota(organizationId: string, incomingBytes: number): Promise<void> {
  if (!Number.isSafeInteger(incomingBytes) || incomingBytes <= 0) throw new StorageError("El tamaño del archivo no es válido.");
  await assertSubscriptionUsable(organizationId);
  await prisma.$transaction(async (tx) => {
    // Reserve before touching Storage. The advisory lock makes two concurrent
    // uploads observe the same tenant quota, even before their rows exist.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`storage:${organizationId}`}))`;
    const org = await tx.organization.findUnique({ where: { id: organizationId }, select: { plan: true, storageBytes: true } });
    const plan = PLANS[(org?.plan ?? "STARTER") as keyof typeof PLANS] ?? PLANS.STARTER;
    const limitGb = plan.limits.storage;
    if (!org || !limitGb || limitGb <= 0) return;
    const limitBytes = limitGb * 1024 * 1024 * 1024;
    const used = org.storageBytes ?? 0;
    if (used + incomingBytes > limitBytes) {
      const usedGb = (used / 1024 / 1024 / 1024).toFixed(2);
      throw new StorageError(`Se alcanzó el límite de almacenamiento del plan ${plan.name} (${usedGb} de ${limitGb} GB usados). Amplía tu plan en Facturación para subir más archivos.`);
    }
    await tx.organization.update({ where: { id: organizationId }, data: { storageBytes: { increment: incomingBytes } } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Releases a reservation when the subsequent DB write is rolled back. */
export async function releaseStorageQuota(organizationId: string, bytes: number): Promise<void> {
  if (!Number.isSafeInteger(bytes) || bytes <= 0) return;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`storage:${organizationId}`}))`;
    const org = await tx.organization.findUnique({ where: { id: organizationId }, select: { storageBytes: true } });
    if (!org) return;
    await tx.organization.update({ where: { id: organizationId }, data: { storageBytes: Math.max(0, (org.storageBytes ?? 0) - bytes) } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

function safeFilename(name: string): string {
  // Quita acentos, espacios y caracteres conflictivos
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function buildObjectPath(args: {
  organizationId: string;
  documentId: string;
  version: string;
  originalFilename: string;
}): string {
  const ver = args.version.replace(/[^0-9a-zA-Z.]/g, "");
  const file = safeFilename(args.originalFilename) || "documento";
  return `org-${args.organizationId}/documents/${args.documentId}/v${ver}-${Date.now()}-${file}`;
}

/**
 * Sube un archivo al bucket de documentos.
 * Devuelve la ruta interna del objeto (no la URL).
 */
export async function uploadDocumentFile(args: {
  organizationId: string;
  documentId: string;
  version: string;
  file: { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> };
}): Promise<{ path: string; size: number; mime: string }> {
  const { file } = args;
  const validated = await validateDocumentFile(file);
  await assertStorageQuota(args.organizationId, file.size);

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new StorageError("Supabase no está configurado en este entorno.");

  const path = buildObjectPath({
    organizationId: args.organizationId,
    documentId: args.documentId,
    version: args.version,
    originalFilename: file.name,
  });

  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, validated.buffer, {
      contentType: validated.mime,
      upsert: false,
      cacheControl: "3600",
    });

  if (error) {
    await releaseStorageQuota(args.organizationId, file.size).catch(() => undefined);
    throw new StorageError(`No se pudo subir el archivo: ${error.message}`, error);
  }

  return { path, size: file.size, mime: validated.mime };
}

/**
 * Devuelve una URL firmada temporal para descargar/previsualizar.
 * Por defecto vale 5 minutos.
 */
export async function createSignedDownloadUrl(path: string, organizationId: string, expiresInSeconds = 300): Promise<string> {
  assertTenantStoragePath(organizationId, path);
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new StorageError("Supabase no está configurado en este entorno.");
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw new StorageError(`No se pudo firmar la URL: ${error?.message ?? "?"}`);
  return data.signedUrl;
}

/**
 * Borra un objeto. Usar con cuidado — los documentos aprobados no deberían borrarse,
 * solo marcarse obsoletos. Útil para limpiar borradores rechazados o subidas erróneas.
 */
export async function deleteDocumentFile(path: string, organizationId: string): Promise<void> {
  assertTenantStoragePath(organizationId, path);
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new StorageError("Supabase no está configurado en este entorno.");
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
  if (error) throw new StorageError(`No se pudo borrar el archivo: ${error.message}`, error);
}

export async function uploadRecordFile(args: {
  organizationId: string;
  recordId: string;
  entryId: string;
  file: { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> };
}): Promise<{ path: string; size: number; mime: string; fileName: string }> {
  const { file } = args;
  const validated = await validateDocumentFile(file);
  await assertStorageQuota(args.organizationId, file.size);
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new StorageError("Supabase no está configurado en este entorno.");
  const fileName = safeFilename(file.name) || "registro";
  const path = `org-${args.organizationId}/records/${args.recordId}/${args.entryId}/${Date.now()}-${fileName}`;
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, validated.buffer, {
    contentType: validated.mime,
    upsert: false,
    cacheControl: "3600",
  });
  if (error) {
    await releaseStorageQuota(args.organizationId, file.size).catch(() => undefined);
    throw new StorageError(`No se pudo subir el archivo del registro: ${error.message}`, error);
  }
  return { path, size: file.size, mime: validated.mime, fileName: file.name.slice(0, 255) };
}

export function createSignedRecordUrl(path: string, organizationId: string, expiresInSeconds = 300) {
  return createSignedDownloadUrl(path, organizationId, expiresInSeconds);
}

export function deleteRecordFile(path: string, organizationId: string) {
  return deleteDocumentFile(path, organizationId);
}

export async function uploadEvidenceFile(args: {
  organizationId: string;
  evidenceId: string;
  file: { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> };
}): Promise<{ path: string; size: number; mime: string }> {
  const { file } = args;
  const validated = await validateDocumentFile(file);
  await assertStorageQuota(args.organizationId, file.size);
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new StorageError("Supabase no está configurado en este entorno.");
  const filename = safeFilename(file.name) || "evidencia";
  const path = `org-${args.organizationId}/evidence/${args.evidenceId}/${Date.now()}-${filename}`;
  const { error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(path, validated.buffer, {
      contentType: validated.mime,
      upsert: false,
      cacheControl: "3600",
    });
  if (error) {
    await releaseStorageQuota(args.organizationId, file.size).catch(() => undefined);
    throw new StorageError(`No se pudo subir la evidencia: ${error.message}`, error);
  }
  return { path, size: file.size, mime: validated.mime };
}

export async function createSignedEvidenceUrl(path: string, organizationId: string, expiresInSeconds = 300): Promise<string> {
  assertTenantStoragePath(organizationId, path);
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new StorageError("Supabase no está configurado en este entorno.");
  const { data, error } = await supabase.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw new StorageError(`No se pudo firmar la evidencia: ${error?.message ?? "?"}`);
  return data.signedUrl;
}

export async function deleteEvidenceFile(path: string, organizationId: string): Promise<void> {
  assertTenantStoragePath(organizationId, path);
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new StorageError("Supabase no está configurado en este entorno.");
  const { error } = await supabase.storage.from(EVIDENCE_BUCKET).remove([path]);
  if (error) throw new StorageError(`No se pudo borrar la evidencia: ${error.message}`, error);
}

/**
 * Comprueba que el bucket existe (útil al iniciar la app o en /setup wizard).
 * Si no existe, lanza error con instrucción para crearlo manualmente en Supabase.
 */
export async function ensureDocumentsBucket(): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new StorageError("Supabase no está configurado en este entorno.");
  const { data, error } = await supabase.storage.getBucket(DOCUMENTS_BUCKET);
  if (error || !data) {
    throw new StorageError(
      `El bucket "${DOCUMENTS_BUCKET}" no existe. Crealo en Supabase: Storage → New bucket → nombre "${DOCUMENTS_BUCKET}" → privado.`
    );
  }
}

export async function ensureEvidenceBucket(): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new StorageError("Supabase no está configurado en este entorno.");
  const { data, error } = await supabase.storage.getBucket(EVIDENCE_BUCKET);
  if (error || !data) {
    throw new StorageError(
      `El bucket "${EVIDENCE_BUCKET}" no existe. Crealo en Supabase: Storage → New bucket → nombre "${EVIDENCE_BUCKET}" → privado.`
    );
  }
}
