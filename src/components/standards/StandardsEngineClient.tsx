"use client";

import { useMemo, useState, useTransition } from "react";
import { Library, ShieldCheck, GitCompareArrows, Grid3x3, LayoutDashboard, Check, Download } from "lucide-react";
import type { StandardsEnginePayload } from "@/lib/standards-engine";
import { activateStandard } from "@/lib/actions/standards";
import { installStandardPack } from "@/lib/actions/standard-packs";

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
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <Library size={26} /> Motor de Normas ISO
        </h1>
        <p style={{ color: "var(--nf-ink-2, #5e6b7a)", margin: "6px 0 0", fontSize: 14 }}>
          Instala paquetes normativos, actívalos por organización y gestiona requisitos, correspondencias y evidencia compartida entre normas.
          {demo && <strong style={{ color: "#5266F6" }}> · Vista demo (solo lectura).</strong>}
        </p>
      </header>

      {error && <div role="alert" style={{ ...card, borderColor: "#f2b8b8", background: "#fdf3f3", color: "#b91c1c", marginBottom: 16 }}>{error}</div>}

      <nav style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20, borderBottom: "1px solid var(--nf-line, #e5eaf2)" }}>
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            display: "flex", alignItems: "center", gap: 7, padding: "10px 14px", border: "none", background: "none",
            borderBottom: tab === id ? "2px solid #5266F6" : "2px solid transparent", color: tab === id ? "#5266F6" : "var(--nf-ink-2, #5e6b7a)",
            fontWeight: 700, fontSize: 13.5, cursor: "pointer", marginBottom: -1,
          }}><Icon size={16} /> {label}</button>
        ))}
      </nav>

      {tab === "panel" && <PanelTab payload={initial} />}
      {tab === "catalog" && <CatalogTab payload={initial} pending={pending} demo={demo} onActivate={(familyCode, editionCode) => run(() => activateStandard({ familyCode, editionCode }))} onInstall={(code) => run(() => installStandardPack(code))} />}
      {tab === "active" && <ActiveTab payload={initial} />}
      {tab === "matrix" && (
        <MatrixTab
          payload={initial} currentMatrix={currentMatrix} rows={filteredReqs}
          matrixEdition={matrixEdition} setMatrixEdition={setMatrixEdition}
          levelFilter={levelFilter} setLevelFilter={setLevelFilter} onlyGaps={onlyGaps} setOnlyGaps={setOnlyGaps}
        />
      )}
      {tab === "correspondence" && <CorrespondenceTab payload={initial} />}
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

