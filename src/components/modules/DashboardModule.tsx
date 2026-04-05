"use client";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import { DEMO_INDICATORS, DEMO_ACTIVITY, DEMO_ACTIONS, DEMO_RISKS } from "@/lib/demo-data";
import type { DashboardPayload } from "@/lib/server-queries";

export default function DashboardModule({
  orgName = "Tecnoserv Industrial S.A.",
  live,
}: {
  orgName?: string;
  live?: DashboardPayload | null;
}) {
  const overdueDemo = DEMO_ACTIONS.filter(
    a => a.status !== "COMPLETED" && a.priority === "CRITICAL" && a.due < new Date().toISOString().slice(0, 10)
  ).length;
  const overdue = live ? live.overdueCritical : overdueDemo || 1;
  const criticalRisks = live ? live.criticalRisks : DEMO_RISKS.filter(r => r.score >= 15).length;
  const docsPending = live?.documentsInReview ?? 3;
  const auditsSoon = live?.auditsUpcoming ?? 2;
  const openNcs = live?.openNcs ?? 2;

  const globalPct = live?.globalPct ?? 78;
  const iso9001Pct = live?.iso9001Pct ?? 82;
  const iso27001Pct = live?.iso27001Pct ?? 74;

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
  const pendingActions = live?.pendingActions ?? DEMO_ACTIONS.filter(a => a.status !== "COMPLETED").length;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#142033", margin: "0 0 4px" }}>Panel de Control</h1>
        <p style={{ fontSize: 14, color: "#5E6B7A", margin: 0 }}>
          {orgName} · {new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      <div style={{ background: "linear-gradient(135deg, #0D2E4E 0%, #123C66 60%, #1a5490 100%)", borderRadius: 16, padding: "28px 32px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>Índice de Cumplimiento Global</div>
            <div style={{ fontSize: 52, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{globalPct}%</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>ISO 9001:2015 + ISO 27001:2022 · Actualizado hoy</div>
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
          { label: "Documentos Pendientes", value: docsPending, sub: "En revisión", color: "#123C66", icon: "📄", href: "/app/documents" },
          { label: "Auditorías Próximas", value: auditsSoon, sub: "Planificadas", color: "#2E8B57", icon: "✓", href: "/app/audits" },
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

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }}>
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
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#142033", margin: "0 0 16px" }}>Actividad Reciente</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {DEMO_ACTIVITY.map((a, i) => (
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
          { href: "/app/audits", icon: "✓", title: "Auditorías", desc: `${auditsSoon} planificadas en calendario`, color: "#2E8B57" },
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
