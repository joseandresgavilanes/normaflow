import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuthorization } from "@/lib/permissions/server";
import { decryptMdSensitiveField } from "@/lib/crypto/field-encryption";
import { designInputCoverage } from "@/lib/medical-devices/workflows";

const DEFAULT_RETENTION_YEARS = 15;

export type MedicalDevicesPayload = Awaited<ReturnType<typeof getMedicalDevicesPayload>>;

type ComplaintRow = Prisma.ComplaintGetPayload<{
  include: {
    device: { select: { code: true; name: true } };
    batch: { select: { code: true; lotNumber: true } };
  };
}>;
type AdverseEventRow = Prisma.AdverseEventGetPayload<{
  include: {
    device: { select: { code: true; name: true } };
    batch: { select: { code: true; lotNumber: true } };
    complaint: { select: { code: true } };
  };
}>;
type FieldActionRow = Prisma.FieldSafetyActionGetPayload<{
  include: { device: { select: { code: true; name: true } } };
}>;
type RecallRow = Prisma.ProductRecallGetPayload<{
  include: { device: { select: { code: true; name: true } } };
}>;
type PmsRow = Prisma.PostMarketSurveillanceGetPayload<{
  include: { device: { select: { code: true; name: true } } };
}>;

export async function getMedicalDevicesPayload() {
  const auth = await requireAuthorization("medical-devices:read");
  const organizationId = auth.ctx.organization.id;
  const canSensitive = auth.can("md-sensitive:read");

  const [
    families, devices, dmrs, dhfs, inputs, outputs, reviews, verifications, validations, transfers,
    riskFiles, suppliers, qualifications, processVals, sterVals, batches, traces,
    requirements, submissions, members, retentionPolicy,
  ] = await Promise.all([
    prisma.deviceFamily.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.medicalDevice.findMany({
      where: { organizationId },
      include: { family: { select: { code: true, name: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.deviceMasterRecord.findMany({
      where: { organizationId },
      include: { device: { select: { code: true, name: true } } },
      orderBy: [{ code: "asc" }, { version: "desc" }],
    }),
    prisma.designHistoryFile.findMany({
      where: { organizationId },
      include: {
        device: { select: { code: true, name: true } },
        _count: { select: { inputs: true, outputs: true, reviews: true, verifications: true, validations: true } },
      },
      orderBy: { code: "asc" },
    }),
    prisma.designInput.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.designOutput.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.designReview.findMany({ where: { organizationId }, orderBy: { reviewDate: "desc" } }),
    prisma.designVerification.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.designValidation.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.designTransfer.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.deviceRiskFile.findMany({
      where: { organizationId },
      include: { device: { select: { code: true, name: true } } },
      orderBy: [{ code: "asc" }, { version: "desc" }],
    }),
    prisma.criticalSupplier.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.supplierQualification.findMany({
      where: { organizationId },
      include: { criticalSupplier: { select: { code: true, name: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.processValidation.findMany({
      where: { organizationId },
      include: { device: { select: { code: true, name: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.sterilizationValidation.findMany({
      where: { organizationId },
      include: { device: { select: { code: true, name: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.productionBatch.findMany({
      where: { organizationId },
      include: { device: { select: { code: true, name: true } } },
      orderBy: { manufacturedAt: "desc" },
    }),
    prisma.deviceTraceability.findMany({
      where: { organizationId },
      include: { batch: { select: { code: true, lotNumber: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.regulatoryRequirement.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.regulatorySubmission.findMany({
      where: { organizationId },
      include: { device: { select: { code: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { memberships: { some: { organizationId } } },
      select: { id: true, name: true },
    }),
    prisma.mdRetentionPolicy.findUnique({ where: { organizationId } }),
  ]);

  let complaints: ComplaintRow[] = [];
  let adverseEvents: AdverseEventRow[] = [];
  let fieldActions: FieldActionRow[] = [];
  let recalls: RecallRow[] = [];
  let pms: PmsRow[] = [];

  // Quejas, eventos adversos, PMS, acciones de campo y retiros comparten el
  // mismo perfil de riesgo (vigilancia post-comercialización) y quedan todos
  // detrás de md-sensitive:read — sin excepción, incluida la PMS (su
  // `findings` lleva la misma minimización que Complaint/AdverseEvent).
  if (canSensitive) {
    [complaints, adverseEvents, fieldActions, recalls, pms] = await Promise.all([
      prisma.complaint.findMany({
        where: { organizationId },
        include: {
          device: { select: { code: true, name: true } },
          batch: { select: { code: true, lotNumber: true } },
        },
        orderBy: { receivedAt: "desc" },
      }),
      prisma.adverseEvent.findMany({
        where: { organizationId },
        include: {
          device: { select: { code: true, name: true } },
          batch: { select: { code: true, lotNumber: true } },
          complaint: { select: { code: true } },
        },
        orderBy: { reportedAt: "desc" },
      }),
      prisma.fieldSafetyAction.findMany({
        where: { organizationId },
        include: { device: { select: { code: true, name: true } } },
        orderBy: { initiatedAt: "desc" },
      }),
      prisma.productRecall.findMany({
        where: { organizationId },
        include: { device: { select: { code: true, name: true } } },
        orderBy: { initiatedAt: "desc" },
      }),
      prisma.postMarketSurveillance.findMany({
        where: { organizationId },
        include: { device: { select: { code: true, name: true } } },
        orderBy: { periodEnd: "desc" },
      }),
    ]);
  }

  const decryptedComplaints = complaints.map((c) => ({
    ...c,
    description: decryptMdSensitiveField(c.description) ?? c.description,
    investigationSummary: decryptMdSensitiveField(c.investigationSummary),
  }));
  const decryptedAdverseEvents = adverseEvents.map((e) => ({
    ...e,
    description: decryptMdSensitiveField(e.description) ?? e.description,
  }));
  const decryptedPms = pms.map((p) => ({ ...p, findings: decryptMdSensitiveField(p.findings) }));
  const decryptedFieldActions = fieldActions.map((f) => ({ ...f, reason: decryptMdSensitiveField(f.reason) }));
  const decryptedRecalls = recalls.map((r) => ({ ...r, reason: decryptMdSensitiveField(r.reason) ?? r.reason }));

  const coverage = designInputCoverage({
    inputCodes: inputs.map((i) => i.code),
    linkedInputCodes: outputs.map((o) => o.linkedInputCodes),
  });

  return {
    can: {
      create: auth.can("medical-devices:create"),
      update: auth.can("medical-devices:update"),
      approve: auth.can("medical-devices:approve") || auth.can("medical-devices:update"),
      export: auth.can("medical-devices:export"),
      sensitiveRead: canSensitive,
      sensitiveCreate: auth.can("md-sensitive:create"),
      sensitiveUpdate: auth.can("md-sensitive:update"),
      sensitiveDelete: auth.can("md-sensitive:delete"),
    },
    disclaimer:
      "Este módulo es una herramienta de gestión de calidad configurable. No sustituye los requisitos regulatorios nacionales aplicables (p. ej. MDR, FDA QSR/QMSR u otros).",
    retentionYears: retentionPolicy?.retentionYears ?? DEFAULT_RETENTION_YEARS,
    members,
    families,
    devices,
    dmrs,
    dhfs,
    inputs,
    outputs,
    reviews,
    verifications,
    validations,
    transfers,
    riskFiles,
    suppliers,
    qualifications,
    processVals,
    sterVals,
    batches,
    traces,
    complaints: decryptedComplaints,
    adverseEvents: decryptedAdverseEvents,
    pms: decryptedPms,
    fieldActions: decryptedFieldActions,
    recalls: decryptedRecalls,
    requirements,
    submissions,
    coverage,
    summary: {
      devices: devices.filter((d) => d.status === "ACTIVE" || d.status === "PRODUCTION").length,
      dmrsApproved: dmrs.filter((d) => d.status === "APPROVED").length,
      dhfsOpen: dhfs.filter((d) => d.status !== "APPROVED" && d.status !== "SUPERSEDED").length,
      inputCoveragePercent: coverage.percent,
      openComplaints: complaints.filter((c) => c.status !== "CLOSED").length,
      openAdverseEvents: adverseEvents.filter((e) => e.status !== "CLOSED").length,
      openRecalls: recalls.filter((r) => r.status !== "CLOSED" && r.status !== "COMPLETED").length,
      batchesReleased: batches.filter((b) => b.status === "RELEASED").length,
      criticalSuppliers: suppliers.filter((s) => s.status === "ACTIVE").length,
      activeRequirements: requirements.filter((r) => r.active).length,
      sensitiveLocked: !canSensitive,
    },
  };
}
