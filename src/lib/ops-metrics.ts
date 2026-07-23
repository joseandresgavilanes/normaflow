import "server-only";
import { NotificationDeliveryStatus, ReportArtifactStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { REPORT_WORKER_LEASE_MS } from "@/lib/report-artifacts";

/** A PROCESSING notification job older than this is considered stuck. */
const NOTIFICATION_STALE_MS = 15 * 60_000;
/** A QUEUED report/notification older than this means the worker isn't draining. */
const QUEUE_DRAIN_SLA_SEC = 15 * 60;
const FAILED_24H_ALERT_THRESHOLD = 10;

export type OpsAlert = { severity: "warning" | "critical"; code: string; message: string };

export type OpsMetrics = {
  status: "ok" | "degraded" | "down";
  checkedAt: string;
  db: { ok: boolean; latencyMs: number | null };
  reports: { queued: number; processing: number; completed24h: number; failed24h: number; stuck: number; oldestQueuedAgeSec: number | null };
  notifications: { pending: number; processing: number; sent24h: number; failed24h: number; stuck: number; oldestPendingAgeSec: number | null };
  alerts: OpsAlert[];
};

function ageSec(from: Date | null | undefined, now: number): number | null {
  return from ? Math.round((now - from.getTime()) / 1000) : null;
}

export async function collectOpsMetrics(): Promise<OpsMetrics> {
  const now = Date.now();
  const since24h = new Date(now - 24 * 3_600_000);
  const reportStaleCutoff = new Date(now - REPORT_WORKER_LEASE_MS);
  const notificationStaleCutoff = new Date(now - NOTIFICATION_STALE_MS);

  let dbOk = true;
  let dbLatency: number | null = null;
  const dbStart = now;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - dbStart;
  } catch {
    dbOk = false;
  }

  const [
    rQueued, rProcessing, rCompleted24h, rFailed24h, rStuck, rOldestQueued,
    nPending, nRetrying, nProcessing, nSent24h, nFailed24h, nPermFailed24h, nStuck, nOldestPending,
  ] = dbOk ? await Promise.all([
    prisma.reportExport.count({ where: { status: ReportArtifactStatus.QUEUED } }),
    prisma.reportExport.count({ where: { status: ReportArtifactStatus.PROCESSING } }),
    prisma.reportExport.count({ where: { status: ReportArtifactStatus.COMPLETED, completedAt: { gte: since24h } } }),
    prisma.reportExport.count({ where: { status: ReportArtifactStatus.FAILED, failedAt: { gte: since24h } } }),
    prisma.reportExport.count({ where: { status: ReportArtifactStatus.PROCESSING, processingStartedAt: { lt: reportStaleCutoff } } }),
    prisma.reportExport.findFirst({ where: { status: ReportArtifactStatus.QUEUED }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.notificationDeliveryJob.count({ where: { status: NotificationDeliveryStatus.PENDING } }),
    prisma.notificationDeliveryJob.count({ where: { status: NotificationDeliveryStatus.RETRYING } }),
    prisma.notificationDeliveryJob.count({ where: { status: NotificationDeliveryStatus.PROCESSING } }),
    prisma.notificationDeliveryJob.count({ where: { status: NotificationDeliveryStatus.SENT, lastErrorAt: null, createdAt: { gte: since24h } } }),
    prisma.notificationDeliveryJob.count({ where: { status: NotificationDeliveryStatus.FAILED, lastErrorAt: { gte: since24h } } }),
    prisma.notificationDeliveryJob.count({ where: { status: NotificationDeliveryStatus.PERMANENTLY_FAILED, lastErrorAt: { gte: since24h } } }),
    prisma.notificationDeliveryJob.count({ where: { status: NotificationDeliveryStatus.PROCESSING, processingStartedAt: { lt: notificationStaleCutoff } } }),
    prisma.notificationDeliveryJob.findFirst({ where: { status: { in: [NotificationDeliveryStatus.PENDING, NotificationDeliveryStatus.RETRYING] } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]) : [0, 0, 0, 0, 0, null, 0, 0, 0, 0, 0, 0, 0, null] as const;

  const reports = { queued: rQueued, processing: rProcessing, completed24h: rCompleted24h, failed24h: rFailed24h, stuck: rStuck, oldestQueuedAgeSec: ageSec(rOldestQueued?.createdAt, now) };
  const notifications = { pending: nPending + nRetrying, processing: nProcessing, sent24h: nSent24h, failed24h: nFailed24h + nPermFailed24h, stuck: nStuck, oldestPendingAgeSec: ageSec(nOldestPending?.createdAt, now) };

  const alerts: OpsAlert[] = [];
  if (!dbOk) alerts.push({ severity: "critical", code: "db_unreachable", message: "La base de datos no responde a SELECT 1." });
  if (reports.stuck > 0) alerts.push({ severity: "warning", code: "report_jobs_stuck", message: `${reports.stuck} reporte(s) llevan > ${REPORT_WORKER_LEASE_MS / 1000}s en PROCESSING (lease vencido).` });
  if (notifications.stuck > 0) alerts.push({ severity: "warning", code: "notification_jobs_stuck", message: `${notifications.stuck} notificación(es) llevan > ${NOTIFICATION_STALE_MS / 60000}m en PROCESSING.` });
  if ((reports.oldestQueuedAgeSec ?? 0) > QUEUE_DRAIN_SLA_SEC) alerts.push({ severity: "warning", code: "report_queue_backlog", message: `El reporte más antiguo lleva ${reports.oldestQueuedAgeSec}s en cola; el worker podría no estar ejecutándose.` });
  if ((notifications.oldestPendingAgeSec ?? 0) > QUEUE_DRAIN_SLA_SEC) alerts.push({ severity: "warning", code: "notification_queue_backlog", message: `La notificación más antigua lleva ${notifications.oldestPendingAgeSec}s en cola.` });
  if (reports.failed24h >= FAILED_24H_ALERT_THRESHOLD) alerts.push({ severity: "warning", code: "report_failures", message: `${reports.failed24h} reportes fallaron en 24h.` });
  if (notifications.failed24h >= FAILED_24H_ALERT_THRESHOLD) alerts.push({ severity: "warning", code: "notification_failures", message: `${notifications.failed24h} notificaciones fallaron en 24h.` });

  const status = !dbOk ? "down" : alerts.length ? "degraded" : "ok";
  return { status, checkedAt: new Date(now).toISOString(), db: { ok: dbOk, latencyMs: dbLatency }, reports, notifications, alerts };
}
