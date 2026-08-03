"use client";

import { useMemo, useState, useTransition } from "react";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import PageHeader from "@/components/layout/PageHeader";
import { Library, ShieldCheck, GitCompareArrows, Grid3x3, LayoutDashboard, Check, Download , Link2} from "lucide-react";
import type { StandardsEnginePayload } from "@/lib/standards-engine";
import { activateStandard } from "@/lib/actions/standards";
import { installStandardPack } from "@/lib/actions/standard-packs";
import { CoverageDialog } from "@/components/standards/CoverageDialog";
import { CrosswalkMatrix } from "@/components/standards/CrosswalkMatrix";

type Tab = "panel" | "catalog" | "active" | "matrix" | "correspondence";

const GAP_COLORS: Record<string, string> = {
  COMPLIANT: "#16a34a", PARTIALLY_COMPLIANT: "#d68a1a", NON_COMPLIANT: "#b91c1c",
  NOT_APPLICABLE: "#8794a5", NOT_EVALUATED: "#c3ccd8",
};

const card: React.CSSProperties = { border: "1px solid var(--nf-line, #e5eaf2)", borderRadius: 14, padding: 18, background: "var(--nf-surface, #fff)" };
const chip = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99 });

export default function StandardsEngineClient({ initial, demo = false }: { initial: StandardsEnginePayload; demo?: boolean }) {
  const [tab, setTab] = useState<Tab>("panel");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [matrixEdition, setMatrixEdition] = useState<string>(initial.matrix[0]?.editionId ?? "");
  const [coverageFor, setCoverageFor] = useState<{ id: string; code: string; title: string; editionLabel: string } | null>(null);
  const [levelFilter, setLevelFilter] = useState<number | 0>(0);
  const [onlyGaps, setOnlyGaps] = useState(false);

  const tabs: { id: Tab; label: string; Icon: typeof Library }[] = [
    { id: "panel", label: "Panel integrado", Icon: LayoutDashboard },
    { id: "catalog", label: "Catálogo", Icon: Library },
    { id: "active", label: "Normas activas", Icon: ShieldCheck },
    { id: "matrix", label: "Matriz de requisitos", Icon: Grid3x3 },
    { id: "correspondence", label: "Correspondencias", Icon: GitCompareArrows },
  ];

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Error inesperado."); }
    });
  }

  const currentMatrix = useMemo(() => initial.matrix.find((m) => m.editionId === matrixEdition) ?? initial.matrix[0], [initial.matrix, matrixEdition]);
  const filteredReqs = useMemo(() => {
    let rows = currentMatrix?.requirements ?? [];
    if (levelFilter) rows = rows.filter((r) => r.level === levelFilter);
    if (onlyGaps) rows = rows.filter((r) => r.gapStatus === "NON_COMPLIANT" || r.gapStatus === "PARTIALLY_COMPLIANT");
    return rows;
  }, [currentMatrix, levelFilter, onlyGaps]);

  return (
    <div style={{ padding: "clamp(16px, 3vw, 32px)", maxWidth: 1180, margin: "0 auto" }}>
      <PageHeader
        title="Motor de Normas ISO"
        subtitle="Instala paquetes normativos, actívalos por organización y gestiona requisitos, correspondencias y evidencia compartida entre normas."
        meta={demo ? <span style={{ color: "#5266F6", fontWeight: 600, fontSize: 13 }}>Vista demo (solo lectura)</span> : undefined}
      />

      {error && <div role="alert" style={{ ...card, borderColor: "#f2b8b8", background: "#fdf3f3", color: "#b91c1c", marginBottom: 16 }}>{error}</div>}

      <nav className="nf-iso-tabs" role="tablist" aria-label="Secciones del motor de normas" style={{ marginBottom: 20 }}>
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} type="button" role="tab" className="nf-iso-tab" aria-selected={tab === id} onClick={() => setTab(id)}><Icon size={16} /> {label}</button>
        ))}
      </nav>

      {tab === "panel" && <PanelTab payload={initial} />}
      {tab === "catalog" && <CatalogTab payload={initial} pending={pending} demo={demo} onActivate={(familyCode, editionCode) => run(() => activateStandard({ familyCode, editionCode }))} onInstall={(code) => run(() => installStandardPack(code))} />}
      {tab === "active" && <ActiveTab payload={initial} />}
      {tab === "matrix" && (
        <MatrixTab
          payload={initial} currentMatrix={currentMatrix} rows={filteredReqs}
          matrixEdition={matrixEdition} setMatrixEdition={setMatrixEdition}
          onCoverage={(row) => setCoverageFor({ id: row.id, code: row.code, title: row.title, editionLabel: currentMatrix?.label ?? "" })}
          levelFilter={levelFilter} setLevelFilter={setLevelFilter} onlyGaps={onlyGaps} setOnlyGaps={setOnlyGaps}
        />
      )}
      {tab === "correspondence" && <CorrespondenceTab payload={initial} />}
      <CoverageDialog requirement={coverageFor} canEdit={initial.canActivate} onClose={() => setCoverageFor(null)} />
    </div>
  );
}

