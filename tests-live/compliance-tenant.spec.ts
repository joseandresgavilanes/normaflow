import crypto from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { actorClient, adminClient, readLiveState, type LiveActor, type LiveFixtureState } from "./support";

/**
 * Compliance management system (ISO 37301) — live multi-tenant boundary.
 *
 * Covers: PACK_ISO_37301 catalog installation, tenant A/B isolation across
 * the compliance programme tables, the speak-up channel's need-to-know
 * boundary (a live `SpeakUpCaseAccess` grant, not just the `speakup:read`
 * module permission — even a COMPLIANCE_MANAGER without a grant cannot see a
 * case), anonymity enforcement (DB CHECK strips identity, channel-config
 * trigger blocks disallowed modes), investigator independence (DB CHECK),
 * AuditLog append-only + tenant scoping, and report artifacts.
 *
 * Two extra COMPLIANCE_MANAGER members are created locally (the shared
 * fixture in global-setup.ts has no such role, since only COMPLIANCE_MANAGER
 * holds `speakup:read/update/approve`) — their emails embed `state.runId` so
 * the global teardown's `cleanupLiveFixture` catches them too; this file also
 * cleans up explicitly in `afterAll` rather than relying on that alone.
 */
test.describe.configure({ mode: "serial" });

let state: LiveFixtureState;
let prisma: PrismaClient;
let complianceHandler: LiveActor;
let complianceOutsider: LiveActor;

let jurisdictionId = "";
let obligationId = "";
let riskId = "";
let reportId = "";
let investigationId = "";

async function createComplianceManager(label: string, organization: LiveActor, password: string): Promise<LiveActor> {
  const admin = adminClient();
  const email = `normaflow-live-${state.runId}-${label}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Live ${label}` } });
  if (error || !data.user) throw error ?? new Error(`No se pudo crear el actor ${label}.`);
  const userId = `live_user_${label}_${state.runId}`;
  const membershipId = `live_membership_${label}_${state.runId}`;
  await prisma.user.create({ data: { id: userId, email, name: `Live ${label}`, authUserId: data.user.id } });
  await prisma.membership.create({ data: { id: membershipId, userId, organizationId: organization.organizationId, role: "COMPLIANCE_MANAGER" } });
  return { ...organization, authId: data.user.id, userId, email, password, name: `Live ${label}`, role: "COMPLIANCE_MANAGER", membershipId };
}

