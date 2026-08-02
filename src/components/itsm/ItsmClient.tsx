"use client";

import { useState, useTransition } from "react";
import {
  LayoutDashboard, Server, BookOpen, FileClock, Ticket, AlertOctagon,
  Bug, GitPullRequest, Boxes, Activity, Shield, Truck, ArrowRight, Check,
} from "lucide-react";
import type { ItsmPayload } from "@/lib/itsm/queries";
import {
  transitionItsmChange,
  transitionItsmIncident,
  transitionItsmProblem,
} from "@/lib/actions/itsm";
import {
  nextItsmChangeStatuses,
  nextItsmIncidentStatuses,
  nextItsmProblemStatuses,
} from "@/lib/itsm/workflows";
import type { ITSMChangeStatus, ITSMIncidentStatus, ITSMProblemStatus } from "@prisma/client";

type Tab =
  | "panel" | "catalog" | "sla" | "requests" | "incidents" | "problems"
  | "changes" | "cmdb" | "availability" | "suppliers" | "knowledge";

const card: React.CSSProperties = { border: "1px solid var(--nf-line, #e5eaf2)", borderRadius: 14, padding: 18, background: "var(--nf-surface, #fff)" };
const chip = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, display: "inline-block" });
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e5eaf2", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const miniBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 7, border: "1px solid #1d4ed8", background: "#eff6ff", color: "#1d4ed8", fontWeight: 600, fontSize: 12, cursor: "pointer", marginRight: 4 };
const fmt = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

