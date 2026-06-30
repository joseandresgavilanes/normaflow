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
const DIGEST_TITLE = "Resumen de tus pendientes ISO";

type UserDigest = { organizationId: string; lines: string[] };
type PersonDigest = { email: string; name: string; lines: string[] };

function pushUser(map: Map<string, UserDigest>, organizationId: string, userId: string, line: string) {
  const key = `${organizationId}:${userId}`;
  const cur = map.get(key) ?? { organizationId, lines: [] };
  cur.lines.push(line);
  map.set(key, cur);
}

export async function runReminders(now: Date = new Date()): Promise<{ users: number; personnel: number; items: number }> {
  const soon = new Date(now.getTime() + UPCOMING_DAYS * DAY);
  const docSoon = new Date(now.getTime() + DOC_REVIEW_DAYS * DAY);

  const byUser = new Map<string, UserDigest>();
  const byPerson = new Map<string, PersonDigest>();
  let items = 0;

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

  // ── Nonconformities: overdue/near, not closed, with an owner ────────────
  const ncs = await prisma.nonconformity.findMany({
    where: { ownerId: { not: null }, status: { not: "CLOSED" }, dueDate: { not: null, lte: soon } },
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

  // ── Training assignments: overdue, personnel with email (no login) ──────
  const trainings = await prisma.trainingAssignment.findMany({
    where: { status: { notIn: ["COMPLETED", "CANCELLED"] }, dueAt: { lte: now } },
    select: { dueAt: true, course: { select: { title: true } }, personnel: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });
  for (const t of trainings) {
    if (!t.personnel.email) continue;
    const cur = byPerson.get(t.personnel.id) ?? { email: t.personnel.email, name: `${t.personnel.firstName} ${t.personnel.lastName}`.trim(), lines: [] };
    cur.lines.push(`• Formación VENCIDA: «${t.course.title}» (${t.dueAt.toLocaleDateString("es")})`);
    byPerson.set(t.personnel.id, cur);
    items++;
  }

  // ── Records: retention period elapsed → disposition due, custodian email ─
  const records = await prisma.record.findMany({
    where: { active: true, custodianId: { not: null }, retentionTimeId: { not: null } },
    select: { code: true, name: true, createdAt: true, retentionTime: { select: { months: true } }, custodian: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });
  for (const r of records) {
    if (!r.custodian?.email || !r.retentionTime) continue;
    const dispositionAt = new Date(r.createdAt);
    dispositionAt.setMonth(dispositionAt.getMonth() + r.retentionTime.months);
    if (dispositionAt > now) continue;
    const cur = byPerson.get(r.custodian.id) ?? { email: r.custodian.email, name: `${r.custodian.firstName} ${r.custodian.lastName}`.trim(), lines: [] };
    cur.lines.push(`• Registro con retención cumplida (disposición pendiente): ${r.code} «${r.name}»`);
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
