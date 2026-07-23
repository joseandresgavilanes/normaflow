import "server-only";
import { prisma } from "@/lib/prisma";
import { notifyUser, notifyEmail } from "@/lib/notify";

/**
 * Scheduled reminder job (invoked by /api/cron/reminders).
 *
 * Sends ONE digest per responsible person — not one message per item — to avoid
 * flooding inboxes. Users with a login get an in-app notification + email;
 * personnel without a login (training assignees, record custodians) get email
 * only. Re-running the same day is deduped per user via a recent marker check.
 */

const DAY = 24 * 60 * 60 * 1000;
const UPCOMING_DAYS = 7; // actions / audits / NC due within a week
const DOC_REVIEW_DAYS = 30; // approved docs whose review date is near
const EVIDENCE_EXPIRY_DAYS = 30; // evidence expiring within a month
const DIGEST_TITLE = "Resumen de tus pendientes ISO";

type UserDigest = { organizationId: string; lines: string[] };
type PersonDigest = { organizationId: string; email: string; name: string; lines: string[] };

function pushUser(map: Map<string, UserDigest>, organizationId: string, userId: string, line: string) {
  const key = `${organizationId}:${userId}`;
  const cur = map.get(key) ?? { organizationId, lines: [] };
  cur.lines.push(line);
  map.set(key, cur);
}