test.describe("ISO 37301 (compliance) live tenant boundary", () => {
  test.beforeAll(async () => {
    state = readLiveState();
    prisma = new PrismaClient();
    const password = `Live-${crypto.randomUUID()}-Aa1!`;

    // Dos COMPLIANCE_MANAGER en la organización A: uno recibirá la
    // autorización del caso (el receptor real), el otro tiene el mismo
    // permiso de módulo pero NUNCA se autoriza — demuestra que `speakup:read`
    // no basta sin la concesión de necesidad de conocer.
    complianceHandler = await createComplianceManager("compliance-handler", state.actorA, password);
    complianceOutsider = await createComplianceManager("compliance-outsider", state.actorA, password);
    await prisma.speakUpChannelConfig.create({
      data: { organizationId: state.actorA.organizationId, allowAnonymous: true, allowConfidential: true },
    });

    const jurisdiction = await prisma.jurisdiction.create({
      data: { organizationId: state.actorA.organizationId, code: `JUR-${state.runId}`, name: "Jurisdicción live fixture", level: "NATIONAL", applicable: true, createdById: state.actorA.userId },
    });
    jurisdictionId = jurisdiction.id;

    const obligation = await prisma.complianceObligation.create({
      data: { organizationId: state.actorA.organizationId, code: `OBL-${state.runId}`, title: "Obligación live fixture", jurisdictionId, criticality: "HIGH", createdById: state.actorA.userId },
    });
    obligationId = obligation.id;

    const risk = await prisma.complianceRisk.create({
      data: { organizationId: state.actorA.organizationId, code: `RC-${state.runId}`, title: "Riesgo live fixture", obligationId, createdById: state.actorA.userId },
    });
    riskId = risk.id;

    // Denuncia identificada, con la única puerta de acceso al caso concedida
    // al receptor — igual que hace `submitSpeakUpReport` en producción.
    const report = await prisma.speakUpReport.create({
      data: {
        organizationId: state.actorA.organizationId, code: `DEN-${state.runId}`, identificationMode: "IDENTIFIED",
        category: "FRAUD", severity: "HIGH", description: "Hechos alegados suficientemente concretos para el expediente live.",
        reporterName: "Reportero externo live fixture", status: "RECEIVED",
      },
    });
    reportId = report.id;
    await prisma.speakUpCaseAccess.create({
      data: { organizationId: state.actorA.organizationId, reportId, userId: complianceHandler.userId, caseRole: "TRIAGE", reason: "Fixture de aislamiento multi-tenant" },
    });

    const investigation = await prisma.investigation.create({
      data: { organizationId: state.actorA.organizationId, code: `INV-${state.runId}`, reportId, title: "Investigación live fixture", leadInvestigatorId: complianceHandler.userId, status: "PLANNED" },
    });
    investigationId = investigation.id;
  });

  test.afterAll(async () => {
    // Deja la configuración del canal de B como estaba: sin fila propia, para
    // no dejar mutado un fixture compartido con el resto de la suite live.
    await prisma.speakUpChannelConfig.deleteMany({ where: { organizationId: { in: [state.actorA.organizationId, state.actorB.organizationId] } } }).catch(() => undefined);
    await prisma.investigation.deleteMany({ where: { id: investigationId } }).catch(() => undefined);
    await prisma.speakUpCaseAccess.deleteMany({ where: { reportId } }).catch(() => undefined);
    await prisma.speakUpReport.deleteMany({ where: { id: reportId } }).catch(() => undefined);
    await prisma.complianceRisk.deleteMany({ where: { id: riskId } }).catch(() => undefined);
    await prisma.complianceObligation.deleteMany({ where: { id: obligationId } }).catch(() => undefined);
    await prisma.jurisdiction.deleteMany({ where: { id: jurisdictionId } }).catch(() => undefined);
    for (const actor of [complianceHandler, complianceOutsider]) {
      await prisma.membership.deleteMany({ where: { id: actor.membershipId } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: actor.userId } }).catch(() => undefined);
      await adminClient().auth.admin.deleteUser(actor.authId).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  test("PACK_ISO_37301 catalog is installed: family, edition and requirement tree", async () => {
    const family = await prisma.standardFamily.findUnique({ where: { code: "ISO_37301" } });
    expect(family, "ISO_37301 family must exist — installAllPacks runs in globalSetup").not.toBeNull();
    const edition = await prisma.standardEdition.findFirst({ where: { family: { code: "ISO_37301" } } });
    expect(edition).not.toBeNull();
    const requirementCount = await prisma.standardRequirement.count({ where: { standardId: edition!.id, active: true } });
    expect(requirementCount).toBeGreaterThanOrEqual(20);
    const pack = await prisma.standardPack.findUnique({ where: { code: "PACK_ISO_37301" } });
    expect(pack).not.toBeNull();
  });

  test("tenant isolation: B cannot read A's compliance programme rows", async () => {
    const clientB = await actorClient(state.actorB);
    const readObligations = await clientB.from("compliance_obligations").select("id").eq("organizationId", state.actorA.organizationId);
    expect(readObligations.error).toBeNull();
    expect(readObligations.data, "B's client sees none of A's obligations").toEqual([]);

    const readRisks = await clientB.from("compliance_risks").select("id").eq("id", riskId);
    expect(readRisks.data, "B cannot see A's risk by id either").toEqual([]);

    const clientA = await actorClient(state.actorA);
    const own = await clientA.from("compliance_obligations").select("id,criticality").eq("id", obligationId).single();
    expect(own.error).toBeNull();
    expect(own.data).toMatchObject({ criticality: "HIGH" });
  });

  test("denuncias: filing a report requires only speakup:create, held by every role", async () => {
    const clientA = await actorClient(state.actorA);
    const insert = await clientA.from("speak_up_reports").insert({
      id: `live_speakup_self_${state.runId}`, organizationId: state.actorA.organizationId,
      code: `DEN-SELF-${state.runId}`, identificationMode: "IDENTIFIED",
      category: "OTHER", description: "Denuncia presentada por el propio ORG_ADMIN para probar el permiso mínimo.",
      reporterUserId: state.actorA.userId, reporterName: "Autopresentada", status: "RECEIVED", updatedAt: new Date().toISOString(),
    }).select("id");
    expect(insert.error, "ORG_ADMIN holds speakup:create even without speakup:read/update/approve").toBeNull();
    if (insert.data?.[0]?.id) {
      await prisma.speakUpReport.delete({ where: { id: insert.data[0].id } }).catch(() => undefined);
    }
  });

  test("acceso restringido: speakup:read alone does not open a case — only a live SpeakUpCaseAccess grant does", async () => {
    const handler = await actorClient(complianceHandler);
    const seen = await handler.from("speak_up_reports").select("id,description").eq("id", reportId).single();
    expect(seen.error, "the authorized handler reaches the case").toBeNull();
    expect(seen.data).toMatchObject({ id: reportId });

    const outsider = await actorClient(complianceOutsider);
    const blocked = await outsider.from("speak_up_reports").select("id").eq("id", reportId);
    expect(blocked.error).toBeNull();
    expect(blocked.data, "same role, same speakup:read, no case-access grant — RESTRICTIVE policy blocks it").toEqual([]);

    const admin = await actorClient(state.actorA);
    const orgAdminBlocked = await admin.from("speak_up_reports").select("id").eq("id", reportId);
    expect(orgAdminBlocked.data, "ORG_ADMIN has compliance:* but never speakup:read — the channel is not open to management by default").toEqual([]);
  });

  test("acceso restringido: revoking the grant removes visibility immediately", async () => {
    const grant = await prisma.speakUpCaseAccess.create({
      data: { organizationId: state.actorA.organizationId, reportId, userId: complianceOutsider.userId, caseRole: "OBSERVER", reason: "Concesión temporal para probar la revocación" },
    });

    const outsider = await actorClient(complianceOutsider);
    const canSeeNow = await outsider.from("speak_up_reports").select("id").eq("id", reportId);
    expect(canSeeNow.data, "with a live grant, the same user now sees the case").toEqual([{ id: reportId }]);

    await prisma.speakUpCaseAccess.update({ where: { id: grant.id }, data: { revokedAt: new Date(), revokedReason: "Fin de la prueba de revocación" } });
    const canSeeAfter = await outsider.from("speak_up_reports").select("id").eq("id", reportId);
    expect(canSeeAfter.data, "once revoked, the grant no longer opens the case").toEqual([]);
  });

  test("anonimato: an ANONYMOUS report cannot carry any identity (DB CHECK)", async () => {
    const admin = adminClient();
    const bad = await admin.from("speak_up_reports").insert({
      id: `live_speakup_anon_bad_${state.runId}`, organizationId: state.actorA.organizationId,
      code: `DEN-ANON-BAD-${state.runId}`, identificationMode: "ANONYMOUS",
      category: "FRAUD", description: "Un informante anónimo cuya identidad no debería poder guardarse jamás.",
      reporterName: "No debería guardarse", updatedAt: new Date().toISOString(),
    }).select("id");
    expect(bad.error, "speak_up_reports_anonymous_has_no_identity CHECK rejects any identity on an anonymous report").not.toBeNull();

    const good = await admin.from("speak_up_reports").insert({
      id: `live_speakup_anon_ok_${state.runId}`, organizationId: state.actorA.organizationId,
      code: `DEN-ANON-OK-${state.runId}`, identificationMode: "ANONYMOUS",
      category: "FRAUD", description: "Denuncia anónima sin ningún dato de identidad, tal como exige el modo.",
      updatedAt: new Date().toISOString(),
    }).select("id").single();
    expect(good.error).toBeNull();
    if (good.data?.id) await prisma.speakUpReport.delete({ where: { id: good.data.id } }).catch(() => undefined);
  });

  test("anonimato: a disallowed mode is rejected even before the identity CHECK runs (channel config trigger)", async () => {
    await prisma.speakUpChannelConfig.upsert({
      where: { organizationId: state.actorB.organizationId },
      create: { organizationId: state.actorB.organizationId, allowAnonymous: false, allowConfidential: false },
      update: { allowAnonymous: false, allowConfidential: false },
    });
    const admin = adminClient();
    const blocked = await admin.from("speak_up_reports").insert({
      id: `live_speakup_anon_disabled_${state.runId}`, organizationId: state.actorB.organizationId,
      code: `DEN-ANON-DISABLED-${state.runId}`, identificationMode: "ANONYMOUS",
      category: "OTHER", description: "Este tenant no admite denuncias anónimas: la inserción debe rechazarse.",
      updatedAt: new Date().toISOString(),
    }).select("id");
    expect(blocked.error, "nf_speakup_mode_allowed trigger rejects ANONYMOUS when the org's channel config disallows it").not.toBeNull();
  });

  test("investigaciones: independence CHECK rejects an investigator who is the subject of the case", async () => {
    const admin = adminClient();
    const bad = await admin.from("investigations").insert({
      organizationId: state.actorA.organizationId, code: `INV-BAD-${state.runId}`, title: "Investigación con conflicto estructural",
      reportId, leadInvestigatorId: complianceHandler.userId, subjectUserId: complianceHandler.userId, status: "PLANNED",
    }).select("id");
    expect(bad.error, "investigations_lead_is_not_the_subject CHECK rejects leadInvestigatorId === subjectUserId").not.toBeNull();
  });

  test("investigaciones: tenant-scoped and only visible through the channel's need-to-know when tied to a case", async () => {
    const outsider = await actorClient(complianceOutsider);
    const blocked = await outsider.from("investigations").select("id").eq("id", investigationId);
    expect(blocked.data, "investigation is tied to a report — same need-to-know boundary applies").toEqual([]);

    const handler = await actorClient(complianceHandler);
    const seen = await handler.from("investigations").select("id,status").eq("id", investigationId).single();
    expect(seen.error).toBeNull();
    expect(seen.data).toMatchObject({ status: "PLANNED" });

    const clientB = await actorClient(state.actorB);
    const crossTenant = await clientB.from("investigations").select("id").eq("id", investigationId);
    expect(crossTenant.data, "B cannot see A's investigation regardless of role").toEqual([]);
  });

  test("AuditLog: compliance writes are tenant-scoped and append-only", async () => {
    const clientA = await actorClient(state.actorA);
    const clientB = await actorClient(state.actorB);

    const ownLogs = await clientA.from("audit_logs").select("id").eq("module", "compliance").eq("organizationId", state.actorA.organizationId).limit(1);
    expect(ownLogs.error).toBeNull();

    if (ownLogs.data && ownLogs.data.length > 0) {
      const logId = ownLogs.data[0].id;
      const crossRead = await clientB.from("audit_logs").select("id").eq("id", logId);
      expect(crossRead.data, "B cannot read A's audit log row").toEqual([]);

      const tamper = await clientA.from("audit_logs").update({ action: "TAMPERED" }).eq("id", logId).select("id");
      expect(tamper.error, "audit_logs is append-only — UPDATE is rejected even for the owning tenant").not.toBeNull();

      const destroy = await clientA.from("audit_logs").delete().eq("id", logId).select("id");
      expect(destroy.error, "audit_logs is append-only — DELETE is rejected even for the owning tenant").not.toBeNull();
    }
  });

  test("reportes: a compliance-audit-package artifact is tenant-scoped", async () => {
    const report = await prisma.reportExport.create({
      data: { organizationId: state.actorA.organizationId, reportType: "compliance-audit-package", format: "PDF", dateFrom: new Date(), dateTo: new Date(), rowCount: 0, fileName: "compliance-audit-package.pdf", status: "QUEUED" },
    });
    const clientB = await actorClient(state.actorB);
    const crossRead = await clientB.from("report_exports").select("id").eq("id", report.id);
    expect(crossRead.error).toBeNull();
    expect(crossRead.data, "B cannot see A's report artifact").toEqual([]);
    const clientA = await actorClient(state.actorA);
    const ownRead = await clientA.from("report_exports").select("id,reportType").eq("id", report.id);
    expect(ownRead.data).toEqual([{ id: report.id, reportType: "compliance-audit-package" }]);
    await prisma.reportExport.delete({ where: { id: report.id } }).catch(() => undefined);
  });

  test("permissions: viewer and auditor are read-only on the compliance programme", async () => {
    const viewer = await actorClient(state.actorAViewer);
    const viewerRead = await viewer.from("compliance_obligations").select("id").eq("id", obligationId);
    expect(viewerRead.error).toBeNull();
    expect(viewerRead.data).toEqual([{ id: obligationId }]);
    const viewerWrite = await viewer.from("compliance_obligations").update({ title: "intento viewer" }).eq("id", obligationId).select("id");
    expect(viewerWrite.error).toBeNull();
    expect(viewerWrite.data, "compliance:update is denied to VIEWER").toEqual([]);

    const auditor = await actorClient(state.actorAAuditor);
    const auditorRead = await auditor.from("compliance_risks").select("id").eq("id", riskId);
    expect(auditorRead.error).toBeNull();
    expect(auditorRead.data).toEqual([{ id: riskId }]);
    const auditorWrite = await auditor.from("compliance_risks").update({ title: "intento auditor" }).eq("id", riskId).select("id");
    expect(auditorWrite.error).toBeNull();
    expect(auditorWrite.data, "compliance:update is denied to AUDITOR (read/export only)").toEqual([]);

    // Ambos roles conservan speakup:create (cualquiera puede denunciar) pero
    // ninguno tiene speakup:read: no alcanzan el canal salvo su propio caso.
    const viewerChannel = await viewer.from("speak_up_reports").select("id").eq("id", reportId);
    expect(viewerChannel.data, "VIEWER has no speakup:read and no grant on this case").toEqual([]);
  });
});
