"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Lock,
  Shield,
  Target,
  Zap,
} from "lucide-react";
import Badge from "@/components/ui/Badge";
import PageHeader from "@/components/layout/PageHeader";
import { useI18n } from "@/context/I18nProvider";
import ProgressBar from "@/components/ui/ProgressBar";
import type { DashboardPayload } from "@/lib/server-queries";
import { useWorkspace } from "@/context/WorkspaceStore";

function avgGap(rows: { score: number }[]) {
  if (!rows.length) return 0;
  return Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length);
}

function ComplianceChart({ value }: { value: number }) {
  const points = [62, 58, 65, 61, 70, 68, 72, 69, 74, value || 71];
  const max = 100;
  const min = 50;
  const w = 600;
  const h = 100;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / (max - min)) * h;
    return `${x},${y}`;
  });
  const line = coords.join(" ");
  const area = `0,${h} ${line} ${w},${h}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="nf-dash-chart" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="nfChartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5266F6" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#5266F6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#nfChartFill)" />
      <polyline
        points={line}
        fill="none"
        stroke="#5266F6"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
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

  const modules: {
    label: string;
    value: string;
    Icon: LucideIcon;
    bg: string;
    color: string;
    href: string;
  }[] = [
    { label: "ISO 9001:2015", value: iso9001Pct == null ? "—" : `${iso9001Pct}%`, Icon: Shield, bg: "#EEF2FF", color: "#5266F6", href: "/app/gap" },
    { label: "ISO 27001:2022", value: iso27001Pct == null ? "—" : `${iso27001Pct}%`, Icon: Lock, bg: "#F0FDF4", color: "#16A34A", href: "/app/gap" },
    { label: "Capacitación", value: `${trainPct}%`, Icon: GraduationCap, bg: "#FEF3C7", color: "#D97706", href: "/app/training" },
    { label: "Documentos en revisión", value: String(docsPending), Icon: FileText, bg: "#F5F5F5", color: "#525252", href: "/app/documents" },
    { label: "Acciones activas", value: String(pendingActions), Icon: Zap, bg: "#FFF7ED", color: "#EA580C", href: "/app/actions" },
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

      <div className="nf-dash-hero-grid">
        <div className="nf-dash-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div className="nf-dash-card-label">Cumplimiento global</div>
              <div className="nf-dash-card-value">
                {globalPct == null ? "—" : `${globalPct}%`}
              </div>
            </div>
            <button type="button" className="nf-dash-period-select">
              Últimos 30 días
              <ChevronDown size={14} strokeWidth={2} aria-hidden />
            </button>
          </div>
          <div className="nf-dash-card-meta">
            <span className="nf-dash-meta-up">
              +{iso9001Pct ?? 0}% ISO 9001
            </span>
            <span className="nf-dash-meta-down">
              {openNcs} NC abiertas
            </span>
          </div>
          <ComplianceChart value={globalPct ?? 71} />
        </div>

        <div className="nf-dash-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "var(--nf-ink)" }}>
              Módulos
            </h3>
            <Link href="/app/gap" style={{ fontSize: 13, color: "var(--nf-app-accent)", fontWeight: 500, textDecoration: "none" }}>
              Ver todo
            </Link>
          </div>
          {modules.map((mod) => {
            const ModIcon = mod.Icon;
            return (
            <Link key={mod.label} href={mod.href} style={{ textDecoration: "none", color: "inherit" }}>
              <div className="nf-dash-module-row">
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <div className="nf-dash-module-icon" style={{ background: mod.bg, color: mod.color }}>
                    <ModIcon size={16} strokeWidth={2} aria-hidden />
                  </div>
                  <span className="nf-dash-module-name">{mod.label}</span>
                </div>
                <span className="nf-dash-module-value">{mod.value}</span>
              </div>
            </Link>
            );
          })}
        </div>
      </div>

      <div className="nf-dash-bottom-grid">
        <div className="nf-dash-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <div className="nf-dash-card-label">Alertas críticas</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--nf-ink)", marginTop: 4 }}>
                {overdue + criticalRisks} pendientes de atención
              </div>
              <p style={{ fontSize: 13, color: "var(--nf-ink-3)", margin: "8px 0 0", lineHeight: 1.5 }}>
                {overdue} acciones vencidas · {criticalRisks} riesgos críticos
              </p>
            </div>
            <Link href="/app/actions" className="nf-app-btn-ghost" style={{ textDecoration: "none", fontSize: 13, padding: "6px 14px" }}>
              Ver
            </Link>
          </div>
          <div style={{ marginTop: 16 }}>
            <ProgressBar
              value={Math.min(100, ((overdue + criticalRisks) / Math.max(pendingActions, 1)) * 100)}
              color="#5266F6"
              height={4}
              railColor="#f0f0f0"
            />
          </div>
        </div>

        <div className="nf-dash-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
            <div>
              <div className="nf-dash-card-label">Estado del sistema</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--nf-ink)", marginTop: 4 }}>
                {orgName}
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--success)", background: "#F0FDF4", padding: "4px 10px", borderRadius: 999 }}>
              Al día
            </span>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {[
              { label: "Formación completada", value: `${trainPct}%`, Icon: BarChart3 },
              { label: "Auditorías planificadas", value: String(isLive ? live.auditsUpcoming : state.audits.filter(a => a.status === "PLANNED").length), Icon: ClipboardCheck },
              { label: "Documentos pendientes", value: String(docsPending), Icon: FileText },
            ].map(({ label, value, Icon }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--nf-ink-2)" }}>
                  <Icon size={16} strokeWidth={1.75} color="#9ca3af" aria-hidden />
                  {label}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--nf-ink)" }}>{value}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="nf-app-btn-primary" onClick={() => router.push("/app/reporting")}>
              Generar informe
            </button>
            <button type="button" className="nf-app-btn-ghost" onClick={() => router.push("/app/risks")}>
              Ver riesgos
            </button>
          </div>
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
          { href: "/app/gap", Icon: Target, title: "GAP assessment", desc: globalPct == null ? "Sin evaluación" : `${globalPct}% global`, color: "#5266F6" },
          { href: "/app/audits", Icon: ClipboardCheck, title: "Auditorías", desc: `${isLive ? live.auditsUpcoming : state.audits.length} en calendario`, color: "#16A34A" },
          { href: "/app/risks", Icon: AlertTriangle, title: "Riesgos", desc: `${criticalRisks} críticos`, color: "#DC2626" },
          { href: "/app/actions", Icon: Zap, title: "Plan de acción", desc: `${pendingActions} activas`, color: "#D97706" },
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
