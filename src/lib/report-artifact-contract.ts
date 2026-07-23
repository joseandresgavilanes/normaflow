import { createHash } from "crypto";
import { assertTenantStoragePath } from "@/lib/storage-path";

export function reportArtifactPath(organizationId: string, artifactId: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 180);
  const path = `org-${organizationId}/reports/${artifactId}/${safe}`;
  assertTenantStoragePath(organizationId, path);
  return path;
}
export function reportArtifactChecksum(bytes: Uint8Array) { return createHash("sha256").update(bytes).digest("hex"); }
