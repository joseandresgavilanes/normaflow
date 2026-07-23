import "server-only";
import { prisma } from "@/lib/prisma";
import { DOCUMENTS_BUCKET, deleteDocumentFile, StorageError } from "@/lib/storage";
import { assertTenantStoragePath } from "@/lib/storage-path";
import { getSupabaseAdmin } from "@/lib/supabase";

export type DocumentStorageReconciliation = {
  organizationId: string;
  orphanedStoragePaths: string[];
  missingStoragePaths: string[];
  deletedPaths: string[];
};

async function listPaths(prefix: string): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new StorageError("Supabase no está configurado en este entorno.");
  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (error) throw new StorageError(`No se pudo listar Storage: ${error.message}`, error);
  const paths: string[] = [];
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`;
    // Folders have no object id in Supabase Storage's listing API.
    if (item.id) paths.push(path);
    else paths.push(...await listPaths(path));
  }
  return paths;
}

/**
 * Dry-run by default. It only considers objects under the explicit tenant
 * prefix and never deletes a Prisma-referenced path.
 */
export async function reconcileDocumentStorage(args: { organizationId: string; apply?: boolean }): Promise<DocumentStorageReconciliation> {
  const prefix = `org-${args.organizationId}/documents`;
  assertTenantStoragePath(args.organizationId, `${prefix}/_probe`);
  const [storagePaths, versions] = await Promise.all([
    listPaths(prefix),
    prisma.documentVersion.findMany({ where: { document: { organizationId: args.organizationId }, fileUrl: { not: null } }, select: { fileUrl: true } }),
  ]);
  const referenced = new Set(versions.flatMap((version) => version.fileUrl ? [version.fileUrl] : []));
  const found = new Set(storagePaths);
  const orphanedStoragePaths = storagePaths.filter((path) => !referenced.has(path));
  const missingStoragePaths = [...referenced].filter((path) => !found.has(path));
  const deletedPaths: string[] = [];
  if (args.apply) {
    for (const path of orphanedStoragePaths) {
      assertTenantStoragePath(args.organizationId, path);
      await deleteDocumentFile(path, args.organizationId);
      deletedPaths.push(path);
    }
  }
  return { organizationId: args.organizationId, orphanedStoragePaths, missingStoragePaths, deletedPaths };
}
