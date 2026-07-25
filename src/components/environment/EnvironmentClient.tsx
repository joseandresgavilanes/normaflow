"use client";

import { useState, useTransition } from "react";
import { Leaf, Grid3x3, Scale, Target, BarChart3, Trash2, Siren, LayoutDashboard } from "lucide-react";
import type { EnvironmentPayload } from "@/lib/environmental/queries";
import {
  createAspect, createImpact, createObligation, createComplianceEvaluation,
  createObjective, createWasteStream, createEmergencyScenario, createSignificanceMethod,
} from "@/lib/actions/environment";

type Tab = "panel" | "matrix" | "compliance" | "objectives" | "trends" | "waste" | "emergencies";

const LEVEL_COLORS: Record<string, string> = {
  LOW: "#16a34a", MODERATE: "#d68a1a", HIGH: "#ea580c", CRITICAL: "#b91c1c",
};
const CONDITION_LABEL: Record<string, string> = { NORMAL: "Normal", ABNORMAL: "Anormal", EMERGENCY: "Emergencia" };
const WASTE_LABEL: Record<string, string> = { NON_HAZARDOUS: "No peligroso", HAZARDOUS: "Peligroso", RECYCLABLE: "Reciclable", INERT: "Inerte", SPECIAL: "Especial" };

const card: React.CSSProperties = { border: "1px solid var(--nf-line, #e5eaf2)", borderRadius: 14, padding: 18, background: "var(--nf-surface, #fff)" };
const chip = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, display: "inline-block" });
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e5eaf2", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const fmt = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