function PanelTab({ payload }: { payload: StandardsEnginePayload }) {
  const totalReq = payload.active.reduce((s, a) => s + a.requirementCount, 0);
  const totalCovered = payload.active.reduce((s, a) => s + a.coveredRequirements, 0);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
        <Stat label="Normas activas" value={String(payload.active.length)} />
        <Stat label="Requisitos totales" value={String(totalReq)} />
        <Stat label="Requisitos con evidencia" value={`${totalCovered}`} sub={totalReq ? `${Math.round((totalCovered / totalReq) * 100)}%` : "—"} />
        <Stat label="Correspondencias" value={String(payload.correspondence.length)} />
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {payload.active.map((a) => (
          <div key={a.orgStandardId} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div><strong style={{ fontSize: 16 }}>{a.name} {a.editionCode}</strong><span style={{ color: "var(--nf-ink-3,#8794a5)", marginLeft: 8, fontSize: 12 }}>{a.implementationStatus}</span></div>
              <span style={chip("#eef1fe", "#5266F6")}>{a.score == null ? "Sin evaluar" : `${Math.round(a.score)}% GAP`}</span>
            </div>
            <Bar pct={a.score ?? 0} />
            <div style={{ fontSize: 12, color: "var(--nf-ink-2,#5e6b7a)", marginTop: 8 }}>
              {a.coveredRequirements}/{a.requirementCount} requisitos con evidencia · Responsable: {a.responsibleName ?? "—"}{a.certified && " · ✅ Certificada"}
            </div>
          </div>
        ))}
        {!payload.active.length && <Empty text="Aún no hay normas activas. Ve al Catálogo para activar una." />}
      </div>
    </div>
  );
}

