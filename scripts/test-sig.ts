/**
 * Sistema Integrado de Gestión (SIG) — prueba de integración.
 *
 * Objetivo central: confirmar que UN MISMO REGISTRO puede cubrir varias normas
 * SIN DUPLICARSE (documentos, evidencias, riesgos, auditorías, hallazgos, CAPA,
 * objetivos, partes interesadas, proveedores y revisión por la dirección).
 *
 *   DATABASE_URL=postgres://…desechable… npx tsx scripts/test-sig.ts
 *
 * Se niega a ejecutarse contra una base gestionada/producción.
 */
import assert from "node:assert/strict";
import Module from "node:module";
import { PrismaClient } from "@prisma/client";
import { installAllPacks } from "../src/lib/standard-packs";
import { buildMappingIndex, classifyRequirement, integrationRate, reuseFactor } from "../src/lib/integrated/crosswalk";

// `server-only` lo resuelve Next en tiempo de build; fuera de Next no existe.
// Se sustituye por un módulo inocuo para poder importar el código de servidor
// desde este script, sin relajar la protección real en producción.
type Loader = (request: string, ...args: unknown[]) => unknown;
const moduleInternals = Module as unknown as { _load: Loader };
const originalLoad = moduleInternals._load;
moduleInternals._load = function (this: unknown, request: string, ...args: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
} as Loader;

const url = process.env.DATABASE_URL ?? "";
if (/supabase|pooler|amazonaws/i.test(url)) {
  throw new Error("Refusing to run integration test against a managed/production database.");
}

