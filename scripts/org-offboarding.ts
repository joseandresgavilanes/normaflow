/**
 * Tenant data export & offboarding (GDPR / data-portability & erasure).
 *
 *   MODE=export  ORG_ID=<id>   npm run org:offboard   → writes exports/org-<id>-<ts>.json
 *   MODE=delete  ORG_ID=<id>   OFFBOARDING_CONFIRM=delete-<id>   → export THEN hard-delete
 *
 * Deletion always exports first (the export is the retained record), then
 * `organization.delete` cascades every tenant row (FKs are ON DELETE CASCADE).
 * The cascade reaches append-only `audit_logs`, so the delete runs inside a
 * transaction that sets `normaflow.audit_log_purge` — the only sanctioned way
 * past the trigger, and it dies with the transaction.
 * It refuses to touch production unless ALLOW_PRODUCTION_OFFBOARDING=true.
 *
 * NOT handled here (must be done in the provider consoles, see
 * docs/data-governance.md): Supabase Storage objects under org-<id>/ and
 * Supabase Auth users — delete those after confirming the DB export.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const RAW_ORG_ID = process.env.ORG_ID?.trim();
const MODE = (process.env.MODE ?? "export").trim();
function fail(msg: string): never { console.error(`\n❌ ${msg}\n`); process.exit(1); }
if (!RAW_ORG_ID) fail("ORG_ID es obligatorio.");
if (!["export", "delete"].includes(MODE)) fail("MODE debe ser 'export' o 'delete'.");
const ORG_ID: string = RAW_ORG_ID;

// La lista de modelos se deriva del schema: todo modelo con `organizationId`
// se exporta solo, así los módulos nuevos (14001, 45001, 22301…) entran sin
// tocar este fichero y el export nunca se queda corto respecto al schema.
const delegateOf = (model: string) => model.charAt(0).toLowerCase() + model.slice(1);
const MODELS = Prisma.dmmf.datamodel.models
  .filter((m) => m.name !== "Organization" && m.fields.some((f) => f.name === "organizationId"))
  .map((m) => delegateOf(m.name));

// Hijos que no llevan organizationId: se filtran por su padre (la FK al padre
// es obligatoria en los cuatro, así que no se escapa ninguna fila).
const CHILD_MODELS: Record<string, (orgId: string) => Record<string, unknown>> = {
  documentVersion: (organizationId) => ({ document: { organizationId } }),
  auditFinding: (organizationId) => ({ audit: { organizationId } }),
  indicatorValue: (organizationId) => ({ indicator: { organizationId } }),
  recordEntry: (organizationId) => ({ record: { organizationId } }),
};

async function exportOrg() {
  const org = await prisma.organization.findUnique({ where: { id: ORG_ID } });
  if (!org) fail(`No existe la organización ${ORG_ID}.`);

  const data: Record<string, unknown> = { organization: org };
  const counts: Record<string, number> = {};
  for (const model of [...MODELS, ...Object.keys(CHILD_MODELS)]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (prisma as any)[model];
    if (!delegate?.findMany) continue;
    const where = CHILD_MODELS[model] ? CHILD_MODELS[model](ORG_ID) : { organizationId: ORG_ID };
    const rows = await delegate.findMany({ where });
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
    // El borrado arrastra audit_logs, que es append-only: la transacción declara
    // el propósito con el flag que exige nf_audit_log_append_only (migración
    // 20260824030000_audit_log_offboarding_purge). SET LOCAL muere con la
    // transacción, así que no deja la puerta abierta después del borrado.
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL normaflow.audit_log_purge = 'on'");
        await tx.organization.delete({ where: { id: ORG_ID } });
      },
      { timeout: 120_000, maxWait: 20_000 },
    );
    console.log(`\n🗑️  Organización ${ORG_ID} eliminada (cascada DB). Recuerda borrar Storage org-${ORG_ID}/ y los usuarios Auth huérfanos.\n`);
  }
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e))).finally(() => prisma.$disconnect());
