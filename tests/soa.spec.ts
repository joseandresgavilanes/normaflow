import { expect, test } from "@playwright/test";
import { roleCan } from "@/lib/permissions/matrix";
import { SECURITY_CONTROL_CATALOG, securityControlCounts } from "@/lib/security-control-catalog";
import { REPORT_IDS } from "@/lib/reporting-contract";
import { soaEntryUpdateSchema } from "@/lib/validation/soa";

const ID = "soa-entry-000000001";

test.describe("Statement of Applicability", () => {
  test("una SoA nueva cubre exactamente los 93 controles del Anexo A", () => {
    // createSoADraft genera una entrada por control activo del catálogo.
    expect(SECURITY_CONTROL_CATALOG).toHaveLength(93);
    const counts = securityControlCounts();
    expect(counts.ORGANIZATIONAL + counts.PEOPLE + counts.PHYSICAL + counts.TECHNOLOGICAL).toBe(93);
  });

  test("una exclusión sin justificación se rechaza", () => {
    expect(soaEntryUpdateSchema.safeParse({ id: ID, applicability: "INCLUDED", implementationStatus: "IMPLEMENTED" }).success).toBe(true);
    expect(soaEntryUpdateSchema.safeParse({ id: ID, applicability: "EXCLUDED", implementationStatus: "NOT_IMPLEMENTED" }).success).toBe(false);
    expect(soaEntryUpdateSchema.safeParse({ id: ID, applicability: "EXCLUDED", implementationStatus: "NOT_IMPLEMENTED", justification: "   " }).success).toBe(false);
    expect(soaEntryUpdateSchema.safeParse({ id: ID, applicability: "EXCLUDED", implementationStatus: "NOT_IMPLEMENTED", justification: "No se opera infraestructura física propia." }).success).toBe(true);
  });

  test("aplica permisos del módulo soa", () => {
    expect(roleCan("ORG_ADMIN", "soa:update")).toBe(true);
    expect(roleCan("ORG_ADMIN", "soa:approve")).toBe(true);
    expect(roleCan("AUDITOR", "soa:approve")).toBe(true);
    expect(roleCan("AUDITOR", "soa:read")).toBe(true);
    expect(roleCan("VIEWER", "soa:read")).toBe(true);
    expect(roleCan("VIEWER", "soa:update")).toBe(false);
    expect(roleCan("CONTRIBUTOR", "soa:approve")).toBe(false);
  });

  test("registra los reportes de SoA en el contrato de exportación", () => {
    for (const id of ["soa", "excluded-controls", "pending-controls", "control-evidence"]) {
      expect(REPORT_IDS).toContain(id);
    }
  });

  test("expone la SoA en demo con las 93 entradas", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "demo@normaflow.io");
    await page.fill("input[type='password']", "NormaFlow2025!");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/app\/dashboard/);
    await page.goto("/app/soa");
    await expect(page.getByText("Declaración de Aplicabilidad").first()).toBeVisible();
    await expect(page.getByText("93 de 93 controles")).toBeVisible();
  });
});
