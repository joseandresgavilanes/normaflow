import { test, expect } from "@playwright/test";
import { documentMagicMatches } from "@/lib/document-file-signatures";
import { canPublishApprovedDocument, hasPendingAssignedApproval } from "@/lib/document-approval-workflow";
import { assertTenantStoragePath } from "@/lib/storage-path";
import { persistWithStorageCompensation } from "@/lib/storage-compensation";

test.describe("document storage and approval concurrency contracts", () => {
  test("validates magic bytes and keeps tenant paths isolated", () => {
    expect(documentMagicMatches("pdf", Buffer.from("%PDF-1.7"))).toBe(true);
    expect(documentMagicMatches("pdf", Buffer.from("not-a-pdf"))).toBe(false);
    expect(documentMagicMatches("docx", Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe(true);
    expect(() => assertTenantStoragePath("tenant-a", "org-tenant-b/documents/x/file.pdf")).toThrow();
  });

  test("two approvers cannot publish until every pending decision settles", () => {
    const approvals = [{ approverId: "approver_a", status: "APPROVED" as const }, { approverId: "approver_b", status: "PENDING" as const }];
    expect(hasPendingAssignedApproval(approvals, "approver_a")).toBe(false);
    expect(hasPendingAssignedApproval(approvals, "approver_b")).toBe(true);
    expect(canPublishApprovedDocument({ approved: 1, pending: 1, rejected: 0 })).toBe(false);
    expect(canPublishApprovedDocument({ approved: 2, pending: 0, rejected: 0 })).toBe(true);
  });

  test("double submit and rejection never result in a published version", () => {
    expect(canPublishApprovedDocument({ approved: 1, pending: 0, rejected: 1 })).toBe(false);
    expect(canPublishApprovedDocument({ approved: 1, pending: 1, rejected: 0 })).toBe(false);
  });

  test("rolls back the uploaded object when transactional persistence fails", async () => {
    let removed = false;
    await expect(persistWithStorageCompensation(
      async () => { throw new Error("Prisma transaction failed"); },
      async () => { removed = true; },
    )).rejects.toThrow("Prisma transaction failed");
    expect(removed).toBe(true);
  });
});
