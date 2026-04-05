/**
 * NormaFlow — Script de Seed
 * Ejecutar: npm run db:seed
 *
 * Idempotente por organización demo: limpia datos operativos y los vuelve a crear.
 */

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function wipeOrgChildren(organizationId: string) {
  const actions = await prisma.action.findMany({
    where: { organizationId },
    select: { id: true },
  });
  await prisma.actionComment.deleteMany({ where: { actionId: { in: actions.map(a => a.id) } } });
  await prisma.action.deleteMany({ where: { organizationId } });
  await prisma.indicator.deleteMany({ where: { organizationId } });
  await prisma.control.deleteMany({ where: { risk: { organizationId } } });
  await prisma.risk.deleteMany({ where: { organizationId } });
  await prisma.approval.deleteMany({ where: { document: { organizationId } } });
  await prisma.documentVersion.deleteMany({ where: { document: { organizationId } } });
  await prisma.document.deleteMany({ where: { organizationId } });
  await prisma.nonconformity.deleteMany({ where: { organizationId } });
  await prisma.auditFinding.deleteMany({ where: { audit: { organizationId } } });
  await prisma.audit.deleteMany({ where: { organizationId } });
  await prisma.assessmentAnswer.deleteMany({ where: { assessment: { organizationId } } });
  await prisma.assessment.deleteMany({ where: { organizationId } });
  await prisma.process.deleteMany({ where: { organizationId } });
  await prisma.evidenceFile.deleteMany({ where: { organizationId } });
  await prisma.notification.deleteMany({ where: { organizationId } });
  await prisma.subscription.deleteMany({ where: { organizationId } });
  await prisma.organizationStandard.deleteMany({ where: { organizationId } });
  await prisma.auditLog.deleteMany({ where: { organizationId } });
}

