import type { ChangeRequestRow, DocumentRow, IndicatorRow, ProcessRow, RiskRow, TrainingAssignmentRow } from "@/context/WorkspaceStore";

export function documentsLinkedToProcess(
  process: Pick<ProcessRow, "code" | "linkedDocCodes">,
  documents: DocumentRow[],
): DocumentRow[] {
  const seen = new Map<string, DocumentRow>();
  for (const d of documents) {
    if (process.linkedDocCodes?.includes(d.code) || (d.linkedProcessCode && d.linkedProcessCode === process.code)) {
      seen.set(d.id, d);
    }
  }
  return [...seen.values()];
}

export function risksLinkedToProcess(
  process: Pick<ProcessRow, "code" | "linkedRiskCodes">,
  risks: RiskRow[],
): RiskRow[] {
  const seen = new Map<string, RiskRow>();
  for (const r of risks) {
    if (process.linkedRiskCodes?.includes(r.code) || (r.linkedProcessCode && r.linkedProcessCode === process.code)) {
      seen.set(r.id, r);
    }
  }
  return [...seen.values()];
}

export function indicatorsLinkedToProcess(
  process: Pick<ProcessRow, "code" | "linkedIndicatorNames">,
  indicators: IndicatorRow[],
): IndicatorRow[] {
  const seen = new Map<string, IndicatorRow>();
  for (const ind of indicators) {
    if (process.linkedIndicatorNames?.includes(ind.name) || (ind.linkedProcessCode && ind.linkedProcessCode === process.code)) {
      seen.set(ind.id, ind);
    }
  }
  return [...seen.values()];
}

export function processesLinkedToRisk(
  risk: Pick<RiskRow, "code" | "linkedProcessCode">,
  processes: ProcessRow[],
): ProcessRow[] {
  const seen = new Map<string, ProcessRow>();
  for (const p of processes) {
    if (p.linkedRiskCodes?.includes(risk.code) || (risk.linkedProcessCode && p.code === risk.linkedProcessCode)) {
      seen.set(p.id, p);
    }
  }
  return [...seen.values()];
}

export function processesLinkedToIndicator(
  indicator: Pick<IndicatorRow, "name" | "linkedProcessCode">,
  processes: ProcessRow[],
): ProcessRow[] {
  const seen = new Map<string, ProcessRow>();
  for (const p of processes) {
    if (p.linkedIndicatorNames?.includes(indicator.name) || (indicator.linkedProcessCode && p.code === indicator.linkedProcessCode)) {
      seen.set(p.id, p);
    }
  }
  return [...seen.values()];
}

export function changesLinkedToProcess(
  process: Pick<ProcessRow, "code" | "linkedChangeCodes">,
  changes: ChangeRequestRow[],
): ChangeRequestRow[] {
  const seen = new Map<string, ChangeRequestRow>();
  for (const c of changes) {
    if (process.linkedChangeCodes?.includes(c.code) || c.processCodes?.includes(process.code)) {
      seen.set(c.id, c);
    }
  }
  return [...seen.values()];
}

export function trainingLinkedToProcess(
  process: Pick<ProcessRow, "code" | "linkedTrainingAssignmentIds">,
  assignments: TrainingAssignmentRow[],
): TrainingAssignmentRow[] {
  const seen = new Map<string, TrainingAssignmentRow>();
  for (const t of assignments) {
    if (process.linkedTrainingAssignmentIds?.includes(t.id) || (t.processCode && t.processCode === process.code)) {
      seen.set(t.id, t);
    }
  }
  return [...seen.values()];
}

export function processesLinkedToChange(
  change: Pick<ChangeRequestRow, "code" | "processCodes">,
  processes: ProcessRow[],
): ProcessRow[] {
  const seen = new Map<string, ProcessRow>();
  for (const p of processes) {
    if (change.processCodes?.includes(p.code) || p.linkedChangeCodes?.includes(change.code)) {
      seen.set(p.id, p);
    }
  }
  return [...seen.values()];
}
