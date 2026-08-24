/**
 * Backfill de la norma base (ISO 9001) en organizaciones ya existentes.
 *
 * Desde `withBaselineStandard` toda organización nueva la adopta al crearse,
 * pero las que se dieron de alta antes se quedaron sin ninguna norma activa: su
 * selector de norma en documentos solo ofrece «Ninguna» y el picker de cláusulas
 * dice «Sin cláusulas disponibles».
 *
 *   npm run standards:baseline              → informe, no escribe nada
 *   APPLY=true npm run standards:baseline   → adopta la norma donde falte
 *
 * Es idempotente: salta las organizaciones que ya la tienen. Usa la misma
 * `adoptStandardForOrganization` que la app, así que crea también la evaluación
 * GAP inicial con sus respuestas.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { PrismaClient } from "@prisma/client";
import { getStandardSpec, BASELINE_STANDARD_CODE } from "../src/lib/standards-catalog";
import { ensureStandardCatalog, adoptStandardForOrganization } from "../src/lib/standards-adoption";

const prisma = new PrismaClient();
const APPLY = process.env.APPLY === "true";

async function main() {
  const spec = getStandardSpec(BASELINE_STANDARD_CODE);
  if (!spec) throw new Error("La norma base no está en el catálogo.");
  const standard = await ensureStandardCatalog(spec);

  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  for (const org of orgs) {
    const has = await prisma.organizationStandard.findUnique({
      where: { organizationId_standardId: { organizationId: org.id, standardId: standard.id } },
      select: { id: true },
    });
    if (has) { console.log(`✔️  ${org.name} ya tiene ${BASELINE_STANDARD_CODE}`); continue; }
    if (!APPLY) { console.log(`➕ ${org.name} necesita ${BASELINE_STANDARD_CODE} — relanza con APPLY=true`); continue; }
    const admin = await prisma.membership.findFirst({
      where: { organizationId: org.id, role: { in: ["ORG_ADMIN", "OWNER", "ADMIN"] } },
      select: { userId: true },
    });
    const res = await adoptStandardForOrganization({
      organizationId: org.id,
      standardCode: spec.code,
      standardId: standard.id,
      assessorId: admin?.userId ?? undefined,
    });
    console.log(`✅ ${org.name}: ${BASELINE_STANDARD_CODE} activada (assessment=${res.assessmentId ?? "-"}, respuestas=${res.answersCreated})`);
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
