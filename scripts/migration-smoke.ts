import { loadEnvConfig } from "@next/env";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

loadEnvConfig(process.cwd());

const mode = process.env.NORMAFLOW_DB_ENV?.trim().toLowerCase();
if (mode !== "testing" && mode !== "staging") throw new Error("El smoke test solo se ejecuta con NORMAFLOW_DB_ENV=testing o staging.");

const prefix = mode === "testing" ? "TEST" : "STAGING";
const databaseUrl = process.env[`${prefix}_DATABASE_URL`]?.trim();
const directUrl = process.env[`${prefix}_DIRECT_URL`]?.trim();
if (!databaseUrl || !directUrl || databaseUrl.includes("...") || directUrl.includes("...")) throw new Error(`Faltan ${prefix}_DATABASE_URL o ${prefix}_DIRECT_URL.`);

process.env.DATABASE_URL = databaseUrl;
process.env.DIRECT_URL = directUrl;

const status = spawnSync("npx", ["prisma", "migrate", "status"], { stdio: "inherit", env: process.env });
if (status.error || status.status !== 0) throw new Error("Las migraciones no están completamente aplicadas; se detiene el smoke test.");

const prisma = new PrismaClient();
try {
  const checks = await Promise.all([
    prisma.organization.count(),
    prisma.document.count(),
    prisma.evidenceFile.count(),
    prisma.reportExport.count(),
    prisma.notificationDeliveryJob.count(),
  ]);
  if (checks.some((value) => typeof value !== "number")) throw new Error("Una consulta base no devolvió un contador válido.");

  const storage = await prisma.$queryRaw<Array<{ exists: boolean }>>`SELECT to_regclass('storage.objects') IS NOT NULL AS exists`;
  if (!storage[0]?.exists) throw new Error("storage.objects no existe en el ambiente objetivo.");
  const policies = await prisma.$queryRaw<Array<{ policyName: string }>>`
    SELECT policyname AS "policyName"
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname LIKE 'nf_storage_%'
    ORDER BY policyname
  `;
  const expected = [
    "nf_storage_documents_select", "nf_storage_documents_insert", "nf_storage_documents_update", "nf_storage_documents_delete",
    "nf_storage_evidence_select", "nf_storage_evidence_insert", "nf_storage_evidence_update", "nf_storage_evidence_delete",
  ];
  for (const name of expected) if (!policies.some((policy) => policy.policyName === name)) throw new Error(`Falta policy Storage ${name}.`);
  console.log(`Migration smoke passed for ${mode}: ${checks.join("/")} rows sampled and Storage policies present.`);
} finally {
  await prisma.$disconnect();
}
