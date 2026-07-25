"use client";

import { useState, useTransition } from "react";
import { HardHat, Grid3x3, AlertOctagon, ClipboardList, ShieldCheck, FileWarning, Siren, Users, Stethoscope, LayoutDashboard, ArrowRight } from "lucide-react";
import type { SafetyPayload } from "@/lib/safety/queries";
import { transitionIncident } from "@/lib/actions/safety";

type Tab = "panel" | "hazards" | "incidents" | "inspections" | "ppe" | "permits" | "drills" | "contractors" | "health";

const LEVEL_COLORS: Record<string, string> = { LOW: "#16a34a", MEDIUM: "#d68a1a", MODERATE: "#d68a1a", HIGH: "#ea580c", CRITICAL: "#b91c1c" };
const SEV_COLORS: Record<string, string> = { LOW: "#16a34a", MEDIUM: "#d68a1a", HIGH: "#ea580c", CRITICAL: "#b91c1c" };
const ACCEPT_LABEL: Record<string, string> = { ACCEPTABLE: "Aceptable", TOLERABLE: "Tolerable", NOT_ACCEPTABLE: "No aceptable" };
const STATUS_LABEL: Record<string, string> = { REPORTED: "Reportado", CLASSIFIED: "Clasificado", INVESTIGATING: "Investigando", ROOT_CAUSE: "Causa raíz", ACTION_PLAN: "Plan de acción", IMPLEMENTED: "Implementado", EFFECTIVENESS_VERIFIED: "Eficacia verificada", CLOSED: "Cerrado" };

const card: React.CSSProperties = { border: "1px solid var(--nf-line, #e5eaf2)", borderRadius: 14, padding: 18, background: "var(--nf-surface, #fff)" };
const chip = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, display: "inline-block" });
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e5eaf2", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const fmt = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

