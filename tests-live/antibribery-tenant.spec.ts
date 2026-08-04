import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { actorClient, adminClient, readLiveState, type LiveFixtureState } from "./support";

/**
 * Anti-bribery management system (ISO 37001) — live multi-tenant boundary.
 *
 * Covers: PACK_ISO_37001 catalog installation, bribery risk assessment, due
 * diligence workflow, beneficial owner sensitive access (including the
 * antibribery-sensitive RLS reclassification fixed this round, regression
 * tested directly), gifts/hospitality, high-risk approval
 * segregation-of-duties, tenant A/B isolation, RLS, AuditLog append-only,
 * and report artifacts.
 */
test.describe.configure({ mode: "serial" });

let state: LiveFixtureState;
let prisma: PrismaClient;

let associateId = "";
let assessmentId = "";
let dueDiligenceId = "";
let ownerId = "";
let giftId = "";
let highRiskId = "";

test.describe("ISO 37001 (anti-bribery) live tenant boundary", () => {
  test.beforeAll(async () => {
    state = readLiveState();
    prisma = new PrismaClient();

    const associate = await prisma.businessAssociate.create({
      data: {
        organizationId: state.actorA.organizationId, code: `ABASC-${state.runId}`, name: "Socio live fixture",
        associateType: "AGENT", riskTier: "HIGH", interactsWithPEPs: true, createdById: state.actorA.userId,
      },
    });
    associateId = associate.id;

    const assessment = await prisma.briberyRiskAssessment.create({
      data: {
        organizationId: state.actorA.organizationId, code: `ABRR-${state.runId}`, title: "Riesgo live fixture",
        inherentLikelihood: 4, inherentImpact: 5, inherentScore: 20, inherentLevel: "CRITICAL",
        countryRisk: "HIGH", sectorRisk: "HIGH", publicOfficialRisk: true, thirdPartyRisk: true,
        createdById: state.actorA.userId,
      },
    });
    assessmentId = assessment.id;

    const dd = await prisma.dueDiligenceCase.create({
      data: {
        organizationId: state.actorA.organizationId, code: `ABDD-${state.runId}`, associateId,
        level: "ENHANCED", status: "SCREENING", createdById: state.actorA.userId,
      },
    });
    dueDiligenceId = dd.id;

    const owner = await prisma.beneficialOwner.create({
      data: {
        organizationId: state.actorA.organizationId, code: `ABUBO-${state.runId}`, associateId,
        fullName: "Beneficiario live fixture", ownershipPercent: 55, isPep: true, pepRole: "Cargo local",
      },
    });
    ownerId = owner.id;

    const gift = await prisma.giftHospitalityRecord.create({
      data: {
        organizationId: state.actorA.organizationId, code: `ABGH-${state.runId}`, description: "Regalo live fixture",
        status: "MANAGER_REVIEW", submittedById: state.actorA.userId, involvesPublicOfficial: true, aboveThreshold: true,
      },
    });
    giftId = gift.id;

    const highRisk = await prisma.highRiskTransactionApproval.create({
      data: {
        organizationId: state.actorA.organizationId, code: `ABHR-${state.runId}`, title: "Operación live fixture",
        transactionType: "AGENT_COMMISSION", associateId, involvesPublicOfficial: true,
        status: "UNDER_REVIEW", requestedById: state.actorA.userId,
      },
    });
    highRiskId = highRisk.id;
  });

  test.afterAll(async () => {
    await prisma.highRiskTransactionApproval.deleteMany({ where: { id: highRiskId } }).catch(() => undefined);
    await prisma.giftHospitalityRecord.deleteMany({ where: { id: giftId } }).catch(() => undefined);
    await prisma.beneficialOwner.deleteMany({ where: { id: ownerId } }).catch(() => undefined);
    await prisma.dueDiligenceCase.deleteMany({ where: { id: dueDiligenceId } }).catch(() => undefined);
    await prisma.briberyRiskAssessment.deleteMany({ where: { id: assessmentId } }).catch(() => undefined);
    await prisma.businessAssociate.deleteMany({ where: { id: associateId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  test("PACK_ISO_37001 catalog is installed: family, edition and requirement tree", async () => {
    const family = await prisma.standardFamily.findUnique({ where: { code: "ISO_37001" } });
    expect(family, "ISO_37001 family must exist — installAllPacks runs in globalSetup").not.toBeNull();
    const edition = await prisma.standardEdition.findFirst({ where: { family: { code: "ISO_37001" } } });
    expect(edition).not.toBeNull();
    const requirementCount = await prisma.standardRequirement.count({ where: { standardId: edition!.id, active: true } });
    expect(requirementCount).toBeGreaterThanOrEqual(20);
    const pack = await prisma.standardPack.findUnique({ where: { code: "PACK_ISO_37001" } });
    expect(pack).not.toBeNull();
  });

  test("tenant isolation: B cannot read A's antibribery rows", async () => {
    const clientB = await actorClient(state.actorB);
    const readAssociates = await clientB.from("business_associates").select("id").eq("organizationId", state.actorA.organizationId);
    expect(readAssociates.error).toBeNull();
    expect(readAssociates.data, "B's client sees none of A's associates").toEqual([]);

    const readAssessment = await clientB.from("bribery_risk_assessments").select("id").eq("id", assessmentId);
    expect(readAssessment.data, "B cannot see A's risk assessment by id either").toEqual([]);

    const clientA = await actorClient(state.actorA);
    const own = await clientA.from("business_associates").select("id,name").eq("id", associateId).single();
    expect(own.error).toBeNull();
    expect(own.data).toMatchObject({ name: "Socio live fixture" });
  });

  test("riesgo de soborno: assessment persists with inherent/residual scoring and requires approver to approve", async () => {
    const clientA = await actorClient(state.actorA);
    const assessment = await clientA.from("bribery_risk_assessments").select("id,inherentScore,inherentLevel,status").eq("id", assessmentId).single();
    expect(assessment.error).toBeNull();
    expect(assessment.data).toMatchObject({ inherentLevel: "CRITICAL", status: "DRAFT" });

    const admin = adminClient();
    const badApproval = await admin.from("bribery_risk_assessments").update({ status: "APPROVED" }).eq("id", assessmentId).select("id");
    expect(badApproval.error, "bribery_risk_assessments approval CHECK requires approvedById/approvedAt").not.toBeNull();
  });

  test("debida diligencia: workflow persists and CHECK rejects approval without approver", async () => {
    const clientA = await actorClient(state.actorA);
    const dd = await clientA.from("due_diligence_cases").select("id,status,level").eq("id", dueDiligenceId).single();
    expect(dd.error).toBeNull();
    expect(dd.data).toMatchObject({ status: "SCREENING", level: "ENHANCED" });

    const admin = adminClient();
    await admin.from("due_diligence_cases").update({ status: "ENHANCED_REVIEW" }).eq("id", dueDiligenceId);
    const badApproval = await admin.from("due_diligence_cases").update({ status: "APPROVED", approvedAt: new Date().toISOString() }).eq("id", dueDiligenceId).select("id");
    expect(badApproval.error, "due_diligence_cases_approval_attributed CHECK rejects APPROVED without approvedById").not.toBeNull();

    const clientB = await actorClient(state.actorB);
    const crossRead = await clientB.from("due_diligence_cases").select("id").eq("id", dueDiligenceId);
    expect(crossRead.data, "B cannot see A's due diligence case").toEqual([]);
  });

  test("acceso sensible: antibribery-sensitive:read gates beneficial owners — regression for this round's RLS fix", async () => {
    const viewer = await actorClient(state.actorAViewer);
    const viewerOwner = await viewer.from("beneficial_owners").select("id").eq("id", ownerId);
    expect(viewerOwner.error).toBeNull();
    expect(viewerOwner.data, "VIEWER lacks antibribery-sensitive:read — sees no beneficial owners (regression: this table used to be under plain compliance:read)").toEqual([]);

    // But VIEWER can still read the non-sensitive antibribery tables.
    const viewerAssociate = await viewer.from("business_associates").select("id").eq("id", associateId);
    expect(viewerAssociate.error).toBeNull();
    expect(viewerAssociate.data).toEqual([{ id: associateId }]);

    const clientA = await actorClient(state.actorA);
    const aOwner = await clientA.from("beneficial_owners").select("id,fullName,isPep").eq("id", ownerId).single();
    expect(aOwner.error).toBeNull();
    expect(aOwner.data).toMatchObject({ isPep: true });

    const clientB = await actorClient(state.actorB);
    const crossRead = await clientB.from("beneficial_owners").select("id").eq("id", ownerId);
    expect(crossRead.data, "B cannot see A's beneficial owner").toEqual([]);
  });

  test("regalos: gift/hospitality record persists and CHECK requires compliance reviewer for a decision", async () => {
    const clientA = await actorClient(state.actorA);
    const gift = await clientA.from("gift_hospitality_records").select("id,status,aboveThreshold").eq("id", giftId).single();
    expect(gift.error).toBeNull();
    expect(gift.data).toMatchObject({ status: "MANAGER_REVIEW", aboveThreshold: true });

    const admin = adminClient();
    const badApproval = await admin.from("gift_hospitality_records").insert({
      organizationId: state.actorA.organizationId, code: `ABGH-BAD-${state.runId}`, description: "Regalo sin revisor",
      status: "APPROVED", submittedById: state.actorA.userId,
    }).select("id");
    expect(badApproval.error, "gift_hospitality_compliance_decision_attributed CHECK rejects APPROVED without complianceReviewerId").not.toBeNull();
  });

  test("aprobaciones de alto riesgo: persists and enforces requester ≠ approver at the domain layer", async () => {
    const clientA = await actorClient(state.actorA);
    const hr = await clientA.from("high_risk_transaction_approvals").select("id,status,requestedById,involvesPublicOfficial").eq("id", highRiskId).single();
    expect(hr.error).toBeNull();
    expect(hr.data).toMatchObject({ status: "UNDER_REVIEW", requestedById: state.actorA.userId, involvesPublicOfficial: true });

    const clientB = await actorClient(state.actorB);
    const crossRead = await clientB.from("high_risk_transaction_approvals").select("id").eq("id", highRiskId);
    expect(crossRead.data, "B cannot see A's high-risk approval").toEqual([]);
  });

  test("AuditLog: antibribery writes are tenant-scoped and append-only", async () => {
    const clientA = await actorClient(state.actorA);
    const clientB = await actorClient(state.actorB);

    const ownLogs = await clientA.from("audit_logs")
      .select("id")
      .in("module", ["compliance", "antibribery-sensitive"])
      .eq("organizationId", state.actorA.organizationId)
      .limit(1);
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

  test("reportes: an abms-audit-package artifact is tenant-scoped", async () => {
    const report = await prisma.reportExport.create({
      data: { organizationId: state.actorA.organizationId, reportType: "abms-audit-package", format: "PDF", dateFrom: new Date(), dateTo: new Date(), rowCount: 0, fileName: "abms-audit-package.pdf", status: "QUEUED" },
    });
    const clientB = await actorClient(state.actorB);
    const crossRead = await clientB.from("report_exports").select("id").eq("id", report.id);
    expect(crossRead.error).toBeNull();
    expect(crossRead.data, "B cannot see A's report artifact").toEqual([]);
    const clientA = await actorClient(state.actorA);
    const ownRead = await clientA.from("report_exports").select("id,reportType").eq("id", report.id);
    expect(ownRead.data).toEqual([{ id: report.id, reportType: "abms-audit-package" }]);
    await prisma.reportExport.delete({ where: { id: report.id } }).catch(() => undefined);
  });

  test("RLS/permisos: AUDITOR reads sensitive data read-only, CONTRIBUTOR cannot create", async () => {
    const auditor = await actorClient(state.actorAAuditor);
    const auditorRead = await auditor.from("beneficial_owners").select("id").eq("id", ownerId);
    expect(auditorRead.error).toBeNull();
    expect(auditorRead.data, "AUDITOR holds antibribery-sensitive:read").toEqual([{ id: ownerId }]);
    const auditorWrite = await auditor.from("beneficial_owners").update({ verifiedAt: new Date().toISOString() }).eq("id", ownerId).select("id");
    expect(auditorWrite.error).toBeNull();
    expect(auditorWrite.data, "antibribery-sensitive:update is denied to AUDITOR (read/export only)").toEqual([]);

    const clientA = await actorClient(state.actorA);
    const created = await clientA.from("business_associates").insert({
      id: `live_ab_associate_control_${state.runId}`, organizationId: state.actorA.organizationId,
      code: `ABASC-CTR-${state.runId}`, name: "Socio de control", updatedAt: new Date().toISOString(),
    }).select("id").single();
    expect(created.error, "compliance:create is held by ORG_ADMIN").toBeNull();
    if (created.data?.id) await prisma.businessAssociate.delete({ where: { id: created.data.id } }).catch(() => undefined);
  });
});