function CatalogTab({ payload, onActivate, onInstall, pending, demo }: {
  payload: StandardsEnginePayload; pending: boolean; demo: boolean;
  onActivate: (familyCode: string, editionCode: string) => void; onInstall: (code: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {payload.canInstall && (
        <div style={{ ...card, background: "#f7f9fc" }}>
          <strong style={{ fontSize: 14 }}>Paquetes disponibles (plataforma)</strong>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            {payload.availablePacks.map((p) => (
              <button key={p.code} disabled={pending} onClick={() => onInstall(p.code)} style={ghostBtn}>
                <Download size={14} /> Instalar {p.name} <span style={{ opacity: 0.6 }}>v{p.version}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
        {payload.families.map((f) => (
          <div key={f.code} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <strong style={{ fontSize: 16 }}>{f.name}</strong>
              {f.category && <span style={chip("#f0f3f8", "#5e6b7a")}>{f.category}</span>}
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {f.editions.map((e) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 11px", border: "1px solid var(--nf-line,#e5eaf2)", borderRadius: 10 }}>
                  <div>
                    <strong style={{ fontSize: 13 }}>Edición {e.editionCode}</strong>
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--nf-ink-3,#8794a5)" }}>{e.requirementCount} requisitos · {e.status}</span>
                  </div>
                  {e.active
                    ? <span style={chip("#eafaf0", "#16a34a")}><Check size={11} style={{ verticalAlign: -1 }} /> Activa</span>
                    : payload.canActivate && !demo
                      ? <button disabled={pending} onClick={() => onActivate(f.code, e.editionCode)} style={primaryBtn}>Activar</button>
                      : <span style={chip("#f0f3f8", "#8794a5")}>Inactiva</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type ActiveRow = StandardsEnginePayload["active"][number];
type RequirementRow = StandardsEnginePayload["matrix"][number]["requirements"][number];
type CorrespondenceRow = StandardsEnginePayload["correspondence"][number];

const activeColumns: DataTableColumn<ActiveRow>[] = [
  { id: "name", header: "Norma", primary: true, minWidth: 190, hideable: false, sortValue: (a) => `${a.name} ${a.editionCode}`,
    cell: (a) => <strong>{a.name} {a.editionCode}</strong> },
  { id: "scope", header: "Alcance", minWidth: 220, sortValue: (a) => a.scope ?? "",
    cell: (a) => <span style={{ color: "var(--nf-ink-2,#5e6b7a)" }}>{a.scope ?? "—"}</span> },
  { id: "responsible", header: "Responsable", minWidth: 150, sortValue: (a) => a.responsibleName ?? "", cell: (a) => a.responsibleName ?? "—" },
  { id: "status", header: "Estado", minWidth: 140, sortValue: (a) => a.implementationStatus,
    cell: (a) => <span style={chip("#eef1fe", "#5266F6")}>{a.implementationStatus}</span> },
  { id: "gap", header: "GAP", minWidth: 90, numeric: true, align: "end", sortValue: (a) => a.score ?? null,
    cell: (a) => (a.score == null ? "—" : `${Math.round(a.score)}%`) },
  { id: "audit", header: "Próx. auditoría", minWidth: 140, numeric: true, sortValue: (a) => (a.nextAuditDate ? new Date(a.nextAuditDate).getTime() : null),
    cell: (a) => (a.nextAuditDate ? new Date(a.nextAuditDate).toLocaleDateString() : "—") },
];

function requirementColumns(onCoverage: (row: RequirementRow) => void): DataTableColumn<RequirementRow>[] { return [
  { id: "code", header: "Código", primary: true, minWidth: 110, hideable: false, sortValue: (r) => r.code, cell: (r) => <strong>{r.code}</strong> },
  // La sangría refleja el nivel jerárquico del requisito dentro de la norma.
  { id: "title", header: "Requisito", minWidth: 280, sortValue: (r) => r.title,
    cell: (r) => <span style={{ paddingLeft: (r.level - 1) * 14, display: "inline-block" }}>{r.title}</span> },
  { id: "mandatory", header: "Oblig.", minWidth: 90, sortValue: (r) => (r.mandatory ? "Sí" : "No"), cell: (r) => (r.mandatory ? "Sí" : "No") },
  { id: "gap", header: "Estado GAP", minWidth: 140, sortValue: (r) => r.gapStatus ?? "",
    cell: (r) => <span style={chip((GAP_COLORS[r.gapStatus ?? "NOT_EVALUATED"] ?? "#c3ccd8") + "22", GAP_COLORS[r.gapStatus ?? "NOT_EVALUATED"] ?? "#8794a5")}>{r.gapStatus ?? "—"}</span> },
  { id: "coverage", header: "Evidencia", minWidth: 160, sortValue: (r) => r.coverageCount,
    cell: (r) => (
      <button type="button" className="nf-coverage-cell" onClick={() => onCoverage(r)}
        aria-label={r.coverageCount > 0 ? `Ver los ${r.coverageCount} elementos que cubren ${r.code}` : `Vincular un elemento a ${r.code}`}>
        {r.coverageCount > 0
          ? <span style={chip("#eafaf0", "#15803D")}>{r.coverageCount} elemento(s)</span>
          : <span className="nf-coverage-cell__empty"><Link2 size={12} aria-hidden /> Vincular</span>}
      </button>
    ) },
]; }

const correspondenceColumns: DataTableColumn<CorrespondenceRow>[] = [
  { id: "sourceFamily", header: "Norma origen", minWidth: 130, sortValue: (m) => m.sourceFamily,
    cell: (m) => <span style={chip("#eef1fe", "#5266F6")}>{m.sourceFamily}</span> },
  { id: "source", header: "Requisito", primary: true, minWidth: 220, hideable: false, sortValue: (m) => m.sourceCode,
    cell: (m) => <><strong>{m.sourceCode}</strong> {m.sourceTitle}</> },
  { id: "targetFamily", header: "Norma destino", minWidth: 130, sortValue: (m) => m.targetFamily,
    cell: (m) => <span style={chip("#eef1fe", "#5266F6")}>{m.targetFamily}</span> },
  { id: "target", header: "Requisito", minWidth: 220, sortValue: (m) => m.targetCode,
    cell: (m) => <><strong>{m.targetCode}</strong> {m.targetTitle}</> },
  { id: "relation", header: "Relación", minWidth: 130, sortValue: (m) => m.relationType, cell: (m) => m.relationType },
  { id: "equivalence", header: "Equiv.", minWidth: 90, numeric: true, align: "end", sortValue: (m) => m.equivalencePercent ?? null,
    cell: (m) => (m.equivalencePercent == null ? "—" : `${m.equivalencePercent}%`) },
];

function ActiveTab({ payload }: { payload: StandardsEnginePayload }) {
  if (!payload.active.length) return <Empty text="No hay normas activas para esta organización." />;
  return (
    <DataTable
      columns={activeColumns}
      rows={payload.active}
      rowKey={(a) => a.orgStandardId}
      caption="Normas activas en la organización: nombre y edición, alcance, responsable, estado de implementación, puntuación GAP y próxima auditoría."
      storageKey="standards-active"
    />
  );
}

function MatrixTab({ payload, currentMatrix, rows, matrixEdition, setMatrixEdition, levelFilter, setLevelFilter, onlyGaps, setOnlyGaps, onCoverage }: {
  payload: StandardsEnginePayload; currentMatrix?: StandardsEnginePayload["matrix"][number]; rows: StandardsEnginePayload["matrix"][number]["requirements"];
  matrixEdition: string; setMatrixEdition: (v: string) => void; levelFilter: number; setLevelFilter: (v: number) => void; onlyGaps: boolean; setOnlyGaps: (v: boolean) => void;
  onCoverage: (row: RequirementRow) => void;
}) {
  if (!payload.matrix.length) return <Empty text="Activa al menos una norma para ver su matriz de requisitos." />;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <select aria-label="Edición de la matriz" value={matrixEdition} onChange={(e) => setMatrixEdition(e.target.value)} className="nf-app-input" style={{ maxWidth: 260 }}>
          {payload.matrix.map((m) => <option key={m.editionId} value={m.editionId}>{m.label}</option>)}
        </select>
        <select aria-label="Filtrar por nivel" value={levelFilter} onChange={(e) => setLevelFilter(Number(e.target.value))} className="nf-app-input" style={{ maxWidth: 160 }}>
          <option value={0}>Todos los niveles</option><option value={1}>Nivel 1 (capítulo)</option><option value={2}>Nivel 2</option><option value={3}>Nivel 3</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--nf-ink-2,#5e6b7a)" }}>
          <input type="checkbox" checked={onlyGaps} onChange={(e) => setOnlyGaps(e.target.checked)} /> Solo brechas
        </label>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--nf-ink-3,#8794a5)" }}>{rows.length} requisitos</span>
      </div>
      <DataTable
        columns={requirementColumns(onCoverage)}
        rows={rows}
        rowKey={(r) => r.id}
        caption="Requisitos de la norma: código, título, obligatoriedad, estado de la evaluación GAP y evidencia que lo cubre."
        storageKey="standards-requirements"
      />
      {currentMatrix && <p style={{ fontSize: 12, color: "var(--nf-ink-3,#8794a5)" }}>Un mismo documento, riesgo o evidencia puede cubrir requisitos de varias normas. Pulsa en la columna Evidencia para vincular o revisar la cobertura de un requisito.</p>}
    </div>
  );
}

function CorrespondenceTab({ payload }: { payload: StandardsEnginePayload }) {
  if (!payload.correspondence.length) return <Empty text="No hay correspondencias entre normas cargadas." />;
  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* La tabla plana de 170 filas no permitía ver dónde está la densidad.
          La matriz sí, y solo pinta los pares que existen de verdad. */}
      <CrosswalkMatrix correspondence={payload.correspondence} />
      <DataTable
      columns={correspondenceColumns}
      rows={payload.correspondence}
      rowKey={(m) => m.id}
        caption="Matriz de correspondencia entre normas: requisito de origen, requisito de destino, tipo de relación y porcentaje de equivalencia."
        storageKey="standards-correspondence"
      />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div style={card}><div style={{ fontSize: 12, color: "var(--nf-ink-3,#8794a5)", fontWeight: 600 }}>{label}</div><div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{value}{sub && <span style={{ fontSize: 13, color: "#5266F6", marginLeft: 6 }}>{sub}</span>}</div></div>;
}
function Bar({ pct }: { pct: number }) {
  return <div style={{ height: 7, background: "var(--nf-line,#e8edf5)", borderRadius: 8, marginTop: 10, overflow: "hidden" }}><div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: pct >= 70 ? "#16a34a" : "#5266F6" }} /></div>;
}
function Empty({ text }: { text: string }) {
  return <div style={{ ...card, textAlign: "center", color: "var(--nf-ink-3,#8794a5)", padding: 40 }}>{text}</div>;
}

const primaryBtn: React.CSSProperties = { background: "#5266F6", color: "#fff", border: "none", borderRadius: 9, padding: "7px 14px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" };
const ghostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", color: "#5266F6", border: "1px solid #cdd6f8", borderRadius: 9, padding: "8px 13px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" };
