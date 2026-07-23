import { expect, test } from "@playwright/test";
import { StoragePathError, assertTenantStoragePath } from "@/lib/storage-path";

test.describe("Storage tenant boundary", () => {
  test("accepts only paths rooted in the active organization", () => {
    expect(() => assertTenantStoragePath("org-a", "org-org-a/documents/doc-1/v1-file.pdf")).not.toThrow();
  });

  test("rejects cross-tenant and traversal paths before signing", () => {
    expect(() => assertTenantStoragePath("org-a", "org-org-b/documents/doc-1/v1-file.pdf")).toThrow(StoragePathError);
    expect(() => assertTenantStoragePath("org-a", "org-org-a/../org-b/evidence/file.txt")).toThrow(StoragePathError);
  });
});
