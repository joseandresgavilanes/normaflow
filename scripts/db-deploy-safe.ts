import { loadEnvConfig } from "@next/env";
import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";

loadEnvConfig(process.cwd());

type DatabaseEnvironment = "testing" | "staging" | "production";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || value.includes("...") || value.includes("xxxxxxxx") || value.includes("[PASSWORD]") || value.includes("[PROJECT-REF]")) {
    throw new Error(`${name} debe tener un valor real; no se ejecutará ninguna migración.`);
  }
  return value;
}

function targetEnvironment(): DatabaseEnvironment {
  const value = process.env.NORMAFLOW_DB_ENV?.trim().toLowerCase();
  if (value === "testing" || value === "staging" || value === "production") return value;
  throw new Error("NORMAFLOW_DB_ENV debe ser testing, staging o production.");
}

function connectionFingerprint(value: string) {
  const at = value.lastIndexOf("@");
  const target = at >= 0 ? value.slice(at + 1) : value;
  return createHash("sha256").update(target).digest("hex").slice(0, 12);
}

const environment = targetEnvironment();
if (environment === "production" && process.env.NORMAFLOW_ALLOW_PRODUCTION_MIGRATIONS !== "true") {
  throw new Error("Las migraciones de producción requieren NORMAFLOW_ALLOW_PRODUCTION_MIGRATIONS=true explícito.");
}
if (process.env.NORMAFLOW_MIGRATION_CONFIRM !== `apply-${environment}`) {
  throw new Error(`Confirma el target escribiendo NORMAFLOW_MIGRATION_CONFIRM=apply-${environment}.`);
}

const databasePrefix = environment === "testing" ? "TEST" : environment.toUpperCase();
const databaseUrl = required(`${databasePrefix}_DATABASE_URL`);
const directUrl = required(`${databasePrefix}_DIRECT_URL`);
const normalUrl = process.env.DATABASE_URL?.trim();
const testUrl = process.env.TEST_DATABASE_URL?.trim();
if (environment !== "production" && (databaseUrl === normalUrl || databaseUrl === testUrl)) {
  throw new Error("El target de migración coincide con una conexión normal/test no aislada.");
}

const backupDirectory = join(process.cwd(), "backups", environment);
mkdirSync(backupDirectory, { recursive: true });
const backupFile = join(backupDirectory, `normaflow-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`);

const backup = spawnSync("pg_dump", ["--format=custom", "--no-owner", "--file", backupFile, databaseUrl], { stdio: "inherit" });
if (backup.error || backup.status !== 0) {
  throw new Error("No se pudo crear el backup pg_dump; las migraciones no se ejecutaron.");
}

const env = { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: directUrl };
console.log(`Backup creado para ${environment} (fingerprint ${connectionFingerprint(databaseUrl)}).`);
const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", env });
if (migrate.error || migrate.status !== 0) throw new Error("Prisma migrate deploy falló; revisar el backup antes de reintentar.");

const status = spawnSync("npx", ["prisma", "migrate", "status"], { stdio: "inherit", env });
if (status.error || status.status !== 0) throw new Error("La verificación final de Prisma no pasó.");
