import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";

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
