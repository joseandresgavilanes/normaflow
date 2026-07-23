import { expect, test } from "@playwright/test";
import { AssetCategory } from "@prisma/client";
import { roleCan } from "@/lib/permissions/matrix";
import { REPORT_IDS } from "@/lib/reporting-contract";
import { assetCreateSchema, dependencySchema, parseAssetCsv } from "@/lib/validation/assets";

test.describe("inventario de activos de información", () => {
  test("cubre las 7 categorías mínimas ISO 27001", () => {
    const categories = Object.values(AssetCategory);
    for (const c of ["INFORMATION", "SOFTWARE", "HARDWARE", "SERVICES", "PEOPLE", "FACILITIES", "SUPPLIERS"]) {
      expect(categories).toContain(c);
    }
    expect(categories).toHaveLength(7);
  });

  test("valida el alta de activos y rechaza categorías inválidas", () => {
    const base = { code: "ACT-001", name: "CRM", category: "INFORMATION" as const };
    expect(assetCreateSchema.safeParse(base).success).toBe(true);
    expect(assetCreateSchema.safeParse({ ...base, category: "OTHER" }).success).toBe(false);
    expect(assetCreateSchema.safeParse({ name: "sin código", category: "SOFTWARE" }).success).toBe(false);
  });

  test("una dependencia no puede apuntar al mismo activo", () => {
    expect(dependencySchema.safeParse({ sourceAssetId: "asset-000000001", dependentAssetId: "asset-000000002", type: "DEPENDS_ON" }).success).toBe(true);
    expect(dependencySchema.safeParse({ sourceAssetId: "asset-000000001", dependentAssetId: "asset-000000001", type: "DEPENDS_ON" }).success).toBe(false);
  });

  test("parsea CSV con cabecera y comillas", () => {
    const rows = parseAssetCsv('code,name,category,criticality\nACT-1,"Base, datos",INFORMATION,CRITICAL\nACT-2,Servidor,HARDWARE,HIGH\n');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ code: "ACT-1", name: "Base, datos", category: "INFORMATION", criticality: "CRITICAL" });
    expect(() => parseAssetCsv("name,category\nX,SOFTWARE")).toThrow();
  });

  test("aplica permisos del módulo assets", () => {
    expect(roleCan("ORG_ADMIN", "assets:update")).toBe(true);
    expect(roleCan("COMPLIANCE_MANAGER", "assets:delete")).toBe(true);
    expect(roleCan("AUDITOR", "assets:read")).toBe(true);
    expect(roleCan("AUDITOR", "assets:update")).toBe(false);
    expect(roleCan("CONTRIBUTOR", "assets:create")).toBe(true);
    expect(roleCan("VIEWER", "assets:read")).toBe(true);
    expect(roleCan("VIEWER", "assets:update")).toBe(false);
  });

  test("registra los reportes de activos en el contrato de exportación", () => {
    for (const id of ["assets", "asset-classification", "asset-risks", "asset-controls"]) {
      expect(REPORT_IDS).toContain(id);
    }
  });

  test("expone el inventario de activos en demo", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "demo@normaflow.io");
    await page.fill("input[type='password']", "NormaFlow2025!");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/app\/dashboard/);
    await page.goto("/app/assets");
    await expect(page.getByText("Activos de información").first()).toBeVisible();
    await expect(page.getByText("ACT-001")).toBeVisible();
  });
});
