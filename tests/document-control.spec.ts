import { test, expect } from "@playwright/test";
import { nextDocumentVersion } from "@/lib/document-version";
import { roleCan } from "@/lib/permissions/matrix";
import { canPublishApprovedDocument, hasPendingAssignedApproval } from "@/lib/document-approval-workflow";

test.describe("document control versioning", () => {
  test("starts at the document version and bumps from the greatest stored version", () => {
    expect(nextDocumentVersion("1.0", [], "minor")).toBe("1.0");
    expect(nextDocumentVersion("1.0", [{ version: "1.0" }], "minor")).toBe("1.1");
    expect(nextDocumentVersion("1.0", [{ version: "1.1" }, { version: "1.3" }], "minor")).toBe("1.4");
    expect(nextDocumentVersion("2.4", [{ version: "2.4" }], "major")).toBe("3.0");
  });
});

test.describe("document approval permissions", () => {
  test("does not allow an administrative override or publication with pending approvals", () => {
    const approvals = [
      { approverId: "reviewer-a", status: "APPROVED" as const },
      { approverId: "reviewer-b", status: "PENDING" as const },
    ];
    expect(hasPendingAssignedApproval(approvals, "admin-not-assigned")).toBe(false);
    expect(hasPendingAssignedApproval(approvals, "reviewer-b")).toBe(true);
    expect(canPublishApprovedDocument({ approved: 1, pending: 1, rejected: 0 })).toBe(false);
    expect(canPublishApprovedDocument({ approved: 2, pending: 0, rejected: 0 })).toBe(true);
    expect(canPublishApprovedDocument({ approved: 2, pending: 0, rejected: 1 })).toBe(false);
  });

  test("limits approval and obsolescence capabilities to the approval roles", () => {
    expect(roleCan("MANAGER", "documents:approve")).toBe(true);
    // El auditor evalúa el sistema, no lo firma: aprobar un documento que luego
    // audita lo dejaría revisando su propio trabajo.
    expect(roleCan("AUDITOR", "documents:approve")).toBe(false);
    expect(roleCan("CONTRIBUTOR", "documents:approve")).toBe(false);
    expect(roleCan("VIEWER", "documents:approve")).toBe(false);
    expect(roleCan("AUDITOR", "documents:export")).toBe(true);
    expect(roleCan("VIEWER", "documents:export")).toBe(false);
  });
});
