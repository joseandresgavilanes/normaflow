import crypto from "node:crypto";
import fs from "node:fs";
import { PrismaClient, type Role } from "@prisma/client";
import { adminClient, cleanupLiveFixture, LIVE_STATE_PATH, type LiveActor, type LiveFixtureState, writeLiveState } from "./support";

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
    const organizationName = `LIVE ORG ${label.toUpperCase()} ${runId}`;
    const documentId = `live_doc_${label}_${runId}`;
    const notificationId = `live_notification_${label}_${runId}`;
    const invoiceNumber = `LIVE-INV-${label.toUpperCase()}-${runId}`;
    const reportFileName = `live-report-${label}-${runId}.csv`;
    const name = `Live ${label.toUpperCase()}`;

    createdOrganizationIds.push(organizationId);
    createdUserIds.push(userId);

    await prisma.organization.create({ data: { id: organizationId, name: organizationName, slug: `live-org-${label}-${runId}` } });
    await prisma.user.create({ data: { id: userId, email, name, authUserId: data.user.id } });
    await prisma.membership.create({ data: { id: `live_membership_${label}_${runId}`, userId, organizationId, role } });
    await prisma.document.create({ data: { id: documentId, organizationId, code: `LIVE-${label.toUpperCase()}-${runId}`, title: `LIVE DOCUMENT ${label.toUpperCase()} ${runId}`, type: "POLICY", tags: [], distributionList: [] } });
    await prisma.process.create({ data: { id: `live_process_${label}_${runId}`, organizationId, name: `LIVE PROCESS ${label.toUpperCase()} ${runId}`, inputs: [], outputs: [] } });
    await prisma.notification.create({ data: { id: notificationId, organizationId, userId, title: `LIVE NOTIFICATION ${label.toUpperCase()} ${runId}`, body: `Tenant ${label}`, type: "INFO" } });
    const subscription = await prisma.subscription.create({ data: { id: `live_subscription_${label}_${runId}`, organizationId, plan: label === "a" ? "GROWTH" : "STARTER", status: "ACTIVE" } });
    await prisma.billingInvoice.create({ data: { id: `live_invoice_${label}_${runId}`, organizationId, subscriptionId: subscription.id, stripeInvoiceId: `live_stripe_invoice_${label}_${runId}`, number: invoiceNumber, status: "paid", amountDue: label === "a" ? 29900 : 9900, amountPaid: label === "a" ? 29900 : 9900 } });
    await prisma.reportExport.create({ data: { id: `live_report_${label}_${runId}`, organizationId, generatedById: userId, reportType: "exec", format: "CSV", dateFrom: new Date("2026-01-01T00:00:00.000Z"), dateTo: new Date("2026-12-31T23:59:59.999Z"), rowCount: 1, fileName: reportFileName } });

    return { authId: data.user.id, userId, email, password, name, role, organizationId, organizationName, documentId, documentTitle: `LIVE DOCUMENT ${label.toUpperCase()} ${runId}`, notificationId, notificationTitle: `LIVE NOTIFICATION ${label.toUpperCase()} ${runId}`, invoiceNumber, reportFileName };
  }

  let state: LiveFixtureState | null = null;
  try {
    const actorA = await createActor("a", "ORG_ADMIN");
    const actorB = await createActor("b", "VIEWER");
    state = {
      runId,
      actorA,
      actorB,
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