function ActiveTab({ payload }: { payload: StandardsEnginePayload }) {
  if (!payload.active.length) return <Empty text="No hay normas activas para esta organización." />;
  return (
    <div className="nf-data-table-wrap" style={{ overflowX: "auto" }}>
      <table className="nf-data-table" style={{ width: "100%", minWidth: 720 }}>
        <thead><tr><th>Norma</th><th>Alcance</th><th>Responsable</th><th>Estado</th><th>GAP</th><th>Próx. auditoría</th></tr></thead>
        <tbody>
          {payload.active.map((a) => (
            <tr key={a.orgStandardId}>
              <td><strong>{a.name} {a.editionCode}</strong></td>
              <td style={{ maxWidth: 260, color: "var(--nf-ink-2,#5e6b7a)" }}>{a.scope ?? "—"}</td>
              <td>{a.responsibleName ?? "—"}</td>
              <td><span style={chip("#eef1fe", "#5266F6")}>{a.implementationStatus}</span></td>
              <td>{a.score == null ? "—" : `${Math.round(a.score)}%`}</td>
              <td>{a.nextAuditDate ? new Date(a.nextAuditDate).toLocaleDateString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatrixTab({ payload, currentMatrix, rows, matrixEdition, setMatrixEdition, levelFilter, setLevelFilter, onlyGaps, setOnlyGaps }: {
  payload: StandardsEnginePayload; currentMatrix?: StandardsEnginePayload["matrix"][number]; rows: StandardsEnginePayload["matrix"][number]["requirements"];
  matrixEdition: string; setMatrixEdition: (v: string) => void; levelFilter: number; setLevelFilter: (v: number) => void; onlyGaps: boolean; setOnlyGaps: (v: boolean) => void;
}) {
  if (!payload.matrix.length) return <Empty text="Activa al menos una norma para ver su matriz de requisitos." />;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <select value={matrixEdition} onChange={(e) => setMatrixEdition(e.target.value)} className="nf-app-input" style={{ maxWidth: 260 }}>
          {payload.matrix.map((m) => <option key={m.editionId} value={m.editionId}>{m.label}</option>)}
        </select>
        <select value={levelFilter} onChange={(e) => setLevelFilter(Number(e.target.value))} className="nf-app-input" style={{ maxWidth: 160 }}>
          <option value={0}>Todos los niveles</option><option value={1}>Nivel 1 (capítulo)</option><option value={2}>Nivel 2</option><option value={3}>Nivel 3</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--nf-ink-2,#5e6b7a)" }}>
          <input type="checkbox" checked={onlyGaps} onChange={(e) => setOnlyGaps(e.target.checked)} /> Solo brechas
        </label>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--nf-ink-3,#8794a5)" }}>{rows.length} requisitos</span>
      </div>
      <div className="nf-data-table-wrap" style={{ overflowX: "auto" }}>
        <table className="nf-data-table" style={{ width: "100%", minWidth: 640 }}>
          <thead><tr><th>Código</th><th>Requisito</th><th>Oblig.</th><th>Estado GAP</th><th>Evidencia</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.code}</strong></td>
                <td style={{ paddingLeft: (r.level - 1) * 14 }}>{r.title}</td>
                <td>{r.mandatory ? "Sí" : "No"}</td>
                <td><span style={chip((GAP_COLORS[r.gapStatus ?? "NOT_EVALUATED"] ?? "#c3ccd8") + "22", GAP_COLORS[r.gapStatus ?? "NOT_EVALUATED"] ?? "#8794a5")}>{r.gapStatus ?? "—"}</span></td>
                <td>{r.coverageCount > 0 ? <span style={chip("#eafaf0", "#16a34a")}>{r.coverageCount} elemento(s)</span> : <span style={{ color: "var(--nf-ink-3,#8794a5)" }}>—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {currentMatrix && <p style={{ fontSize: 12, color: "var(--nf-ink-3,#8794a5)" }}>Un mismo documento, riesgo o evidencia puede cubrir requisitos de varias normas: la columna Evidencia refleja la cobertura compartida.</p>}
    </div>
  );
}

function CorrespondenceTab({ payload }: { payload: StandardsEnginePayload }) {
  if (!payload.correspondence.length) return <Empty text="No hay correspondencias entre normas cargadas." />;
  return (
    <div className="nf-data-table-wrap" style={{ overflowX: "auto" }}>
      <table className="nf-data-table" style={{ width: "100%", minWidth: 760 }}>
        <thead><tr><th>Norma origen</th><th>Requisito</th><th></th><th>Norma destino</th><th>Requisito</th><th>Relación</th><th>Equiv.</th></tr></thead>
        <tbody>
          {payload.correspondence.map((m) => (
            <tr key={m.id}>
              <td><span style={chip("#eef1fe", "#5266F6")}>{m.sourceFamily}</span></td>
              <td><strong>{m.sourceCode}</strong> {m.sourceTitle}</td>
              <td style={{ textAlign: "center", color: "#8794a5" }}>→</td>
              <td><span style={chip("#eef1fe", "#5266F6")}>{m.targetFamily}</span></td>
              <td><strong>{m.targetCode}</strong> {m.targetTitle}</td>
              <td>{m.relationType}</td>
              <td>{m.equivalencePercent == null ? "—" : `${m.equivalencePercent}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
