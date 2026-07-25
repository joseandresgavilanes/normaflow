import crypto from "node:crypto";
import fs from "node:fs";
import { PrismaClient, type Role } from "@prisma/client";
import { adminClient, cleanupLiveFixture, LIVE_STATE_PATH, type LiveActor, type LiveFixtureState, writeLiveState } from "./support";
import { ensureOrganizationControlSet, ensureSecurityControlCatalog } from "../src/lib/security-control-catalog";
import { installAllPacks } from "../src/lib/standard-packs";

export default async function globalSetup() {
  const prisma = new PrismaClient();
  const admin = adminClient();
  const runId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const password = `Live-${crypto.randomUUID()}-Aa1!`;
  const createdAuthIds: string[] = [];
  const createdOrganizationIds: string[] = [];
  const createdUserIds: string[] = [];

  async function createActor(label: "a" | "b", role: Role): Promise<LiveActor> {
    const email = `normaflow-live-${runId}-${label}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Live ${label.toUpperCase()}` },
    });
    if (error || !data.user) throw error ?? new Error(`No se pudo crear el usuario live ${label}.`);
    createdAuthIds.push(data.user.id);
    const organizationId = `live_org_${label}_${runId}`;
    const userId = `live_user_${label}_${runId}`;
    const organizationName = `Organización ${label.toUpperCase()} · ${runId}`;
    const documentId = `live_doc_${label}_${runId}`;
    const processId = `live_process_${label}_${runId}`;
    const riskId = `live_risk_${label}_${runId}`;
    const auditId = `live_audit_${label}_${runId}`;
    const capaId = `live_capa_${label}_${runId}`;
    const evidenceId = `live_evidence_${label}_${runId}`;
    const membershipId = `live_membership_${label}_${runId}`;
    const notificationId = `live_notification_${label}_${runId}`;
    const invoiceNumber = `LIVE-INV-${label.toUpperCase()}-${runId}`;
    const reportFileName = `live-report-${label}-${runId}.csv`;
    const name = `Live ${label.toUpperCase()}`;

    createdOrganizationIds.push(organizationId);
    createdUserIds.push(userId);

    await prisma.organization.create({ data: { id: organizationId, name: organizationName, slug: `live-org-${label}-${runId}` } });
    await prisma.user.create({ data: { id: userId, email, name, authUserId: data.user.id } });
    await prisma.membership.create({ data: { id: membershipId, userId, organizationId, role } });
    await prisma.document.create({ data: { id: documentId, organizationId, code: `LIVE-${label.toUpperCase()}-${runId}`, title: `LIVE DOCUMENT ${label.toUpperCase()} ${runId}`, type: "POLICY", tags: [], distributionList: [] } });
    await prisma.process.create({ data: { id: processId, organizationId, name: `LIVE PROCESS ${label.toUpperCase()} ${runId}`, inputs: [], outputs: [] } });
    await prisma.risk.create({ data: { id: riskId, organizationId, processId, title: `LIVE RISK ${label.toUpperCase()} ${runId}`, category: "OPERATIONS", probability: 3, impact: 3, score: 9 } });
    await prisma.audit.create({ data: { id: auditId, organizationId, processId, title: `LIVE AUDIT ${label.toUpperCase()} ${runId}`, standardCode: "ISO 9001" } });
    await prisma.cAPA.create({ data: { id: capaId, organizationId, code: `LIVE-CAPA-${label.toUpperCase()}-${runId}`, title: `LIVE CAPA ${label.toUpperCase()} ${runId}`, description: "Fixture de aislamiento multi-tenant.", requestedById: userId } });
    await prisma.evidenceFile.create({ data: { id: evidenceId, organizationId, title: `LIVE EVIDENCE ${label.toUpperCase()} ${runId}`, evidenceType: "OTHER", fileUrl: `org-${organizationId}/evidence/${evidenceId}/seed.txt`, processId, uploadedById: userId } });
    await prisma.notification.create({ data: { id: notificationId, organizationId, userId, title: `LIVE NOTIFICATION ${label.toUpperCase()} ${runId}`, body: `Tenant ${label}`, type: "INFO" } });
    const subscription = await prisma.subscription.create({ data: { id: `live_subscription_${label}_${runId}`, organizationId, plan: label === "a" ? "GROWTH" : "STARTER", status: "ACTIVE" } });
    await prisma.billingInvoice.create({ data: { id: `live_invoice_${label}_${runId}`, organizationId, subscriptionId: subscription.id, stripeInvoiceId: `live_stripe_invoice_${label}_${runId}`, number: invoiceNumber, status: "paid", amountDue: label === "a" ? 29900 : 9900, amountPaid: label === "a" ? 29900 : 9900 } });
    await prisma.reportExport.create({ data: { id: `live_report_${label}_${runId}`, organizationId, generatedById: userId, reportType: "exec", format: "CSV", dateFrom: new Date("2026-01-01T00:00:00.000Z"), dateTo: new Date("2026-12-31T23:59:59.999Z"), rowCount: 1, fileName: reportFileName } });

    return { authId: data.user.id, userId, email, password, name, role, organizationId, organizationName, documentId, documentTitle: `LIVE DOCUMENT ${label.toUpperCase()} ${runId}`, processId, riskId, auditId, capaId, evidenceId, membershipId, notificationId, notificationTitle: `LIVE NOTIFICATION ${label.toUpperCase()} ${runId}`, invoiceNumber, reportFileName };
  }

  async function createMember(label: string, role: Role, organization: LiveActor): Promise<LiveActor> {
    const email = `normaflow-live-${runId}-${label}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Live ${label}` } });
    if (error || !data.user) throw error ?? new Error(`No se pudo crear el actor ${label}.`);
    const userId = `live_user_${label}_${runId}`;
    const membershipId = `live_membership_${label}_${runId}`;
    createdAuthIds.push(data.user.id); createdUserIds.push(userId);
    await prisma.user.create({ data: { id: userId, email, name: `Live ${label}`, authUserId: data.user.id } });
    await prisma.membership.create({ data: { id: membershipId, userId, organizationId: organization.organizationId, role } });
    return { ...organization, authId: data.user.id, userId, email, name: `Live ${label}`, role, membershipId };
  }

  let state: LiveFixtureState | null = null;
  try {
    const actorA = await createActor("a", "ORG_ADMIN");
    const actorB = await createActor("b", "VIEWER");
    const actorAViewer = await createMember("a-viewer", "VIEWER", actorA);
    const actorAAuditor = await createMember("a-auditor", "AUDITOR", actorA);
    const actorBAdmin = await createMember("b-admin", "ORG_ADMIN", actorB);
    await installAllPacks(prisma);
    await ensureSecurityControlCatalog(prisma);
    await ensureOrganizationControlSet(actorA.organizationId, prisma);
    await ensureOrganizationControlSet(actorB.organizationId, prisma);
    state = {
      runId,
      actorA,
      actorB,
      actorAViewer,
      actorAAuditor,
      actorBAdmin,
      storagePaths: [
        `org-${actorA.organizationId}/documents/live-${runId}/probe.txt`,
        `org-${actorB.organizationId}/documents/live-${runId}/cross-tenant.txt`,
      ],
    };
    writeLiveState(state);
  } catch (error) {
    if (state) await cleanupLiveFixture(state, prisma);
    else {
      await prisma.organization.deleteMany({ where: { id: { in: createdOrganizationIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await Promise.allSettled(createdAuthIds.map(authId => admin.auth.admin.deleteUser(authId)));
      await prisma.$disconnect();
    }
    throw error;
  }

  if (!fs.existsSync(LIVE_STATE_PATH)) throw new Error("No se creó el estado del fixture live.");
  await prisma.$disconnect();
}
