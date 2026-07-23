import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, ReportArtifactStatus, ReportFormat } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase";
import { assertStorageQuota, DOCUMENTS_BUCKET, releaseStorageQuota, StorageError } from "@/lib/storage";
import { assertTenantStoragePath } from "@/lib/storage-path";
import { reportArtifactChecksum, reportArtifactPath } from "@/lib/report-artifact-contract";
import { writeAuditLog, type AuditLogInput } from "@/lib/audit-log";
import type { LiveAppContext } from "@/lib/app-context";
import { documentMagicMatches } from "@/lib/document-file-signatures";
import { reportRetryDelayMs, nextReportState } from "@/lib/report-worker-contract";

export const REPORT_WORKER_TIMEOUT_MS = 120_000;
export const REPORT_WORKER_LEASE_MS = 180_000;
export const REPORT_MAX_ATTEMPTS = 3;

const MIME: Record<"PDF" | "EXCEL", string> = {
  PDF: "application/pdf",
  EXCEL: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

type ReportArtifactCreateInput = {
  organizationId: string;
  userId: string;
  reportType: string;
  title: string;
  format: "PDF" | "EXCEL";
  filters: unknown;
  dateFrom: Date;
  dateTo: Date;
  fileName: string;
  idempotencyKey?: string;
  auditContext?: LiveAppContext;
};

function auditForArtifact(ctx: LiveAppContext, artifactId: string, action: string, extra?: Record<string, unknown>): AuditLogInput {
  return { ctx, action, module: "reporting", recordId: artifactId, extra };
}

function systemAudit(organizationId: string, action: string, recordId: string, extra?: Record<string, unknown>) {
  return {
    data: {
      organizationId,
      userId: null,
      action,
      module: "reporting",
      recordId,
      metadata: extra ? (extra as Prisma.InputJsonValue) : undefined,
    },
  };
}

export async function createReportArtifact(input: ReportArtifactCreateInput) {
  const existing = input.idempotencyKey
    ? await prisma.reportExport.findUnique({ where: { organizationId_idempotencyKey: { organizationId: input.organizationId, idempotencyKey: input.idempotencyKey } } })
    : null;
  if (existing) return existing;

  try {
    return await prisma.$transaction(async (tx) => {
      const artifact = await tx.reportExport.create({
        data: {
          organizationId: input.organizationId,
          generatedById: input.userId,
          reportType: input.reportType,
          title: input.title,
          format: input.format as ReportFormat,
          filters: input.filters as Prisma.InputJsonValue,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
          rowCount: 0,
          fileName: input.fileName,
          mimeType: MIME[input.format],
          status: ReportArtifactStatus.QUEUED,
          idempotencyKey: input.idempotencyKey ?? null,
          maxAttempts: REPORT_MAX_ATTEMPTS,
        },
      });
      if (input.auditContext) {
        await writeAuditLog(tx, auditForArtifact(input.auditContext, artifact.id, "export_queued", {
          reportType: input.reportType,
          format: input.format,
          filters: input.filters,
          idempotencyKey: input.idempotencyKey ?? null,
        }));
      }
      return artifact;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && input.idempotencyKey) {
      return prisma.reportExport.findUniqueOrThrow({ where: { organizationId_idempotencyKey: { organizationId: input.organizationId, idempotencyKey: input.idempotencyKey } } });
    }
    throw error;
  }
}

export async function startReportArtifact(artifactId: string, organizationId: string, leaseToken = randomUUID(), actor?: LiveAppContext) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.reportExport.updateMany({
      where: { id: artifactId, organizationId, status: ReportArtifactStatus.QUEUED, nextAttemptAt: { lte: new Date() } },
      data: { status: ReportArtifactStatus.PROCESSING, processingStartedAt: new Date(), leaseToken, attempts: { increment: 1 }, error: null, lastErrorAt: null },
    });
    if (result.count !== 1) throw new Error("El artefacto no está disponible para procesamiento.");
    if (actor) await writeAuditLog(tx, auditForArtifact(actor, artifactId, "export_processing"));
    else await tx.auditLog.create(systemAudit(organizationId, "export_processing", artifactId));
    return leaseToken;
  });
}

export async function recoverStaleReportArtifacts(now = new Date()) {
  const cutoff = new Date(now.getTime() - REPORT_WORKER_LEASE_MS);
  return prisma.$transaction(async (tx) => {
    const stale = await tx.reportExport.findMany({ where: { status: ReportArtifactStatus.PROCESSING, processingStartedAt: { lt: cutoff }, attempts: { lt: REPORT_MAX_ATTEMPTS } }, select: { id: true, organizationId: true, attempts: true } });
    for (const artifact of stale) {
      const changed = await tx.reportExport.updateMany({ where: { id: artifact.id, status: ReportArtifactStatus.PROCESSING, processingStartedAt: { lt: cutoff } }, data: { status: ReportArtifactStatus.QUEUED, nextAttemptAt: now, processingStartedAt: null, leaseToken: null, error: "Worker lease expired; queued for retry.", lastErrorAt: now } });
      if (changed.count === 1) await tx.auditLog.create(systemAudit(artifact.organizationId, "export_lease_expired", artifact.id, { attempts: artifact.attempts, nextAttemptAt: now.toISOString() }));
    }
    return { count: stale.length };
  });
}

