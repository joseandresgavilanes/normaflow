import { loadEnvConfig } from "@next/env";
import { reconcileDocumentStorage } from "../src/lib/document-storage-reconciliation";

async function main() {
  loadEnvConfig(process.cwd());
  const organizationId = process.argv.find((arg) => arg.startsWith("--org="))?.slice("--org=".length);
  if (!organizationId) throw new Error("Uso: tsx scripts/reconcile-document-storage.ts --org=<organizationId> [--apply]");
  const result = await reconcileDocumentStorage({ organizationId, apply: process.argv.includes("--apply") });
  console.log(JSON.stringify(result, null, 2));
  if (!process.argv.includes("--apply") && result.orphanedStoragePaths.length) console.log("Dry-run: no se eliminó ningún archivo. Revisa el resultado y repite con --apply si procede.");
}

main().catch((error) => { console.error(error); process.exit(1); });