export async function runReminders(now: Date = new Date()): Promise<{ users: number; personnel: number; items: number }> {
  const soon = new Date(now.getTime() + UPCOMING_DAYS * DAY);
  const docSoon = new Date(now.getTime() + DOC_REVIEW_DAYS * DAY);
  const evidenceSoon = new Date(now.getTime() + EVIDENCE_EXPIRY_DAYS * DAY);

  const byUser = new Map<string, UserDigest>();
  const byPerson = new Map<string, PersonDigest>();
  let items = 0;

  // ── Trial onboarding: nudge the owner without sending more than once/day ─
  const onboardingOrganizations = await prisma.organization.findMany({
    where: { onboardingStatus: "IN_PROGRESS", trialEndsAt: { not: null, gt: now } },
    select: { id: true, name: true, trialEndsAt: true, memberships: { where: { active: true, role: "OWNER" }, take: 1, select: { userId: true, user: { select: { email: true, name: true } } } } },
  });
  for (const organization of onboardingOrganizations) {
    const owner = organization.memberships[0];
    if (!owner) continue;
    const daysRemaining = Math.ceil((organization.trialEndsAt!.getTime() - now.getTime()) / DAY);
    if (![10, 7, 3, 1].includes(daysRemaining)) continue;
    const already = await prisma.notification.count({ where: { organizationId: organization.id, userId: owner.userId, title: "Completa tu onboarding de NormaFlow", createdAt: { gte: new Date(now.getTime() - 20 * 60 * 60 * 1000) } } });
    if (already > 0) continue;
    await notifyUser({ organizationId: organization.id, userId: owner.userId, title: "Completa tu onboarding de NormaFlow", body: `Te quedan ${daysRemaining} días de trial. Completa los primeros pasos para activar valor en tu workspace.`, type: "WARNING", link: "/app/onboarding" });
    items++;
  }

  // ── Actions / ACPM: overdue or due soon, with an owner ──────────────────
  const actions = await prisma.action.findMany({
    where: { ownerId: { not: null }, status: { notIn: ["COMPLETED", "CANCELLED"] }, dueDate: { not: null, lte: soon } },
    select: { organizationId: true, ownerId: true, title: true, dueDate: true },
  });
  for (const a of actions) {
    const overdue = a.dueDate! < now;
    pushUser(byUser, a.organizationId, a.ownerId!, `• Acción ${overdue ? "VENCIDA" : "por vencer"}: «${a.title}» (${a.dueDate!.toLocaleDateString("es")})`);
    items++;
  }

  // ── ACPM/CAPA live: due dates and pending efficacy verification ─────────
  const capas = await prisma.cAPA.findMany({
    where: {
      stage: { not: "CLOSED" },
      OR: [
        { dueDate: { not: null, lte: soon } },
        { stage: "VERIFICATION" },
      ],
    },
    select: { organizationId: true, ownerId: true, requestedById: true, code: true, title: true, dueDate: true, stage: true },
  });
  for (const capa of capas) {
    const recipients = new Set([capa.ownerId, capa.requestedById].filter((id): id is string => Boolean(id)));
    const overdue = capa.dueDate ? capa.dueDate < now : false;
    const line = capa.stage === "VERIFICATION"
      ? `• ACPM/CAPA pendiente de verificación de eficacia: ${capa.code} «${capa.title}»`
      : `• ACPM/CAPA ${overdue ? "VENCIDA" : "por vencer"}: ${capa.code} «${capa.title}» (${capa.dueDate!.toLocaleDateString("es")})`;
    for (const recipientId of recipients) { pushUser(byUser, capa.organizationId, recipientId, line); items++; }
  }

  // ── Nonconformities: overdue/near, not closed, with an owner ────────────
  const ncs = await prisma.nonconformity.findMany({
    where: { ownerId: { not: null }, status: { notIn: ["CLOSED", "ARCHIVED"] }, dueDate: { not: null, lte: soon } },
    select: { organizationId: true, ownerId: true, title: true, dueDate: true },
  });
  for (const nc of ncs) {
    const overdue = nc.dueDate! < now;
    pushUser(byUser, nc.organizationId, nc.ownerId!, `• No conformidad ${overdue ? "VENCIDA" : "por vencer"}: «${nc.title}» (${nc.dueDate!.toLocaleDateString("es")})`);
    items++;
  }

  // ── Audits: scheduled date passed but not finished, with an auditor ─────
  const audits = await prisma.audit.findMany({
    where: { auditorId: { not: null }, status: { in: ["PLANNED", "IN_PROGRESS"] }, scheduledDate: { not: null, lte: soon } },
    select: { organizationId: true, auditorId: true, title: true, scheduledDate: true },
  });
  for (const au of audits) {
    const overdue = au.scheduledDate! < now;
    pushUser(byUser, au.organizationId, au.auditorId!, `• Auditoría ${overdue ? "atrasada" : "próxima"}: «${au.title}» (${au.scheduledDate!.toLocaleDateString("es")})`);
    items++;
  }

  // ── Documents: approved, review date near/past, with an owner ───────────
  const docs = await prisma.document.findMany({
    where: { ownerId: { not: null }, status: "APPROVED", reviewDate: { not: null, lte: docSoon } },
    select: { organizationId: true, ownerId: true, code: true, title: true, reviewDate: true },
  });
  for (const d of docs) {
    const overdue = d.reviewDate! < now;
    pushUser(byUser, d.organizationId, d.ownerId!, `• Documento ${overdue ? "con revisión vencida" : "por revisar"}: ${d.code} «${d.title}» (${d.reviewDate!.toLocaleDateString("es")})`);
    items++;
  }

  // ── Evidence: pending review or expired/near expiry, with a responsible ──
  const evidences = await prisma.evidenceFile.findMany({
    where: {
      deletedAt: null,
      OR: [
        { status: "PENDING_REVIEW" },
        { expiresAt: { not: null, lte: evidenceSoon } },
      ],
    },
    select: { organizationId: true, responsibleId: true, uploadedById: true, title: true, status: true, expiresAt: true },
  });
  for (const evidence of evidences) {
    const recipientId = evidence.responsibleId ?? evidence.uploadedById;
    if (!recipientId) continue;
    const overdue = evidence.expiresAt ? evidence.expiresAt < now : false;
    const line = evidence.status === "PENDING_REVIEW"
      ? `• Evidencia pendiente de revisión: «${evidence.title}»`
      : `• Evidencia ${overdue ? "VENCIDA" : "por vencer"}: «${evidence.title}» (${evidence.expiresAt!.toLocaleDateString("es")})`;
    pushUser(byUser, evidence.organizationId, recipientId, line);
    items++;
  }

  // ── Document approvals: pending reviewer decisions ────────────────────
  const pendingDocumentApprovals = await prisma.approval.findMany({
    where: { status: "PENDING", document: { status: "IN_REVIEW" } },
    select: { approverId: true, document: { select: { organizationId: true, code: true, title: true } } },
  });
  for (const approval of pendingDocumentApprovals) {
    pushUser(byUser, approval.document.organizationId, approval.approverId, `• Aprobación pendiente: ${approval.document.code} «${approval.document.title}»`);
    items++;
  }

  // ── Change approvals: pending reviewer decisions ──────────────────────
  const pendingChangeApprovals = await prisma.changeApprover.findMany({
    where: { status: "PENDING", changeRequest: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } },
    select: { userId: true, changeRequest: { select: { organizationId: true, code: true, title: true } } },
  });
  for (const approval of pendingChangeApprovals) {
    pushUser(byUser, approval.changeRequest.organizationId, approval.userId, `• Revisión pendiente: cambio ${approval.changeRequest.code} «${approval.changeRequest.title}»`);
    items++;
  }

  // ── Opportunities: due dates and reviewer decisions ───────────────────
  const opportunities = await prisma.opportunity.findMany({
    where: {
      status: { notIn: ["CLOSED", "REJECTED"] },
      AND: [
        { OR: [{ dueDate: { not: null, lte: soon } }, { status: "UNDER_REVIEW" }] },
        { OR: [{ ownerId: { not: null } }, { reviewerId: { not: null } }] },
      ],
    },
    select: { organizationId: true, title: true, dueDate: true, ownerId: true, reviewerId: true, status: true },
  });
  for (const opportunity of opportunities) {
    const overdue = opportunity.dueDate ? opportunity.dueDate < now : false;
    const line = opportunity.status === "UNDER_REVIEW"
      ? `• Oportunidad pendiente de revisión: «${opportunity.title}»`
      : `• Oportunidad ${overdue ? "VENCIDA" : "por vencer"}: «${opportunity.title}» (${opportunity.dueDate!.toLocaleDateString("es")})`;
    for (const userId of new Set([opportunity.ownerId, opportunity.reviewerId].filter((id): id is string => Boolean(id)))) {
      pushUser(byUser, opportunity.organizationId, userId, line);
      items++;
    }
  }

  // ── Supplier reviews: next evaluation due ─────────────────────────────
  const suppliers = await prisma.supplier.findMany({
    where: { ownerId: { not: null }, nextReviewDue: { not: null, lte: soon }, status: { not: "SUSPENDED" } },
    select: { organizationId: true, ownerId: true, name: true, nextReviewDue: true },
  });
  for (const supplier of suppliers) {
    const overdue = supplier.nextReviewDue! < now;
    pushUser(byUser, supplier.organizationId, supplier.ownerId!, `• Evaluación de proveedor ${overdue ? "VENCIDA" : "por vencer"}: «${supplier.name}» (${supplier.nextReviewDue!.toLocaleDateString("es")})`);
    items++;
  }

  // ── Training assignments: overdue, personnel with email (no login) ──────
  const trainings = await prisma.trainingAssignment.findMany({
    where: { status: { notIn: ["COMPLETED", "CANCELLED"] }, dueAt: { lte: now } },
    select: { organizationId: true, dueAt: true, course: { select: { title: true } }, personnel: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });
  for (const t of trainings) {
    if (!t.personnel.email) continue;
    const cur = byPerson.get(t.personnel.id) ?? { organizationId: t.organizationId, email: t.personnel.email, name: `${t.personnel.firstName} ${t.personnel.lastName}`.trim(), lines: [] };
    cur.lines.push(`• Formación VENCIDA: «${t.course.title}» (${t.dueAt.toLocaleDateString("es")})`);
    byPerson.set(t.personnel.id, cur);
    items++;
  }

  // ── Records: retention period elapsed → disposition due, custodian email ─
  const records = await prisma.record.findMany({
    where: { active: true, custodianId: { not: null }, retentionTimeId: { not: null } },
    select: { organizationId: true, code: true, name: true, createdAt: true, retentionTime: { select: { months: true } }, entries: { orderBy: { entryDate: "desc" }, take: 1, select: { entryDate: true } }, custodian: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });
  for (const r of records) {
    if (!r.custodian?.email || !r.retentionTime) continue;
    const dispositionAt = new Date(r.entries[0]?.entryDate ?? r.createdAt);
    dispositionAt.setMonth(dispositionAt.getMonth() + r.retentionTime.months);
    if (dispositionAt > evidenceSoon) continue;
    const cur = byPerson.get(r.custodian.id) ?? { organizationId: r.organizationId, email: r.custodian.email, name: `${r.custodian.firstName} ${r.custodian.lastName}`.trim(), lines: [] };
    cur.lines.push(`• Registro ${dispositionAt < now ? "con retención cumplida (disposición pendiente)" : "próximo a vencer"}: ${r.code} «${r.name}» (${dispositionAt.toLocaleDateString("es")})`);
    byPerson.set(r.custodian.id, cur);
    items++;
  }

  // ── Deliver user digests (in-app + email), deduped per ~20h window ──────
  const dedupeSince = new Date(now.getTime() - 20 * 60 * 60 * 1000);
  let userCount = 0;
  for (const [key, digest] of byUser) {
    const userId = key.split(":")[1];
    const already = await prisma.notification.count({
      where: { userId, organizationId: digest.organizationId, title: DIGEST_TITLE, createdAt: { gte: dedupeSince } },
    });
    if (already > 0) continue;
    await notifyUser({
      organizationId: digest.organizationId,
      userId,
      title: DIGEST_TITLE,
      body: `Tienes ${digest.lines.length} pendiente(s) que requieren tu atención:<br/>${digest.lines.join("<br/>")}`,
      type: "WARNING",
      link: "/app/dashboard",
    });
    userCount++;
  }

  // ── Deliver personnel digests (email only) ──────────────────────────────
  let personCount = 0;
  for (const digest of byPerson.values()) {
    await notifyEmail({
      organizationId: digest.organizationId,
      to: digest.email,
      name: digest.name,
      title: "Tienes pendientes de capacitación / registros",
      body: `Pendientes a tu cargo:<br/>${digest.lines.join("<br/>")}`,
      link: "/app/training",
    });
    personCount++;
  }

  return { users: userCount, personnel: personCount, items };
}