export default function EnvironmentClient({ initial, demo = false }: { initial: EnvironmentPayload; demo?: boolean }) {
  const [tab, setTab] = useState<Tab>("panel");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const canManage = initial.canManage && !demo;

  const tabs: { id: Tab; label: string; Icon: typeof Leaf }[] = [
    { id: "panel", label: "Panel", Icon: LayoutDashboard },
    { id: "matrix", label: "Aspectos e impactos", Icon: Grid3x3 },
    { id: "compliance", label: "Cumplimiento legal", Icon: Scale },
    { id: "objectives", label: "Objetivos", Icon: Target },
    { id: "trends", label: "Indicadores", Icon: BarChart3 },
    { id: "waste", label: "Residuos", Icon: Trash2 },
    { id: "emergencies", label: "Emergencias", Icon: Siren },
  ];

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Error inesperado."); }
    });
  }

  const s = initial.summary;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#dcfce7", display: "grid", placeItems: "center" }}>
          <Leaf size={22} color="#16a34a" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Gestión Ambiental</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>ISO 14001:2015 — aspectos, cumplimiento, objetivos, indicadores y emergencias.</p>
        </div>
        {demo && <span style={{ ...chip("#eef2ff", "#4f46e5"), marginLeft: "auto" }}>Demo</span>}
      </header>

      {error && <div style={{ ...card, borderColor: "#fecaca", background: "#fef2f2", color: "#b91c1c" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
        <Stat label="Aspectos" value={s.aspects} />
        <Stat label="Impactos" value={s.impacts} />
        <Stat label="Significativos" value={s.significant} accent="#b91c1c" />
        <Stat label="Obligaciones" value={s.obligations} />
        <Stat label="Vencidas" value={s.overdue} accent={s.overdue ? "#b91c1c" : undefined} />
        <Stat label="Objetivos" value={s.objectives} />
      </div>

      <nav style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, border: "1px solid " + (tab === id ? "#16a34a" : "#e5eaf2"), background: tab === id ? "#f0fdf4" : "#fff", color: tab === id ? "#166534" : "#334155", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>

      {tab === "panel" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Metodología de significancia</h3>
            {initial.methods.length === 0 && <p style={{ color: "#64748b" }}>Sin metodología definida.</p>}
            {initial.methods.map((m) => (
              <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
                <span>{m.name} <span style={{ color: "#94a3b8" }}>v{m.version}</span></span>
                <span>{m.active ? <span style={chip("#dcfce7", "#166534")}>activa</span> : <span style={chip("#f1f5f9", "#64748b")}>histórico</span>}</span>
              </div>
            ))}
            {canManage && (
              <button disabled={pending} style={btn} onClick={() => run(() => createSignificanceMethod({ name: "Método de significancia ambiental", formula: "WEIGHTED_SUM", weights: { severity: 2, frequency: 1, scope: 1 }, threshold: 12 }))}>
                + Nueva versión de metodología
              </button>
            )}
          </div>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Cumplimiento</h3>
            <p style={{ margin: "4px 0" }}>Obligaciones vencidas: <b style={{ color: s.overdue ? "#b91c1c" : "#166534" }}>{s.overdue}</b></p>
            <p style={{ margin: "4px 0" }}>No conformes / parciales: <b style={{ color: s.nonCompliant ? "#b91c1c" : "#166534" }}>{s.nonCompliant}</b></p>
            <p style={{ margin: "4px 0", color: "#64748b" }}>Residuos: {s.waste} · Escenarios de emergencia: {s.emergencies}</p>
          </div>
        </div>
      )}

      {tab === "matrix" && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Matriz de aspectos e impactos</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={th}>Código</th><th style={th}>Actividad</th><th style={th}>Condición</th><th style={th}>Ciclo de vida</th>
                <th style={th}>Impacto</th><th style={th}>S/F/A</th><th style={th}>Valor</th><th style={th}>Nivel</th><th style={th}>Significativo</th>
              </tr></thead>
              <tbody>
                {initial.aspects.flatMap((a) => (a.impacts.length ? a.impacts : [null]).map((i, k) => (
                  <tr key={a.id + "-" + k}>
                    <td style={td}>{a.code}</td>
                    <td style={td}>{a.activity}</td>
                    <td style={td}>{CONDITION_LABEL[a.condition] ?? a.condition}</td>
                    <td style={td}>{a.lifeCycleStage ?? "—"}</td>
                    <td style={td}>{i?.impactType ?? "—"}</td>
                    <td style={td}>{i ? `${i.severity}/${i.frequency}/${i.scope}` : "—"}</td>
                    <td style={td}>{i?.score ?? "—"}</td>
                    <td style={td}>{i ? <span style={chip(LEVEL_COLORS[i.level] + "22", LEVEL_COLORS[i.level])}>{i.level}</span> : "—"}</td>
                    <td style={td}>{i?.significant ? <span style={chip("#fee2e2", "#b91c1c")}>Sí</span> : "No"}</td>
                  </tr>
                )))}
                {initial.aspects.length === 0 && <tr><td style={td} colSpan={9}>Sin aspectos registrados.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "compliance" && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Obligaciones legales y evaluación del cumplimiento</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={th}>Código</th><th style={th}>Fuente</th><th style={th}>Obligación</th><th style={th}>Últ. resultado</th>
                <th style={th}>Próx. revisión</th><th style={th}>Estado</th>
              </tr></thead>
              <tbody>
                {initial.obligations.map((o) => (
                  <tr key={o.id}>
                    <td style={td}>{o.code}</td>
                    <td style={td}>{o.source}</td>
                    <td style={td}>{o.obligation}</td>
                    <td style={td}>{o.lastResult ?? "Sin evaluar"}</td>
                    <td style={td}>{fmt(o.reviewDate)}</td>
                    <td style={td}>
                      {o.overdue && <span style={{ ...chip("#fee2e2", "#b91c1c"), marginRight: 4 }}>Vencido</span>}
                      {o.nonCompliant && <span style={chip("#fef3c7", "#92400e")}>Incumple</span>}
                      {!o.overdue && !o.nonCompliant && <span style={chip("#dcfce7", "#166534")}>Al día</span>}
                    </td>
                  </tr>
                ))}
                {initial.obligations.length === 0 && <tr><td style={td} colSpan={6}>Sin obligaciones registradas.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "objectives" && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Objetivos y programas ambientales</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={th}>Código</th><th style={th}>Objetivo</th><th style={th}>Línea base</th><th style={th}>Meta</th>
                <th style={th}>Estado</th><th style={th}>Avance</th><th style={th}>Programas</th>
              </tr></thead>
              <tbody>
                {initial.objectives.map((o) => (
                  <tr key={o.id}><td style={td}>{o.code}</td><td style={td}>{o.objective}</td><td style={td}>{o.baseline ?? "—"}</td><td style={td}>{o.target ?? "—"}</td><td style={td}>{o.status}</td><td style={td}>{o.progress}%</td><td style={td}>{o.programs}</td></tr>
                ))}
                {initial.objectives.length === 0 && <tr><td style={td} colSpan={7}>Sin objetivos registrados.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "trends" && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Indicadores ambientales y tendencias</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={th}>Periodo</th><th style={th}>Agua</th><th style={th}>Energía</th><th style={th}>Combustible</th>
                <th style={th}>Emisiones</th><th style={th}>Vertidos</th><th style={th}>Residuos</th><th style={th}>Materias primas</th>
              </tr></thead>
              <tbody>
                {initial.trends.map((t) => (
                  <tr key={t.period}><td style={td}>{t.period}</td><td style={td}>{t.water}</td><td style={td}>{t.energy}</td><td style={td}>{t.fuel}</td><td style={td}>{t.emissions}</td><td style={td}>{t.discharges}</td><td style={td}>{t.waste}</td><td style={td}>{t.rawMaterials}</td></tr>
                ))}
                {initial.trends.length === 0 && <tr><td style={td} colSpan={8}>Sin indicadores registrados.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "waste" && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Flujos de residuos</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={th}>Código</th><th style={th}>Tipo</th><th style={th}>Clasificación</th><th style={th}>Cantidad</th>
                <th style={th}>Gestor</th><th style={th}>Disposición</th><th style={th}>Manifiesto</th>
              </tr></thead>
              <tbody>
                {initial.waste.map((w) => (
                  <tr key={w.id}><td style={td}>{w.code}</td><td style={td}>{w.wasteType}</td><td style={td}>{WASTE_LABEL[w.classification] ?? w.classification}</td><td style={td}>{w.quantity ?? "—"} {w.unit ?? ""}</td><td style={td}>{w.managerName ?? "—"}</td><td style={td}>{w.disposition ?? "—"}</td><td style={td}>{w.manifest ?? "—"}</td></tr>
                ))}
                {initial.waste.length === 0 && <tr><td style={td} colSpan={7}>Sin residuos registrados.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "emergencies" && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Escenarios de emergencia ambiental</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={th}>Código</th><th style={th}>Escenario</th><th style={th}>Último simulacro</th><th style={th}>Próximo simulacro</th>
              </tr></thead>
              <tbody>
                {initial.emergencies.map((e) => (
                  <tr key={e.id}><td style={td}>{e.code}</td><td style={td}>{e.scenario}</td><td style={td}>{fmt(e.lastDrillAt)}</td><td style={td}>{fmt(e.nextDrillAt)}</td></tr>
                ))}
                {initial.emergencies.length === 0 && <tr><td style={td} colSpan={4}>Sin escenarios registrados.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const btn: React.CSSProperties = { marginTop: 12, padding: "8px 12px", borderRadius: 9, border: "1px solid #16a34a", background: "#f0fdf4", color: "#166534", fontWeight: 600, fontSize: 13, cursor: "pointer" };

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ ...card, padding: 14 }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent ?? "#0f172a" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
    </div>
  );
}