export async function completeReportArtifact(artifactId: string, organizationId: string, leaseToken: string, bytes: Uint8Array, rowCount: number, actor?: LiveAppContext) {
  const artifact = await prisma.reportExport.findFirst({ where: { id: artifactId, organizationId, status: ReportArtifactStatus.PROCESSING, leaseToken } });
  if (!artifact) throw new Error("El lease del artefacto ya no es válido.");
  const magicExtension = artifact.format === ReportFormat.PDF ? "pdf" : "xlsx";
  if (bytes.byteLength <= 0 || !documentMagicMatches(magicExtension, Buffer.from(bytes))) {
    await failReportArtifact(artifactId, organizationId, leaseToken, "El archivo generado no coincide con el formato declarado.");
    throw new StorageError("El archivo generado no supera la validación de tipo y magic bytes.");
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new StorageError("Supabase no está configurado en este entorno.");
  const path = reportArtifactPath(organizationId, artifactId, artifact.fileName);
  assertTenantStoragePath(organizationId, path);
  await assertStorageQuota(organizationId, bytes.byteLength);
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, bytes, { contentType: artifact.mimeType ?? "application/octet-stream", upsert: true, cacheControl: "300" });
  if (error) {
    await releaseStorageQuota(organizationId, bytes.byteLength).catch(() => undefined);
    await failReportArtifact(artifactId, organizationId, leaseToken, error.message);
    throw new StorageError(`No se pudo guardar el reporte: ${error.message}`, error);
  }
  const checksum = reportArtifactChecksum(bytes);
  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.reportExport.updateMany({
        where: { id: artifactId, organizationId, status: ReportArtifactStatus.PROCESSING, leaseToken },
        data: { storagePath: path, fileSize: bytes.byteLength, checksum, rowCount, status: ReportArtifactStatus.COMPLETED, completedAt: new Date(), processingStartedAt: null, leaseToken: null, error: null, lastErrorAt: null, failedAt: null },
      });
      if (updated.count !== 1) throw new Error("El artefacto perdió su lease antes de completarse.");
      if (actor) await writeAuditLog(tx, auditForArtifact(actor, artifactId, "export_completed", { storagePath: path, fileSize: bytes.byteLength, checksum, rowCount }));
      else await tx.auditLog.create(systemAudit(organizationId, "export_completed", artifactId, { storagePath: path, fileSize: bytes.byteLength, checksum, rowCount }));
      return tx.reportExport.findUniqueOrThrow({ where: { id: artifactId } });
    });
  } catch (error) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]).catch(() => undefined);
    await releaseStorageQuota(organizationId, bytes.byteLength).catch(() => undefined);
    await failReportArtifact(artifactId, organizationId, leaseToken, error instanceof Error ? error.message : "No se pudo finalizar el artefacto");
    throw error;
  }
}

export async function failReportArtifact(artifactId: string, organizationId: string, leaseToken: string, message: string, actor?: LiveAppContext) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const artifact = await tx.reportExport.findFirst({ where: { id: artifactId, organizationId, status: ReportArtifactStatus.PROCESSING, leaseToken }, select: { attempts: true, maxAttempts: true } });
    if (!artifact) return null;
    const retry = nextReportState(artifact.attempts, artifact.maxAttempts) === "QUEUED";
    const nextAttemptAt = new Date(now.getTime() + reportRetryDelayMs(artifact.attempts));
    const updated = await tx.reportExport.update({ where: { id: artifactId }, data: { status: retry ? ReportArtifactStatus.QUEUED : ReportArtifactStatus.FAILED, nextAttemptAt, error: message.slice(0, 1000), lastErrorAt: now, failedAt: retry ? null : now, processingStartedAt: null, leaseToken: null } });
    const extra = { error: message.slice(0, 1000), retry, attempts: artifact.attempts, nextAttemptAt: retry ? nextAttemptAt.toISOString() : null };
    if (actor) await writeAuditLog(tx, auditForArtifact(actor, artifactId, retry ? "export_retrying" : "export_failed", extra));
    else await tx.auditLog.create(systemAudit(organizationId, retry ? "export_retrying" : "export_failed", artifactId, extra));
    return updated;
  });
}

export async function retryReportArtifact(artifactId: string, organizationId: string, actor: LiveAppContext) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.reportExport.updateMany({ where: { id: artifactId, organizationId, status: ReportArtifactStatus.FAILED }, data: { status: ReportArtifactStatus.QUEUED, nextAttemptAt: new Date(), failedAt: null, error: null, lastErrorAt: null } });
    if (result.count !== 1) throw new Error("El reporte no está disponible para reintento.");
    await writeAuditLog(tx, auditForArtifact(actor, artifactId, "export_manual_retry"));
    return tx.reportExport.findUniqueOrThrow({ where: { id: artifactId } });
  });
}

export async function getReportArtifactDownload(artifactId: string, organizationId: string) {
  const artifact = await prisma.reportExport.findFirst({ where: { id: artifactId, organizationId, status: ReportArtifactStatus.COMPLETED }, select: { fileName: true, mimeType: true, storagePath: true, rowCount: true, checksum: true } });
  if (!artifact?.storagePath) throw new Error("El archivo no está disponible para descarga.");
  assertTenantStoragePath(organizationId, artifact.storagePath);
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new StorageError("Supabase no está configurado en este entorno.");
  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(artifact.storagePath, 300);
  if (error || !data) throw new StorageError("No se pudo crear la URL de descarga.", error);
  return { fileName: artifact.fileName, mimeType: artifact.mimeType ?? "application/octet-stream", url: data.signedUrl, rowCount: artifact.rowCount, checksum: artifact.checksum };
}
