"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  Bell,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  FileText,
  MapPin,
  Shield,
  Sparkles,
  Target,
  Zap,
  CircleOff,
} from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
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
  const router = useRouter();
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

  const dateLabel = new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div>
      <SectionTitle
        title="Panel de Control"
        sub={`${orgName} · ${dateLabel}`}
        action={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <FileText size={17} strokeWidth={2.25} aria-hidden />
            Informes
          </span>
        }
        onAction={() => router.push("/app/reporting")}
      />

      {!live && unreadWs > 0 && (
        <Link
          href="/app/notifications"
          style={{
            display: "block",
            marginBottom: 18,
            textDecoration: "none",
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid rgba(18, 60, 102, 0.12)",
            boxShadow: "0 14px 40px -28px rgba(18, 60, 102, 0.35)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
              flexWrap: "wrap",
              padding: "14px 18px",
              background: "linear-gradient(125deg, rgba(18, 60, 102, 0.1) 0%, rgba(214, 138, 26, 0.12) 55%, #fff 100%)",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <span
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "rgba(18, 60, 102, 0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#123C66",
                  flexShrink: 0,
                }}
              >
                <Bell size={22} strokeWidth={2.25} aria-hidden />
              </span>
              <span>
                <span style={{ display: "block", fontSize: 15, fontWeight: 800, color: "#123C66", letterSpacing: "-0.02em" }}>
                  {unreadWs} notificación{unreadWs > 1 ? "es" : ""} sin leer
                </span>
                <span style={{ fontSize: 13, color: "var(--nf-ink-3)", fontWeight: 600, marginTop: 2, display: "block" }}>
                  Abrir centro de notificaciones
                </span>
              </span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#123C66" }}>
              Ver
              <ChevronRight size={18} strokeWidth={2.5} aria-hidden />
            </span>
          </div>
        </Link>
      )}

      <div className="nf-kpi-summary" style={{ marginBottom: 14 }}>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(18, 60, 102, 0.16) 0%, rgba(18, 60, 102, 0.06) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#123C66",
            }}
          >
            <Sparkles size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 30, fontWeight: 800, color: "#123C66", letterSpacing: "-0.04em", lineHeight: 1 }}>{globalPct}%</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 4 }}>Cumplimiento global</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(46, 139, 87, 0.2) 0%, rgba(46, 139, 87, 0.07) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1f6f45",
            }}
          >
            <Award size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#2E8B57", letterSpacing: "-0.03em", lineHeight: 1 }}>{iso9001Pct}%</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>ISO 9001:2015</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(214, 138, 26, 0.22) 0%, rgba(214, 138, 26, 0.08) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9a6510",
            }}
          >
            <Shield size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#D68A1A", letterSpacing: "-0.03em", lineHeight: 1 }}>{iso27001Pct}%</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>ISO 27001:2022</div>
          </div>
        </div>
      </div>

      <Card style={{ marginBottom: 22, padding: "18px 20px 20px", border: "1px solid var(--nf-line)", boxShadow: "0 1px 0 rgba(18, 60, 102, 0.04)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--nf-ink-3)" }}>
            Progreso vs objetivo
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--nf-ink-2)" }}>GAP del espacio de trabajo</span>
        </div>
        <ProgressBar value={globalPct} color="#2E8B57" height={8} railColor="#eef2f9" />
        <p style={{ fontSize: 12, color: "var(--nf-ink-3)", margin: "12px 0 0", lineHeight: 1.5, fontWeight: 500 }}>
          ISO 9001:2015 e ISO 27001:2022 · Los porcentajes se alinean con el módulo GAP y el estado actual del workspace.
        </p>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))", gap: 12, marginBottom: 14 }}>
        {(
          [
            { label: "Acciones vencidas", value: overdue, sub: "Prioridad crítica", color: "#C93C37", Icon: Zap, href: "/app/actions" },
            { label: "Riesgos críticos", value: criticalRisks, sub: "Score ≥ 15", color: "#D68A1A", Icon: AlertTriangle, href: "/app/risks" },
            { label: "Documentos pendientes", value: docsPending, sub: "Borrador / revisión", color: "#123C66", Icon: FileText, href: "/app/documents" },
            { label: "Auditorías próximas", value: auditsSoon, sub: "Planificadas o en curso", color: "#2E8B57", Icon: ClipboardCheck, href: "/app/audits" },
            { label: "No conformidades", value: openNcs, sub: "Abiertas sin cerrar", color: "#C93C37", Icon: CircleOff, href: "/app/nonconformities" },
            { label: "NPS clientes", value: npsDisplay, sub: "Meta indicadores", color: "#2E8B57", Icon: BarChart3, href: "/app/indicators" },
          ] as const
        ).map(kpi => {
          const KpiIcon = kpi.Icon;
          return (
            <Link key={kpi.label} href={kpi.href} style={{ textDecoration: "none", minWidth: 0, display: "block", color: "inherit" }}>
              <div className="nf-kpi-card" style={{ height: "100%" }}>
                <div style={{ height: 4, background: `linear-gradient(90deg, ${kpi.color}, ${kpi.color}99)` }} />
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px 16px" }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 11,
                      background: `${kpi.color}20`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      color: kpi.color,
                    }}
                  >
                    <KpiIcon size={21} strokeWidth={2.25} aria-hidden />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--nf-ink-3)", marginBottom: 4, letterSpacing: "0.02em" }}>{kpi.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--nf-ink)", lineHeight: 1.1, letterSpacing: "-0.02em" }}>{kpi.value}</div>
                    <div style={{ fontSize: 11, color: "var(--nf-ink-3)", marginTop: 4, fontWeight: 500 }}>{kpi.sub}</div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(158px, 1fr))", gap: 12, marginBottom: 18 }}>
        {[
          { href: "/app/setup", label: "Readiness", value: `${readinessPct}%`, sub: "Implementación", color: "#123C66" },
          { href: "/app/training", label: "Formación", value: `${trainPct}%`, sub: `${trainOverdue} alertas`, color: trainOverdue ? "#C93C37" : "#2E8B57" },
          { href: "/app/changes", label: "Cambios activos", value: changesOpen, sub: "Pipeline", color: "#D68A1A" },
          { href: "/app/suppliers", label: "Proveedores crít.", value: supCritical, sub: "Alta / crítica", color: "#C93C37" },
          { href: "/app/documents", label: "Revisiones próx.", value: docsReviewDueSoon, sub: "≤ 60 días", color: "#123C66" },
          { href: "/app/activity", label: "Audit trail", value: state.auditEvents.length, sub: "Sesión actual", color: "var(--nf-ink-2)" },
        ].map(w => (
          <Link key={w.href} href={w.href} style={{ textDecoration: "none", minWidth: 0, display: "block", color: "inherit" }}>
            <div className="nf-kpi-card" style={{ height: "100%" }}>
              <div style={{ height: 3, background: `linear-gradient(90deg, ${w.color}, transparent)` }} />
              <div style={{ padding: "13px 15px 15px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--nf-ink-3)", marginBottom: 4 }}>{w.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: w.color, letterSpacing: "-0.03em" }}>{w.value}</div>
                <div style={{ fontSize: 11, color: "var(--nf-ink-3)", marginTop: 4, fontWeight: 500 }}>{w.sub}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <span className="nf-filter-label" style={{ marginRight: 4 }}>
          Accesos rápidos
        </span>
        {[
          { href: "/app/setup", label: "Implementación" },
          { href: "/app/gap", label: "Continuar GAP" },
          { href: "/app/documents", label: "Revisar documentos" },
          { href: "/app/changes", label: "Control de cambios" },
          { href: "/app/actions", label: "Ver acciones" },
          { href: "/app/audits", label: "Auditorías" },
          { href: "/app/reporting", label: "Informes" },
        ].map(q => (
          <Link key={q.href} href={q.href} className="nf-chip" style={{ textDecoration: "none" }}>
            {q.label}
          </Link>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, marginBottom: 20 }}>
        <Card style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 11,
                  background: "linear-gradient(135deg, rgba(18, 60, 102, 0.12) 0%, rgba(18, 60, 102, 0.05) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#123C66",
                  flexShrink: 0,
                }}
              >
                <MapPin size={20} strokeWidth={2.25} aria-hidden />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--nf-ink)", letterSpacing: "-0.02em" }}>Resumen por sede</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--nf-ink-3)", marginTop: 2 }}>Demo · enlaces a procesos</div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {state.sites.map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 0",
                  borderBottom: i < state.sites.length - 1 ? "1px solid var(--nf-line)" : "none",
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--nf-ink)" }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: "var(--nf-ink-3)", fontWeight: 500, marginTop: 2 }}>
                    {s.code} · {s.city}
                  </div>
                </div>
                <Link href="/app/processes" style={{ fontSize: 12, color: "#123C66", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  Procesos
                  <ChevronRight size={14} strokeWidth={2.5} aria-hidden />
                </Link>
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 11,
                  background: "linear-gradient(135deg, rgba(214, 138, 26, 0.2) 0%, rgba(214, 138, 26, 0.07) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#9a6510",
                  flexShrink: 0,
                }}
              >
                <CalendarClock size={20} strokeWidth={2.25} aria-hidden />
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--nf-ink)", letterSpacing: "-0.02em" }}>Próximos vencimientos</div>
            </div>
            <Link href="/app/actions" style={{ fontSize: 12, fontWeight: 700, color: "#123C66", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 2 }}>
              Todas
              <ChevronRight size={14} strokeWidth={2.5} aria-hidden />
            </Link>
          </div>
          {upcomingActions.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--nf-ink-3)", margin: 0, fontWeight: 500 }}>No hay acciones pendientes en el workspace.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {upcomingActions.map((a, i) => (
                <Link key={a.id} href="/app/actions" style={{ textDecoration: "none", color: "inherit" }}>
                  <div
                    style={{
                      padding: "12px 6px",
                      borderBottom: i < upcomingActions.length - 1 ? "1px solid var(--nf-line)" : "none",
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 800, color: "#123C66" }}>{a.code}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: a.due < today ? "#C93C37" : "var(--nf-ink-3)" }}>{a.due}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--nf-ink)", fontWeight: 600, marginTop: 4, lineHeight: 1.35 }}>{a.title}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 18, marginBottom: 20 }}>
        <Card style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 11,
                  background: "linear-gradient(135deg, rgba(46, 139, 87, 0.18) 0%, rgba(46, 139, 87, 0.06) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#1f6f45",
                  flexShrink: 0,
                }}
              >
                <BarChart3 size={20} strokeWidth={2.25} aria-hidden />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--nf-ink)", margin: 0, letterSpacing: "-0.02em" }}>KPIs clave</h3>
            </div>
            <Link href="/app/indicators" style={{ fontSize: 13, color: "#123C66", textDecoration: "none", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 2 }}>
              Ver todos
              <ChevronRight size={16} strokeWidth={2.25} aria-hidden />
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {indicators.map(ind => (
              <div key={ind.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: "var(--nf-ink)", fontWeight: 600 }}>{ind.name}</span>
                    <span style={{ fontSize: 12, color: "var(--nf-ink-3)", fontWeight: 600 }}>
                      {ind.value}
                      {ind.unit} / {ind.target}
                      {ind.unit}
                    </span>
                  </div>
                  <ProgressBar
                    value={Math.min(100, (ind.value / ind.target) * 100)}
                    color={ind.status === "ON_TRACK" ? "#2E8B57" : ind.status === "AT_RISK" ? "#D68A1A" : "#C93C37"}
                    height={6}
                    railColor="#eef2f9"
                  />
                </div>
                <Badge status={ind.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 11,
                  background: "linear-gradient(135deg, rgba(18, 60, 102, 0.12) 0%, rgba(18, 60, 102, 0.05) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#123C66",
                  flexShrink: 0,
                }}
              >
                <Activity size={20} strokeWidth={2.25} aria-hidden />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--nf-ink)", margin: 0, letterSpacing: "-0.02em" }}>Actividad reciente</h3>
            </div>
            <Link href="/app/activity" style={{ fontSize: 13, color: "#123C66", textDecoration: "none", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 2 }}>
              Ver más
              <ChevronRight size={16} strokeWidth={2.25} aria-hidden />
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {activityRows.slice(0, 8).map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                <Avatar name={a.user} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--nf-ink)", lineHeight: 1.45, fontWeight: 500 }}>
                    <strong style={{ fontWeight: 700 }}>{a.user.split(" ")[0]}</strong> {a.action}{" "}
                    <span style={{ color: "#123C66", fontWeight: 600 }}>
                      {a.object.slice(0, 38)}
                      {a.object.length > 38 ? "…" : ""}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--nf-ink-3)", marginTop: 3, fontWeight: 600 }}>
                    {new Date(a.time).toLocaleString("es-ES", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {(
          [
            { href: "/app/gap", Icon: Target, title: "GAP assessment", desc: `ISO 9001 · Puntuación global: ${gapPct}%`, color: "#123C66" },
            { href: "/app/audits", Icon: ClipboardCheck, title: "Auditorías", desc: `${auditsSoon} en calendario próximo`, color: "#2E8B57" },
            { href: "/app/risks", Icon: AlertTriangle, title: "Riesgos", desc: `${criticalRisks} críticos (score ≥ 15)`, color: "#C93C37" },
            { href: "/app/actions", Icon: Zap, title: "Plan de acción", desc: `${pendingActions} acciones activas`, color: "#D68A1A" },
          ] as const
        ).map(c => {
          const CardIcon = c.Icon;
          return (
            <Link key={c.href} href={c.href} style={{ textDecoration: "none", minWidth: 0, display: "block", color: "inherit" }}>
              <Card style={{ padding: 0, overflow: "hidden", height: "100%", borderRadius: 14, border: "1px solid var(--nf-line)", boxShadow: "0 14px 36px -28px rgba(18, 60, 102, 0.22)" }}>
                <div style={{ height: 4, background: `linear-gradient(90deg, ${c.color}, ${c.color}88)` }} />
                <div style={{ padding: "16px 18px 18px" }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: `${c.color}18`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: c.color,
                      marginBottom: 12,
                    }}
                  >
                    <CardIcon size={21} strokeWidth={2.25} aria-hidden />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "var(--nf-ink)", letterSpacing: "-0.02em" }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 6, lineHeight: 1.5, fontWeight: 500 }}>{c.desc}</div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
