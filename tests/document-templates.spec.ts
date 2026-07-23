import { expect, test } from "@playwright/test";
import { DOCUMENT_TEMPLATES, renderTemplateContent } from "../src/lib/document-templates";

test.describe("biblioteca de plantillas ISO", () => {
  test("incluye las 20 plantillas base con códigos y cláusulas únicas", () => {
    expect(DOCUMENT_TEMPLATES).toHaveLength(20);
    expect(DOCUMENT_TEMPLATES.filter((template) => template.standardCode === "ISO_9001")).toHaveLength(10);
    expect(DOCUMENT_TEMPLATES.filter((template) => template.standardCode === "ISO_27001")).toHaveLength(10);
    expect(new Set(DOCUMENT_TEMPLATES.map((template) => template.code)).size).toBe(20);
    expect(DOCUMENT_TEMPLATES.every((template) => template.clauseCode && template.content.includes("{{ORGANIZATION_NAME}}"))).toBe(true);
  });

  test("renderiza campos de organización y conserva pendientes explícitos", () => {
    const content = renderTemplateContent("{{ORGANIZATION_NAME}} · {{SYSTEM_SCOPE}} · {{MISSING_FIELD}}", {
      ORGANIZATION_NAME: "Acme S.A.",
      SYSTEM_SCOPE: "Diseño y soporte",
    });
    expect(content).toContain("Acme S.A. · Diseño y soporte");
    expect(content).toContain("[Completar: MISSING_FIELD]");
  });

  test("mantiene accesible el control documental en el workspace", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "demo@normaflow.io");
    await page.fill("input[type='password']", "NormaFlow2025!");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/app\/dashboard/);
    await page.goto("/app/documents");
    await expect(page.getByText(/Control de Documentos/i).first()).toBeVisible();
  });
});