export default function SafetyClient({ initial, demo = false }: { initial: SafetyPayload; demo?: boolean }) {
  const [tab, setTab] = useState<Tab>("panel");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const canManage = initial.canManage && !demo;
  const s = initial.summary;
  const ind = initial.indicators;

  const tabs: { id: Tab; label: string; Icon: typeof HardHat }[] = [
    { id: "panel", label: "Panel", Icon: LayoutDashboard },
    { id: "hazards", label: "Peligros y riesgos", Icon: Grid3x3 },
    { id: "incidents", label: "Incidentes", Icon: AlertOctagon },
    { id: "inspections", label: "Inspecciones", Icon: ClipboardList },
    { id: "ppe", label: "EPP", Icon: ShieldCheck },
    { id: "permits", label: "Permisos", Icon: FileWarning },
    { id: "drills", label: "Emergencias", Icon: Siren },
    { id: "contractors", label: "Contratistas", Icon: Users },
    { id: "health", label: "Vigilancia salud", Icon: Stethoscope },
  ];

  function nextOf(status: string): string | null {
    const i = initial.incidentFlow.indexOf(status as never);
    return i >= 0 && i < initial.incidentFlow.length - 1 ? initial.incidentFlow[i + 1] : null;
  }
  function advance(id: string, to: string) {
    setError(null);
    startTransition(async () => {
      try { await transitionIncident(id, { to: to as never }); } catch (e) { setError(e instanceof Error ? e.message : "Error inesperado."); }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fef3c7", display: "grid", placeItems: "center" }}><HardHat size={22} color="#b45309" /></div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Seguridad y Salud en el Trabajo</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>ISO 45001:2018 — peligros, riesgos, incidentes, EPP, permisos, emergencias e indicadores.</p>
        </div>
        {demo && <span style={{ ...chip("#eef2ff", "#4f46e5"), marginLeft: "auto" }}>Demo</span>}
      </header>

      {error && <div style={{ ...card, borderColor: "#fecaca", background: "#fef2f2", color: "#b91c1c" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
        <Stat label="Peligros" value={s.hazards} />
        <Stat label="Riesgos críticos" value={s.criticalRisks} accent={s.criticalRisks ? "#b91c1c" : undefined} />
        <Stat label="Incidentes abiertos" value={s.openIncidents} accent={s.openIncidents ? "#ea580c" : undefined} />
        <Stat label="Casi accidentes" value={s.nearMisses} />
        <Stat label="Permisos activos" value={s.permits} />
        <Stat label="Acciones vencidas" value={s.overdueActions} accent={s.overdueActions ? "#b91c1c" : undefined} />
      </div>

      <nav style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, border: "1px solid " + (tab === id ? "#b45309" : "#e5eaf2"), background: tab === id ? "#fffbeb" : "#fff", color: tab === id ? "#92400e" : "#334155", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>

      {tab === "panel" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Indicadores de seguridad (año en curso)</h3>
            <Row k="Índice de frecuencia (IF)" v={ind.frequencyIndex} />
            <Row k="Índice de gravedad (IG)" v={ind.severityIndex} />
            <Row k="Índice de accidentabilidad" v={ind.accidentRate} />
            <Row k="Días perdidos" v={ind.lostDays} />
            <Row k="Casi accidentes" v={ind.nearMisses} />
            <Row k="Inspecciones" v={ind.inspections} />
            <Row k="Acciones vencidas" v={ind.overdueActions} danger={ind.overdueActions > 0} />
            <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 12 }}>IF/IG requieren horas-hombre; configúralas al exportar el informe de indicadores.</p>
          </div>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Incidentes por etapa</h3>
            {initial.incidentFlow.map((st) => (
              <div key={st} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
                <span>{STATUS_LABEL[st] ?? st}</span><b>{initial.incidentsByStatus[st] ?? 0}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "hazards" && (
        <Table head={["Código", "Actividad", "Tarea", "Peligro", "Categoría", "Expuestos", "N. inherente", "N. residual", "Aceptabilidad"]}>
          {initial.hazards.map((h) => (
            <tr key={h.id}>
              <td style={td}>{h.code}</td><td style={td}>{h.activity}</td><td style={td}>{h.task ?? "—"}</td><td style={td}>{h.hazard}</td><td style={td}>{h.category}</td><td style={td}>{h.exposedWorkers ?? "—"}</td>
              <td style={td}>{h.inherentLevel ? <span style={chip(LEVEL_COLORS[h.inherentLevel] + "22", LEVEL_COLORS[h.inherentLevel])}>{h.inherentLevel}</span> : "—"}</td>
              <td style={td}>{h.residualLevel ? <span style={chip(LEVEL_COLORS[h.residualLevel] + "22", LEVEL_COLORS[h.residualLevel])}>{h.residualLevel}</span> : "—"}</td>
              <td style={td}>{h.acceptability ? (h.acceptability === "NOT_ACCEPTABLE" ? <span style={chip("#fee2e2", "#b91c1c")}>{ACCEPT_LABEL[h.acceptability]}</span> : ACCEPT_LABEL[h.acceptability]) : "—"}</td>
            </tr>
          ))}
          {initial.hazards.length === 0 && <tr><td style={td} colSpan={9}>Sin peligros registrados.</td></tr>}
        </Table>
      )}

      {tab === "incidents" && (
        <Table head={["Código", "Tipo", "Severidad", "Título", "Fecha", "Días perd.", "Estado", canManage ? "Avanzar" : ""].filter(Boolean) as string[]}>
          {initial.incidents.map((i) => {
            const next = nextOf(i.status);
            return (
              <tr key={i.id}>
                <td style={td}>{i.code}</td><td style={td}>{i.type}</td>
                <td style={td}><span style={chip(SEV_COLORS[i.severity] + "22", SEV_COLORS[i.severity])}>{i.severity}</span></td>
                <td style={td}>{i.title}</td><td style={td}>{fmt(i.occurredAt)}</td><td style={td}>{i.lostDays}</td>
                <td style={td}><span style={chip("#eef2ff", "#4338ca")}>{STATUS_LABEL[i.status] ?? i.status}</span></td>
                {canManage && <td style={td}>{next ? <button disabled={pending} onClick={() => advance(i.id, next)} style={miniBtn}><ArrowRight size={12} /> {STATUS_LABEL[next]}</button> : <span style={{ color: "#94a3b8" }}>Cerrado</span>}</td>}
              </tr>
            );
          })}
          {initial.incidents.length === 0 && <tr><td style={td} colSpan={canManage ? 8 : 7}>Sin incidentes registrados.</td></tr>}
        </Table>
      )}

      {tab === "inspections" && (
        <Table head={["Código", "Tipo", "Área", "Fecha", "Hallazgos"]}>
          {initial.inspections.map((i) => (<tr key={i.id}><td style={td}>{i.code}</td><td style={td}>{i.type}</td><td style={td}>{i.area ?? "—"}</td><td style={td}>{fmt(i.inspectedAt)}</td><td style={td}>{i.findings ?? "—"}</td></tr>))}
          {initial.inspections.length === 0 && <tr><td style={td} colSpan={5}>Sin inspecciones.</td></tr>}
        </Table>
      )}

      {tab === "ppe" && (
        <Table head={["Código", "EPP", "Tipo", "Norma técnica", "Vida útil (m)", "Asignaciones"]}>
          {initial.ppeItems.map((p) => (<tr key={p.id}><td style={td}>{p.code}</td><td style={td}>{p.name}</td><td style={td}>{p.ppeType}</td><td style={td}>{p.technicalStandard ?? "—"}</td><td style={td}>{p.lifespanMonths ?? "—"}</td><td style={td}>{p.assignments}</td></tr>))}
          {initial.ppeItems.length === 0 && <tr><td style={td} colSpan={6}>Sin EPP registrado.</td></tr>}
        </Table>
      )}

      {tab === "permits" && (
        <Table head={["Código", "Tipo de trabajo", "Área", "Estado", "Vigencia hasta"]}>
          {initial.permits.map((p) => (<tr key={p.id}><td style={td}>{p.code}</td><td style={td}>{p.workType}</td><td style={td}>{p.area ?? "—"}</td><td style={td}><span style={chip("#eef2ff", "#4338ca")}>{p.status}</span></td><td style={td}>{fmt(p.validTo)}</td></tr>))}
          {initial.permits.length === 0 && <tr><td style={td} colSpan={5}>Sin permisos.</td></tr>}
        </Table>
      )}

      {tab === "drills" && (
        <Table head={["Código", "Escenario", "Resultado", "T. respuesta (min)", "Fecha"]}>
          {initial.drills.map((d) => (<tr key={d.id}><td style={td}>{d.code}</td><td style={td}>{d.scenario}</td><td style={td}>{d.outcome ?? "—"}</td><td style={td}>{d.responseTimeMinutes ?? "—"}</td><td style={td}>{fmt(d.drillDate)}</td></tr>))}
          {initial.drills.length === 0 && <tr><td style={td} colSpan={5}>Sin simulacros.</td></tr>}
        </Table>
      )}

      {tab === "contractors" && (
        <Table head={["Código", "Contratista", "Evaluación", "Incidentes", "Próxima revisión"]}>
          {initial.contractors.map((c) => (<tr key={c.id}><td style={td}>{c.code}</td><td style={td}>{c.contractorName ?? "—"}</td><td style={td}>{c.outcome}</td><td style={td}>{c.incidents}</td><td style={td}>{fmt(c.nextReviewDate)}</td></tr>))}
          {initial.contractors.length === 0 && <tr><td style={td} colSpan={5}>Sin evaluaciones de contratistas.</td></tr>}
        </Table>
      )}

      {tab === "health" && (
        <Table head={["Código", "Trabajador", "Aptitud", "Próxima revisión"]}>
          {initial.surveillance.map((h) => (<tr key={h.id}><td style={td}>{h.code}</td><td style={td}>{h.workerName ?? "—"}</td><td style={td}>{h.fitness}</td><td style={td}>{fmt(h.nextReviewDate)}</td></tr>))}
          {initial.surveillance.length === 0 && <tr><td style={td} colSpan={4}>Sin vigilancia de salud.</td></tr>}
        </Table>
      )}
    </div>
  );
}

const miniBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 7, border: "1px solid #b45309", background: "#fffbeb", color: "#92400e", fontWeight: 600, fontSize: 12, cursor: "pointer" };

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (<div style={{ ...card, padding: 14 }}><div style={{ fontSize: 26, fontWeight: 800, color: accent ?? "#0f172a" }}>{value}</div><div style={{ fontSize: 12, color: "#64748b" }}>{label}</div></div>);
}
function Row({ k, v, danger }: { k: string; v: number; danger?: boolean }) {
  return (<div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}><span>{k}</span><b style={{ color: danger ? "#b91c1c" : "#0f172a" }}>{v}</b></div>);
}
function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div style={card}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{head.map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}
