/**
 * Trazabilidad hacia atrás (proveedor ← … ← lote) y hacia adelante (lote → … → cliente).
 * Los enlaces viven en `previousLotIds` de cada TraceabilityLot.
 */

export type TraceLotNode = {
  id: string;
  code: string;
  lotType: string;
  productCode?: string | null;
  rawMaterialCode?: string | null;
  supplierId?: string | null;
  customerName?: string | null;
  previousLotIds: string[];
  quantity?: number | null;
  unit?: string | null;
  status?: string;
};

export type TracePath = {
  direction: "BACKWARD" | "FORWARD";
  rootCode: string;
  nodes: TraceLotNode[];
  edges: { from: string; to: string }[];
  complete: boolean;
  missingIds: string[];
};

function indexById(lots: TraceLotNode[]): Map<string, TraceLotNode> {
  return new Map(lots.map((lot) => [lot.id, lot]));
}

function indexByCode(lots: TraceLotNode[]): Map<string, TraceLotNode> {
  return new Map(lots.map((lot) => [lot.code, lot]));
}

/** Hacia atrás: sigue previousLotIds desde el lote raíz. */
export function traceBackward(rootId: string, lots: TraceLotNode[]): TracePath {
  const byId = indexById(lots);
  const root = byId.get(rootId);
  if (!root) {
    return { direction: "BACKWARD", rootCode: rootId, nodes: [], edges: [], complete: false, missingIds: [rootId] };
  }

  const visited = new Set<string>();
  const nodes: TraceLotNode[] = [];
  const edges: { from: string; to: string }[] = [];
  const missingIds: string[] = [];
  const queue = [root.id];

  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = byId.get(id);
    if (!node) {
      missingIds.push(id);
      continue;
    }
    nodes.push(node);
    for (const prev of node.previousLotIds) {
      edges.push({ from: node.code, to: byId.get(prev)?.code ?? prev });
      if (!visited.has(prev)) queue.push(prev);
    }
  }

  return {
    direction: "BACKWARD",
    rootCode: root.code,
    nodes,
    edges,
    complete: missingIds.length === 0,
    missingIds,
  };
}

/** Hacia adelante: lotes que listan al raíz (o a sus descendientes) en previousLotIds. */
export function traceForward(rootId: string, lots: TraceLotNode[]): TracePath {
  const byId = indexById(lots);
  const root = byId.get(rootId);
  if (!root) {
    return { direction: "FORWARD", rootCode: rootId, nodes: [], edges: [], complete: false, missingIds: [rootId] };
  }

  const childrenOf = new Map<string, string[]>();
  for (const lot of lots) {
    for (const prev of lot.previousLotIds) {
      const list = childrenOf.get(prev) ?? [];
      list.push(lot.id);
      childrenOf.set(prev, list);
    }
  }

  const visited = new Set<string>();
  const nodes: TraceLotNode[] = [];
  const edges: { from: string; to: string }[] = [];
  const queue = [root.id];

  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = byId.get(id);
    if (!node) continue;
    nodes.push(node);
    for (const childId of childrenOf.get(id) ?? []) {
      const child = byId.get(childId);
      if (child) edges.push({ from: node.code, to: child.code });
      if (!visited.has(childId)) queue.push(childId);
    }
  }

  return {
    direction: "FORWARD",
    rootCode: root.code,
    nodes,
    edges,
    complete: true,
    missingIds: [],
  };
}

/** Prueba de trazabilidad: ambos sentidos desde un lote (por id o código). */
export function runTraceabilityTest(input: {
  rootIdOrCode: string;
  lots: TraceLotNode[];
}): { backward: TracePath; forward: TracePath; ok: boolean; summary: string } {
  const byId = indexById(input.lots);
  const byCode = indexByCode(input.lots);
  const root = byId.get(input.rootIdOrCode) ?? byCode.get(input.rootIdOrCode);
  if (!root) {
    throw new Error(`Lote de trazabilidad no encontrado: ${input.rootIdOrCode}`);
  }
  const backward = traceBackward(root.id, input.lots);
  const forward = traceForward(root.id, input.lots);
  const ok = backward.complete && backward.nodes.length > 0 && forward.nodes.length > 0;
  const summary = ok
    ? `Prueba OK: ${backward.nodes.length} nodos atrás, ${forward.nodes.length} adelante desde ${root.code}.`
    : `Prueba incompleta desde ${root.code}: faltan ${backward.missingIds.join(", ") || "enlaces"}.`;
  return { backward, forward, ok, summary };
}

/** Lotes afectados por un retiro a partir de códigos. */
export function lotsAffectedByRecall(lotCodes: string[], lots: TraceLotNode[]): TraceLotNode[] {
  const codes = new Set(lotCodes);
  const selected = lots.filter((lot) => codes.has(lot.code));
  const expanded = new Map<string, TraceLotNode>();
  for (const lot of selected) {
    const fwd = traceForward(lot.id, lots);
    for (const node of fwd.nodes) expanded.set(node.id, node);
    const back = traceBackward(lot.id, lots);
    for (const node of back.nodes) expanded.set(node.id, node);
  }
  return [...expanded.values()];
}
