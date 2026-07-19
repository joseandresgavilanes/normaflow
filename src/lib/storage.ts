import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { PLANS } from "@/lib/stripe";

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

/**
 * Cuota de almacenamiento por plan (límites de PLANS en GB).
 * El uso se calcula desde los tamaños registrados en la DB (versiones de
 * documentos, evidencias y entradas de registros), no listando el bucket.
 */
export async function assertStorageQuota(organizationId: string, incomingBytes: number): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  });
  const plan = PLANS[(org?.plan ?? "STARTER") as keyof typeof PLANS] ?? PLANS.STARTER;
  const limitGb = plan.limits.storage;
  if (!limitGb || limitGb <= 0) return;
  const limitBytes = limitGb * 1024 * 1024 * 1024;

  const [docs, evidence, records] = await Promise.all([
    prisma.documentVersion.aggregate({
      _sum: { fileSize: true },
      where: { document: { organizationId } },
    }),
    prisma.evidenceFile.aggregate({ _sum: { fileSize: true }, where: { organizationId } }),
    prisma.recordEntry.aggregate({
      _sum: { fileSize: true },
      where: { record: { organizationId } },
    }),
  ]);
  const used =
    (docs._sum.fileSize ?? 0) + (evidence._sum.fileSize ?? 0) + (records._sum.fileSize ?? 0);

  if (used + incomingBytes > limitBytes) {
    const usedGb = (used / 1024 / 1024 / 1024).toFixed(2);
    throw new StorageError(
      `Se alcanzó el límite de almacenamiento del plan ${plan.name} (${usedGb} de ${limitGb} GB usados). Amplía tu plan en Facturación para subir más archivos.`
    );
  }
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
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new StorageError(`El archivo supera el tamaño máximo permitido (${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB).`);
  }
  if (file.type && !isAllowedMime(file.type)) {
    throw new StorageError(`Tipo de archivo no permitido: ${file.type}`);
  }
  await assertStorageQuota(args.organizationId, file.size);

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new StorageError("Supabase no está configurado en este entorno.");

  const path = buildObjectPath({
    organizationId: args.organizationId,
    documentId: args.documentId,
    version: args.version,
    originalFilename: file.name,
  });

  const buf = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
      cacheControl: "3600",
    });

  if (error) throw new StorageError(`No se pudo subir el archivo: ${error.message}`, error);

  return { path, size: file.size, mime: file.type || "application/octet-stream" };
}

/**
 * Devuelve una URL firmada temporal para descargar/previsualizar.
 * Por defecto vale 5 minutos.
 */
export async function createSignedDownloadUrl(path: string, expiresInSeconds = 300): Promise<string> {
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
export async function deleteDocumentFile(path: string): Promise<void> {
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
  if (file.size <= 0) throw new StorageError("El archivo está vacío.");
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new StorageError(`El archivo supera el tamaño máximo permitido (${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB).`);
  }
  if (file.type && !isAllowedMime(file.type)) throw new StorageError(`Tipo de archivo no permitido: ${file.type}`);
  await assertStorageQuota(args.organizationId, file.size);
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new StorageError("Supabase no está configurado en este entorno.");
  const fileName = safeFilename(file.name) || "registro";
  const path = `org-${args.organizationId}/records/${args.recordId}/${args.entryId}/${Date.now()}-${fileName}`;
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), {
    contentType: file.type || "application/octet-stream",
    upsert: false,
    cacheControl: "3600",
  });
  if (error) throw new StorageError(`No se pudo subir el archivo del registro: ${error.message}`, error);
  return { path, size: file.size, mime: file.type || "application/octet-stream", fileName: file.name.slice(0, 255) };
}

export function createSignedRecordUrl(path: string, expiresInSeconds = 300) {
  return createSignedDownloadUrl(path, expiresInSeconds);
}

export function deleteRecordFile(path: string) {
  return deleteDocumentFile(path);
}

export async function uploadEvidenceFile(args: {
  organizationId: string;
  evidenceId: string;
  file: { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> };
}): Promise<{ path: string; size: number; mime: string }> {
  const { file } = args;
  if (file.size <= 0) throw new StorageError("El archivo está vacío.");
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new StorageError(`El archivo supera el tamaño máximo permitido (${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB).`);
  }
  if (file.type && !isAllowedMime(file.type)) {
    throw new StorageError(`Tipo de archivo no permitido: ${file.type}`);
  }
  await assertStorageQuota(args.organizationId, file.size);
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new StorageError("Supabase no está configurado en este entorno.");
  const filename = safeFilename(file.name) || "evidencia";
  const path = `org-${args.organizationId}/evidence/${args.evidenceId}/${Date.now()}-${filename}`;
  const { error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
      cacheControl: "3600",
    });
  if (error) throw new StorageError(`No se pudo subir la evidencia: ${error.message}`, error);
  return { path, size: file.size, mime: file.type || "application/octet-stream" };
}

export async function createSignedEvidenceUrl(path: string, expiresInSeconds = 300): Promise<string> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new StorageError("Supabase no está configurado en este entorno.");
  const { data, error } = await supabase.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw new StorageError(`No se pudo firmar la evidencia: ${error?.message ?? "?"}`);
  return data.signedUrl;
}

export async function deleteEvidenceFile(path: string): Promise<void> {
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
