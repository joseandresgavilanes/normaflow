"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ClipboardCheck,
  CalendarClock,
  CircleOff,
  ShieldAlert,
  FileText,
  GraduationCap,
  Lock,
  Shield,
  Target,
  Zap,
} from "lucide-react";
import Badge from "@/components/ui/Badge";
import AttentionSection, { type AttentionItem } from "@/components/dashboard/AttentionSection";
import ComplianceByStandard from "@/components/dashboard/ComplianceByStandard";
import PageHeader from "@/components/layout/PageHeader";
import { useI18n } from "@/context/I18nProvider";
import ProgressBar from "@/components/ui/ProgressBar";
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
  const { t, tx } = useI18n();
  const { state } = useWorkspace();
  const isLive = live != null;
  const today = new Date().toISOString().slice(0, 10);

  const overdueWs = state.actions.filter(
    a => a.status !== "COMPLETED" && a.priority === "CRITICAL" && a.due < today
  ).length;
  const criticalWs = state.risks.filter(r => r.score >= 15).length;
  const docsPendingWs = state.documents.filter(d => d.status === "IN_REVIEW" || d.status === "DRAFT").length;
  const openNcsWs = state.nonconformities.filter(n => n.status !== "CLOSED").length;
  const iso9001Ws = avgGap(state.gapIso9001);
  const iso27001Ws = avgGap(state.gapIso27001);
  const globalWs = Math.round((iso9001Ws + iso27001Ws) / 2);

  const overdue = isLive ? live.overdueCritical : overdueWs;
  const criticalRisks = isLive ? live.criticalRisks : criticalWs;
  const docsPending = isLive ? live.documentsInReview : docsPendingWs;
  const openNcs = isLive ? live.openNcs : openNcsWs;
  const globalPct = isLive ? live.globalPct : globalWs;
  const iso9001Pct = isLive ? live.iso9001Pct : iso9001Ws;
  const iso27001Pct = isLive ? live.iso27001Pct : iso27001Ws;
  const pendingActions = isLive ? live.pendingActions : state.actions.filter(a => a.status !== "COMPLETED").length;
  const activityRows = isLive ? live.recentActivity : state.activityFeed;
  const trainTotal = isLive ? live.trainingTotal : state.trainingAssignments.length;
  const trainDone = isLive ? live.trainingDone : state.trainingAssignments.filter(a => a.status === "COMPLETED").length;
  const trainPct = trainTotal ? Math.round((trainDone / trainTotal) * 100) : 0;
  const orgName = isLive ? orgNameProp : state.session.orgName;

  const progressRows: { label: string; value: string; Icon: LucideIcon; bg: string; color: string; href: string }[] = [
    { label: "ISO 9001:2015", value: iso9001Pct == null ? "—" : `${iso9001Pct}%`, Icon: Shield, bg: "var(--nf-primary-subtle)", color: "var(--nf-primary-active)", href: "/app/gap" },
    { label: "ISO 27001:2022", value: iso27001Pct == null ? "—" : `${iso27001Pct}%`, Icon: Lock, bg: "var(--nf-success-subtle)", color: "var(--nf-success-text)", href: "/app/gap" },
    { label: "Capacitación completada", value: `${trainPct}%`, Icon: GraduationCap, bg: "var(--nf-warning-border)", color: "var(--nf-warning-text)", href: "/app/training" },
  ];

  // No existe serie histórica de cumplimiento en ninguna parte del sistema,
  // así que el panel compara el estado ACTUAL por norma en lugar de fingir una
  // tendencia.
  const standards = [
    { code: "ISO 9001", name: "ISO 9001:2015 · Calidad", pct: iso9001Pct ?? null },
    { code: "ISO 27001", name: "ISO 27001:2022 · Seguridad de la información", pct: iso27001Pct ?? null },
  ];

  const trainingOverdue = isLive
    ? live.trainingOverdue
    : state.trainingAssignments.filter((a) => a.status !== "COMPLETED" && (a.dueAt ?? "") < today).length;
  const docsReviewDueSoon = isLive ? live.documentsReviewDueSoon : 0;
  const auditsUpcoming = isLive
    ? live.auditsUpcoming
    : state.audits.filter((a) => a.status === "PLANNED").length;
  const indicatorsOffTarget = isLive
    ? live.indicatorRows.filter((i) => i.status && i.status !== "ON_TRACK").length
    : state.indicators.filter((i) => i.status && i.status !== "ON_TRACK").length;

  const attention: AttentionItem[] = [
    { id: "overdue", label: "Acciones críticas vencidas", detail: "Pasaron su fecha compromiso y siguen abiertas.", count: overdue, href: "/app/actions", tone: "danger", Icon: Zap },
    { id: "risks", label: "Riesgos críticos", detail: "Superan el umbral aceptado y necesitan tratamiento.", count: criticalRisks, href: "/app/risks", tone: "danger", Icon: ShieldAlert },
    { id: "ncs", label: "No conformidades abiertas", detail: "Sin cerrar: requieren causa raíz y acción correctiva.", count: openNcs, href: "/app/nonconformities", tone: "danger", Icon: CircleOff },
    { id: "training", label: "Formación vencida", detail: "Personas con capacitación caducada o sin completar.", count: trainingOverdue, href: "/app/training", tone: "warning", Icon: GraduationCap },
    { id: "indicators", label: "Indicadores fuera de meta", detail: "Su último valor no alcanza el objetivo fijado.", count: indicatorsOffTarget, href: "/app/indicators", tone: "warning", Icon: BarChart3 },
    { id: "docs", label: "Documentos en revisión", detail: "Esperan aprobación para pasar a vigentes.", count: docsPending, href: "/app/documents", tone: "info", Icon: FileText },
    { id: "review", label: "Documentos por revisar pronto", detail: "Su fecha de revisión vence en los próximos 60 días.", count: docsReviewDueSoon, href: "/app/documents", tone: "info", Icon: ClipboardCheck },
    { id: "audits", label: "Auditorías planificadas", detail: "Programadas y pendientes de ejecutar.", count: auditsUpcoming, href: "/app/audits", tone: "info", Icon: CalendarClock },
  ];

  const quickActions = [
    { label: "GAP Assessment", href: "/app/gap", primary: true },
    { label: "Documentos", href: "/app/documents" },
    { label: "No conformidad", href: "/app/nonconformities" },
    { label: "Informe", href: "/app/reporting" },
  ];

  return (
    <div>
      {/* El dashboard no declaraba ningún `<h1>` ni indicaba de qué
          organización eran los datos: la página abría directamente con una fila
          de accesos rápidos. */}
      <PageHeader
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle", { org: orgName })}
        actions={quickActions.map((action, i) => (
          <button
            key={action.href}
            type="button"
            className={i === 0 ? "nf-app-btn-primary" : "nf-app-btn-ghost"}
            onClick={() => router.push(action.href)}
          >
            {tx(action.label)}
          </button>
        ))}
      />

      <AttentionSection items={attention} />

      <div className="nf-dash-hero-grid">
        <div className="nf-dash-card">
          <div className="nf-dash-card-label">Cumplimiento global</div>
          <div className="nf-dash-card-value">{globalPct == null ? "—" : `${globalPct}%`}</div>
          <p className="nf-dash-card-note">
            Media de las normas con evaluación GAP completada.
          </p>
          <ComplianceByStandard standards={standards} />
        </div>

        <div className="nf-dash-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h2 className="nf-dash-card-heading">Progreso</h2>
            <Link href="/app/gap" className="nf-dash-card-link">Ver GAP</Link>
          </div>
          {/* Solo progresos porcentuales. Los conteos accionables viven en
              "Requiere tu atención": antes esta tarjeta los mezclaba y además
              repetía formación y documentos con la tarjeta de estado. */}
          {progressRows.map((row) => (
            <Link key={row.label} href={row.href} style={{ textDecoration: "none", color: "inherit" }}>
              <div className="nf-dash-module-row">
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <div className="nf-dash-module-icon" style={{ background: row.bg, color: row.color }}>
                    <row.Icon size={16} strokeWidth={2} aria-hidden />
                  </div>
                  <span className="nf-dash-module-name">{row.label}</span>
                </div>
                <span className="nf-dash-module-value nf-tabular">{row.value}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="nf-dash-table-wrap">
        <div className="nf-dash-table-head">
          <h3 className="nf-dash-table-title">Actividad reciente</h3>
        </div>
        <table className="nf-dash-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Descripción</th>
              <th>Módulo</th>
              <th style={{ textAlign: "right" }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {activityRows.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "var(--nf-ink-3)", padding: "32px 24px" }}>
                  La actividad aparecerá cuando el equipo empiece a registrar cambios.
                </td>
              </tr>
            ) : (
              activityRows.slice(0, 6).map((a, i) => {
                const isPositive = a.action.toLowerCase().includes("complet") || a.action.toLowerCase().includes("aprob");
                return (
                  <tr key={i}>
                    <td style={{ color: "var(--nf-ink-3)", fontSize: 13 }}>
                      {new Date(a.time).toLocaleDateString("es-ES", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{a.user.split(" ")[0]} · {a.action}</div>
                      <div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 2 }}>{a.object.slice(0, 48)}</div>
                    </td>
                    <td style={{ color: "var(--nf-ink-3)", fontSize: 13 }}>{a.object.split(" · ")[0] ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      {isPositive ? (
                        <span className="nf-dash-amount-pos">Completado</span>
                      ) : (
                        <Badge status="IN_PROGRESS" label="En curso" />
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 16 }}>
        {[
          { href: "/app/gap", Icon: Target, title: "GAP assessment", desc: globalPct == null ? "Sin evaluación" : `${globalPct}% global`, color: "var(--nf-primary-active)" },
          { href: "/app/audits", Icon: ClipboardCheck, title: "Auditorías", desc: `${isLive ? live.auditsUpcoming : state.audits.length} en calendario`, color: "var(--nf-success-text)" },
          { href: "/app/risks", Icon: AlertTriangle, title: "Riesgos", desc: `${criticalRisks} críticos`, color: "var(--nf-danger-text)" },
          { href: "/app/actions", Icon: Zap, title: "Plan de acción", desc: `${pendingActions} activas`, color: "var(--nf-warning-text)" },
        ].map(({ href, Icon, title, desc, color }) => (
          <Link key={href} href={href} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="nf-dash-card" style={{ padding: "18px 20px" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}14`, display: "flex", alignItems: "center", justifyContent: "center", color, marginBottom: 12 }}>
                <Icon size={18} strokeWidth={2} aria-hidden />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--nf-ink)" }}>{title}</div>
              <div style={{ fontSize: 13, color: "var(--nf-ink-3)", marginTop: 4 }}>{desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
