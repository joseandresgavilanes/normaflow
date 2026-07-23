export class StoragePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoragePathError";
  }
}

/** Rejects paths that are not rooted in the active tenant prefix. */
export function assertTenantStoragePath(organizationId: string, path: string): void {
  const expectedPrefix = `org-${organizationId}/`;
  if (!organizationId || !path.startsWith(expectedPrefix) || path.includes("..")) {
    throw new StoragePathError("La ruta del archivo no pertenece a la organización activa.");
  }
}
