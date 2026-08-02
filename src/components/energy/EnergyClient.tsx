"use client";

import { useState, useTransition } from "react";
import {
  Flame, LayoutDashboard, Search, Grid3x3, LineChart, Gauge, Activity,
  Lightbulb, ListChecks, BadgeCheck, ShoppingCart, DraftingCompass, ArrowRight, Check,
} from "lucide-react";
import type { EnergyPayload } from "@/lib/energy/queries";
import {
  transitionEnergyReview, verifyEnergySaving, updateEnergyActionProgress,
} from "@/lib/actions/energy";
import type { EnergyReviewStatus } from "@prisma/client";
import { nextEnergyReviewStatuses } from "@/lib/energy/review";

type Tab =
  | "panel" | "review" | "seu" | "baseline" | "enpi" | "meters"
  | "opportunities" | "actions" | "savings" | "procurement" | "design";

const card: React.CSSProperties = { border: "1px solid var(--nf-line, #e5eaf2)", borderRadius: 14, padding: 18, background: "var(--nf-surface, #fff)" };
const chip = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, display: "inline-block" });
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e5eaf2", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const miniBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 7, border: "1px solid #ca8a04", background: "#fefce8", color: "#a16207", fontWeight: 600, fontSize: 12, cursor: "pointer", marginRight: 4 };
const okBtn: React.CSSProperties = { ...miniBtn, borderColor: "#16a34a", background: "#f0fdf4", color: "#15803d" };
const fmt = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
const REVIEW_LABEL: Record<string, string> = {
  DRAFT: "Borrador", IN_PROGRESS: "En curso", UNDER_REVIEW: "En revisión", APPROVED: "Aprobada", SUPERSEDED: "Sustituida",
};

