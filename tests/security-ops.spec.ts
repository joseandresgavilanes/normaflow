import { expect, test } from "@playwright/test";
import { roleCan } from "@/lib/permissions/matrix";
import { REPORT_IDS } from "@/lib/reporting-contract";
import { INCIDENT_ORDER, incidentCreateSchema, incidentTransitionSchema, nextIncidentStatus } from "@/lib/validation/incidents";
import { vulnCreateSchema } from "@/lib/validation/vulnerabilities";
import { bcpSchema, testResultSchema } from "@/lib/validation/continuity";
import { supplierSecuritySchema } from "@/lib/validation/supplier-security";

test.describe("operaciones de seguridad", () => {
  test("el flujo de incidentes es secuencial y sin saltos", () => {
    expect(INCIDENT_ORDER).toEqual(["DETECTED", "TRIAGED", "INVESTIGATING", "CONTAINED", "ERADICATED", "RECOVERED", "CLOSED"]);
    expect(nextIncidentStatus("DETECTED")).toBe("TRIAGED");
    expect(nextIncidentStatus("CONTAINED")).toBe("ERADICATED");
    expect(nextIncidentStatus("CLOSED")).toBeNull();
    expect(incidentTransitionSchema.safeParse({ id: "inc-000000001", toStatus: "TRIAGED" }).success).toBe(true);
  });

  test("valida el alta de incidentes y vulnerabilidades", () => {
    expect(incidentCreateSchema.safeParse({ code: "INC-1", description: "algo ocurrió", severity: "HIGH", category: "MALWARE" }).success).toBe(true);
    expect(incidentCreateSchema.safeParse({ code: "INC-1" }).success).toBe(false);
    expect(vulnCreateSchema.safeParse({ code: "V-1", source: "scanner", severity: "CRITICAL" }).success).toBe(true);
    expect(vulnCreateSchema.safeParse({ code: "V-1" }).success).toBe(false);
  });

  test("valida continuidad y perfil de proveedor", () => {
    expect(bcpSchema.safeParse({ code: "BCP-1", title: "Plan", rtoMinutes: 240, rpoMinutes: 60 }).success).toBe(true);
    expect(bcpSchema.safeParse({ code: "BCP-1", title: "Plan", rtoMinutes: -1 }).success).toBe(false);
    expect(testResultSchema.safeParse({ testId: "t-000000001", outcome: "PASSED" }).success).toBe(true);
    expect(testResultSchema.safeParse({ testId: "t-000000001", outcome: "MAYBE" }).success).toBe(false);
    expect(supplierSecuritySchema.safeParse({ supplierId: "sup-00000001", securityCriticality: "CRITICAL" }).success).toBe(true);
  });

  test("aplica permisos de los módulos de seguridad", () => {
    for (const mod of ["incidents", "vulnerabilities", "continuity"]) {
      expect(roleCan("ORG_ADMIN", `${mod}:update`)).toBe(true);
      expect(roleCan("VIEWER", `${mod}:read`)).toBe(true);
      expect(roleCan("VIEWER", `${mod}:update`)).toBe(false);
    }
    expect(roleCan("CONTRIBUTOR", "incidents:create")).toBe(true);
    expect(roleCan("AUDITOR", "vulnerabilities:export")).toBe(true);
    expect(roleCan("AUDITOR", "vulnerabilities:update")).toBe(false);
  });

  test("registra los reportes de seguridad en el contrato de exportación", () => {
    for (const id of ["incident-log", "incident-report", "open-vulnerabilities", "remediation-plan", "continuity-plans", "bcp-dr-tests", "critical-suppliers"]) {
      expect(REPORT_IDS).toContain(id);
    }
  });

  test("expone los módulos de seguridad en demo", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "demo@normaflow.io");
    await page.fill("input[type='password']", "NormaFlow2025!");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/app\/dashboard/);
    await page.goto("/app/incidents");
    await expect(page.getByText("INC-001")).toBeVisible();
    await page.goto("/app/vulnerabilities");
    await expect(page.getByText("VULN-001")).toBeVisible();
    await page.goto("/app/continuity");
    await expect(page.getByText("BCP-001").first()).toBeVisible();
    await page.goto("/app/suppliers/security");
    await expect(page.getByText("PROV-001")).toBeVisible();
  });
});
