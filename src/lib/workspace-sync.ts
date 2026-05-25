import type { ChangeRequestRow, IndicatorRow, ProcessRow, RiskRow, TrainingAssignmentRow } from "@/context/WorkspaceStore";

export function syncProcessDocCodes(
  processes: ProcessRow[],
  docCode: string,
  nextProcessCode: string,
  prevProcessCode?: string,
): ProcessRow[] {
  const prev = prevProcessCode?.trim();
  const next = nextProcessCode.trim();
  if (prev === next) return processes;
  return processes.map(p => {
    let linkedDocCodes = [...(p.linkedDocCodes ?? [])];
    if (prev && p.code === prev) {
      linkedDocCodes = linkedDocCodes.filter(c => c !== docCode);
    }
    if (next && p.code === next && !linkedDocCodes.includes(docCode)) {
      linkedDocCodes = [...linkedDocCodes, docCode];
    }
    return linkedDocCodes === (p.linkedDocCodes ?? []) ? p : { ...p, linkedDocCodes };
  });
}

export function syncProcessRiskCodes(
  processes: ProcessRow[],
  riskCode: string,
  nextProcessCode: string,
  prevProcessCode?: string,
): ProcessRow[] {
  const prev = prevProcessCode?.trim();
  const next = nextProcessCode.trim();
  if (prev === next) return processes;
  return processes.map(p => {
    let linkedRiskCodes = [...(p.linkedRiskCodes ?? [])];
    if (prev && p.code === prev) {
      linkedRiskCodes = linkedRiskCodes.filter(c => c !== riskCode);
    }
    if (next && p.code === next && !linkedRiskCodes.includes(riskCode)) {
      linkedRiskCodes = [...linkedRiskCodes, riskCode];
    }
    return linkedRiskCodes === (p.linkedRiskCodes ?? []) ? p : { ...p, linkedRiskCodes };
  });
}

export function syncProcessIndicatorNames(
  processes: ProcessRow[],
  indicatorName: string,
  nextProcessCode: string,
  prevProcessCode?: string,
): ProcessRow[] {
  const prev = prevProcessCode?.trim();
  const next = nextProcessCode.trim();
  if (prev === next) return processes;
  return processes.map(p => {
    let linkedIndicatorNames = [...(p.linkedIndicatorNames ?? [])];
    if (prev && p.code === prev) {
      linkedIndicatorNames = linkedIndicatorNames.filter(n => n !== indicatorName);
    }
    if (next && p.code === next && !linkedIndicatorNames.includes(indicatorName)) {
      linkedIndicatorNames = [...linkedIndicatorNames, indicatorName];
    }
    return linkedIndicatorNames === (p.linkedIndicatorNames ?? []) ? p : { ...p, linkedIndicatorNames };
  });
}

export function syncProcessChangeCodes(
  processes: ProcessRow[],
  changeCode: string,
  nextProcessCode: string,
  prevProcessCode?: string,
): ProcessRow[] {
  const prev = prevProcessCode?.trim();
  const next = nextProcessCode.trim();
  if (prev === next) return processes;
  return processes.map(p => {
    let linkedChangeCodes = [...(p.linkedChangeCodes ?? [])];
    if (prev && p.code === prev) {
      linkedChangeCodes = linkedChangeCodes.filter(c => c !== changeCode);
    }
    if (next && p.code === next && !linkedChangeCodes.includes(changeCode)) {
      linkedChangeCodes = [...linkedChangeCodes, changeCode];
    }
    return linkedChangeCodes === (p.linkedChangeCodes ?? []) ? p : { ...p, linkedChangeCodes };
  });
}

export function syncChangeRequestProcessCodes(
  processes: ProcessRow[],
  changeCode: string,
  nextCodes: string[],
  prevCodes: string[],
): ProcessRow[] {
  let result = processes;
  for (const code of prevCodes) {
    if (!nextCodes.includes(code)) {
      result = syncProcessChangeCodes(result, changeCode, "", code);
    }
  }
  for (const code of nextCodes) {
    if (!prevCodes.includes(code)) {
      result = syncProcessChangeCodes(result, changeCode, code);
    }
  }
  return result;
}