export default function EnergyClient({ initial, demo = false }: { initial: EnergyPayload; demo?: boolean }) {
  const [tab, setTab] = useState<Tab>("panel");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const can = initial.can;
  const live = !demo;
  const s = initial.summary;

  const tabs: { id: Tab; label: string; Icon: typeof Flame; badge?: number }[] = [
    { id: "panel", label: "Panel", Icon: LayoutDashboard },
    { id: "review", label: "Revisión energética", Icon: Search, badge: s.reviewsOpen },
    { id: "seu", label: "Usos significativos", Icon: Grid3x3, badge: s.significantUses },
    { id: "baseline", label: "Línea base", Icon: LineChart },
    { id: "enpi", label: "EnPI", Icon: Gauge },
    { id: "meters", label: "Medidores y lecturas", Icon: Activity },
    { id: "opportunities", label: "Oportunidades", Icon: Lightbulb, badge: s.opportunitiesOpen },
    { id: "actions", label: "Acciones", Icon: ListChecks, badge: s.actionsOpen },
    { id: "savings", label: "Ahorros", Icon: BadgeCheck },
    { id: "procurement", label: "Compras", Icon: ShoppingCart },
    { id: "design", label: "Diseño", Icon: DraftingCompass },
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
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fef9c3", display: "grid", placeItems: "center" }}>
          <Flame size={22} color="#ca8a04" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Sistema de Gestión de la Energía</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
            ISO 50001:2018 — revisión energética, SEU, línea base, EnPI versionados, medidores, oportunidades y verificación de ahorros.
          </p>
        </div>
        {demo && <span style={{ ...chip("#eef2ff", "#4f46e5"), marginLeft: "auto" }}>Demo</span>}
      </header>

      {error && <div style={{ ...card, borderColor: "#fecaca", background: "#fef2f2", color: "#b91c1c" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
        <Stat label="Consumo periodo" value={Math.round(s.periodConsumption)} suffix=" kWh" />
        <Stat label="SEU" value={s.significantUses} accent={s.significantUses ? "#ca8a04" : undefined} />
        <Stat label="EnPI activos" value={s.enpisActive} />
        <Stat label="Coste periodo" value={s.periodCost} suffix=" €" />
        <Stat label="Acciones abiertas" value={s.actionsOpen} accent={s.actionsOpen ? "#d68a1a" : undefined} />
        <Stat label="Ahorro verificado" value={Math.round(s.absoluteSavings)} suffix=" kWh" accent="#16a34a" />
      </div>

      <nav style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {tabs.map(({ id, label, Icon, badge }) => (
          <button key={id} onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, border: "1px solid " + (tab === id ? "#ca8a04" : "#e5eaf2"), background: tab === id ? "#fefce8" : "#fff", color: tab === id ? "#a16207" : "#334155", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <Icon size={15} /> {label}
            {badge ? <span style={chip("#fef9c3", "#a16207")}>{badge}</span> : null}
          </button>
        ))}
      </nav>

      {tab === "panel" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Revisión y SEU (§6.3)</h3>
            <Row k="Fuentes activas" v={s.sources} />
            <Row k="Usos de energía" v={s.uses} />
            <Row k="Usos significativos" v={s.significantUses} />
            <Row k="Revisiones abiertas" v={s.reviewsOpen} danger={s.reviewsOpen > 0} />
            <Row k="Líneas base activas" v={s.baselines} />
          </div>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Desempeño (§6.4, §9.1)</h3>
            <Row k="EnPI activos" v={s.enpisActive} />
            <Row k="Medidores" v={s.meters} />
            <Row k="Consumo del periodo" v={Math.round(s.periodConsumption)} suffix=" kWh" />
            <Row k="Coste asociado" v={s.periodCost} suffix=" €" />
            <Row k="Emisiones asociadas" v={s.periodEmissions} suffix=" tCO2e" />
          </div>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Mejora (§10.2)</h3>
            <Row k="Oportunidades abiertas" v={s.opportunitiesOpen} danger={s.opportunitiesOpen > 0} />
            <Row k="Planes abiertos" v={s.actionsOpen} danger={s.actionsOpen > 0} />
            <Row k="Verificaciones cerradas" v={s.savingsVerified} />
            <Row k="Ahorro absoluto verificado" v={Math.round(s.absoluteSavings)} suffix=" kWh" />
            <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 12 }}>Las fórmulas de EnPI y ahorro son configurables y versionadas; al cambiar, la versión previa queda supersedida.</p>
          </div>
        </div>
      )}

      {tab === "review" && (
        <Table head={["Código", "Título", "Periodo", "Estado", "Acciones"]}>
          {initial.reviews.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}><b>{row.title}</b><div style={{ color: "#64748b", fontSize: 12 }}>{row.scope ?? ""}</div></td>
              <td style={td}>{fmt(row.periodStart)} → {fmt(row.periodEnd)}</td>
              <td style={td}>{REVIEW_LABEL[row.status] ?? row.status}</td>
              <td style={td}>
                {live && nextEnergyReviewStatuses(row.status).map((to) => {
                  const needsApprove = to === "APPROVED";
                  if (needsApprove && !can.approve) return null;
                  if (!needsApprove && !can.update) return null;
                  return (
                    <button key={to} disabled={pending} style={to === "APPROVED" ? okBtn : miniBtn}
                      onClick={() => run(() => transitionEnergyReview(row.id, to as EnergyReviewStatus))}>
                      <ArrowRight size={12} /> {REVIEW_LABEL[to] ?? to}
                    </button>
                  );
                })}
              </td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "seu" && (
        <Table head={["Código", "Uso", "Participación", "Potencial", "Significativo", "Revisión", "Estado"]}>
          {initial.seus.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}><b>{row.energyUse.code}</b><div style={{ color: "#64748b", fontSize: 12 }}>{row.energyUse.name}</div></td>
              <td style={td}>{row.consumptionShare ?? "—"}%</td>
              <td style={td}>{row.improvementPotential ?? "—"}%</td>
              <td style={td}>{row.significant ? "Sí" : "No"}{row.autoSignificant && !row.significant ? " (criterio)" : ""}</td>
              <td style={td}>{row.review?.code ?? "—"}</td>
              <td style={td}>{row.status}</td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "baseline" && (
        <Table head={["Código", "Versión", "Título", "SEU", "Consumo", "Normalizado", "Método", "Estado"]}>
          {initial.baselines.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}>{row.formulaVersion}</td>
              <td style={td}>{row.title}</td>
              <td style={td}>{row.seu?.code ?? "—"}</td>
              <td style={td}>{row.consumption} {row.unit}</td>
              <td style={td}>{row.normalizedConsumption ?? "—"}</td>
              <td style={td}>{row.normalizationMethod}</td>
              <td style={td}>{row.status}</td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "enpi" && (
        <Table head={["Código", "Versión", "Nombre", "Fórmula", "Actual", "Base", "Desviación", "Activo"]}>
          {initial.enpis.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}>{row.formulaVersion}</td>
              <td style={td}><b>{row.name}</b><div style={{ color: "#64748b", fontSize: 12 }}>{row.unit}</div></td>
              <td style={td}>{row.formulaKind}</td>
              <td style={td}>{row.currentValue ?? "—"}</td>
              <td style={td}>{row.baselineValue ?? "—"}</td>
              <td style={td}>{row.deviationPercent != null ? `${row.deviationPercent}%` : "—"}</td>
              <td style={td}>{row.active && !row.superseded ? "Sí" : "No"}</td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "meters" && (
        <>
          <Table head={["Medidor", "Fuente", "Unidad", "Lecturas", "Calibración"]}>
            {initial.meters.map((row) => (
              <tr key={row.id}>
                <td style={td}><b>{row.code}</b><div style={{ color: "#64748b", fontSize: 12 }}>{row.name}</div></td>
                <td style={td}>{row.source?.code ?? "—"}</td>
                <td style={td}>{row.unit}</td>
                <td style={td}>{row._count.readings}</td>
                <td style={td}>{fmt(row.nextCalibration)}</td>
              </tr>
            ))}
          </Table>
          <Table head={["Lectura", "Medidor", "Fecha", "Valor", "Coste", "Emisiones", "Estimada"]}>
            {initial.readings.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}>{row.meter.code}</td>
                <td style={td}>{fmt(row.readingAt)}</td>
                <td style={td}>{row.value} {row.unit}</td>
                <td style={td}>{row.cost ?? "—"}</td>
                <td style={td}>{row.emissions ?? "—"}</td>
                <td style={td}>{row.estimated ? "Sí" : "No"}</td>
              </tr>
            ))}
          </Table>
        </>
      )}

      {tab === "opportunities" && (
        <Table head={["Código", "Oportunidad", "SEU", "Ahorro est.", "Coste", "Prioridad", "Estado", "Planes"]}>
          {initial.opportunities.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}><b>{row.title}</b></td>
              <td style={td}>{row.seu?.code ?? "—"}</td>
              <td style={td}>{row.estimatedSaving ?? "—"} {row.savingUnit ?? ""}</td>
              <td style={td}>{row.estimatedCost ?? "—"}</td>
              <td style={td}>{row.priority}</td>
              <td style={td}>{row.status}</td>
              <td style={td}>{row._count.actionPlans}</td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "actions" && (
        <Table head={["Código", "Plan", "Oportunidad", "Avance", "Estado", "Vence", "Acciones"]}>
          {initial.plans.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}>{row.title}</td>
              <td style={td}>{row.opportunity?.code ?? "—"}</td>
              <td style={td}>{row.progressPercent}%</td>
              <td style={td}>{row.status}</td>
              <td style={td}>{fmt(row.dueDate)}</td>
              <td style={td}>
                {live && can.update && row.status !== "COMPLETED" && row.status !== "CANCELLED" && (
                  <button disabled={pending} style={okBtn}
                    onClick={() => run(() => updateEnergyActionProgress(row.id, Math.min(100, row.progressPercent + 25)))}>
                    +25%
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "savings" && (
        <Table head={["Código", "Plan", "Absoluto", "Normalizado", "Fórmula", "Estado", "Acciones"]}>
          {initial.verifications.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}>{row.actionPlan.code}</td>
              <td style={td}>{row.absoluteSaving ?? "—"} {row.unit}</td>
              <td style={td}>{row.normalizedSaving ?? "—"}</td>
              <td style={td}>{row.formulaKind} v{row.formulaVersion}</td>
              <td style={td}>{row.status}</td>
              <td style={td}>
                {live && can.approve && row.status !== "VERIFIED" && (
                  <button disabled={pending} style={okBtn} onClick={() => run(() => verifyEnergySaving(row.id))}>
                    <Check size={12} /> Verificar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "procurement" && (
        <Table head={["Código", "Evaluación", "Tipo", "Proveedor", "Score", "Resultado"]}>
          {initial.procurement.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}>{row.title}</td>
              <td style={td}>{row.sourceType}</td>
              <td style={td}>{row.supplierName ?? "—"}</td>
              <td style={td}>{row.totalScore ?? "—"}</td>
              <td style={td}>{row.result}</td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "design" && (
        <Table head={["Código", "Proyecto", "Referencia", "Estado", "Revisado"]}>
          {initial.designs.map((row) => (
            <tr key={row.id}>
              <td style={td}>{row.code}</td>
              <td style={td}><b>{row.title}</b><div style={{ color: "#64748b", fontSize: 12 }}>{row.energyConsiderations?.slice(0, 80) ?? ""}</div></td>
              <td style={td}>{row.projectReference ?? "—"}</td>
              <td style={td}>{row.status}</td>
              <td style={td}>{fmt(row.reviewedAt)}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

function Stat({ label, value, accent, suffix }: { label: string; value: number; accent?: string; suffix?: string }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ?? "#0f172a" }}>{value}{suffix ?? ""}</div>
    </div>
  );
}

function Row({ k, v, suffix, danger }: { k: string; v: string | number; suffix?: string; danger?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0", fontSize: 13, borderBottom: "1px solid #f8fafc" }}>
      <span style={{ color: "#64748b" }}>{k}</span>
      <b style={{ color: danger ? "#b91c1c" : "#0f172a" }}>{v}{suffix ?? ""}</b>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div style={{ ...card, padding: 0, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{head.map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
