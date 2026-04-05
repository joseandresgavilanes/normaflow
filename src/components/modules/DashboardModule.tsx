"use client";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import { DEMO_INDICATORS, DEMO_ACTIVITY, DEMO_ACTIONS, DEMO_RISKS } from "@/lib/demo-data";
import type { DashboardPayload } from "@/lib/server-queries";
import { useWorkspace } from "@/context/WorkspaceStore";

function avgGap(rows: { score: number }[]) {
  if (!rows.length) return 0;
  return Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length);
}

export default function DashboardModule({
  orgName: orgNameProp = "Tecnoserv Industrial S.A.",
  live,
}: {
  orgName?: string;
  live?: DashboardPayload | null;
}) {
  const { state } = useWorkspace();
  const today = new Date().toISOString().slice(0, 10);
  const in60 = new Date();
  in60.setDate(in60.getDate() + 60);
  const horizon = in60.toISOString().slice(0, 10);

  const overdueDemo = DEMO_ACTIONS.filter(
    a => a.status !== "COMPLETED" && a.priority === "CRITICAL" && a.due < today
  ).length;
  const overdueWs = state.actions.filter(
    a => a.status !== "COMPLETED" && a.priority === "CRITICAL" && a.due < today
  ).length;

  const criticalDemo = DEMO_RISKS.filter(r => r.score >= 15).length;
  const criticalWs = state.risks.filter(r => r.score >= 15).length;

  const docsReviewWs = state.documents.filter(d => d.status === "IN_REVIEW" || d.status === "DRAFT").length;
  const auditsSoonWs = state.audits.filter(
    a => (a.status === "PLANNED" || a.status === "IN_PROGRESS") && a.date <= horizon
  ).length;
  const openNcsWs = state.nonconformities.filter(n => n.status !== "CLOSED").length;

  const iso9001Ws = avgGap(state.gapIso9001);
  const iso27001Ws = avgGap(state.gapIso27001);
  const globalWs = Math.round((iso9001Ws + iso27001Ws) / 2);

  const unreadWs = state.notifications.filter(n => !n.read).length;

  const overdue = live ? live.overdueCritical : overdueWs || overdueDemo || 1;
  const criticalRisks = live ? live.criticalRisks : criticalWs || criticalDemo;
  const docsPending = live?.documentsInReview ?? docsReviewWs;
  const auditsSoon = live?.auditsUpcoming ?? Math.max(auditsSoonWs, 1);
  const openNcs = live?.openNcs ?? openNcsWs;

  const globalPct = live?.globalPct ?? globalWs;
  const iso9001Pct = live?.iso9001Pct ?? iso9001Ws;
  const iso27001Pct = live?.iso27001Pct ?? iso27001Ws;

  const indicators =
    live && live.indicatorRows.length > 0
      ? live.indicatorRows.map(row => ({
          id: row.id,
          name: row.name,
          value: row.value,
          target: row.target,
          unit: row.unit,
          status: row.status as "ON_TRACK" | "AT_RISK" | "OFF_TRACK",
        }))
      : state.indicators.length > 0
        ? state.indicators.map(d => ({
            id: d.id,
            name: d.name,
            value: d.value,
            target: d.target,
            unit: d.unit,
            status: d.status,
          }))
        : DEMO_INDICATORS.map(d => ({
            id: d.id,
            name: d.name,
            value: d.value,
            target: d.target,
            unit: d.unit,
            status: d.status,
          }));

  const npsRow = indicators.find(i => i.name.toLowerCase().includes("nps")) ?? indicators[0];
  const npsDisplay = npsRow ? `${Math.round(npsRow.value)}${npsRow.unit}` : "72 pts";

  const gapPct = globalPct;
  const pendingActions = live?.pendingActions ?? state.actions.filter(a => a.status !== "COMPLETED").length;

  const activityRows =
    state.activityFeed.length > 0
      ? state.activityFeed
      : DEMO_ACTIVITY.map(a => ({ ...a, user: a.user, action: a.action, object: a.object, time: a.time }));

  const upcomingActions = [...state.actions]
    .filter(a => a.status !== "COMPLETED")
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 4);

  const trainTotal = state.trainingAssignments.length;
  const trainDone = state.trainingAssignments.filter(a => a.status === "COMPLETED").length;
  const trainPct = trainTotal ? Math.round((trainDone / trainTotal) * 100) : 100;
  const trainOverdue = state.trainingAssignments.filter(a => a.status === "OVERDUE" || a.status === "RETRAINING_REQUIRED").length;
  const changesOpen = state.changeRequests.filter(c => !["CLOSED", "REJECTED"].includes(c.status)).length;
  const supCritical = state.suppliers.filter(s => s.criticality === "CRITICAL" || s.criticality === "HIGH").length;
  const ob = state.onboardingChecklist;
  const readinessPct = ob.length ? Math.round((ob.filter(x => x.done).reduce((s, x) => s + x.weight, 0) / ob.reduce((s, x) => s + x.weight, 0)) * 100) : 0;
  const docsReviewDueSoon = state.documents.filter(d => d.reviewDue && d.reviewDue <= horizon && d.status === "APPROVED").length;

  const orgName = live ? orgNameProp : state.session.orgName;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#142033", margin: "0 0 4px" }}>Panel de Control</h1>
        <p style={{ fontSize: 14, color: "#5E6B7A", margin: 0 }}>
          {orgName} · {new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {!live && unreadWs > 0 && (
        <Link
          href="/app/notifications"
          style={{
            display: "block",
            marginBottom: 16,
            textDecoration: "none",
            borderRadius: 12,
            padding: "12px 16px",
            background: "linear-gradient(90deg, rgba(18,60,102,0.08), rgba(214,138,26,0.12))",
            border: "1px solid #E5EAF2",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: "#123C66" }}>
            Tiene {unreadWs} notificación{unreadWs > 1 ? "es" : ""} sin leer
          </span>
          <span style={{ fontSize: 13, color: "#5E6B7A", marginLeft: 8 }}>— Abrir centro de notificaciones →</span>
        </Link>
      )}

      <div style={{ background: "linear-gradient(135deg, #0D2E4E 0%, #123C66 60%, #1a5490 100%)", borderRadius: 16, padding: "28px 32px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>Índice de Cumplimiento Global</div>
            <div style={{ fontSize: 52, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{globalPct}%</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>ISO 9001:2015 + ISO 27001:2022 · Sincronizado con GAP demo</div>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {[
              { label: "ISO 9001", value: `${iso9001Pct}%`, color: "#4ade80" },
              { label: "ISO 27001", value: `${iso27001Pct}%`, color: "#fbbf24" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center", background: "rgba(255,255,255,0.09)", borderRadius: 10, padding: "12px 20px" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <ProgressBar value={globalPct} color="#4ade80" height={8} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Acciones Vencidas", value: overdue, sub: "Prioridad crítica", color: "#C93C37", icon: "⚡", href: "/app/actions" },
          { label: "Riesgos Críticos", value: criticalRisks, sub: "Score ≥ 15", color: "#D68A1A", icon: "⚠", href: "/app/risks" },
          { label: "Documentos Pendientes", value: docsPending, sub: "Borrador / revisión", color: "#123C66", icon: "📄", href: "/app/documents" },
          { label: "Auditorías Próximas", value: auditsSoon, sub: "Planificadas o en curso", color: "#2E8B57", icon: "✓", href: "/app/audits" },
          { label: "No Conformidades", value: openNcs, sub: "Abiertas sin cerrar", color: "#C93C37", icon: "⊘", href: "/app/nonconformities" },
          { label: "NPS Clientes", value: npsDisplay, sub: "Meta indicadores", color: "#2E8B57", icon: "📊", href: "/app/indicators" },
        ].map(kpi => (
          <Link key={kpi.label} href={kpi.href} style={{ textDecoration: "none" }}>
            <Card style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: kpi.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                {kpi.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "#5E6B7A", marginBottom: 2 }}>{kpi.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#142033", lineHeight: 1.1 }}>{kpi.value}</div>
                <div style={{ fontSize: 11, color: "#5E6B7A", marginTop: 2 }}>{kpi.sub}</div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { href: "/app/setup", label: "Readiness", value: `${readinessPct}%`, sub: "Implementación", color: "#123C66" },
          { href: "/app/training", label: "Formación", value: `${trainPct}%`, sub: `${trainOverdue} alertas`, color: trainOverdue ? "#C93C37" : "#2E8B57" },
          { href: "/app/changes", label: "Cambios activos", value: changesOpen, sub: "Pipeline", color: "#D68A1A" },
          { href: "/app/suppliers", label: "Proveedores crít.", value: supCritical, sub: "Alta / crítica", color: "#C93C37" },
          { href: "/app/documents", label: "Revisiones próx.", value: docsReviewDueSoon, sub: `≤60 días`, color: "#123C66" },
          { href: "/app/activity", label: "Eventos audit trail", value: state.auditEvents.length, sub: "Sesión actual", color: "#5E6B7A" },
        ].map(w => (
          <Link key={w.href} href={w.href} style={{ textDecoration: "none" }}>
            <Card style={{ padding: "14px 16px", height: "100%" }}>
              <div style={{ fontSize: 11, color: "#5E6B7A", marginBottom: 4 }}>{w.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: w.color }}>{w.value}</div>
              <div style={{ fontSize: 11, color: "#9aa5b1", marginTop: 2 }}>{w.sub}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        {[
          { href: "/app/setup", label: "Implementación" },
          { href: "/app/gap", label: "Continuar GAP" },
          { href: "/app/documents", label: "Revisar documentos" },
          { href: "/app/changes", label: "Control de cambios" },
          { href: "/app/actions", label: "Ver acciones" },
          { href: "/app/audits", label: "Auditorías" },
          { href: "/app/reporting", label: "Informes" },
        ].map(q => (
          <Link
            key={q.href}
            href={q.href}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#123C66",
              textDecoration: "none",
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #E5EAF2",
              background: "#fff",
            }}
          >
            {q.label}
          </Link>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 20 }}>
        <Card>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#142033", marginBottom: 12 }}>Resumen por sede (demo)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {state.sites.map(s => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #E5EAF2" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#142033" }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "#5E6B7A" }}>
                    {s.code} · {s.city}
                  </div>
                </div>
                <Link href="/app/processes" style={{ fontSize: 12, color: "#123C66", fontWeight: 600, textDecoration: "none" }}>
                  Procesos →
                </Link>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#142033", marginBottom: 12 }}>Próximos vencimientos</div>
          {upcomingActions.length === 0 ? (
            <p style={{ fontSize: 13, color: "#5E6B7A", margin: 0 }}>No hay acciones pendientes en el workspace.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {upcomingActions.map(a => (
                <Link key={a.id} href="/app/actions" style={{ textDecoration: "none", color: "inherit" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid #E5EAF2" }}>
                    <span style={{ fontSize: 13, color: "#142033", fontWeight: 500 }}>{a.code}</span>
                    <span style={{ fontSize: 12, color: a.due < today ? "#C93C37" : "#5E6B7A" }}>{a.due}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#5E6B7A" }}>{a.title}</div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 20, marginBottom: 20 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#142033", margin: 0 }}>KPIs Clave</h3>
            <Link href="/app/indicators" style={{ fontSize: 13, color: "#123C66", textDecoration: "none", fontWeight: 500 }}>
              Ver todos →
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {indicators.map(ind => (
              <div key={ind.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 13, color: "#142033", fontWeight: 500 }}>{ind.name}</span>
                    <span style={{ fontSize: 12, color: "#5E6B7A" }}>
                      {ind.value}
                      {ind.unit} / {ind.target}
                      {ind.unit}
                    </span>
                  </div>
                  <ProgressBar
                    value={Math.min(100, (ind.value / ind.target) * 100)}
                    color={ind.status === "ON_TRACK" ? "#2E8B57" : ind.status === "AT_RISK" ? "#D68A1A" : "#C93C37"}
                    height={5}
                  />
                </div>
                <Badge status={ind.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#142033", margin: 0 }}>Actividad reciente</h3>
            <Link href="/app/notifications" style={{ fontSize: 12, color: "#123C66", textDecoration: "none", fontWeight: 600 }}>
              Alertas →
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {activityRows.slice(0, 8).map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <Avatar name={a.user} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "#142033", lineHeight: 1.5 }}>
                    <strong style={{ fontWeight: 600 }}>{a.user.split(" ")[0]}</strong> {a.action}{" "}
                    <span style={{ color: "#123C66" }}>
                      {a.object.slice(0, 35)}
                      {a.object.length > 35 ? "…" : ""}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#5E6B7A", marginTop: 1 }}>
                    {new Date(a.time).toLocaleString("es-ES", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        {[
          { href: "/app/gap", icon: "◎", title: "GAP Assessment", desc: `ISO 9001 · Puntuación global: ${gapPct}%`, color: "#123C66" },
          { href: "/app/audits", icon: "✓", title: "Auditorías", desc: `${auditsSoon} en calendario próximo`, color: "#2E8B57" },
          { href: "/app/risks", icon: "⚠", title: "Riesgos", desc: `${criticalRisks} críticos (score ≥ 15)`, color: "#C93C37" },
          { href: "/app/actions", icon: "⚡", title: "Plan de acción", desc: `${pendingActions} acciones activas`, color: "#D68A1A" },
        ].map(c => (
          <Link key={c.href} href={c.href} style={{ textDecoration: "none" }}>
            <Card style={{ cursor: "pointer", borderTop: `3px solid ${c.color}` }}>
              <div style={{ fontSize: 18, marginBottom: 8 }}>{c.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#142033" }}>{c.title}</div>
              <div style={{ fontSize: 12, color: "#5E6B7A", marginTop: 4 }}>{c.desc}</div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