async function main() {
  console.log("🌱 Iniciando seed de NormaFlow...");

  const iso9001 = await prisma.standard.upsert({
    where: { code: "ISO_9001" },
    update: {},
    create: { code: "ISO_9001", name: "ISO 9001", version: "2015", description: "Sistema de Gestión de la Calidad", isActive: true },
  });

  const iso27001 = await prisma.standard.upsert({
    where: { code: "ISO_27001" },
    update: {},
    create: { code: "ISO_27001", name: "ISO 27001", version: "2022", description: "Sistema de Gestión de Seguridad de la Información", isActive: true },
  });

  const clauses9001 = [
    { code: "4", title: "Contexto de la organización", order: 1 },
    { code: "5", title: "Liderazgo", order: 2 },
    { code: "6", title: "Planificación", order: 3 },
    { code: "7", title: "Apoyo", order: 4 },
    { code: "8", title: "Operación", order: 5 },
    { code: "9", title: "Evaluación del desempeño", order: 6 },
    { code: "10", title: "Mejora", order: 7 },
  ];

  for (const c of clauses9001) {
    await prisma.clause.upsert({
      where: { id: `cl-9001-${c.code}` },
      update: {},
      create: { id: `cl-9001-${c.code}`, standardId: iso9001.id, ...c },
    });
  }

  const clauses27001 = [
    { code: "4", title: "Contexto de la organización", order: 1 },
    { code: "5", title: "Liderazgo", order: 2 },
    { code: "6", title: "Planificación", order: 3 },
    { code: "7", title: "Apoyo", order: 4 },
    { code: "8", title: "Operación", order: 5 },
    { code: "9", title: "Evaluación del desempeño", order: 6 },
    { code: "10", title: "Mejora", order: 7 },
  ];

  for (const c of clauses27001) {
    await prisma.clause.upsert({
      where: { id: `cl-27001-${c.code}` },
      update: {},
      create: { id: `cl-27001-${c.code}`, standardId: iso27001.id, ...c },
    });
  }

  const org = await prisma.organization.upsert({
    where: { slug: "tecnoserv-industrial" },
    update: {},
    create: {
      id: "org_demo_tecnoserv",
      name: "Tecnoserv Industrial S.A.",
      slug: "tecnoserv-industrial",
      industry: "Manufactura y Distribución",
      country: "ES",
      plan: "GROWTH",
    },
  });

  await wipeOrgChildren(org.id);

  await prisma.organizationStandard.create({
    data: { organizationId: org.id, standardId: iso9001.id, score: 82, targetDate: new Date("2026-09-30") },
  });

  await prisma.organizationStandard.create({
    data: { organizationId: org.id, standardId: iso27001.id, score: 74, targetDate: new Date("2027-03-31") },
  });

  const users = [
    { id: "u_demo_ana", name: "Ana García", email: "demo@normaflow.io", role: "COMPLIANCE_MANAGER" as const },
    { id: "u_demo_carlos", name: "Carlos Méndez", email: "carlos.mendez@tecnoserv.com", role: "AUDITOR" as const },
    { id: "u_demo_laura", name: "Laura Vega", email: "laura.vega@tecnoserv.com", role: "ORG_ADMIN" as const },
    { id: "u_demo_pedro", name: "Pedro Ruiz", email: "pedro.ruiz@tecnoserv.com", role: "CONTRIBUTOR" as const },
    { id: "u_demo_maria", name: "María Torres", email: "maria.torres@tecnoserv.com", role: "CONTRIBUTOR" as const },
    { id: "u_demo_jose", name: "José López", email: "jose.lopez@tecnoserv.com", role: "VIEWER" as const },
  ];

  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { id: u.id, email: u.email, name: u.name },
    });

    await prisma.membership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
      update: {},
      create: { userId: user.id, organizationId: org.id, role: u.role },
    });
  }

  const gap9001: { code: string; score: number; status: "COMPLIANT" | "PARTIALLY_COMPLIANT" | "NON_COMPLIANT" }[] = [
    { code: "4", score: 85, status: "COMPLIANT" },
    { code: "5", score: 70, status: "PARTIALLY_COMPLIANT" },
    { code: "6", score: 60, status: "PARTIALLY_COMPLIANT" },
    { code: "7", score: 80, status: "COMPLIANT" },
    { code: "8", score: 75, status: "COMPLIANT" },
    { code: "9", score: 55, status: "NON_COMPLIANT" },
    { code: "10", score: 65, status: "PARTIALLY_COMPLIANT" },
  ];

  const gap27001: { code: string; score: number; status: "COMPLIANT" | "PARTIALLY_COMPLIANT" | "NON_COMPLIANT" }[] = [
    { code: "4", score: 80, status: "COMPLIANT" },
    { code: "5", score: 75, status: "COMPLIANT" },
    { code: "6", score: 65, status: "PARTIALLY_COMPLIANT" },
    { code: "7", score: 70, status: "PARTIALLY_COMPLIANT" },
    { code: "8", score: 72, status: "COMPLIANT" },
    { code: "9", score: 50, status: "NON_COMPLIANT" },
    { code: "10", score: 60, status: "PARTIALLY_COMPLIANT" },
  ];

  const avg = (rows: typeof gap9001) => Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length);

  const assessment9001 = await prisma.assessment.create({
    data: {
      organizationId: org.id,
      standardId: iso9001.id,
      title: "GAP Assessment interno ISO 9001",
      type: "INTERNAL",
      status: "COMPLETED",
      globalScore: avg(gap9001),
      assessorId: "u_demo_carlos",
      completedAt: new Date(),
    },
  });

  for (const row of gap9001) {
    await prisma.assessmentAnswer.create({
      data: {
        assessmentId: assessment9001.id,
        clauseId: `cl-9001-${row.code}`,
        score: row.score,
        status: row.status,
        comment: "Resultado demo — revisar evidencias adjuntas.",
      },
    });
  }

  const assessment27001 = await prisma.assessment.create({
    data: {
      organizationId: org.id,
      standardId: iso27001.id,
      title: "GAP Assessment ISO 27001",
      type: "INTERNAL",
      status: "COMPLETED",
      globalScore: avg(gap27001),
      assessorId: "u_demo_ana",
      completedAt: new Date(),
    },
  });

  for (const row of gap27001) {
    await prisma.assessmentAnswer.create({
      data: {
        assessmentId: assessment27001.id,
        clauseId: `cl-27001-${row.code}`,
        score: row.score,
        status: row.status,
        comment: "Evaluación demo SGSI.",
      },
    });
  }

  const proc1 = await prisma.process.create({
    data: {
      organizationId: org.id,
      name: "Producción y entrega",
      code: "P-01",
      type: "core",
      description: "Transformación de materias primas en producto acabado, control de calidad en línea y expedición.",
      ownerId: "u_demo_laura",
      inputs: ["Pedido confirmado", "Materias primas aprobadas", "Instrucciones de trabajo"],
      outputs: ["Producto terminado", "Registro de trazabilidad", "Certificado de conformidad"],
    },
  });

  await prisma.process.create({
    data: {
      organizationId: org.id,
      name: "Soporte TI y seguridad",
      code: "P-08",
      type: "support",
      description: "Operación de infraestructura, gestión de accesos, parches y copias de seguridad.",
      ownerId: "u_demo_pedro",
      inputs: ["Tickets", "Cambios aprobados", "Políticas SGSI"],
      outputs: ["Sistemas disponibles", "Registros de backup", "Informes de incidentes"],
    },
  });

  const risks = [
    { title: "Fuga de datos de clientes", probability: 4, impact: 5, score: 20, status: "UNDER_TREATMENT" as const, category: "Información", ownerId: "u_demo_ana", treatment: "MITIGATE" as const },
    { title: "Fallo de proveedor crítico", probability: 3, impact: 4, score: 12, status: "MONITORED" as const, category: "Operacional", ownerId: "u_demo_carlos", treatment: "MITIGATE" as const },
    { title: "Incumplimiento RGPD", probability: 2, impact: 5, score: 10, status: "MITIGATED" as const, category: "Legal", ownerId: "u_demo_laura", treatment: "MITIGATE" as const },
    { title: "Acceso no autorizado a sistemas", probability: 3, impact: 3, score: 9, status: "UNDER_TREATMENT" as const, category: "Seguridad TI", ownerId: "u_demo_pedro", treatment: "MITIGATE" as const },
    { title: "Error en proceso de fabricación", probability: 2, impact: 4, score: 8, status: "ACCEPTED" as const, category: "Operacional", ownerId: "u_demo_maria", treatment: "ACCEPT" as const },
    { title: "Pérdida de certificación ISO", probability: 1, impact: 5, score: 5, status: "MITIGATED" as const, category: "Cumplimiento", ownerId: "u_demo_jose", treatment: "MITIGATE" as const },
  ];

  for (const r of risks) {
    await prisma.risk.create({
      data: { organizationId: org.id, processId: r.title.includes("fabricación") ? proc1.id : undefined, ...r, dueDate: new Date("2026-12-31") },
    });
  }

  const docs = [
    { code: "SGC-MAN-001", title: "Manual del Sistema de Gestión de Calidad", type: "MANUAL" as const, status: "APPROVED" as const, currentVersion: "3.2", ownerId: "u_demo_laura" },
    { code: "SGC-PRO-001", title: "Procedimiento de Control de Documentos", type: "PROCEDURE" as const, status: "APPROVED" as const, currentVersion: "2.1", ownerId: "u_demo_carlos" },
    { code: "SGSI-POL-001", title: "Política de Seguridad de la Información", type: "POLICY" as const, status: "IN_REVIEW" as const, currentVersion: "1.5", ownerId: "u_demo_ana" },
    { code: "SGSI-PRO-003", title: "Procedimiento de Gestión de Incidentes", type: "PROCEDURE" as const, status: "APPROVED" as const, currentVersion: "2.0", ownerId: "u_demo_pedro" },
    { code: "SGSI-MAN-002", title: "Plan de Continuidad del Negocio", type: "PLAN" as const, status: "DRAFT" as const, currentVersion: "1.0", ownerId: "u_demo_maria" },
    { code: "SGC-INS-007", title: "Instrucción de Trabajo — Control de Calidad", type: "INSTRUCTION" as const, status: "APPROVED" as const, currentVersion: "4.0", ownerId: "u_demo_jose" },
  ];

  for (const d of docs) {
    await prisma.document.create({ data: { organizationId: org.id, ...d, tags: ["demo"] } });
  }

  const audit = await prisma.audit.create({
    data: {
      organizationId: org.id,
      title: "Auditoría Interna ISO 9001 — Q2 2025",
      type: "INTERNAL",
      standardCode: "ISO_9001",
      status: "COMPLETED",
      auditorId: "u_demo_carlos",
      scheduledDate: new Date("2025-05-20"),
      startedAt: new Date("2025-05-20"),
      completedAt: new Date("2025-05-22"),
      progress: 100,
      scope: "Cláusulas 4 a 10",
      objectives: "Verificar el mantenimiento del SGC",
    },
  });

  const t1 = new Date();
  t1.setMonth(t1.getMonth() + 1);
  const t2 = new Date();
  t2.setMonth(t2.getMonth() + 3);

  await prisma.audit.create({
    data: {
      organizationId: org.id,
      title: "Auditoría de certificación ISO 9001:2015",
      type: "EXTERNAL",
      standardCode: "ISO_9001",
      status: "PLANNED",
      auditorExternal: "Organismo acreditado",
      scheduledDate: t1,
      progress: 0,
      scope: "SGC completo",
      objectives: "Renovación de certificado",
    },
  });

  await prisma.audit.create({
    data: {
      organizationId: org.id,
      title: "Revisión controles Anexo A — ISO 27001",
      type: "INTERNAL",
      standardCode: "ISO_27001",
      status: "PLANNED",
      auditorId: "u_demo_pedro",
      scheduledDate: t2,
      progress: 0,
      scope: "A.5 a A.18",
      objectives: "Verificar efectividad de controles",
    },
  });

  await prisma.audit.create({
    data: {
      organizationId: org.id,
      title: "Auditoría de Seguridad ISO 27001 — Semestral",
      type: "INTERNAL",
      standardCode: "ISO_27001",
      status: "IN_PROGRESS",
      auditorId: "u_demo_ana",
      scheduledDate: new Date(),
      startedAt: new Date(),
      progress: 65,
      scope: "Controles técnicos y organizativos",
      objectives: "Evaluación semestral SGSI",
    },
  });

  await prisma.auditFinding.create({
    data: { auditId: audit.id, title: "Documentación de proceso de producción desactualizada", type: "NONCONFORMITY", severity: "MAJOR", status: "IN_PROGRESS", clauseCode: "7.5" },
  });

  await prisma.nonconformity.create({
    data: {
      organizationId: org.id,
      auditId: audit.id,
      title: "Documentación proceso producción desactualizada (8 meses)",
      source: "INTERNAL_AUDIT",
      severity: "MAJOR",
      status: "IN_PROGRESS",
      ownerId: "u_demo_jose",
      rootCause: "Ausencia de proceso formal de revisión periódica de documentos de proceso.",
      dueDate: new Date("2026-07-15"),
    },
  });

  await prisma.nonconformity.create({
    data: {
      organizationId: org.id,
      title: "Registros de trazabilidad incompletos — turno noche",
      source: "CUSTOMER_COMPLAINT",
      severity: "MINOR",
      status: "OPEN",
      ownerId: "u_demo_maria",
      dueDate: new Date("2026-08-30"),
    },
  });

  const pastDue = new Date();
  pastDue.setDate(pastDue.getDate() - 14);

  await prisma.action.create({
    data: {
      organizationId: org.id,
      title: "Actualizar procedimiento de revisión documental",
      type: "CORRECTIVE",
      priority: "HIGH",
      status: "IN_PROGRESS",
      ownerId: "u_demo_laura",
      dueDate: new Date("2026-08-15"),
      progress: 60,
    },
  });

  await prisma.action.create({
    data: {
      organizationId: org.id,
      title: "Implementar MFA en sistemas críticos",
      type: "CORRECTIVE",
      priority: "CRITICAL",
      status: "IN_PROGRESS",
      ownerId: "u_demo_pedro",
      dueDate: pastDue,
      progress: 80,
    },
  });

  const indicators = [
    { name: "Satisfacción del Cliente (NPS)", unit: "pts", target: 75, status: "AT_RISK" as const },
    { name: "Tasa de No Conformidades Internas", unit: "%", target: 3.0, status: "ON_TRACK" as const },
    { name: "Disponibilidad de Sistemas Críticos", unit: "%", target: 99.5, status: "AT_RISK" as const },
  ];

  for (const ind of indicators) {
    const indicator = await prisma.indicator.create({ data: { organizationId: org.id, ...ind, ownerId: "u_demo_ana" } });
    await prisma.indicatorValue.create({ data: { indicatorId: indicator.id, value: ind.target * 0.97, period: "2026-03" } });
  }

  await prisma.evidenceFile.create({
    data: {
      organizationId: org.id,
      title: "Lista de chequeo — Auditoría interna ISO 9001",
      fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      fileSize: 12000,
      mimeType: "application/pdf",
      module: "audit",
      uploadedById: "u_demo_carlos",
    },
  });

  await prisma.evidenceFile.create({
    data: {
      organizationId: org.id,
      title: "Captura — Política SGSI v1.5 en revisión",
      fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      module: "document",
      uploadedById: "u_demo_ana",
    },
  });

  const notifs = [
    { title: "Documento en revisión", body: "SGSI-POL-001 espera tu aprobación.", type: "WARNING" as const, link: "/app/documents" },
    { title: "Acción crítica vencida", body: "MFA en sistemas críticos superó la fecha compromiso.", type: "ALERT" as const, link: "/app/actions" },
    { title: "Auditoría en curso", body: "Auditoría ISO 27001 semestral — 65% avance.", type: "INFO" as const, link: "/app/audits" },
    { title: "Nueva evidencia cargada", body: "Evidencia de auditoría interna disponible.", type: "SUCCESS" as const, link: "/app/evidence" },
  ];

  for (const n of notifs) {
    await prisma.notification.create({
      data: { organizationId: org.id, userId: "u_demo_ana", title: n.title, body: n.body, type: n.type, link: n.link },
    });
  }

  await prisma.subscription.create({
    data: {
      organizationId: org.id,
      plan: "GROWTH",
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      userId: "u_demo_ana",
      action: "LOGIN",
      module: "auth",
      metadata: { source: "seed" },
    },
  });

  console.log("✅ Seed completado:");
  console.log("   📧 Email de acceso: demo@normaflow.io");
  console.log("   🔑 Contraseña: NormaFlow2025!");
  console.log("   🏢 Organización: Tecnoserv Industrial S.A.");
  console.log("   📋 Normas: ISO 9001:2015 + ISO 27001:2022");
}

main()
  .catch(e => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