export function syncProcessTrainingId(
  processes: ProcessRow[],
  assignmentId: string,
  nextProcessCode: string,
  prevProcessCode?: string,
): ProcessRow[] {
  const prev = prevProcessCode?.trim();
  const next = nextProcessCode.trim();
  if (prev === next) return processes;
  return processes.map(p => {
    let linkedTrainingAssignmentIds = [...(p.linkedTrainingAssignmentIds ?? [])];
    if (prev && p.code === prev) {
      linkedTrainingAssignmentIds = linkedTrainingAssignmentIds.filter(id => id !== assignmentId);
    }
    if (next && p.code === next && !linkedTrainingAssignmentIds.includes(assignmentId)) {
      linkedTrainingAssignmentIds = [...linkedTrainingAssignmentIds, assignmentId];
    }
    return linkedTrainingAssignmentIds === (p.linkedTrainingAssignmentIds ?? [])
      ? p
      : { ...p, linkedTrainingAssignmentIds };
  });
}

/** Asegura que el seed demo tenga enlaces coherentes en procesos y entidades. */
export function normalizeWorkspaceLinks<
  TDoc extends { id: string; code: string; linkedProcessCode?: string },
>(state: {
  documents: TDoc[];
  risks: RiskRow[];
  indicators: IndicatorRow[];
  processes: ProcessRow[];
  changeRequests?: ChangeRequestRow[];
  trainingAssignments?: TrainingAssignmentRow[];
}): {
  documents: TDoc[];
  risks: RiskRow[];
  indicators: IndicatorRow[];
  processes: ProcessRow[];
  changeRequests: ChangeRequestRow[];
  trainingAssignments: TrainingAssignmentRow[];
} {
  let { documents, risks, indicators, processes } = state;
  let changeRequests = state.changeRequests ?? [];
  let trainingAssignments = state.trainingAssignments ?? [];

  for (const d of documents) {
    if (d.linkedProcessCode) {
      processes = syncProcessDocCodes(processes, d.code, d.linkedProcessCode);
    }
  }
  for (const r of risks) {
    if (r.linkedProcessCode) {
      processes = syncProcessRiskCodes(processes, r.code, r.linkedProcessCode);
    }
  }
  for (const ind of indicators) {
    if (ind.linkedProcessCode) {
      processes = syncProcessIndicatorNames(processes, ind.name, ind.linkedProcessCode);
    }
  }

  for (const p of processes) {
    for (const code of p.linkedDocCodes ?? []) {
      const doc = documents.find(d => d.code === code);
      if (doc && doc.linkedProcessCode !== p.code) {
        documents = documents.map(d => (d.id === doc.id ? { ...d, linkedProcessCode: p.code } : d));
      }
    }
    for (const code of p.linkedRiskCodes ?? []) {
      const risk = risks.find(r => r.code === code);
      if (risk && risk.linkedProcessCode !== p.code) {
        risks = risks.map(r => (r.id === risk.id ? { ...r, linkedProcessCode: p.code } : r));
      }
    }
    for (const name of p.linkedIndicatorNames ?? []) {
      const ind = indicators.find(i => i.name === name);
      if (ind && ind.linkedProcessCode !== p.code) {
        indicators = indicators.map(i => (i.id === ind.id ? { ...i, linkedProcessCode: p.code } : i));
      }
    }
    for (const code of p.linkedChangeCodes ?? []) {
      const cr = changeRequests.find(c => c.code === code);
      if (cr && !cr.processCodes.includes(p.code)) {
        changeRequests = changeRequests.map(c =>
          c.id === cr.id ? { ...c, processCodes: [...c.processCodes, p.code] } : c
        );
      }
    }
    for (const id of p.linkedTrainingAssignmentIds ?? []) {
      const row = trainingAssignments.find(t => t.id === id);
      if (row && row.processCode !== p.code) {
        trainingAssignments = trainingAssignments.map(t => (t.id === id ? { ...t, processCode: p.code } : t));
      }
    }
  }

  for (const cr of changeRequests) {
    for (const code of cr.processCodes ?? []) {
      processes = syncProcessChangeCodes(processes, cr.code, code);
    }
  }
  for (const t of trainingAssignments) {
    if (t.processCode) {
      processes = syncProcessTrainingId(processes, t.id, t.processCode);
    }
  }

  return { documents, risks, indicators, processes, changeRequests, trainingAssignments };
}
