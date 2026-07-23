import { expect, test } from "@playwright/test";
import { roleCan } from "@/lib/permissions/matrix";
import { SECURITY_CONTROL_CATALOG, securityControlCounts } from "@/lib/security-control-catalog";
import { parseSecurityControlFilters } from "@/lib/validation/security-controls";

test.describe("catálogo operativo ISO 27001", () => {
  test("contiene exactamente 93 identificadores en distribución 37/8/14/34", () => {
    expect(SECURITY_CONTROL_CATALOG).toHaveLength(93);
    expect(new Set(SECURITY_CONTROL_CATALOG.map((item) => item.code)).size).toBe(93);
    expect(securityControlCounts()).toEqual({ ORGANIZATIONAL: 37, PEOPLE: 8, PHYSICAL: 14, TECHNOLOGICAL: 34 });
  });

  test("usa identificadores, títulos resumidos y metadatos propios", () => {
    expect(SECURITY_CONTROL_CATALOG.every((item) => /^([5-8])\.\d+$/.test(item.code))).toBe(true);
    expect(SECURITY_CONTROL_CATALOG.every((item) => item.title.length <= 80)).toBe(true);
  });

  test("valida filtros y rechaza payloads fuera del contrato", () => {
    expect(parseSecurityControlFilters({ domain: "TECHNOLOGICAL", status: "IMPLEMENTED" })).toEqual({ domain: "TECHNOLOGICAL", status: "IMPLEMENTED" });
    expect(() => parseSecurityControlFilters({ status: "APPROVED" })).toThrow();
    expect(() => parseSecurityControlFilters({ query: "x".repeat(121) })).toThrow();
  });

  test("aplica permisos específicos al módulo", () => {
    expect(roleCan("ORG_ADMIN", "security-controls:update")).toBe(true);
    expect(roleCan("COMPLIANCE_MANAGER", "security-controls:approve")).toBe(true);
    expect(roleCan("AUDITOR", "security-controls:read")).toBe(true);
    expect(roleCan("VIEWER", "security-controls:read")).toBe(true);
    expect(roleCan("VIEWER", "security-controls:update")).toBe(false);
    expect(roleCan("CONTRIBUTOR", "security-controls:delete")).toBe(false);
  });

  test("expone el catálogo en demo sin texto normativo completo", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "demo@normaflow.io");
    await page.fill("input[type='password']", "NormaFlow2025!");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/app\/dashboard/);
    await page.goto("/app/security-controls");
    await expect(page.getByText("Controles ISO 27001").first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "A.5 Organizacionales" }).first()).toBeVisible();
    await expect(page.getByText("93 controles")).toBeVisible();
  });
});