export default function ItsmClient({ initial, demo = false }: { initial: ItsmPayload; demo?: boolean }) {
  const [tab, setTab] = useState<Tab>("panel");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const can = initial.can;
  const live = !demo;
  const s = initial.summary;

  const tabs: { id: Tab; label: string; Icon: typeof Server; badge?: number }[] = [
    { id: "panel", label: "Panel", Icon: LayoutDashboard },
    { id: "catalog", label: "Catálogo", Icon: BookOpen, badge: s.catalogEntries },
    { id: "sla", label: "SLA / OLA", Icon: FileClock, badge: s.activeSlas },
    { id: "requests", label: "Solicitudes", Icon: Ticket, badge: s.openRequests },
    { id: "incidents", label: "Incidentes", Icon: AlertOctagon, badge: s.openIncidents },
    { id: "problems", label: "Problemas", Icon: Bug, badge: s.openProblems },
    { id: "changes", label: "Cambios / Releases", Icon: GitPullRequest, badge: s.openChanges },
    { id: "cmdb", label: "CMDB", Icon: Boxes, badge: s.cis },
    { id: "availability", label: "Disp. / Cap. / Cont.", Icon: Activity },
    { id: "suppliers", label: "Proveedores", Icon: Truck },
    { id: "knowledge", label: "Conocimiento", Icon: Shield, badge: s.publishedArticles },
  ];

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Error inesperado."); }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#dbeafe", display: "grid", placeItems: "center" }}>
          <Server size={22} color="#1d4ed8" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Gestión de servicios TI (ITSM)</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
            ISO/IEC 20000 — catálogo, SLA, incidentes de servicio (no seguridad), problemas, cambios, CMDB y desempeño.
          </p>
        </div>
        {demo && <span style={{ ...chip("#eef2ff", "#4f46e5"), marginLeft: "auto" }}>Demo</span>}
      </header>

      {error && <div style={{ ...card, borderColor: "#fecaca", background: "#fef2f2", color: "#b91c1c" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12 }}>
        <Stat label="Servicios" value={s.services} />
        <Stat label="SLA activos" value={s.activeSlas} />
        <Stat label="Incidentes abiertos" value={s.openIncidents} accent={s.openIncidents ? "#dc2626" : undefined} />
        <Stat label="Problemas abiertos" value={s.openProblems} accent={s.openProblems ? "#d68a1a" : undefined} />
        <Stat label="Cambios abiertos" value={s.openChanges} />
        <Stat label="Incumplimientos SLA" value={s.slaBreaches} accent={s.slaBreaches ? "#dc2626" : undefined} />
      </div>

      <nav style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {tabs.map(({ id, label, Icon, badge }) => (
          <button key={id} onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, border: "1px solid " + (tab === id ? "#1d4ed8" : "#e5eaf2"), background: tab === id ? "#eff6ff" : "#fff", color: tab === id ? "#1d4ed8" : "#334155", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <Icon size={15} /> {label}
            {badge ? <span style={chip("#dbeafe", "#1d4ed8")}>{badge}</span> : null}
          </button>
        ))}
      </nav>

      {tab === "panel" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Catálogo y acuerdos (§8.2–8.3)</h3>
            <Row k="Servicios activos" v={s.services} />
            <Row k="Entradas de catálogo" v={s.catalogEntries} />
            <Row k="SLA activos" v={s.activeSlas} />
            <Row k="Solicitudes abiertas" v={s.openRequests} danger={s.openRequests > 0} />
          </div>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Resolución (§8.6)</h3>
            <Row k="Incidentes abiertos" v={s.openIncidents} danger={s.openIncidents > 0} />
            <Row k="Problemas abiertos" v={s.openProblems} danger={s.openProblems > 0} />
            <Row k="Incumplimientos SLA" v={s.slaBreaches} danger={s.slaBreaches > 0} />
            <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 12 }}>
              ITSMIncident ≠ SecurityIncident (ISO 27001). Workflow: NEW → ASSIGNED → INVESTIGATING → RESOLVED → CONFIRMED → CLOSED.
            </p>
          </div>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Transición y aseguramiento (§8.5–8.7)</h3>
            <Row k="Cambios abiertos" v={s.openChanges} />
            <Row k="Releases en curso" v={s.releasesOpen} />
            <Row k="CIs en uso" v={s.cis} />
            <Row k="Artículos publicados" v={s.publishedArticles} />
          </div>
        </div>
      )}

      {tab === "catalog" && (
        <div style={{ display: "grid", gap: 14 }}>
          <Table headers={["Código", "Servicio", "Criticidad", "Estado"]}>
            {initial.services.map((svc) => (
              <tr key={svc.id}>
                <td style={td}>{svc.code}</td>
                <td style={td}>{svc.name}</td>
                <td style={td}>{svc.criticality}</td>
                <td style={td}>{svc.status}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Código", "Entrada", "Servicio", "Solicitable", "Horas est."]}>
            {initial.catalog.map((c) => (
              <tr key={c.id}>
                <td style={td}>{c.code}</td>
                <td style={td}>{c.name}</td>
                <td style={td}>{c.service.code}</td>
                <td style={td}>{c.requestable ? "Sí" : "No"}</td>
                <td style={td}>{c.estimatedFulfillmentHours ?? "—"}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "sla" && (
        <div style={{ display: "grid", gap: 14 }}>
          <Table headers={["Código", "SLA", "Servicio", "Respuesta", "Resolución", "Disp. %", "Estado"]}>
            {initial.slas.map((sla) => (
              <tr key={sla.id}>
                <td style={td}>{sla.code}</td>
                <td style={td}>{sla.name}</td>
                <td style={td}>{sla.service.code}</td>
                <td style={td}>{sla.responseTimeMinutes} min</td>
                <td style={td}>{sla.resolutionTimeMinutes} min</td>
                <td style={td}>{sla.availabilityTargetPct ?? "—"}</td>
                <td style={td}>{sla.status}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Código", "OLA", "Servicio", "SLA", "Equipo"]}>
            {initial.olas.map((o) => (
              <tr key={o.id}>
                <td style={td}>{o.code}</td>
                <td style={td}>{o.name}</td>
                <td style={td}>{o.service.code}</td>
                <td style={td}>{o.sla?.code ?? "—"}</td>
                <td style={td}>{o.supportingTeam ?? "—"}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "requests" && (
        <Table headers={["Código", "Título", "Servicio", "Catálogo", "Prioridad", "Estado", "Vence"]}>
          {initial.requests.map((r) => (
            <tr key={r.id}>
              <td style={td}>{r.code}</td>
              <td style={td}>{r.title}</td>
              <td style={td}>{r.service?.code ?? "—"}</td>
              <td style={td}>{r.catalogEntry?.code ?? "—"}</td>
              <td style={td}>{r.priority}</td>
              <td style={td}>{r.status}</td>
              <td style={td}>{fmt(r.dueAt)}</td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "incidents" && (
        <Table headers={["Código", "Título", "Servicio", "Prioridad", "Estado", "SLA", "Acción"]}>
          {initial.incidents.map((inc) => {
            const next = nextItsmIncidentStatuses(inc.status as ITSMIncidentStatus)[0];
            return (
              <tr key={inc.id}>
                <td style={td}>{inc.code}</td>
                <td style={td}>{inc.title}</td>
                <td style={td}>{inc.service?.code ?? "—"}</td>
                <td style={td}>{inc.priority}</td>
                <td style={td}>
                  <span style={chip(inc.status === "CLOSED" ? "#dcfce7" : "#fee2e2", inc.status === "CLOSED" ? "#15803d" : "#b91c1c")}>{inc.status}</span>
                  {inc.slaEval?.overallMet === false && <span style={{ ...chip("#fef3c7", "#a16207"), marginLeft: 6 }}>SLA</span>}
                </td>
                <td style={td}>{inc.sla?.code ?? "—"}</td>
                <td style={td}>
                  {live && next && (can.update || can.approve) && (
                    <button disabled={pending} style={miniBtn} onClick={() => run(() => transitionItsmIncident(inc.id, next))}>
                      <ArrowRight size={12} /> {next}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      {tab === "problems" && (
        <div style={{ display: "grid", gap: 14 }}>
          <Table headers={["Código", "Título", "Estado", "Incidentes", "KE", "Acción"]}>
            {initial.problems.map((p) => {
              const next = nextItsmProblemStatuses(p.status as ITSMProblemStatus)[0];
              return (
                <tr key={p.id}>
                  <td style={td}>{p.code}</td>
                  <td style={td}>{p.title}</td>
                  <td style={td}>{p.status}</td>
                  <td style={td}>{p._count.incidents}</td>
                  <td style={td}>{p._count.knownErrors}</td>
                  <td style={td}>
                    {live && next && can.update && (
                      <button disabled={pending} style={miniBtn} onClick={() => run(() => transitionItsmProblem(p.id, next))}>
                        <ArrowRight size={12} /> {next}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
          <Table headers={["Código", "Error conocido", "Problema", "Workaround", "Estado"]}>
            {initial.knownErrors.map((k) => (
              <tr key={k.id}>
                <td style={td}>{k.code}</td>
                <td style={td}>{k.title}</td>
                <td style={td}>{k.problem?.code ?? "—"}</td>
                <td style={td}>{k.workaround ?? "—"}</td>
                <td style={td}>{k.status}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "changes" && (
        <div style={{ display: "grid", gap: 14 }}>
          <Table headers={["Código", "Cambio", "Tipo", "Estado", "Riesgo", "Acción"]}>
            {initial.changes.map((c) => {
              const next = nextItsmChangeStatuses(c.status as ITSMChangeStatus)[0];
              return (
                <tr key={c.id}>
                  <td style={td}>{c.code}</td>
                  <td style={td}>{c.title}</td>
                  <td style={td}>{c.changeType}</td>
                  <td style={td}>{c.status}</td>
                  <td style={td}>{c.riskLevel}</td>
                  <td style={td}>
                    {live && next && (can.update || can.approve) && (
                      <button disabled={pending} style={miniBtn} onClick={() => run(() => transitionItsmChange(c.id, next))}>
                        {next === "APPROVED" ? <Check size={12} /> : <ArrowRight size={12} />} {next}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
          <Table headers={["Código", "Release", "Versión", "Estado", "Despliegues"]}>
            {initial.releases.map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.code}</td>
                <td style={td}>{r.title}</td>
                <td style={td}>{r.version}</td>
                <td style={td}>{r.status}</td>
                <td style={td}>{r._count.deployments}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "cmdb" && (
        <div style={{ display: "grid", gap: 14 }}>
          <Table headers={["Código", "CI", "Tipo", "Servicio", "Estado", "Criticidad"]}>
            {initial.cis.map((ci) => (
              <tr key={ci.id}>
                <td style={td}>{ci.code}</td>
                <td style={td}>{ci.name}</td>
                <td style={td}>{ci.ciType}</td>
                <td style={td}>{ci.service?.code ?? "—"}</td>
                <td style={td}>{ci.status}</td>
                <td style={td}>{ci.criticality}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Código", "Origen", "Relación", "Destino"]}>
            {initial.relationships.map((rel) => (
              <tr key={rel.id}>
                <td style={td}>{rel.code}</td>
                <td style={td}>{rel.sourceCi.code}</td>
                <td style={td}>{rel.relationType}</td>
                <td style={td}>{rel.targetCi.code}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "availability" && (
        <div style={{ display: "grid", gap: 14 }}>
          <Table headers={["Código", "Disponibilidad", "Servicio", "Objetivo %", "Real %", "Estado"]}>
            {initial.availability.map((a) => (
              <tr key={a.id}>
                <td style={td}>{a.code}</td>
                <td style={td}>{a.title}</td>
                <td style={td}>{a.service.code}</td>
                <td style={td}>{a.targetPercent}</td>
                <td style={td}>{a.computedAvailability ?? a.actualAvailabilityPct ?? "—"}</td>
                <td style={td}>{a.status}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Código", "Capacidad", "Métrica", "Actual", "Pronóstico", "Umbral %"]}>
            {initial.capacity.map((c) => (
              <tr key={c.id}>
                <td style={td}>{c.code}</td>
                <td style={td}>{c.title}</td>
                <td style={td}>{c.metric}</td>
                <td style={td}>{c.currentCapacity ?? "—"}</td>
                <td style={td}>{c.forecastCapacity ?? "—"}</td>
                <td style={td}>{c.thresholdPercent ?? "—"}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Código", "Continuidad", "RTO", "RPO", "BCP", "Estado"]}>
            {initial.continuity.map((c) => (
              <tr key={c.id}>
                <td style={td}>{c.code}</td>
                <td style={td}>{c.title}</td>
                <td style={td}>{c.rtoMinutes ?? "—"} min</td>
                <td style={td}>{c.rpoMinutes ?? "—"} min</td>
                <td style={td}>{c.bcpId ?? "—"}</td>
                <td style={td}>{c.status}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "suppliers" && (
        <Table headers={["Código", "Proveedor", "Servicio", "Contrato", "Criticidad", "Estado"]}>
          {initial.suppliers.map((srow) => (
            <tr key={srow.id}>
              <td style={td}>{srow.code}</td>
              <td style={td}>{srow.name}</td>
              <td style={td}>{srow.service?.code ?? "—"}</td>
              <td style={td}>{srow.contractRef ?? "—"}</td>
              <td style={td}>{srow.criticality}</td>
              <td style={td}>{srow.status}</td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "knowledge" && (
        <Table headers={["Código", "Artículo", "Categoría", "Servicio", "Estado"]}>
          {initial.articles.map((a) => (
            <tr key={a.id}>
              <td style={td}>{a.code}</td>
              <td style={td}>{a.title}</td>
              <td style={td}>{a.category}</td>
              <td style={td}>{a.service?.code ?? "—"}</td>
              <td style={td}>{a.status}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ ...card, padding: 14 }}>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ?? "#0f172a" }}>{value}</div>
    </div>
  );
}

function Row({ k, v, danger }: { k: string; v: number | string; danger?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
      <span style={{ color: "#64748b" }}>{k}</span>
      <span style={{ fontWeight: 600, color: danger ? "#b91c1c" : "#0f172a" }}>{v}</span>
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div style={{ ...card, overflowX: "auto", padding: 0 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{headers.map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