const prisma = new PrismaClient();
let passed = 0;
async function t(name: string, fn: () => Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const REQ = {
  q75: "cl-9001-7.5",             // ISO 9001 — información documentada
  e75: "req-iso-14001-7.5",       // ISO 14001 — información documentada
  s75: "req-iso-45001-7.5",       // ISO 45001 — información documentada
  q92: "cl-9001-9.2",             // auditoría interna
  e92: "req-iso-14001-9.2",
  s92: "req-iso-45001-9.2",
  s54: "req-iso-45001-5.4",       // específico de ISO 45001 (consulta y participación)
};

async function main() {
  console.log("Sistema Integrado de Gestión — prueba de integración\n");

  // ── 1. Lógica pura del crosswalk (sin base de datos) ──
  await t("crosswalk: índice bidireccional y clasificación de requisitos", async () => {
    const index = buildMappingIndex([
      { sourceId: "A", targetId: "B", relationType: "EQUIVALENT", equivalencePercent: 100 },
      { sourceId: "A", targetId: "C", relationType: "PARTIAL", equivalencePercent: 70 },
    ]);
    assert.equal(index.get("A")?.length, 2, "A debe ver sus dos correspondencias");
    assert.equal(index.get("B")?.length, 1, "el mapeo es consultable en sentido inverso");
    assert.equal(index.get("B")?.[0].targetId, "A", "el sentido inverso intercambia los extremos");

    assert.equal(classifyRequirement([{ relationType: "EQUIVALENT", familyCode: "ISO_14001" }], "ISO_9001"), "EQUIVALENT");
    assert.equal(classifyRequirement([{ relationType: "PARTIAL", familyCode: "ISO_45001" }], "ISO_9001"), "PARTIAL");
    assert.equal(classifyRequirement([], "ISO_45001"), "SPECIFIC", "sin correspondencias => requisito específico");
    // Una correspondencia dentro de la MISMA norma no la hace compartida.
    assert.equal(classifyRequirement([{ relationType: "EQUIVALENT", familyCode: "ISO_9001" }], "ISO_9001"), "SPECIFIC");
  });

  await t("crosswalk: grado de integración y factor de reutilización", async () => {
    assert.equal(integrationRate([{ kind: "EQUIVALENT" }, { kind: "PARTIAL" }, { kind: "SPECIFIC" }, { kind: "SPECIFIC" }]), 50);
    assert.equal(integrationRate([]), 0);
    // Un documento que cubre 3 requisitos => factor 3 (no 3 documentos).
    const factor = reuseFactor([
      { entityType: "DOCUMENT", entityId: "d1", requirementId: "r1" },
      { entityType: "DOCUMENT", entityId: "d1", requirementId: "r2" },
      { entityType: "DOCUMENT", entityId: "d1", requirementId: "r3" },
    ]);
    assert.equal(factor, 3, "un elemento que cubre 3 requisitos tiene factor 3");
  });

  // ── 2. Catálogo y matriz de correspondencia ──
  await t("packs: se instalan las tres normas del SIG con su crosswalk", async () => {
    await installAllPacks(prisma);
    for (const code of ["ISO_9001", "ISO_14001", "ISO_45001"]) {
      const fam = await prisma.standardFamily.findUnique({ where: { code } });
      assert.ok(fam, `debe existir la familia ${code}`);
    }
    const equiv = await prisma.requirementMapping.findFirst({
      where: { sourceRequirementId: REQ.q92, targetRequirementId: REQ.e92 },
    });
    assert.ok(equiv, "9001 9.2 debe corresponder con 14001 9.2");
    assert.equal(equiv!.relationType, "EQUIVALENT");
  });

  await t("crosswalk: 9.2 (auditoría interna) enlaza las tres normas", async () => {
    const links = await prisma.requirementMapping.findMany({
      where: { OR: [{ sourceRequirementId: REQ.q92 }, { targetRequirementId: REQ.q92 }] },
      select: { sourceRequirementId: true, targetRequirementId: true },
    });
    const ids = new Set(links.flatMap((l) => [l.sourceRequirementId, l.targetRequirementId]));
    assert.ok(ids.has(REQ.e92), "enlaza con ISO 14001");
    assert.ok(ids.has(REQ.s92), "enlaza con ISO 45001");
  });

  await t("crosswalk: un requisito sin correspondencia SIG es específico de su norma", async () => {
    // req-iso-45001-5.4 sí tiene una correspondencia legítima con ISO 37301 8.3
    // (canal de denuncias ⇄ consulta y participación de los trabajadores,
    // declarada en iso-37301-2021.pack.ts) — eso es correcto y no compete al
    // SIG. Dentro del SIG (9001+14001+45001) 5.4 sigue siendo específico.
    const SIG_FAMILIES = new Set(["ISO_9001", "ISO_14001", "ISO_45001"]);
    const links = await prisma.requirementMapping.findMany({
      where: { OR: [{ sourceRequirementId: REQ.s54 }, { targetRequirementId: REQ.s54 }] },
      select: {
        sourceRequirementId: true,
        source: { select: { standard: { select: { family: { select: { code: true } } } } } },
        target: { select: { standard: { select: { family: { select: { code: true } } } } } },
      },
    });
    const sigLinks = links.filter((l) => {
      const counterpartFamily = l.sourceRequirementId === REQ.s54
        ? l.target.standard.family.code
        : l.source.standard.family.code;
      return SIG_FAMILIES.has(counterpartFamily);
    });
    assert.equal(sigLinks.length, 0, "5.4 (consulta a trabajadores) es específico dentro del SIG 9001+14001+45001");
  });

  // ── Fixtures de organización (recreadas en cada ejecución: test idempotente) ──
  await prisma.organization.deleteMany({ where: { slug: { in: ["sig-a", "sig-b"] } } });
  const orgA = await prisma.organization.create({ data: { name: "SIG A", slug: "sig-a", plan: "GROWTH" } });
  const orgB = await prisma.organization.create({ data: { name: "SIG B", slug: "sig-b", plan: "GROWTH" } });
  const user = await prisma.user.upsert({ where: { email: "sig@x.com" }, update: {}, create: { email: "sig@x.com", name: "SIG User" } });
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: orgA.id } },
    update: {}, create: { userId: user.id, organizationId: orgA.id, role: "ORG_ADMIN" },
  });
  const editions = await prisma.standardEdition.findMany({ where: { family: { code: { in: ["ISO_9001", "ISO_14001", "ISO_45001"] } } }, include: { family: true } });
  for (const ed of editions) {
    await prisma.organizationStandard.upsert({
      where: { organizationId_standardId: { organizationId: orgA.id, standardId: ed.id } },
      update: {}, create: { organizationId: orgA.id, standardId: ed.id },
    });
  }

  // ── 3. LA PRUEBA CENTRAL: un registro cubre varias normas sin duplicarse ──
  await t("NO DUPLICACIÓN: un solo documento satisface 7.5 en las tres normas", async () => {
    const before = await prisma.document.count({ where: { organizationId: orgA.id } });
    const doc = await prisma.document.upsert({
      where: { organizationId_code: { organizationId: orgA.id, code: "SIG-DOC-001" } },
      update: {},
      create: { organizationId: orgA.id, code: "SIG-DOC-001", title: "Procedimiento de información documentada", type: "PROCEDURE", currentVersion: "1.0" },
    });
    for (const rid of [REQ.q75, REQ.e75, REQ.s75]) {
      await prisma.requirementCoverage.upsert({
        where: { organizationId_requirementId_entityType_entityId: { organizationId: orgA.id, requirementId: rid, entityType: "DOCUMENT", entityId: doc.id } },
        update: {}, create: { organizationId: orgA.id, requirementId: rid, entityType: "DOCUMENT", entityId: doc.id, coverageType: "primary" },
      });
    }
    const after = await prisma.document.count({ where: { organizationId: orgA.id } });
    assert.equal(after, before + 1, "solo se creó UN documento para las tres normas");

    const cov = await prisma.requirementCoverage.findMany({ where: { entityType: "DOCUMENT", entityId: doc.id }, include: { requirement: { include: { standard: { include: { family: true } } } } } });
    assert.equal(cov.length, 3, "el mismo documento cubre 3 requisitos");
    const families = new Set(cov.map((c) => c.requirement.standard.family.code));
    assert.deepEqual([...families].sort(), ["ISO_14001", "ISO_45001", "ISO_9001"], "cubre las tres normas");
  });

  await t("NO DUPLICACIÓN: una sola evidencia cubre requisitos de tres normas", async () => {
    const ev = await prisma.evidenceFile.create({
      data: { organizationId: orgA.id, title: "Registro de auditoría interna integrada", fileUrl: "org-x/evidence/sig.pdf", evidenceType: "REPORT" },
    });
    for (const rid of [REQ.q92, REQ.e92, REQ.s92]) {
      await prisma.requirementCoverage.create({ data: { organizationId: orgA.id, requirementId: rid, entityType: "EVIDENCE", entityId: ev.id } });
    }
    const evidenceCount = await prisma.evidenceFile.count({ where: { organizationId: orgA.id, title: "Registro de auditoría interna integrada" } });
    assert.equal(evidenceCount, 1, "una sola evidencia, no una por norma");
    const cov = await prisma.requirementCoverage.count({ where: { entityType: "EVIDENCE", entityId: ev.id } });
    assert.equal(cov, 3, "la misma evidencia satisface 3 requisitos");
  });

  await t("NO DUPLICACIÓN: una auditoría integrada cubre varias normas", async () => {
    const audit = await prisma.audit.create({
      data: {
        organizationId: orgA.id, title: "Auditoría interna integrada 2026", type: "INTERNAL",
        standards: ["ISO_9001", "ISO_14001", "ISO_45001"], integrated: true, standardCode: "ISO_9001",
      },
    });
    const audits = await prisma.audit.count({ where: { organizationId: orgA.id, title: "Auditoría interna integrada 2026" } });
    assert.equal(audits, 1, "una sola auditoría para las tres normas");
    assert.equal(audit.standards.length, 3);
    assert.equal(audit.integrated, true);

    // Un hallazgo que afecta a dos normas, sin duplicarse.
    const finding = await prisma.auditFinding.create({
      data: { auditId: audit.id, title: "Control documental incompleto", type: "NONCONFORMITY", severity: "MAJOR", standards: ["ISO_9001", "ISO_14001"] },
    });
    const findings = await prisma.auditFinding.count({ where: { auditId: audit.id } });
    assert.equal(findings, 1, "un solo hallazgo aunque afecte a dos normas");
    assert.equal(finding.standards.length, 2);
  });

  await t("NO DUPLICACIÓN: una CAPA común cubre varias normas", async () => {
    const capa = await prisma.cAPA.create({
      data: {
        organizationId: orgA.id, code: "CAPA-SIG-001", title: "Reforzar control documental",
        description: "Acción correctiva común al sistema integrado",
        requestedById: user.id, standards: ["ISO_9001", "ISO_14001", "ISO_45001"],
      },
    });
    const count = await prisma.cAPA.count({ where: { organizationId: orgA.id, code: "CAPA-SIG-001" } });
    assert.equal(count, 1, "una sola CAPA para las tres normas");
    assert.equal(capa.standards.length, 3);
  });

  await t("NO DUPLICACIÓN: un riesgo pertenece a varias disciplinas", async () => {
    const risk = await prisma.risk.create({
      data: {
        organizationId: orgA.id, title: "Derrame de sustancia peligrosa", category: "Operacional",
        probability: 3, impact: 5, score: 15,
        disciplines: ["ENVIRONMENT", "SAFETY"], standards: ["ISO_14001", "ISO_45001"],
      },
    });
    const count = await prisma.risk.count({ where: { organizationId: orgA.id, title: "Derrame de sustancia peligrosa" } });
    assert.equal(count, 1, "un solo riesgo para ambiente y SST");
    assert.deepEqual([...risk.disciplines].sort(), ["ENVIRONMENT", "SAFETY"]);
  });

  await t("NO DUPLICACIÓN: un objetivo compartido entre disciplinas", async () => {
    const obj = await prisma.integratedObjective.create({
      data: {
        organizationId: orgA.id, code: "OBJ-SIG-001", title: "Reducir incidentes y no conformidades un 20%",
        disciplines: ["QUALITY", "ENVIRONMENT", "SAFETY"], standards: ["ISO_9001", "ISO_14001", "ISO_45001"],
        target: "-20% interanual", status: "IN_PROGRESS",
      },
    });
    const count = await prisma.integratedObjective.count({ where: { organizationId: orgA.id, code: "OBJ-SIG-001" } });
    assert.equal(count, 1, "un solo objetivo compartido, no uno por norma");
    assert.equal(obj.disciplines.length, 3);
  });

  await t("NO DUPLICACIÓN: una parte interesada común a las tres normas", async () => {
    const party = await prisma.interestedParty.create({
      data: {
        organizationId: orgA.id, code: "PI-001", name: "Trabajadores", type: "Interna",
        needs: "Entorno seguro, información y participación",
        disciplines: ["QUALITY", "ENVIRONMENT", "SAFETY"],
      },
    });
    const count = await prisma.interestedParty.count({ where: { organizationId: orgA.id, name: "Trabajadores" } });
    assert.equal(count, 1, "una sola ficha de parte interesada");
    assert.equal(party.disciplines.length, 3);
  });

  await t("NO DUPLICACIÓN: una evaluación de proveedor con las tres dimensiones", async () => {
    const supplier = await prisma.supplier.create({
      data: { organizationId: orgA.id, code: "PROV-SIG-1", name: "Transportes Integrales", category: "Logística" },
    });
    const evaluation = await prisma.supplierEvaluation.create({
      data: {
        supplierId: supplier.id, qualityScore: 85, environmentScore: 70, safetyScore: 90,
        score: Math.round((85 + 70 + 90) / 3), disciplines: ["QUALITY", "ENVIRONMENT", "SAFETY"], outcome: "APPROVED",
      },
    });
    const count = await prisma.supplierEvaluation.count({ where: { supplierId: supplier.id } });
    assert.equal(count, 1, "una sola evaluación cubre calidad, ambiente y SST");
    assert.equal(evaluation.score, 82);
    assert.equal(evaluation.disciplines.length, 3);
  });

  await t("NO DUPLICACIÓN: una revisión por la dirección integrada", async () => {
    const review = await prisma.managementReview.create({
      data: {
        organizationId: orgA.id, title: "Revisión por la dirección 2026 (integrada)",
        standards: ["ISO_9001", "ISO_14001", "ISO_45001"],
      },
    });
    const count = await prisma.managementReview.count({ where: { organizationId: orgA.id, title: "Revisión por la dirección 2026 (integrada)" } });
    assert.equal(count, 1, "una sola revisión para las tres normas");
    assert.equal(review.standards.length, 3);
  });

  await t("NO DUPLICACIÓN: un cambio con impacto en varias disciplinas", async () => {
    const change = await prisma.changeRequest.create({
      data: {
        organizationId: orgA.id, code: "CHG-SIG-1", title: "Nueva línea de producción",
        category: "Infraestructura", changeType: "Permanente", reason: "Ampliación de capacidad",
        disciplines: ["QUALITY", "ENVIRONMENT", "SAFETY"], standards: ["ISO_9001", "ISO_14001", "ISO_45001"],
      },
    });
    assert.equal(change.disciplines.length, 3, "un solo cambio con impacto múltiple");
  });

  // ── 4. Alcance/política integrados y responsable por requisito ──
  await t("alcance y política integrados: uno por organización", async () => {
    const system = await prisma.integratedSystem.upsert({
      where: { organizationId: orgA.id },
      update: { scope: "Planta principal", policy: "Política integrada QAS" },
      create: { organizationId: orgA.id, scope: "Planta principal", policy: "Política integrada QAS" },
    });
    for (const [code, discipline] of [["ISO_9001", "QUALITY"], ["ISO_14001", "ENVIRONMENT"], ["ISO_45001", "SAFETY"]] as const) {
      await prisma.integratedSystemStandard.upsert({
        where: { integratedSystemId_standardCode: { integratedSystemId: system.id, standardCode: code } },
        update: {}, create: { organizationId: orgA.id, integratedSystemId: system.id, standardCode: code, discipline },
      });
    }
    const systems = await prisma.integratedSystem.count({ where: { organizationId: orgA.id } });
    assert.equal(systems, 1, "un único sistema integrado por organización");
    const standards = await prisma.integratedSystemStandard.count({ where: { integratedSystemId: system.id } });
    assert.equal(standards, 3, "las tres normas dentro del mismo alcance");
  });

  await t("crosswalk: responsable asignado por requisito", async () => {
    await prisma.requirementAssignment.upsert({
      where: { organizationId_requirementId: { organizationId: orgA.id, requirementId: REQ.q75 } },
      update: { responsibleId: user.id },
      create: { organizationId: orgA.id, requirementId: REQ.q75, responsibleId: user.id, notes: "Responsable del control documental" },
    });
    const assignment = await prisma.requirementAssignment.findUnique({
      where: { organizationId_requirementId: { organizationId: orgA.id, requirementId: REQ.q75 } },
      include: { responsible: true },
    });
    assert.equal(assignment?.responsible?.id, user.id);
  });

  // ── 5. Métricas agregadas del sistema integrado ──
  await t("métricas: factor de reutilización > 1 confirma la no duplicación", async () => {
    const coverage = await prisma.requirementCoverage.findMany({
      where: { organizationId: orgA.id }, select: { entityType: true, entityId: true, requirementId: true },
    });
    const factor = reuseFactor(coverage);
    assert.ok(factor >= 3, `cada elemento cubre >=3 requisitos (obtenido ${factor})`);
    const entities = new Set(coverage.map((c) => `${c.entityType}:${c.entityId}`)).size;
    assert.ok(coverage.length > entities, "hay más coberturas que elementos: se están reutilizando");
  });

  await t("reportes: matriz integrada y elementos compartidos", async () => {
    const { getIntegratedCrosswalkRows, getSharedElementRows } = await import("../src/lib/integrated/report-data");
    const rows = await getIntegratedCrosswalkRows(orgA.id);
    assert.ok(rows.length > 0, "la matriz integrada devuelve filas");
    const doc75 = rows.find((r) => r.norma === "ISO_9001" && r.requisito === "7.5");
    assert.ok(doc75, "existe la fila del requisito 7.5 de ISO 9001");
    assert.equal(doc75!.tipo, "EQUIVALENTE", "7.5 es equivalente entre normas");
    assert.ok(String(doc75!.requisito_equivalente).includes("ISO_14001"), "muestra el requisito equivalente de ambiente");
    assert.ok(String(doc75!.documento_compartido).includes("SIG-DOC-001"), "muestra el documento compartido");
    assert.equal(doc75!.responsable, "SIG User", "muestra el responsable asignado");

    const specific = rows.find((r) => r.norma === "ISO_45001" && r.requisito === "5.4");
    assert.ok(specific, "existe el requisito específico de SST");
    assert.equal(specific!.tipo, "ESPECIFICO", "5.4 es específico de ISO 45001");

    const shared = await getSharedElementRows(orgA.id);
    assert.ok(shared.length >= 2, "hay al menos dos elementos compartidos entre normas");
    assert.ok(shared.every((s) => Number(s.total_normas) > 1), "todos cubren más de una norma");
  });

  // ── 6. Aislamiento multi-tenant ──
  await t("multi-tenant: la organización B no ve datos del SIG de A", async () => {
    const models = ["integratedSystem", "integratedSystemStandard", "interestedParty", "integratedObjective", "requirementAssignment", "requirementCoverage"] as const;
    for (const model of models) {
      // @ts-expect-error — conteo uniforme entre delegates
      const count = await prisma[model].count({ where: { organizationId: orgB.id } });
      assert.equal(count, 0, `${model} de B debe estar vacío`);
    }
    const crossRows = await (await import("../src/lib/integrated/report-data")).getIntegratedCrosswalkRows(orgB.id);
    assert.equal(crossRows.length, 0, "B no tiene normas activas ni matriz");
    const sharedB = await (await import("../src/lib/integrated/report-data")).getSharedElementRows(orgB.id);
    assert.equal(sharedB.length, 0, "B no ve los elementos compartidos de A");
  });

  await t("reportes SIG declarados en el contrato", async () => {
    const { REPORT_IDS } = await import("../src/lib/reporting-contract");
    for (const id of ["sig-crosswalk", "sig-scope-policy", "sig-interested-parties", "sig-objectives", "sig-shared-elements", "sig-integrated-audit", "sig-integrated-capa", "sig-management-review", "sig-system-package"]) {
      assert.ok((REPORT_IDS as readonly string[]).includes(id), `falta el reporte ${id}`);
    }
  });

  console.log(`\n${passed} checks passed.`);
}

main()
  .catch((e) => { console.error("\n✗ FAILED:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
