/**
 * Tenant data export & offboarding (GDPR / data-portability & erasure).
 *
 *   MODE=export  ORG_ID=<id>   npm run org:offboard   → writes exports/org-<id>-<ts>.json
 *   MODE=delete  ORG_ID=<id>   OFFBOARDING_CONFIRM=delete-<id>   → export THEN hard-delete
 *
 * Deletion always exports first (the export is the retained record), then
 * `organization.delete` cascades every tenant row (FKs are ON DELETE CASCADE).
 * It refuses to touch production unless ALLOW_PRODUCTION_OFFBOARDING=true.
 *
 * NOT handled here (must be done in the provider consoles, see
 * docs/data-governance.md): Supabase Storage objects under org-<id>/ and
 * Supabase Auth users — delete those after confirming the DB export.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ORG_ID = process.env.ORG_ID?.trim();
const MODE = (process.env.MODE ?? "export").trim();
function fail(msg: string): never { console.error(`\n❌ ${msg}\n`); process.exit(1); }
if (!ORG_ID) fail("ORG_ID es obligatorio.");
if (!["export", "delete"].includes(MODE)) fail("MODE debe ser 'export' o 'delete'.");

// Top-level tenant models (each filtered by organizationId). Child rows also
// carry organizationId so they are captured directly.
const MODELS = [
  "membership", "memberInvite", "document", "documentVersion", "process", "risk", "audit", "auditFinding",
  "nonconformity", "action", "cAPA", "opportunity", "indicator", "indicatorValue", "evidenceFile",
  "record", "recordEntry", "assessment", "auditProgram", "managementReview", "trainingCourse", "trainingAssignment",
  "changeRequest", "supplier", "supplierSecurityProfile", "integration", "position", "personnel", "location",
  "organizationControl", "controlEvidence", "controlReview", "riskControlLink",
  "statementOfApplicability", "soAControlEntry", "riskAssessmentMethodology", "riskTreatmentPlan", "riskTreatmentItem", "residualRiskAssessment", "riskAcceptance",
  "informationAsset", "assetClassification", "assetDependency", "assetRisk", "assetControl",
  "securityIncident", "vulnerability", "remediation", "verification",
  "businessContinuityPlan", "disasterRecoveryPlan", "continuityTest", "testResult", "improvementAction",
  "subscription", "billingInvoice", "reportExport", "notification", "auditLog",
] as const;

async function exportOrg() {
  const org = await prisma.organization.findUnique({ where: { id: ORG_ID } });
  if (!org) fail(`No existe la organización ${ORG_ID}.`);

  const data: Record<string, unknown> = { organization: org };
  const counts: Record<string, number> = {};
  for (const model of MODELS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (prisma as any)[model];
    if (!delegate?.findMany) continue;
    const rows = await delegate.findMany({ where: { organizationId: ORG_ID } });
    data[model] = rows;
    counts[model] = rows.length;
  }

  const exportsDir = path.join(process.cwd(), "exports");
  mkdirSync(exportsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(exportsDir, `org-${ORG_ID}-${ts}.json`);
  writeFileSync(file, JSON.stringify({ exportedAt: new Date().toISOString(), organizationId: ORG_ID, counts, data }, null, 2));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`\n✅ Export de ${org.name} → ${file}\n   ${total} registros en ${Object.keys(counts).length} tablas.`);
  return file;
}

async function main() {
  const file = await exportOrg();
  if (MODE === "delete") {
    const isProd = (process.env.NORMAFLOW_ENV || process.env.NODE_ENV) === "production";
    if (isProd && process.env.ALLOW_PRODUCTION_OFFBOARDING !== "true") fail("Offboarding en producción requiere ALLOW_PRODUCTION_OFFBOARDING=true.");
    if (process.env.OFFBOARDING_CONFIRM !== `delete-${ORG_ID}`) fail(`Para eliminar define OFFBOARDING_CONFIRM=delete-${ORG_ID} (export ya guardado en ${file}).`);
    await prisma.organization.delete({ where: { id: ORG_ID } });
    console.log(`\n🗑️  Organización ${ORG_ID} eliminada (cascada DB). Recuerda borrar Storage org-${ORG_ID}/ y los usuarios Auth huérfanos.\n`);
  }
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e))).finally(() => prisma.$disconnect());
