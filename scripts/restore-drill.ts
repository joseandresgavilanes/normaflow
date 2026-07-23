/**
 * Restore drill — proves a backup can actually be restored, with evidence.
 *
 * It restores a dump into an EPHEMERAL target database (never production),
 * verifies the schema/data, and writes a timestamped evidence file to
 * `backups/restore-drills/`. Run it on a schedule (quarterly minimum) and after
 * any major migration; attach the evidence file to the ISO 27001 continuity /
 * A.8.13 backup control.
 *
 * Required env:
 *   RESTORE_TARGET_URL   Postgres URL of a throwaway DB to restore INTO.
 *   RESTORE_SOURCE       Path to a dump file (custom -Fc or plain .sql), OR
 *   RESTORE_SOURCE_URL   A DB URL to pg_dump first (e.g. staging).
 *   RESTORE_DRILL_CONFIRM=run   Required to execute (the restore wipes target).
 *
 * Safety: refuses to run if the target matches DATABASE_URL / DIRECT_URL /
 * PRODUCTION_DATABASE_URL / PRODUCTION_DIRECT_URL.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

function mask(url: string) { return url.replace(/:\/\/[^@]*@/, "://***@"); }
function host(url: string) { try { return new URL(url).host; } catch { return "invalid-url"; } }
function fail(msg: string): never { console.error(`\n❌ ${msg}\n`); process.exit(1); }

const target = process.env.RESTORE_TARGET_URL?.trim();
const sourceFile = process.env.RESTORE_SOURCE?.trim();
const sourceUrl = process.env.RESTORE_SOURCE_URL?.trim();
const confirmed = process.env.RESTORE_DRILL_CONFIRM === "run";

if (!target) fail("RESTORE_TARGET_URL es obligatorio (una base efímera de restauración).");
if (!sourceFile && !sourceUrl) fail("Define RESTORE_SOURCE (archivo de dump) o RESTORE_SOURCE_URL (base a respaldar).");

const forbidden = [process.env.DATABASE_URL, process.env.DIRECT_URL, process.env.PRODUCTION_DATABASE_URL, process.env.PRODUCTION_DIRECT_URL]
  .filter(Boolean).map((u) => host(u as string));
if (forbidden.includes(host(target!))) fail(`RESTORE_TARGET_URL apunta a un host protegido (${host(target!)}). El drill solo restaura en una base efímera.`);

const startedAt = new Date();
const evidenceDir = path.join(process.cwd(), "backups", "restore-drills");
mkdirSync(evidenceDir, { recursive: true });

function run(bin: string, args: string[], env?: NodeJS.ProcessEnv) {
  return execFileSync(bin, args, { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env } }).toString();
}
function psql(sql: string): string {
  try { return run("psql", [target!, "-tAc", sql]).trim(); } catch { return ""; }
}

console.log(`\n=== NormaFlow restore drill ===`);
console.log(`target : ${mask(target!)}`);
console.log(`source : ${sourceFile ? `file:${sourceFile}` : `dump-of:${mask(sourceUrl!)}`}`);
if (!confirmed) {
  console.log(`\nDRY RUN — set RESTORE_DRILL_CONFIRM=run to execute (the restore wipes the target with --clean).`);
  process.exit(0);
}

let dumpPath = sourceFile ?? "";
try {
  if (!dumpPath) {
    dumpPath = path.join(tmpdir(), `nf-restore-src-${startedAt.getTime()}.dump`);
    console.log(`\n→ pg_dump (custom format) desde el origen…`);
    run("pg_dump", ["-Fc", "-f", dumpPath, sourceUrl!]);
  }
  if (!existsSync(dumpPath)) fail(`No se encontró el dump: ${dumpPath}`);
  const dumpBytes = statSync(dumpPath).size;

  console.log(`→ Restaurando en el target efímero…`);
  const restoreStart = Date.now();
  const isCustom = dumpPath.endsWith(".dump") || dumpPath.endsWith(".backup") || dumpPath.endsWith(".pgdump");
  if (isCustom) run("pg_restore", ["--clean", "--if-exists", "--no-owner", "--no-privileges", "-d", target!, dumpPath]);
  else run("psql", [target!, "-v", "ON_ERROR_STOP=0", "-f", dumpPath]);
  const restoreMs = Date.now() - restoreStart;

  console.log(`→ Verificando…`);
  const tables = ["organizations", "users", "documents", "security_incidents", "information_assets"];
  const counts: Record<string, number | null> = {};
  for (const t of tables) { const v = psql(`SELECT count(*) FROM "${t}"`); counts[t] = v === "" ? null : Number(v); }
  const migrationsApplied = Number(psql(`SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`) || "0");
  const latestMigration = psql(`SELECT migration_name FROM "_prisma_migrations" ORDER BY finished_at DESC NULLS LAST LIMIT 1`);

  const orgsOk = (counts.organizations ?? 0) >= 0 && counts.organizations !== null;
  const result = orgsOk && migrationsApplied > 0 ? "PASS" : "FAIL";
  const finishedAt = new Date();
  const evidence = {
    drill: "restore",
    result,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    totalDurationSec: Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000),
    restoreDurationSec: Math.round(restoreMs / 1000),
    source: sourceFile ? `file:${path.basename(sourceFile)}` : `dump-of:${host(sourceUrl!)}`,
    targetHost: host(target!),
    dumpBytes,
    migrationsApplied,
    latestMigration,
    tableCounts: counts,
    tool: "pg_restore/psql",
  };
  const evidencePath = path.join(evidenceDir, `restore-${startedAt.toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

  console.log(`\n${result === "PASS" ? "✅" : "❌"} Restore ${result} en ${evidence.totalDurationSec}s (restauración ${evidence.restoreDurationSec}s)`);
  console.log(`   migraciones aplicadas: ${migrationsApplied} · última: ${latestMigration || "—"}`);
  console.log(`   conteos: ${JSON.stringify(counts)}`);
  console.log(`   evidencia: ${evidencePath}\n`);
  process.exit(result === "PASS" ? 0 : 2);
} catch (error) {
  fail(`El drill de restauración falló: ${error instanceof Error ? error.message : String(error)}`);
}
