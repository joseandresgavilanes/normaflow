import "server-only";
import { prisma } from "@/lib/prisma";
import { requireAuthorization } from "@/lib/permissions/server";
import { classifySystem, missingHighRiskSafeguards, requiredSafeguards } from "@/lib/aims/classification";
import { biasFlags, isDatasetFitForTraining } from "@/lib/aims/data-quality";
import { humanReviewIntegrity } from "@/lib/aims/human-review";
import { summarizeMonitoring } from "@/lib/aims/monitoring";

export type AimsPayload = Awaited<ReturnType<typeof getAimsPayload>>;

/** Live payload for the /app/aims module (ISO/IEC 42001). */
export async function getAimsPayload() {
  const auth = await requireAuthorization("aims:read");
  const organizationId = auth.ctx.organization.id;

  const [systems, risks, datasets, models, controls, transparency, incidents, suppliers, changes, metrics, outputs, members] =
    await Promise.all([
      prisma.aISystem.findMany({
        where: { organizationId },
        include: {
          useCases: { orderBy: { code: "asc" } },
          impactAssessments: { orderBy: [{ code: "asc" }, { version: "desc" }] },
          oversightControls: { orderBy: { code: "asc" } },
          transparency: { orderBy: { code: "asc" } },
          _count: { select: { risks: true, incidents: true, modelVersions: true } },
        },
        orderBy: { code: "asc" },
      }),
      prisma.aIRisk.findMany({ where: { organizationId }, orderBy: [{ residualScore: "desc" }, { code: "asc" }] }),
      prisma.dataset.findMany({
        where: { organizationId },
        include: { _count: { select: { sources: true, lineage: true } } },
        orderBy: { code: "asc" },
      }),
      prisma.modelVersion.findMany({
        where: { organizationId },
        include: { evaluations: { orderBy: { evaluatedAt: "desc" }, take: 1 } },
        orderBy: [{ modelName: "asc" }, { version: "desc" }],
      }),
      prisma.humanOversightControl.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
      prisma.aITransparencyRecord.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
      prisma.aIIncident.findMany({ where: { organizationId }, orderBy: { detectedAt: "desc" } }),
      prisma.aISupplierAssessment.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
      prisma.aIChangeRequest.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
      prisma.aIPerformanceMetric.findMany({ where: { organizationId }, orderBy: [{ period: "desc" }, { name: "asc" }] }),
      prisma.aIGeneratedOutput.findMany({ where: { organizationId }, orderBy: { generatedAt: "desc" }, take: 100 }),
      prisma.user.findMany({ where: { memberships: { some: { organizationId } } }, select: { id: true, name: true } }),
    ]);

  const passedModelsBySystem = new Set(
    models.filter((m) => m.evaluations[0]?.outcome === "PASSED" || m.evaluations[0]?.outcome === "PASSED_WITH_CONDITIONS").map((m) => m.systemId),
  );

  const systemRows = systems.map((system) => {
    const approvedAssessment = system.impactAssessments.find((a) => a.reviewStatus === "APPROVED") ?? null;
    const classification = classifySystem(system.criticality, approvedAssessment?.classification ?? system.classification);
    const missing = missingHighRiskSafeguards({
      classification,
      hasApprovedImpactAssessment: Boolean(approvedAssessment),
      hasOversightControl: system.oversightControls.some((c) => c.active),
      hasPassedEvaluation: passedModelsBySystem.has(system.id),
      hasTransparencyRecord: system.transparency.length > 0,
    });
    return {
      id: system.id,
      code: system.code,
      name: system.name,
      ownerId: system.ownerId,
      provider: system.provider,
      providerType: system.providerType,
      purpose: system.purpose,
      users: system.users,
      context: system.context,
      criticality: system.criticality,
      classification,
      autonomy: system.autonomy,
      status: system.status,
      approvedAt: system.approvedAt,
      retiredAt: system.retiredAt,
      nextReviewDate: system.nextReviewDate,
      useCases: system.useCases.length,
      risks: system._count.risks,
      incidents: system._count.incidents,
      models: system._count.modelVersions,
      oversightControls: system.oversightControls.length,
      transparencyRecords: system.transparency.length,
      impactAssessment: approvedAssessment
        ? { id: approvedAssessment.id, code: approvedAssessment.code, version: approvedAssessment.version, severity: approvedAssessment.overallSeverity }
        : null,
      /** Salvaguardas exigidas por la clase y las que faltan hoy. */
      requiredSafeguards: requiredSafeguards(classification),
      missingSafeguards: missing,
      compliant: missing.length === 0,
    };
  });

  const datasetRows = datasets.map((dataset) => ({
    id: dataset.id,
    code: dataset.code,
    name: dataset.name,
    purpose: dataset.purpose,
    ownerId: dataset.ownerId,
    classification: dataset.classification,
    containsPersonalData: dataset.containsPersonalData,
    containsSpecialCategories: dataset.containsSpecialCategories,
    legalBasis: dataset.legalBasis,
    recordCount: dataset.recordCount,
    qualityScore: dataset.qualityScore,
    qualityLevel: dataset.qualityLevel,
    sources: dataset._count.sources,
    lineageSteps: dataset._count.lineage,
    biasReviewed: dataset.biasReviewed,
    biasFlags: biasFlags({
      representativeness: dataset.representativeness,
      biasReviewed: dataset.biasReviewed,
      underrepresentedGroups: dataset.underrepresentedGroups,
      containsPersonalData: dataset.containsPersonalData,
      containsSpecialCategories: dataset.containsSpecialCategories,
    }),
    fitForTraining: isDatasetFitForTraining({ qualityLevel: dataset.qualityLevel, biasReviewed: dataset.biasReviewed }),
    /** Sin fuente declarada no hay procedencia auditable. */
    traceable: dataset._count.sources > 0 && dataset._count.lineage > 0,
  }));

  const modelRows = models.map((model) => {
    const latest = model.evaluations[0] ?? null;
    return {
      id: model.id,
      code: model.code,
      systemId: model.systemId,
      modelName: model.modelName,
      version: model.version,
      algorithm: model.algorithm,
      provider: model.provider,
      stage: model.stage,
      reviewStatus: model.reviewStatus,
      reviewerId: model.reviewerId,
      reviewedAt: model.reviewedAt,
      deployedAt: model.deployedAt,
      explainabilityMethod: model.explainabilityMethod,
      trainingDatasetId: model.trainingDatasetId,
      lastEvaluation: latest
        ? {
            id: latest.id,
            outcome: latest.outcome,
            accuracy: latest.accuracy,
            fairnessScore: latest.fairnessScore,
            biasDetected: latest.biasDetected,
            evaluatedAt: latest.evaluatedAt,
          }
        : null,
    };
  });

  const outputRows = outputs.map((output) => ({
    id: output.id,
    code: output.code,
    systemId: output.systemId,
    purpose: output.purpose,
    targetType: output.targetType,
    model: output.model,
    modelVersionLabel: output.modelVersionLabel,
    requestedById: output.requestedById,
    generatedAt: output.generatedAt,
    reviewStatus: output.reviewStatus,
    reviewerId: output.reviewerId,
    reviewedAt: output.reviewedAt,
    edited: output.edited,
    containsPersonalData: output.containsPersonalData,
    promotedEntityType: output.promotedEntityType,
    promotedAt: output.promotedAt,
    integrity: humanReviewIntegrity(output),
  }));

  const monitoring = summarizeMonitoring(
    metrics.map((metric) => ({ systemId: metric.systemId, breached: metric.breached, driftDetected: metric.driftDetected })),
    systems.filter((system) => system.status === "IN_PRODUCTION").map((system) => system.id),
  );

  const openIncidents = incidents.filter((incident) => incident.status !== "CLOSED");

  return {
    canManage: auth.can("aims:create"),
    canApprove: auth.can("aims:approve"),
    members,
    systems: systemRows,
    risks: risks.map((risk) => ({
      id: risk.id,
      code: risk.code,
      systemId: risk.systemId,
      title: risk.title,
      category: risk.category,
      likelihood: risk.likelihood,
      impact: risk.impact,
      inherentScore: risk.inherentScore,
      inherentLevel: risk.inherentLevel,
      residualScore: risk.residualScore,
      residualLevel: risk.residualLevel,
      acceptability: risk.acceptability,
      treatment: risk.treatment,
      status: risk.status,
      ownerId: risk.ownerId,
      dueDate: risk.dueDate,
    })),
    datasets: datasetRows,
    models: modelRows,
    controls: controls.map((control) => ({
      id: control.id,
      code: control.code,
      systemId: control.systemId,
      name: control.name,
      type: control.type,
      responsibleId: control.responsibleId,
      canOverride: control.canOverride,
      canStop: control.canStop,
      effectiveness: control.effectiveness,
      lastVerifiedAt: control.lastVerifiedAt,
      active: control.active,
    })),
    transparency: transparency.map((record) => ({
      id: record.id,
      code: record.code,
      systemId: record.systemId,
      audience: record.audience,
      disclosure: record.disclosure,
      aiUseDisclosed: record.aiUseDisclosed,
      humanContactOffered: record.humanContactOffered,
      channel: record.channel,
      publishedAt: record.publishedAt,
      version: record.version,
    })),
    incidents: incidents.map((incident) => ({
      id: incident.id,
      code: incident.code,
      systemId: incident.systemId,
      type: incident.type,
      severity: incident.severity,
      title: incident.title,
      status: incident.status,
      detectedAt: incident.detectedAt,
      affectedCount: incident.affectedCount,
      notificationRequired: incident.notificationRequired,
      responsibleId: incident.responsibleId,
      closedAt: incident.closedAt,
    })),
    suppliers: suppliers.map((supplier) => ({
      id: supplier.id,
      code: supplier.code,
      supplierName: supplier.supplierName,
      serviceType: supplier.serviceType,
      outcome: supplier.outcome,
      score: supplier.score,
      usesCustomerDataForTraining: supplier.usesCustomerDataForTraining,
      assessedAt: supplier.assessedAt,
      nextReviewDate: supplier.nextReviewDate,
    })),
    changes: changes.map((change) => ({
      id: change.id,
      code: change.code,
      systemId: change.systemId,
      title: change.title,
      changeType: change.changeType,
      reviewStatus: change.reviewStatus,
      requiresReassessment: change.requiresReassessment,
      implementedAt: change.implementedAt,
      reviewerId: change.reviewerId,
      reviewedAt: change.reviewedAt,
    })),
    metrics: metrics.slice(0, 60).map((metric) => ({
      id: metric.id,
      systemId: metric.systemId,
      period: metric.period,
      kind: metric.kind,
      name: metric.name,
      value: metric.value,
      threshold: metric.threshold,
      baseline: metric.baseline,
      breached: metric.breached,
      driftDetected: metric.driftDetected,
    })),
    outputs: outputRows,
    summary: {
      systems: systems.length,
      inProduction: systems.filter((system) => system.status === "IN_PRODUCTION").length,
      retired: systems.filter((system) => system.status === "RETIRED").length,
      highRisk: systemRows.filter((system) => system.classification === "HIGH" || system.classification === "UNACCEPTABLE").length,
      systemsMissingSafeguards: systemRows.filter((system) => !system.compliant).length,
      useCases: systems.reduce((total, system) => total + system.useCases.length, 0),
      approvedAssessments: systemRows.filter((system) => system.impactAssessment).length,
      pendingAssessments: systems.reduce(
        (total, system) => total + system.impactAssessments.filter((a) => a.reviewStatus === "HUMAN_REVIEW").length,
        0,
      ),
      risks: risks.length,
      unacceptableRisks: risks.filter((risk) => risk.acceptability === "NOT_ACCEPTABLE").length,
      datasets: datasets.length,
      datasetsWithPersonalData: datasets.filter((dataset) => dataset.containsPersonalData).length,
      datasetsWithoutBiasReview: datasets.filter((dataset) => !dataset.biasReviewed).length,
      models: models.length,
      modelsInProduction: models.filter((model) => model.stage === "PRODUCTION").length,
      modelsAwaitingReview: models.filter((model) => model.reviewStatus === "HUMAN_REVIEW").length,
      controls: controls.length,
      transparencyRecords: transparency.length,
      openIncidents: openIncidents.length,
      incidentsRequiringNotification: incidents.filter((incident) => incident.notificationRequired && !incident.notifiedAt).length,
      suppliers: suppliers.length,
      suppliersPending: suppliers.filter((supplier) => supplier.outcome === "UNDER_REVIEW").length,
      changesAwaitingReview: changes.filter((change) => change.reviewStatus === "HUMAN_REVIEW").length,
      outputsAwaitingReview: outputRows.filter((output) => output.reviewStatus === "HUMAN_REVIEW").length,
      outputsApproved: outputRows.filter((output) => output.reviewStatus === "APPROVED").length,
      outputsRejected: outputRows.filter((output) => output.reviewStatus === "REJECTED").length,
      outputsPromoted: outputRows.filter((output) => output.promotedAt).length,
      /** Cualquier valor > 0 es un incumplimiento de la regla humana. */
      humanRuleViolations: outputRows.filter((output) => !output.integrity.valid).length,
      monitoring,
    },
  };
}
