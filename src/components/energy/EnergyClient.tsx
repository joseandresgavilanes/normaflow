"use client";

import { useEffect, useState, useTransition } from "react";
import ModuleTabs from "@/components/ui/ModuleTabs";
import { useRouter } from "next/navigation";
import {
  Flame, LayoutDashboard, Search, Grid3x3, LineChart, Gauge, Activity,
  Lightbulb, ListChecks, BadgeCheck, ShoppingCart, DraftingCompass, ArrowRight, Check, Plus, Fuel, SlidersHorizontal, X, Pencil, Archive, ArchiveRestore, Undo2,
} from "lucide-react";
import type { EnergyPayload } from "@/lib/energy/queries";
import {
  transitionEnergyReview, verifyEnergySaving, updateEnergyActionProgress,
  createEnergySource, createEnergyUse, createEnergyReview, createSignificantEnergyUse,
  createEnergyBaseline, createOrVersionEnpi, createEnergyMeter, recordEnergyReading,
  createRelevantVariable, createStaticFactor, createEnergyOpportunity, createEnergyActionPlan,
  createEnergySavingVerification, createEnergyProcurementEvaluation, createEnergyDesignReview,
  updateEnergySource, updateEnergyUse, updateEnergyReview, updateSignificantEnergyUse, updateEnergyMeter,
  updateRelevantVariable, updateStaticFactor, updateEnergyOpportunity, updateEnergyActionPlan,
  updateEnergyProcurementEvaluation, updateEnergyDesignReview,
} from "@/lib/actions/energy";
import type { EnergyReviewStatus } from "@prisma/client";
import { nextEnergyReviewStatuses } from "@/lib/energy/review";
import Modal from "@/components/ui/Modal";
import IsoMetricCard from "@/components/ui/IsoMetricCard";
import IsoQuickCreate from "@/components/ui/IsoQuickCreate";
import IsoSectionMetrics from "@/components/ui/IsoSectionMetrics";
import IsoTableCard from "@/components/ui/IsoTableCard";
import { useCreateRequest } from "@/hooks/useCreateRequest";
import { useModuleSection } from "@/hooks/useModuleSection";

type Tab =
  | "panel" | "sources" | "review" | "seu" | "baseline" | "enpi" | "meters" | "variables"
  | "opportunities" | "actions" | "savings" | "procurement" | "design";

const card: React.CSSProperties = { border: "1px solid var(--nf-line, #e5eaf2)", borderRadius: 14, padding: 18, background: "var(--nf-surface, #fff)" };
const chip = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, display: "inline-block" });
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e5eaf2", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const fmt = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
const REVIEW_LABEL: Record<string, string> = {
  DRAFT: "Borrador", IN_PROGRESS: "En curso", UNDER_REVIEW: "En revisión", APPROVED: "Aprobada", SUPERSEDED: "Sustituida",
};
const ENERGY_LABEL: Record<string, string> = {
  ACTIVE: "Activo", ARCHIVED: "Archivado", DRAFT: "Borrador", PLANNED: "Planificado", IN_PROGRESS: "En curso", COMPLETED: "Completado", CANCELLED: "Cancelado",
  IDENTIFIED: "Identificada", UNDER_ANALYSIS: "En análisis", APPROVED: "Aprobada", IN_IMPLEMENTATION: "En implementación", VERIFIED: "Verificada", REJECTED: "Rechazada", CLOSED: "Cerrada", CALCULATED: "Calculada", UNDER_REVIEW: "En revisión",
  ELECTRICITY: "Electricidad", NATURAL_GAS: "Gas natural", FUEL_OIL: "Fuel oil", DISTRICT_HEATING: "Calefacción de red", DISTRICT_COOLING: "Refrigeración de red",
  INTENSITY: "Intensidad", CONSUMPTION: "Consumo", BASELINE_COMPARISON: "Comparación con línea base", DEVIATION: "Desviación", ABSOLUTE_SAVINGS: "Ahorro absoluto", NORMALIZED_SAVINGS: "Ahorro normalizado",
  LINEAR: "Lineal", RATIO: "Relación", NONE: "Sin normalización", PRODUCTION: "Producción",
  LOW: "Baja", MEDIUM: "Media", HIGH: "Alta", CRITICAL: "Crítica", DELAYED: "Retrasado",
  LPG: "GLP", DIESEL: "Diésel", STEAM: "Vapor", SOLAR: "Solar", WIND: "Eólica", BIOMASS: "Biomasa",
  PREFERRED: "Preferente", ACCEPTABLE: "Aceptable", NOT_RECOMMENDED: "No recomendada", SELECTED: "Seleccionada",
  IN_REVIEW: "En revisión", CHANGES_REQUIRED: "Cambios necesarios", OCCUPANCY: "Ocupación", DEGREE_DAYS: "Grados-día", OPERATING_HOURS: "Horas de operación", THROUGHPUT: "Producción procesada", WEATHER: "Clima",
};
const energyLabel = (value: string | null | undefined) => value ? ENERGY_LABEL[value] ?? value.replaceAll("_", " ") : "—";
const CURRENCY_OPTIONS = [
  { value: "EUR", label: "EUR — Euro" },
  { value: "USD", label: "USD — Dólar estadounidense" },
  { value: "GBP", label: "GBP — Libra esterlina" },
  { value: "JPY", label: "JPY — Yen japonés" },
  { value: "CNY", label: "CNY — Yuan chino" },
  { value: "CHF", label: "CHF — Franco suizo" },
  { value: "CAD", label: "CAD — Dólar canadiense" },
  { value: "AUD", label: "AUD — Dólar australiano" },
  { value: "NZD", label: "NZD — Dólar neozelandés" },
  { value: "BRL", label: "BRL — Real brasileño" },
  { value: "COP", label: "COP — Peso colombiano" },
  { value: "MXN", label: "MXN — Peso mexicano" },
  { value: "PEN", label: "PEN — Sol peruano" },
  { value: "CLP", label: "CLP — Peso chileno" },
  { value: "ARS", label: "ARS — Peso argentino" },
  { value: "INR", label: "INR — Rupia india" },
  { value: "KRW", label: "KRW — Won surcoreano" },
  { value: "SGD", label: "SGD — Dólar de Singapur" },
  { value: "HKD", label: "HKD — Dólar de Hong Kong" },
  { value: "SEK", label: "SEK — Corona sueca" },
  { value: "NOK", label: "NOK — Corona noruega" },
  { value: "DKK", label: "DKK — Corona danesa" },
  { value: "PLN", label: "PLN — Zloty polaco" },
  { value: "TRY", label: "TRY — Lira turca" },
  { value: "ZAR", label: "ZAR — Rand sudafricano" },
  { value: "AED", label: "AED — Dírham de Emiratos Árabes Unidos" },
  { value: "SAR", label: "SAR — Riyal saudí" },
] as const;
const SECTION_META: Record<Tab, { title: string; sub: string }> = {
  panel: { title: "Gestión de la Energía", sub: "ISO 50001:2018 — revisión energética, SEU, línea base, EnPI, medidores y mejora." },
  sources: { title: "Fuentes y usos", sub: "Fuentes de energía, usos significativos y consumo asociado." }, review: { title: "Revisión energética", sub: "Revisiones periódicas del desempeño energético." }, seu: { title: "Usos significativos", sub: "Usos significativos de energía y sus variables relevantes." }, baseline: { title: "Línea base", sub: "Líneas base energéticas y versiones aprobadas." }, enpi: { title: "EnPI", sub: "Indicadores de desempeño energético y sus fórmulas." }, meters: { title: "Medidores y lecturas", sub: "Medición, lecturas y trazabilidad del consumo." }, variables: { title: "Variables y factores", sub: "Variables relevantes y factores estáticos del desempeño." }, opportunities: { title: "Oportunidades", sub: "Oportunidades de mejora energética priorizadas." }, actions: { title: "Acciones", sub: "Planes de acción y seguimiento de mejora." }, savings: { title: "Ahorros", sub: "Verificación de ahorros energéticos obtenidos." }, procurement: { title: "Compras", sub: "Evaluación del desempeño energético en compras." }, design: { title: "Diseño", sub: "Revisión energética aplicada al diseño." },
};

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--nf-line)", borderRadius: 8, fontSize: 13, fontFamily: "inherit" };
const primaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 14px", minHeight: 32, border: "1px solid var(--nf-app-accent)", borderRadius: 999, background: "var(--nf-app-accent)", color: "#fff", fontWeight: 600, fontSize: 12, fontFamily: "inherit", cursor: "pointer" };
type Runner = (action: () => Promise<unknown>) => void;
type Members = EnergyPayload["members"];
type EnergyEditorKind = "source" | "use" | "review" | "seu" | "meter" | "variable" | "factor" | "opportunity" | "plan" | "procurement" | "design";

const filled = (value: string) => value.trim().length > 0;
const validNumber = (value: string, min = 0, max = Number.POSITIVE_INFINITY) => {
  if (!filled(value)) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
};
const validOptionalNumber = (value: string, min = 0, max = Number.POSITIVE_INFINITY) => {
  if (!filled(value)) return true;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
};
const validDateRange = (start: string, end: string) => {
  if (!filled(start) || !filled(end)) return false;
  const from = new Date(`${start}T00:00:00.000Z`).getTime();
  const to = new Date(`${end}T00:00:00.000Z`).getTime();
  return Number.isFinite(from) && Number.isFinite(to) && to >= from;
};
function energyValidationError(kind: EnergyEditorKind, form: Record<string, string>) {
  if (kind === "source" && (!filled(form.name) || !filled(form.unit))) return "Completa el nombre y la unidad de la fuente.";
  if (kind === "use" && (!filled(form.name) || !filled(form.unit))) return "Completa el nombre y la unidad del uso.";
  if (kind === "review" && (!filled(form.title) || !validDateRange(form.periodStart, form.periodEnd))) return "Completa el título y un periodo válido.";
  if (kind === "seu" && !filled(form.energyUseId)) return "Selecciona un uso de energía.";
  if (kind === "meter" && (!filled(form.name) || !filled(form.unit))) return "Completa el nombre y la unidad del medidor.";
  if (kind === "variable" && (!filled(form.name) || !filled(form.unit))) return "Completa el nombre y la unidad de la variable.";
  if (kind === "factor" && (!filled(form.name) || !validNumber(form.value) || !filled(form.unit))) return "Completa nombre, valor y unidad del factor.";
  if (kind === "opportunity" && !filled(form.title)) return "Completa el título de la oportunidad.";
  if (kind === "plan" && (!filled(form.title) || (filled(form.startDate) && filled(form.dueDate) && !validDateRange(form.startDate, form.dueDate)))) return "Completa el título y revisa las fechas del plan.";
  if (kind === "procurement" && !filled(form.title)) return "Completa el título de la evaluación.";
  if (kind === "design" && !filled(form.title)) return "Completa el título del proyecto.";
  return null;
}
function submitCreate(valid: boolean, message: string, action: () => Promise<unknown>, run: Runner, onDone: () => void) {
  if (!valid) {
    window.dispatchEvent(new CustomEvent("normaflow:form-validation-error", { detail: { message } }));
    return;
  }
  run(action);
  onDone();
}
/** Modal "+ Nuevo X" form shell shared by every creation form in this module. */
function NewFormToggle({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [closeRequested, setCloseRequested] = useState(false);
  const [modalError, setModalError] = useState("");
  const [requested, clearRequest] = useCreateRequest(label);
  useEffect(() => { if (requested) setOpen(true); }, [requested]);
  const close = () => { setOpen(false); setCloseRequested(false); setModalError(""); clearRequest(); };
  const closeAfterSuccess = () => setCloseRequested(true);
  useEffect(() => {
    if (!closeRequested) return;
    const handleSuccess = () => { setOpen(false); setCloseRequested(false); setModalError(""); clearRequest(); };
    window.addEventListener("normaflow:server-action-success", handleSuccess);
    return () => window.removeEventListener("normaflow:server-action-success", handleSuccess);
  }, [closeRequested, clearRequest]);
  useEffect(() => {
    const handleError = (event: Event) => {
      const message = (event as CustomEvent<{ message?: unknown }>).detail?.message;
      if (message) setModalError(String(message));
    };
    window.addEventListener("normaflow:server-action-error", handleError);
    return () => window.removeEventListener("normaflow:server-action-error", handleError);
  }, []);
  useEffect(() => {
    const handleValidationError = (event: Event) => {
      const message = (event as CustomEvent<{ message?: unknown }>).detail?.message;
      if (message) setModalError(String(message));
    };
    window.addEventListener("normaflow:form-validation-error", handleValidationError);
    return () => window.removeEventListener("normaflow:form-validation-error", handleValidationError);
  }, []);
  return (
    <>
      <button type="button" className="nf-app-btn-primary nf-iso-create-button" onClick={() => { setModalError(""); setOpen(true); }}><Plus size={13} /> {label}</button>
      <Modal open={open} onClose={close} title={label} width={760}>
        <div className="nf-modal-form nf-iso-create-form">
          {modalError && <div className="nf-modal-error" role="alert">{modalError}</div>}
          <div className="nf-iso-create-fields">
            {children(closeAfterSuccess)}
            <button type="button" className="nf-app-btn-ghost nf-iso-create-cancel" onClick={close}>Cancelar</button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function EnergyClient({ initial, demo = false }: { initial: EnergyPayload; demo?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useModuleSection<Tab>("panel");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ kind: EnergyEditorKind; value: any } | null>(null);
  const can = initial.can;
  const live = !demo;
  const s = initial.summary;

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try { await action(); router.refresh(); window.dispatchEvent(new Event("normaflow:server-action-success")); } catch (e) { const message = e instanceof Error ? e.message : "Error inesperado."; setError(message); window.dispatchEvent(new CustomEvent("normaflow:server-action-error", { detail: { message } })); }
    });
  }

  function saveEditor(payload: Record<string, unknown>) {
    if (!editor) return;
    const { kind, value } = editor;
    run(async () => {
      if (kind === "source") await updateEnergySource(value.id, payload as Parameters<typeof updateEnergySource>[1]);
      if (kind === "use") await updateEnergyUse(value.id, payload as Parameters<typeof updateEnergyUse>[1]);
      if (kind === "review") await updateEnergyReview(value.id, payload as Parameters<typeof updateEnergyReview>[1]);
      if (kind === "seu") await updateSignificantEnergyUse(value.id, payload as Parameters<typeof updateSignificantEnergyUse>[1]);
      if (kind === "meter") await updateEnergyMeter(value.id, payload as Parameters<typeof updateEnergyMeter>[1]);
      if (kind === "variable") await updateRelevantVariable(value.id, payload as Parameters<typeof updateRelevantVariable>[1]);
      if (kind === "factor") await updateStaticFactor(value.id, payload as Parameters<typeof updateStaticFactor>[1]);
      if (kind === "opportunity") await updateEnergyOpportunity(value.id, payload as Parameters<typeof updateEnergyOpportunity>[1]);
      if (kind === "plan") await updateEnergyActionPlan(value.id, payload as Parameters<typeof updateEnergyActionPlan>[1]);
      if (kind === "procurement") await updateEnergyProcurementEvaluation(value.id, payload as Parameters<typeof updateEnergyProcurementEvaluation>[1]);
      if (kind === "design") await updateEnergyDesignReview(value.id, payload as Parameters<typeof updateEnergyDesignReview>[1]);
      setEditor(null);
    });
  }

  return (
    <div className="nf-iso-module" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fef9c3", display: "grid", placeItems: "center" }}>
          <Flame size={22} color="#ca8a04" />
        </div>
        <div>
          <ModuleTabs meta={SECTION_META} value={tab} onChange={setTab} />
          <h1 style={{ margin: 0, fontSize: 22 }}>{SECTION_META[tab].title}</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
            {SECTION_META[tab].sub}
          </p>
        </div>
        {demo && <span style={{ ...chip("#eef2ff", "#4f46e5"), marginLeft: "auto" }}>Demo</span>}
      </header>

      {error && <div style={{ ...card, borderColor: "#fecaca", background: "#fef2f2", color: "#b91c1c" }}>{error}</div>}

      {tab === "panel" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
        <Stat label="Consumo periodo" value={Math.round(s.periodConsumption)} suffix=" kWh" />
        <Stat label="SEU" value={s.significantUses} accent={s.significantUses ? "#ca8a04" : undefined} />
        <Stat label="EnPI activos" value={s.enpisActive} />
        <Stat label="Coste periodo" value={s.periodCost} suffix=" €" />
        <Stat label="Acciones abiertas" value={s.actionsOpen} accent={s.actionsOpen ? "#d68a1a" : undefined} />
        <Stat label="Ahorro verificado" value={Math.round(s.absoluteSavings)} suffix=" kWh" accent="#16a34a" />
      </div> : <IsoSectionMetrics items={tab === "sources" ? [{ label: "Fuentes activas", value: s.sources }, { label: "Usos de energía", value: s.uses }, { label: "Consumo del periodo", value: Math.round(s.periodConsumption), suffix: " kWh" }] : tab === "review" ? [{ label: "Revisiones abiertas", value: s.reviewsOpen, accent: s.reviewsOpen ? "#B91C1C" : undefined }, { label: "Fuentes", value: s.sources }, { label: "Líneas base", value: s.baselines }] : tab === "seu" ? [{ label: "Usos significativos", value: s.significantUses, accent: s.significantUses ? "#B45309" : undefined }, { label: "Usos de energía", value: s.uses }, { label: "EnPI activos", value: s.enpisActive }] : tab === "baseline" ? [{ label: "Líneas base activas", value: s.baselines }, { label: "EnPI activos", value: s.enpisActive }, { label: "Consumo del periodo", value: Math.round(s.periodConsumption), suffix: " kWh" }] : tab === "enpi" ? [{ label: "EnPI activos", value: s.enpisActive }, { label: "Consumo del periodo", value: Math.round(s.periodConsumption), suffix: " kWh" }, { label: "Coste del periodo", value: s.periodCost, suffix: " €" }] : tab === "meters" ? [{ label: "Medidores", value: s.meters }, { label: "Consumo medido", value: Math.round(s.periodConsumption), suffix: " kWh" }, { label: "Emisiones", value: s.periodEmissions, suffix: " tCO2e" }] : tab === "variables" ? [{ label: "Variables relevantes", value: s.uses }, { label: "Medidores", value: s.meters }, { label: "EnPI activos", value: s.enpisActive }] : tab === "opportunities" ? [{ label: "Oportunidades abiertas", value: s.opportunitiesOpen, accent: s.opportunitiesOpen ? "#B45309" : undefined }, { label: "Acciones abiertas", value: s.actionsOpen }, { label: "Ahorro verificado", value: Math.round(s.absoluteSavings), suffix: " kWh" }] : tab === "actions" ? [{ label: "Acciones abiertas", value: s.actionsOpen, accent: s.actionsOpen ? "#B45309" : undefined }, { label: "Oportunidades", value: s.opportunitiesOpen }, { label: "Ahorro verificado", value: Math.round(s.absoluteSavings), suffix: " kWh" }] : tab === "savings" ? [{ label: "Verificaciones cerradas", value: s.savingsVerified }, { label: "Ahorro verificado", value: Math.round(s.absoluteSavings), suffix: " kWh", accent: "#15803D" }, { label: "Coste del periodo", value: s.periodCost, suffix: " €" }] : [{ label: "EnPI activos", value: s.enpisActive }, { label: "Medidores", value: s.meters }, { label: "Acciones abiertas", value: s.actionsOpen }]} />}

      {tab === "panel" && (
        <>
          <div className="nf-iso-panel-toolbar"><div><strong>Resumen energético</strong><span>Accesos directos a los registros operativos.</span></div><IsoQuickCreate modulePath="/app/energy" items={[{ label: "Nueva fuente de energía", description: "Registrar una fuente activa", section: "sources", Icon: Fuel }, { label: "Nueva revisión energética", description: "Abrir una revisión del periodo", section: "review", Icon: Search }, { label: "Nuevo uso significativo de energía", description: "Definir un SEU", section: "seu", Icon: Grid3x3 }, { label: "Nuevo medidor", description: "Configurar medición energética", section: "meters", Icon: Activity }, { label: "Nueva oportunidad de mejora", description: "Registrar una oportunidad", section: "opportunities", Icon: Lightbulb }, { label: "Nuevo plan de acción", description: "Crear una acción de mejora", section: "actions", Icon: ListChecks }]} /></div>
          <div className="nf-iso-dashboard-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><Search size={16} aria-hidden />Revisión y SEU (§6.3)</h3>
            <Row k="Fuentes activas" v={s.sources} />
            <Row k="Usos de energía" v={s.uses} />
            <Row k="Usos significativos" v={s.significantUses} />
            <Row k="Revisiones abiertas" v={s.reviewsOpen} danger={s.reviewsOpen > 0} />
            <Row k="Líneas base activas" v={s.baselines} />
          </div>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><Gauge size={16} aria-hidden />Desempeño (§6.4, §9.1)</h3>
            <Row k="EnPI activos" v={s.enpisActive} />
            <Row k="Medidores" v={s.meters} />
            <Row k="Consumo del periodo" v={Math.round(s.periodConsumption)} suffix=" kWh" />
            <Row k="Coste asociado" v={s.periodCost} suffix=" €" />
            <Row k="Emisiones asociadas" v={s.periodEmissions} suffix=" tCO2e" />
          </div>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><Lightbulb size={16} aria-hidden />Mejora (§10.2)</h3>
            <Row k="Oportunidades abiertas" v={s.opportunitiesOpen} danger={s.opportunitiesOpen > 0} />
            <Row k="Planes abiertos" v={s.actionsOpen} danger={s.actionsOpen > 0} />
            <Row k="Verificaciones cerradas" v={s.savingsVerified} />
            <Row k="Ahorro absoluto verificado" v={Math.round(s.absoluteSavings)} suffix=" kWh" />
            <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 12 }}>Las fórmulas de EnPI y ahorro son configurables y versionadas; al cambiar, la versión previa queda supersedida.</p>
          </div>
          </div>
        </>
      )}

      {tab === "sources" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nueva fuente de energía">
              {(close) => <NewSourceForm pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Fuente", "Tipo", "Unidad", "Factor emisión", "Coste/unidad", "Renovable", "Estado", ...(live && can.update ? ["Acciones"] : [])]} title="Registro de fuentes de energía" description="Administra las fuentes que alimentan los usos de energía y sus factores asociados.">
            {initial.sources.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}><b>{row.name}</b></td>
                <td style={td}>{energyLabel(row.sourceType)}</td>
                <td style={td}>{row.unit}</td>
                <td style={td}>{row.emissionFactor ?? "—"} {row.emissionFactor != null ? row.emissionUnit : ""}</td>
                <td style={td}>{row.costPerUnit ?? "—"} {row.costPerUnit != null ? row.currency : ""}</td>
                <td style={td}>{row.renewableShare != null ? `${row.renewableShare}%` : "—"}</td>
                <td style={td}><EnergyStatus value={row.active ? "ACTIVE" : "ARCHIVED"} /></td>
                {live && can.update && <td style={td}><EnergyRowActions><EnergyTableAction icon={Pencil} onClick={() => setEditor({ kind: "source", value: row })}>Editar</EnergyTableAction><EnergyTableAction icon={row.active ? Archive : ArchiveRestore} variant="secondary" onClick={() => run(() => updateEnergySource(row.id, { active: !row.active }))}>{row.active ? "Archivar" : "Activar"}</EnergyTableAction></EnergyRowActions></td>}
              </tr>
            ))}
            {initial.sources.length === 0 && <EmptyEnergyRow colSpan={9 + (live && can.update ? 1 : 0)}>Sin fuentes de energía registradas.</EmptyEnergyRow>}
          </Table>
          {live && can.create && (
            <NewFormToggle label="Nuevo uso de energía">
              {(close) => <NewUseForm sources={initial.sources} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Uso", "Fuente", "Equipo", "Estimación anual", "Estado", ...(live && can.update ? ["Acciones"] : [])]} title="Registro de usos de energía" description="Consulta los usos de energía, su fuente asociada y la estimación anual registrada.">
            {initial.uses.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}><b>{row.name}</b><div style={{ color: "#64748b", fontSize: 12 }}>{row.description ?? ""}</div></td>
                <td style={td}>{row.source?.code ?? "—"}</td>
                <td style={td}>{row.equipment ?? "—"}</td>
                <td style={td}>{row.annualEstimate ?? "—"} {row.unit}</td>
                <td style={td}><EnergyStatus value={row.active ? "ACTIVE" : "ARCHIVED"} /></td>
                {live && can.update && <td style={td}><EnergyRowActions><EnergyTableAction icon={Pencil} onClick={() => setEditor({ kind: "use", value: row })}>Editar</EnergyTableAction><EnergyTableAction icon={row.active ? Archive : ArchiveRestore} variant="secondary" onClick={() => run(() => updateEnergyUse(row.id, { active: !row.active }))}>{row.active ? "Archivar" : "Activar"}</EnergyTableAction></EnergyRowActions></td>}
              </tr>
            ))}
            {initial.uses.length === 0 && <EmptyEnergyRow colSpan={6 + (live && can.update ? 1 : 0)}>Sin usos de energía registrados.</EmptyEnergyRow>}
            {initial.uses.length === 0 && <tr><td style={td} colSpan={6}>Sin usos de energía registrados.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "review" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nueva revisión energética">
              {(close) => <NewReviewForm pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table
            head={["Código", "Título", "Periodo", "Estado", "Acciones"]}
            title="Registro de revisiones energéticas"
            description="Consulta el periodo, el estado y las acciones disponibles para cada revisión energética."
          >
            {initial.reviews.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}><b>{row.title}</b><div style={{ color: "#64748b", fontSize: 12 }}>{row.scope ?? ""}</div></td>
                <td style={td}>{fmt(row.periodStart)} → {fmt(row.periodEnd)}</td>
                <td style={td}><span className={`nf-energy-review-status nf-energy-review-status--${row.status.toLowerCase()}`}>{REVIEW_LABEL[row.status] ?? row.status}</span></td>
                <td style={td}>
                  <div className="nf-energy-table-actions">
                  {live && can.update && row.status !== "APPROVED" && row.status !== "SUPERSEDED" && <EnergyTableAction icon={Pencil} onClick={() => setEditor({ kind: "review", value: row })}>Editar</EnergyTableAction>}
                  {live && nextEnergyReviewStatuses(row.status).map((to) => {
                    const needsApprove = to === "APPROVED";
                    if (needsApprove && !can.approve) return null;
                    if (!needsApprove && !can.update) return null;
                    const isReversal = to === "DRAFT";
                    const label = to === "UNDER_REVIEW" ? "Enviar a revisión" : to === "APPROVED" ? "Aprobar" : to === "DRAFT" ? "Volver a borrador" : REVIEW_LABEL[to] ?? to;
                    return (
                      <EnergyTableAction key={to} icon={isReversal ? Undo2 : needsApprove ? Check : ArrowRight} variant={isReversal ? "secondary" : "primary"} disabled={pending}
                        onClick={() => run(() => transitionEnergyReview(row.id, to as EnergyReviewStatus))}>{label}</EnergyTableAction>
                    );
                  })}
                  </div>
                </td>
              </tr>
            ))}
            {initial.reviews.length === 0 && <EmptyEnergyRow colSpan={5}>Sin revisiones energéticas registradas.</EmptyEnergyRow>}
          </Table>
        </div>
      )}

      {tab === "seu" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo uso significativo de energía">
              {(close) => <NewSeuForm uses={initial.uses} reviews={initial.reviews} members={initial.members} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Uso", "Participación", "Potencial", "Significativo", "Revisión", "Estado", ...(live && can.update ? ["Acciones"] : [])]} title="Registro de usos significativos" description="Identifica los usos significativos de energía, su participación y potencial de mejora.">
            {initial.seus.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}><b>{row.energyUse.code}</b><div style={{ color: "#64748b", fontSize: 12 }}>{row.energyUse.name}</div></td>
                <td style={td}>{row.consumptionShare ?? "—"}%</td>
                <td style={td}>{row.improvementPotential ?? "—"}%</td>
                <td style={td}>{row.significant ? "Sí" : "No"}{row.autoSignificant && !row.significant ? " (criterio)" : ""}</td>
                <td style={td}>{row.review?.code ?? "—"}</td>
                <td style={td}><EnergyStatus value={row.status} /></td>
                {live && can.update && <td style={td}><EnergyRowActions><EnergyTableAction icon={Pencil} onClick={() => setEditor({ kind: "seu", value: row })}>Editar</EnergyTableAction><EnergyTableAction icon={row.status === "ARCHIVED" ? ArchiveRestore : Archive} variant="secondary" onClick={() => run(() => updateSignificantEnergyUse(row.id, { status: row.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED" }))}>{row.status === "ARCHIVED" ? "Activar" : "Archivar"}</EnergyTableAction></EnergyRowActions></td>}
              </tr>
            ))}
            {initial.seus.length === 0 && <EmptyEnergyRow colSpan={7 + (live && can.update ? 1 : 0)}>Sin usos significativos registrados.</EmptyEnergyRow>}
          </Table>
        </div>
      )}

      {tab === "baseline" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nueva línea base (o nueva versión)">
              {(close) => <NewBaselineForm seus={initial.seus} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Versión", "Título", "SEU", "Consumo", "Normalizado", "Método", "Estado"]} title="Registro de líneas base energéticas" description="Compara las versiones de línea base, el consumo registrado y el método de normalización.">
            {initial.baselines.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}>{row.formulaVersion}</td>
                <td style={td}>{row.title}</td>
                <td style={td}>{row.seu?.code ?? "—"}</td>
                <td style={td}>{row.consumption} {row.unit}</td>
                <td style={td}>{row.normalizedConsumption ?? "—"}</td>
                <td style={td}>{energyLabel(row.normalizationMethod)}</td>
                <td style={td}><EnergyStatus value={row.status} /></td>
              </tr>
            ))}
            {initial.baselines.length === 0 && <EmptyEnergyRow colSpan={8}>Sin líneas base energéticas registradas.</EmptyEnergyRow>}
          </Table>
        </div>
      )}

      {tab === "enpi" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo EnPI (o nueva versión)">
              {(close) => <NewEnpiForm seus={initial.seus} baselines={initial.baselines} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Versión", "Nombre", "Fórmula", "Actual", "Base", "Desviación", "Estado"]} title="Registro de indicadores EnPI" description="Consulta las versiones de cada indicador de desempeño energético y su desviación frente a la base.">
            {initial.enpis.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}>{row.formulaVersion}</td>
                <td style={td}><b>{row.name}</b><div style={{ color: "#64748b", fontSize: 12 }}>{row.unit}</div></td>
                <td style={td}>{energyLabel(row.formulaKind)}</td>
                <td style={td}>{row.currentValue ?? "—"}</td>
                <td style={td}>{row.baselineValue ?? "—"}</td>
                <td style={td}>{row.deviationPercent != null ? `${row.deviationPercent}%` : "—"}</td>
                <td style={td}><EnergyStatus value={row.active && !row.superseded ? "ACTIVE" : "ARCHIVED"} /></td>
              </tr>
            ))}
            {initial.enpis.length === 0 && <EmptyEnergyRow colSpan={8}>Sin indicadores EnPI registrados.</EmptyEnergyRow>}
          </Table>
        </div>
      )}

      {tab === "meters" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo medidor">
              {(close) => <NewMeterForm sources={initial.sources} seus={initial.seus} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Medidor", "Fuente", "Unidad", "Lecturas", "Calibración", ...(live && can.update ? ["Acciones"] : [])]} title="Registro de medidores" description="Gestiona los medidores asociados a las fuentes de energía y su calendario de calibración.">
            {initial.meters.map((row) => (
              <tr key={row.id}>
                <td style={td}><b>{row.code}</b><div style={{ color: "#64748b", fontSize: 12 }}>{row.name}</div></td>
                <td style={td}>{row.source?.code ?? "—"}</td>
                <td style={td}>{row.unit}</td>
                <td style={td}>{row._count.readings}</td>
                <td style={td}>{fmt(row.nextCalibration)}</td>
                {live && can.update && <td style={td}><EnergyRowActions><EnergyTableAction icon={Pencil} onClick={() => setEditor({ kind: "meter", value: row })}>Editar</EnergyTableAction><EnergyTableAction icon={row.active ? Archive : ArchiveRestore} variant="secondary" onClick={() => run(() => updateEnergyMeter(row.id, { active: !row.active }))}>{row.active ? "Archivar" : "Activar"}</EnergyTableAction></EnergyRowActions></td>}
              </tr>
            ))}
            {initial.meters.length === 0 && <EmptyEnergyRow colSpan={5 + (live && can.update ? 1 : 0)}>Sin medidores registrados.</EmptyEnergyRow>}
          </Table>
          {live && can.create && (
            <NewFormToggle label="Registrar lectura">
              {(close) => <NewReadingForm meters={initial.meters} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Lectura", "Medidor", "Fecha", "Valor", "Coste", "Emisiones", "Estimada"]} title="Registro de lecturas" description="Consulta las lecturas registradas, el coste y las emisiones calculadas por medidor.">
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
            {initial.readings.length === 0 && <EmptyEnergyRow colSpan={7}>Sin lecturas registradas.</EmptyEnergyRow>}
          </Table>
        </div>
      )}

      {tab === "variables" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nueva variable relevante">
              {(close) => <NewVariableForm pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Variable", "Tipo", "Unidad", "Estado", ...(live && can.update ? ["Acciones"] : [])]} title="Registro de variables relevantes" description="Administra las variables que influyen en el desempeño energético.">
            {initial.variables.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}><b>{row.name}</b><div style={{ color: "#64748b", fontSize: 12 }}>{row.description ?? ""}</div></td>
                <td style={td}>{energyLabel(row.variableType)}</td>
                <td style={td}>{row.unit}</td>
                <td style={td}><EnergyStatus value={row.active ? "ACTIVE" : "ARCHIVED"} /></td>
                {live && can.update && <td style={td}><EnergyRowActions><EnergyTableAction icon={Pencil} onClick={() => setEditor({ kind: "variable", value: row })}>Editar</EnergyTableAction><EnergyTableAction icon={row.active ? Archive : ArchiveRestore} variant="secondary" onClick={() => run(() => updateRelevantVariable(row.id, { active: !row.active }))}>{row.active ? "Archivar" : "Activar"}</EnergyTableAction></EnergyRowActions></td>}
              </tr>
            ))}
            {initial.variables.length === 0 && <EmptyEnergyRow colSpan={5 + (live && can.update ? 1 : 0)}>Sin variables relevantes registradas.</EmptyEnergyRow>}
          </Table>
          {live && can.create && (
            <NewFormToggle label="Nuevo factor estático">
              {(close) => <NewFactorForm pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Factor", "Valor", "Unidad", "Vigente desde", "Vigente hasta", ...(live && can.update ? ["Acciones"] : [])]} title="Registro de factores estáticos" description="Mantén los factores de cálculo y sus periodos de vigencia.">
            {initial.factors.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}><b>{row.name}</b><div style={{ color: "#64748b", fontSize: 12 }}>{row.description ?? ""}</div></td>
                <td style={td}>{row.value}</td>
                <td style={td}>{row.unit}</td>
                <td style={td}>{fmt(row.effectiveFrom)}</td>
                <td style={td}>{fmt(row.effectiveTo)}</td>
                {live && can.update && <td style={td}><EnergyRowActions><EnergyTableAction icon={Pencil} onClick={() => setEditor({ kind: "factor", value: row })}>Editar</EnergyTableAction><EnergyTableAction icon={row.active ? Archive : ArchiveRestore} variant="secondary" onClick={() => run(() => updateStaticFactor(row.id, { active: !row.active, effectiveTo: row.active ? new Date().toISOString() : undefined }))}>{row.active ? "Archivar" : "Activar"}</EnergyTableAction></EnergyRowActions></td>}
              </tr>
            ))}
            {initial.factors.length === 0 && <EmptyEnergyRow colSpan={6 + (live && can.update ? 1 : 0)}>Sin factores estáticos registrados.</EmptyEnergyRow>}
          </Table>
        </div>
      )}

      {tab === "opportunities" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nueva oportunidad de mejora">
              {(close) => <NewOpportunityForm seus={initial.seus} members={initial.members} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Oportunidad", "SEU", "Ahorro est.", "Coste", "Prioridad", "Estado", "Planes", ...(live && can.update ? ["Acciones"] : [])]} title="Registro de oportunidades de mejora" description="Prioriza oportunidades de mejora y consulta su ahorro, coste y estado de avance.">
            {initial.opportunities.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}><b>{row.title}</b></td>
                <td style={td}>{row.seu?.code ?? "—"}</td>
                <td style={td}>{row.estimatedSaving ?? "—"} {row.savingUnit ?? ""}</td>
                <td style={td}>{row.estimatedCost ?? "—"}</td>
                <td style={td}>{energyLabel(row.priority)}</td>
                <td style={td}><EnergyStatus value={row.status} /></td>
                <td style={td}>{row._count.actionPlans}</td>
                {live && can.update && <td style={td}><EnergyRowActions><EnergyTableAction icon={Pencil} onClick={() => setEditor({ kind: "opportunity", value: row })}>Editar</EnergyTableAction></EnergyRowActions></td>}
              </tr>
            ))}
            {initial.opportunities.length === 0 && <EmptyEnergyRow colSpan={8 + (live && can.update ? 1 : 0)}>Sin oportunidades de mejora registradas.</EmptyEnergyRow>}
          </Table>
        </div>
      )}

      {tab === "actions" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo plan de acción">
              {(close) => <NewActionPlanForm opportunities={initial.opportunities} members={initial.members} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Plan", "Oportunidad", "Avance", "Estado", "Vence", "Acciones"]} title="Registro de planes de acción" description="Da seguimiento al avance, vencimiento y estado de los planes de mejora energética.">
            {initial.plans.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}>{row.title}</td>
                <td style={td}>{row.opportunity?.code ?? "—"}</td>
                <td style={td}>{row.progressPercent}%</td>
                <td style={td}><EnergyStatus value={row.status} /></td>
                <td style={td}>{fmt(row.dueDate)}</td>
                <td style={td}><EnergyRowActions>
                  {live && can.update && <EnergyTableAction icon={Pencil} onClick={() => setEditor({ kind: "plan", value: row })}>Editar</EnergyTableAction>}
                  {live && can.update && row.status !== "COMPLETED" && row.status !== "CANCELLED" && (
                    <EnergyTableAction icon={ArrowRight} variant="primary" disabled={pending} onClick={() => run(() => updateEnergyActionProgress(row.id, Math.min(100, row.progressPercent + 25)))}>Avanzar 25 %</EnergyTableAction>
                  )}
                </EnergyRowActions></td>
              </tr>
            ))}
            {initial.plans.length === 0 && <EmptyEnergyRow colSpan={7}>Sin planes de acción registrados.</EmptyEnergyRow>}
          </Table>
        </div>
      )}

      {tab === "savings" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nueva verificación de ahorro">
              {(close) => <NewVerificationForm plans={initial.plans} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Plan", "Absoluto", "Normalizado", "Fórmula", "Estado", "Acciones"]} title="Registro de verificaciones de ahorro" description="Revisa el ahorro calculado por plan y valida las verificaciones pendientes.">
            {initial.verifications.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}>{row.actionPlan.code}</td>
                <td style={td}>{row.absoluteSaving ?? "—"} {row.unit}</td>
                <td style={td}>{row.normalizedSaving ?? "—"}</td>
                <td style={td}>{energyLabel(row.formulaKind)} · v{row.formulaVersion}</td>
                <td style={td}><EnergyStatus value={row.status} /></td>
                <td style={td}><EnergyRowActions>
                  {live && can.approve && row.status !== "VERIFIED" && (
                    <EnergyTableAction icon={Check} variant="primary" disabled={pending} onClick={() => run(() => verifyEnergySaving(row.id))}>Verificar</EnergyTableAction>
                  )}
                </EnergyRowActions></td>
              </tr>
            ))}
            {initial.verifications.length === 0 && <EmptyEnergyRow colSpan={7}>Sin verificaciones de ahorro registradas.</EmptyEnergyRow>}
          </Table>
        </div>
      )}

      {tab === "procurement" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nueva evaluación de compra energética">
              {(close) => <NewProcurementForm pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Evaluación", "Tipo", "Proveedor", "Puntuación", "Resultado", ...(live && can.update ? ["Acciones"] : [])]} title="Registro de evaluaciones de compra" description="Consulta las evaluaciones energéticas realizadas a fuentes, proveedores y compras.">
            {initial.procurement.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}>{row.title}</td>
                <td style={td}>{energyLabel(row.sourceType)}</td>
                <td style={td}>{row.supplierName ?? "—"}</td>
                <td style={td}>{row.totalScore ?? "—"}</td>
                <td style={td}><EnergyStatus value={row.result} /></td>
                {live && can.update && <td style={td}><EnergyRowActions><EnergyTableAction icon={Pencil} onClick={() => setEditor({ kind: "procurement", value: row })}>Editar</EnergyTableAction></EnergyRowActions></td>}
              </tr>
            ))}
            {initial.procurement.length === 0 && <EmptyEnergyRow colSpan={6 + (live && can.update ? 1 : 0)}>Sin evaluaciones de compra registradas.</EmptyEnergyRow>}
          </Table>
        </div>
      )}

      {tab === "design" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nueva revisión de diseño">
              {(close) => <NewDesignReviewForm pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table head={["Código", "Proyecto", "Referencia", "Estado", "Revisado", ...(live && can.update ? ["Acciones"] : [])]} title="Registro de revisiones de diseño" description="Documenta cómo se integra el desempeño energético en cada proyecto o cambio de diseño.">
            {initial.designs.map((row) => (
              <tr key={row.id}>
                <td style={td}>{row.code}</td>
                <td style={td}><b>{row.title}</b><div style={{ color: "#64748b", fontSize: 12 }}>{row.energyConsiderations?.slice(0, 80) ?? ""}</div></td>
                <td style={td}>{row.projectReference ?? "—"}</td>
                <td style={td}><EnergyStatus value={row.status} /></td>
                <td style={td}>{fmt(row.reviewedAt)}</td>
                {live && can.update && <td style={td}><EnergyRowActions><EnergyTableAction icon={Pencil} onClick={() => setEditor({ kind: "design", value: row })}>Editar</EnergyTableAction></EnergyRowActions></td>}
              </tr>
            ))}
            {initial.designs.length === 0 && <EmptyEnergyRow colSpan={5 + (live && can.update ? 1 : 0)}>Sin revisiones de diseño registradas.</EmptyEnergyRow>}
          </Table>
        </div>
      )}
      <Modal open={Boolean(editor)} onClose={() => setEditor(null)} title="Editar registro energético" width={780}>
        {editor && <EnergyRecordEditor kind={editor.kind} value={editor.value} members={initial.members} sources={initial.sources} uses={initial.uses} seus={initial.seus} reviews={initial.reviews} meters={initial.meters} opportunities={initial.opportunities} onCancel={() => setEditor(null)} onSave={saveEditor} />}
      </Modal>
    </div>
  );
}

function Stat({ label, value, accent, suffix }: { label: string; value: number; accent?: string; suffix?: string }) {
  return <IsoMetricCard label={label} value={value} suffix={suffix} accent={accent} />;
}

function Row({ k, v, suffix, danger }: { k: string; v: string | number; suffix?: string; danger?: boolean }) {
  return (
    <div className="nf-iso-dashboard-row">
      <span className="nf-iso-dashboard-row-label">{k}</span>
      <b className="nf-iso-dashboard-row-value" style={{ color: danger ? "#b91c1c" : undefined }}>{v}{suffix ?? ""}</b>
    </div>
  );
}

function EnergyRecordEditor({ kind, value, members, sources, uses, seus, reviews, meters, opportunities, onCancel, onSave }: {
  kind: EnergyEditorKind;
  value: any;
  members: Members;
  sources: EnergyPayload["sources"];
  uses: EnergyPayload["uses"];
  seus: EnergyPayload["seus"];
  reviews: EnergyPayload["reviews"];
  meters: EnergyPayload["meters"];
  opportunities: EnergyPayload["opportunities"];
  onCancel: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const keys = ["name", "title", "description", "sourceType", "unit", "emissionFactor", "costPerUnit", "currency", "renewableShare", "supplierId", "notes", "active", "sourceId", "processId", "locationId", "equipment", "annualEstimate", "periodStart", "periodEnd", "scope", "methodSummary", "findings", "documentId", "evidenceId", "energyUseId", "reviewId", "consumptionShare", "improvementPotential", "significant", "rationale", "ownerId", "status", "serialNumber", "calibrationDate", "nextCalibration", "value", "variableType", "effectiveFrom", "effectiveTo", "estimatedSaving", "estimatedCost", "paybackMonths", "priority", "opportunityId", "progressPercent", "startDate", "dueDate", "capaId", "supplierName", "period", "recommendation", "result", "projectReference", "energyConsiderations", "opportunitiesIdentified"];
    const dateKeys = new Set(["periodStart", "periodEnd", "calibrationDate", "nextCalibration", "effectiveFrom", "effectiveTo", "startDate", "dueDate"]);
    return Object.fromEntries(keys.map((key) => [key, value[key] == null ? "" : dateKeys.has(key) ? fmt(value[key]) : String(value[key])])) as Record<string, string>;
  });
  const [editorError, setEditorError] = useState("");
  const set = (key: string, next: string) => { setEditorError(""); setForm((current) => ({ ...current, [key]: next })); };
  const optional = (key: string) => form[key]?.trim() ? form[key] : undefined;
  const number = (key: string) => form[key]?.trim() ? Number(form[key]) : undefined;
  const date = (key: string) => form[key]?.trim() ? new Date(`${form[key]}T00:00:00.000Z`).toISOString() : undefined;
  const validationError = energyValidationError(kind, form);
  const save = () => {
    if (validationError) { setEditorError(validationError); return; }
    setEditorError("");
    const common = { name: optional("name"), title: optional("title"), description: optional("description"), unit: optional("unit"), notes: optional("notes"), active: form.active === "true" };
    if (kind === "source") onSave({ ...common, sourceType: form.sourceType, emissionFactor: number("emissionFactor"), costPerUnit: number("costPerUnit"), currency: optional("currency"), renewableShare: number("renewableShare"), supplierId: optional("supplierId") });
    if (kind === "use") onSave({ ...common, sourceId: optional("sourceId"), processId: optional("processId"), locationId: optional("locationId"), equipment: optional("equipment"), annualEstimate: number("annualEstimate") });
    if (kind === "review") onSave({ title: form.title, periodStart: date("periodStart"), periodEnd: date("periodEnd"), scope: optional("scope"), methodSummary: optional("methodSummary"), findings: optional("findings"), documentId: optional("documentId"), evidenceId: optional("evidenceId") });
    if (kind === "seu") onSave({ energyUseId: form.energyUseId, reviewId: optional("reviewId"), consumptionShare: number("consumptionShare"), improvementPotential: number("improvementPotential"), significant: form.significant === "true", rationale: optional("rationale"), ownerId: optional("ownerId"), status: form.status });
    if (kind === "meter") onSave({ ...common, sourceId: optional("sourceId"), seuId: optional("seuId"), locationId: optional("locationId"), serialNumber: optional("serialNumber"), calibrationDate: date("calibrationDate"), nextCalibration: date("nextCalibration") });
    if (kind === "variable") onSave({ name: form.name, unit: form.unit, description: optional("description"), variableType: form.variableType, active: form.active === "true" });
    if (kind === "factor") onSave({ name: form.name, value: Number(form.value), unit: form.unit, description: optional("description"), effectiveFrom: date("effectiveFrom"), effectiveTo: date("effectiveTo"), active: form.active === "true" });
    if (kind === "opportunity") onSave({ title: form.title, description: optional("description"), seuId: optional("seuId"), estimatedSaving: number("estimatedSaving"), estimatedCost: number("estimatedCost"), paybackMonths: number("paybackMonths"), priority: form.priority, status: form.status, ownerId: optional("ownerId"), documentId: optional("documentId") });
    if (kind === "plan") onSave({ title: form.title, description: optional("description"), opportunityId: optional("opportunityId"), ownerId: optional("ownerId"), startDate: date("startDate"), dueDate: date("dueDate"), progressPercent: Number(form.progressPercent || 0), status: form.status, capaId: optional("capaId"), documentId: optional("documentId"), evidenceId: optional("evidenceId") });
    if (kind === "procurement") onSave({ title: form.title, sourceType: form.sourceType, supplierName: optional("supplierName"), period: optional("period"), recommendation: optional("recommendation"), result: form.result });
    if (kind === "design") onSave({ title: form.title, projectReference: optional("projectReference"), processId: optional("processId"), locationId: optional("locationId"), description: optional("description"), energyConsiderations: optional("energyConsiderations"), opportunitiesIdentified: optional("opportunitiesIdentified"), status: form.status, documentId: optional("documentId"), evidenceId: optional("evidenceId") });
  };
  const select = (key: string, options: string[]) => <select style={input} value={form[key] ?? ""} onChange={(e) => set(key, e.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  const refSelect = (key: string, options: { id: string; label: string }[], placeholder: string) => <select style={input} value={form[key] ?? ""} onChange={(e) => set(key, e.target.value)}><option value="">{placeholder}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>;
  const field = (key: string, placeholder: string, type = "text") => <input style={input} type={type} placeholder={placeholder} value={form[key] ?? ""} onChange={(e) => set(key, e.target.value)} />;
  const active = <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={form.active === "true"} onChange={(e) => set("active", String(e.target.checked))} /> Activo</label>;
  return <div style={{ display: "grid", gap: 9 }}>
    {editorError && <div className="nf-modal-error" role="alert">{editorError}</div>}
    {kind === "source" && <><div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>{field("name", "Nombre de la fuente")}{select("sourceType", ["ELECTRICITY", "NATURAL_GAS", "DIESEL", "LPG", "FUEL_OIL", "STEAM", "SOLAR", "WIND", "BIOMASS", "OTHER"])}{field("unit", "Unidad")}</div><div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>{field("emissionFactor", "Factor de emisión", "number")}{field("costPerUnit", "Coste/unidad", "number")}<select style={input} value={form.currency ?? ""} onChange={(e) => set("currency", e.target.value)}><option value="">Moneda…</option>{CURRENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}{form.currency && !CURRENCY_OPTIONS.some((option) => option.value === form.currency) && <option value={form.currency}>{form.currency}</option>}</select>{field("renewableShare", "% renovable", "number")}</div>{field("supplierId", "Proveedor (ID)")}{field("notes", "Notas")}{active}</>}
    {kind === "use" && <><div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>{field("name", "Nombre del uso")}{refSelect("sourceId", sources.map((row) => ({ id: row.id, label: row.code })), "Fuente…")}{field("unit", "Unidad")}</div>{field("description", "Descripción")}{field("equipment", "Equipo")}{field("annualEstimate", "Estimación anual", "number")}<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{field("processId", "Proceso (ID)")}{field("locationId", "Sede (ID)")}</div>{active}</>}
    {kind === "review" && <><div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>{field("title", "Título")}{field("periodStart", "Inicio", "date")}{field("periodEnd", "Fin", "date")}</div>{field("scope", "Alcance")}{field("methodSummary", "Método")}{field("findings", "Hallazgos")}{field("documentId", "Documento (ID)")}{field("evidenceId", "Evidencia (ID)")}</>}
    {kind === "seu" && <><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{refSelect("energyUseId", uses.map((row) => ({ id: row.id, label: `${row.code} · ${row.name}` })), "Uso de energía…")}{refSelect("reviewId", reviews.map((row) => ({ id: row.id, label: row.code })), "Revisión…")}</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>{field("consumptionShare", "% consumo", "number")}{field("improvementPotential", "% potencial", "number")}{select("status", ["DRAFT", "ACTIVE", "ARCHIVED", "SUPERSEDED"])}</div>{field("rationale", "Justificación")}{refSelect("ownerId", members.map((row) => ({ id: row.id, label: row.name })), "Responsable…")}<label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={form.significant === "true"} onChange={(e) => set("significant", String(e.target.checked))} /> Significativo</label></>}
    {kind === "meter" && <><div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>{field("name", "Nombre del medidor")}{refSelect("sourceId", sources.map((row) => ({ id: row.id, label: row.code })), "Fuente…")}{refSelect("seuId", seus.map((row) => ({ id: row.id, label: row.code })), "SEU…")}</div><div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>{field("serialNumber", "Nº de serie")}{field("unit", "Unidad")}{field("calibrationDate", "Calibración", "date")}{field("nextCalibration", "Próxima", "date")}</div>{field("locationId", "Sede (ID)")}{field("notes", "Notas")}{active}</>}
    {kind === "variable" && <><div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>{field("name", "Nombre")}{field("unit", "Unidad")}{select("variableType", ["PRODUCTION", "OCCUPANCY", "DEGREE_DAYS", "OPERATING_HOURS", "THROUGHPUT", "WEATHER", "OTHER"])}</div>{field("description", "Descripción")}{active}</>}
    {kind === "factor" && <><div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>{field("name", "Nombre")}{field("value", "Valor", "number")}{field("unit", "Unidad")}</div>{field("description", "Descripción")}<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{field("effectiveFrom", "Vigente desde", "date")}{field("effectiveTo", "Vigente hasta", "date")}</div>{active}</>}
    {kind === "opportunity" && <><div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>{field("title", "Título")}{select("priority", ["LOW", "MEDIUM", "HIGH", "CRITICAL"])}{select("status", ["IDENTIFIED", "UNDER_ANALYSIS", "APPROVED", "IN_IMPLEMENTATION", "VERIFIED", "REJECTED", "CLOSED"])}</div>{field("description", "Descripción")}{refSelect("seuId", seus.map((row) => ({ id: row.id, label: row.code })), "SEU…")}<div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>{field("estimatedSaving", "Ahorro est.", "number")}{field("estimatedCost", "Coste est.", "number")}{field("paybackMonths", "Payback (meses)", "number")}</div>{refSelect("ownerId", members.map((row) => ({ id: row.id, label: row.name })), "Responsable…")}{field("documentId", "Documento (ID)")}</>}
    {kind === "plan" && <><div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>{field("title", "Título")}{select("status", ["PLANNED", "IN_PROGRESS", "DELAYED", "COMPLETED", "CANCELLED"])}</div>{field("description", "Descripción")}{refSelect("opportunityId", opportunities.map((row) => ({ id: row.id, label: row.code })), "Oportunidad…")}{refSelect("ownerId", members.map((row) => ({ id: row.id, label: row.name })), "Responsable…")}<div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>{field("startDate", "Inicio", "date")}{field("dueDate", "Vencimiento", "date")}{field("progressPercent", "Avance %", "number")}</div><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>{field("capaId", "CAPA (ID)")}{field("documentId", "Documento (ID)")}{field("evidenceId", "Evidencia (ID)")}</div></>}
    {kind === "procurement" && <><div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>{field("title", "Título")}{select("sourceType", ["ELECTRICITY", "NATURAL_GAS", "DIESEL", "LPG", "FUEL_OIL", "STEAM", "SOLAR", "WIND", "BIOMASS", "OTHER"])}{select("result", ["UNDER_REVIEW", "PREFERRED", "ACCEPTABLE", "NOT_RECOMMENDED", "SELECTED"])}</div>{field("supplierName", "Proveedor")}{field("period", "Periodo")}{field("recommendation", "Recomendación")}</>}
    {kind === "design" && <><div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>{field("title", "Título")}{select("status", ["DRAFT", "IN_REVIEW", "APPROVED", "CHANGES_REQUIRED", "CLOSED"])}</div>{field("projectReference", "Referencia del proyecto")}{field("description", "Descripción")}{field("energyConsiderations", "Consideraciones energéticas")}{field("opportunitiesIdentified", "Oportunidades identificadas")}<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{field("processId", "Proceso (ID)")}{field("locationId", "Sede (ID)")}</div>{field("documentId", "Documento (ID)")}{field("evidenceId", "Evidencia (ID)")}</>}
    <div className="nf-energy-editor-actions"><button type="button" className="nf-app-btn-ghost" onClick={onCancel}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={Boolean(validationError)} onClick={save} title={validationError ?? undefined}>Guardar cambios</button></div>
  </div>;
}

function Table({ head, children, title, description }: { head: string[]; children: React.ReactNode; title?: string; description?: string }) {
  return <IsoTableCard icon={Flame} headers={head} title={title} description={description}>{children}</IsoTableCard>;
}

function EnergyTableAction({ icon: Icon, children, onClick, variant = "default", disabled = false }: { icon: typeof Pencil; children: React.ReactNode; onClick: () => void; variant?: "default" | "primary" | "secondary"; disabled?: boolean }) {
  return <button type="button" className={`nf-table-action nf-table-action--${variant}`} disabled={disabled} onClick={onClick}><Icon size={13} strokeWidth={2} aria-hidden /><span>{children}</span></button>;
}

function EnergyStatus({ value }: { value: string }) {
  return <span className={`nf-energy-status nf-energy-status--${value.toLowerCase()}`}>{energyLabel(value)}</span>;
}

function EnergyRowActions({ children }: { children: React.ReactNode }) {
  return <div className="nf-energy-table-actions">{children}</div>;
}

function EmptyEnergyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return <tr><td colSpan={colSpan} className="nf-energy-empty-cell">{children}</td></tr>;
}

// ─────────────────────────────────────────────────────
// Formularios de creación
// ─────────────────────────────────────────────────────

function NewSourceForm({ pending, run, onDone }: { pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ name: "", sourceType: "ELECTRICITY", unit: "kWh", emissionFactor: "", costPerUnit: "", currency: "EUR", renewableShare: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input style={input} placeholder="Nombre de la fuente" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <select style={input} value={f.sourceType} onChange={(e) => set("sourceType", e.target.value)}>{["ELECTRICITY", "NATURAL_GAS", "DIESEL", "LPG", "FUEL_OIL", "STEAM", "DISTRICT_HEATING", "DISTRICT_COOLING", "SOLAR", "WIND", "BIOMASS", "OTHER"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        <input style={input} placeholder="Unidad" value={f.unit} onChange={(e) => set("unit", e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        <input style={input} type="number" step="any" placeholder="Factor emisión (tCO2e/unidad)" value={f.emissionFactor} onChange={(e) => set("emissionFactor", e.target.value)} />
        <input style={input} type="number" step="any" placeholder="Coste/unidad" value={f.costPerUnit} onChange={(e) => set("costPerUnit", e.target.value)} />
        <select style={input} value={f.currency} onChange={(e) => set("currency", e.target.value)}><option value="">Moneda…</option>{CURRENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        <input style={input} type="number" min={0} max={100} placeholder="% renovable" value={f.renewableShare} onChange={(e) => set("renewableShare", e.target.value)} />
      </div>
      <button disabled={pending || !filled(f.name) || !filled(f.unit) || !validOptionalNumber(f.emissionFactor) || !validOptionalNumber(f.costPerUnit) || !validOptionalNumber(f.renewableShare, 0, 100)} style={primaryBtn} onClick={() => submitCreate(filled(f.name) && filled(f.unit) && validOptionalNumber(f.emissionFactor) && validOptionalNumber(f.costPerUnit) && validOptionalNumber(f.renewableShare, 0, 100), "Completa el nombre y la unidad; los valores numéricos deben ser válidos.", () => createEnergySource({ name: f.name.trim(), sourceType: f.sourceType as never, unit: f.unit.trim(), emissionFactor: filled(f.emissionFactor) ? Number(f.emissionFactor) : undefined, costPerUnit: filled(f.costPerUnit) ? Number(f.costPerUnit) : undefined, currency: f.currency || undefined, renewableShare: filled(f.renewableShare) ? Number(f.renewableShare) : undefined }), run, onDone)}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewUseForm({ sources, pending, run, onDone }: { sources: EnergyPayload["sources"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ name: "", description: "", sourceId: "", equipment: "", annualEstimate: "", unit: "kWh" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <input style={input} placeholder="Nombre del uso" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <select style={input} value={f.sourceId} onChange={(e) => set("sourceId", e.target.value)}><option value="">Fuente…</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</select>
      </div>
      <input style={input} placeholder="Descripción" value={f.description} onChange={(e) => set("description", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input style={input} placeholder="Equipo" value={f.equipment} onChange={(e) => set("equipment", e.target.value)} />
        <input style={input} type="number" step="any" placeholder="Estimación anual" value={f.annualEstimate} onChange={(e) => set("annualEstimate", e.target.value)} />
        <input style={input} placeholder="Unidad" value={f.unit} onChange={(e) => set("unit", e.target.value)} />
      </div>
      <button disabled={pending || !filled(f.name) || !filled(f.unit) || !validOptionalNumber(f.annualEstimate)} style={primaryBtn} onClick={() => submitCreate(filled(f.name) && filled(f.unit) && validOptionalNumber(f.annualEstimate), "Completa el nombre y la unidad; la estimación anual debe ser un número igual o mayor que cero.", () => createEnergyUse({ name: f.name.trim(), description: filled(f.description) ? f.description.trim() : undefined, sourceId: f.sourceId || undefined, equipment: filled(f.equipment) ? f.equipment.trim() : undefined, annualEstimate: filled(f.annualEstimate) ? Number(f.annualEstimate) : undefined, unit: f.unit.trim() }), run, onDone)}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewReviewForm({ pending, run, onDone }: { pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", periodStart: "", periodEnd: "", scope: "", methodSummary: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input style={input} placeholder="Título de la revisión" value={f.title} onChange={(e) => set("title", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input style={input} type="date" value={f.periodStart} onChange={(e) => set("periodStart", e.target.value)} />
        <input style={input} type="date" value={f.periodEnd} onChange={(e) => set("periodEnd", e.target.value)} />
      </div>
      <input style={input} placeholder="Alcance" value={f.scope} onChange={(e) => set("scope", e.target.value)} />
      <input style={input} placeholder="Resumen del método" value={f.methodSummary} onChange={(e) => set("methodSummary", e.target.value)} />
      <button disabled={pending || !filled(f.title) || !validDateRange(f.periodStart, f.periodEnd)} style={primaryBtn} onClick={() => submitCreate(filled(f.title) && validDateRange(f.periodStart, f.periodEnd), "Completa el título y selecciona un periodo válido; la fecha final no puede ser anterior a la inicial.", () => createEnergyReview({ title: f.title.trim(), periodStart: new Date(`${f.periodStart}T00:00:00.000Z`).toISOString(), periodEnd: new Date(`${f.periodEnd}T00:00:00.000Z`).toISOString(), scope: filled(f.scope) ? f.scope.trim() : undefined, methodSummary: filled(f.methodSummary) ? f.methodSummary.trim() : undefined }), run, onDone)}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewSeuForm({ uses, reviews, members, pending, run, onDone }: { uses: EnergyPayload["uses"]; reviews: EnergyPayload["reviews"]; members: Members; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ energyUseId: "", reviewId: "", consumptionShare: "", improvementPotential: "", rationale: "", ownerId: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <select style={input} value={f.energyUseId} onChange={(e) => set("energyUseId", e.target.value)}><option value="">Uso de energía…</option>{uses.map((u) => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}</select>
        <select style={input} value={f.reviewId} onChange={(e) => set("reviewId", e.target.value)}><option value="">Revisión…</option>{reviews.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}</select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <input style={input} type="number" min={0} max={100} placeholder="% participación" value={f.consumptionShare} onChange={(e) => set("consumptionShare", e.target.value)} />
        <input style={input} type="number" min={0} max={100} placeholder="% potencial de mejora" value={f.improvementPotential} onChange={(e) => set("improvementPotential", e.target.value)} />
        <select style={input} value={f.ownerId} onChange={(e) => set("ownerId", e.target.value)}><option value="">Responsable…</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
      </div>
      <input style={input} placeholder="Motivo de significancia" value={f.rationale} onChange={(e) => set("rationale", e.target.value)} />
      <button disabled={pending || !filled(f.energyUseId) || !validOptionalNumber(f.consumptionShare, 0, 100) || !validOptionalNumber(f.improvementPotential, 0, 100)} style={primaryBtn} onClick={() => submitCreate(filled(f.energyUseId) && validOptionalNumber(f.consumptionShare, 0, 100) && validOptionalNumber(f.improvementPotential, 0, 100), "Selecciona un uso de energía; los porcentajes deben estar entre 0 y 100.", () => createSignificantEnergyUse({ energyUseId: f.energyUseId, reviewId: f.reviewId || undefined, consumptionShare: filled(f.consumptionShare) ? Number(f.consumptionShare) : undefined, improvementPotential: filled(f.improvementPotential) ? Number(f.improvementPotential) : undefined, rationale: filled(f.rationale) ? f.rationale.trim() : undefined, ownerId: f.ownerId || undefined }), run, onDone)}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewBaselineForm({ seus, pending, run, onDone }: { seus: EnergyPayload["seus"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ code: "", title: "", seuId: "", periodStart: "", periodEnd: "", consumption: "", unit: "kWh", normalizationMethod: "NONE" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <p style={{ margin: 0, color: "#94a3b8", fontSize: 11 }}>Usa el mismo código de una línea base existente para crear una nueva versión (la anterior queda supersedida automáticamente).</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 8 }}>
        <input style={input} placeholder="Código (opcional, para versionar)" value={f.code} onChange={(e) => set("code", e.target.value)} />
        <input style={input} placeholder="Título" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <select style={input} value={f.seuId} onChange={(e) => set("seuId", e.target.value)}><option value="">SEU…</option>{seus.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 8 }}>
        <input style={input} type="date" value={f.periodStart} onChange={(e) => set("periodStart", e.target.value)} />
        <input style={input} type="date" value={f.periodEnd} onChange={(e) => set("periodEnd", e.target.value)} />
        <input style={input} type="number" step="any" placeholder="Consumo" value={f.consumption} onChange={(e) => set("consumption", e.target.value)} />
        <input style={input} placeholder="Unidad" value={f.unit} onChange={(e) => set("unit", e.target.value)} />
        <select style={input} value={f.normalizationMethod} onChange={(e) => set("normalizationMethod", e.target.value)}>{["NONE", "RATIO", "LINEAR", "CUSTOM"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
      </div>
      <button disabled={pending || !filled(f.title) || !validDateRange(f.periodStart, f.periodEnd) || !validNumber(f.consumption) || !filled(f.unit)} style={primaryBtn} onClick={() => submitCreate(filled(f.title) && validDateRange(f.periodStart, f.periodEnd) && validNumber(f.consumption) && filled(f.unit), "Completa título, fechas, consumo y unidad; revisa que el periodo sea válido.", () => createEnergyBaseline({ code: filled(f.code) ? f.code.trim() : undefined, title: f.title.trim(), seuId: f.seuId || undefined, periodStart: new Date(`${f.periodStart}T00:00:00.000Z`).toISOString(), periodEnd: new Date(`${f.periodEnd}T00:00:00.000Z`).toISOString(), consumption: Number(f.consumption), unit: f.unit.trim(), normalizationMethod: f.normalizationMethod as never }), run, onDone)}><Plus size={12} /> Crear / versionar</button>
    </div>
  );
}

function NewEnpiForm({ seus, baselines, pending, run, onDone }: { seus: EnergyPayload["seus"]; baselines: EnergyPayload["baselines"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ code: "", name: "", seuId: "", baselineId: "", formulaKind: "INTENSITY", unit: "kWh/unit", targetValue: "", currentValue: "", baselineValue: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <p style={{ margin: 0, color: "#94a3b8", fontSize: 11 }}>Usa el mismo código de un EnPI existente para crear una nueva versión de la fórmula (la anterior queda supersedida).</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <input style={input} placeholder="Código (opcional, para versionar)" value={f.code} onChange={(e) => set("code", e.target.value)} />
        <input style={input} placeholder="Nombre del EnPI" value={f.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <select style={input} value={f.seuId} onChange={(e) => set("seuId", e.target.value)}><option value="">SEU…</option>{seus.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</select>
        <select style={input} value={f.baselineId} onChange={(e) => set("baselineId", e.target.value)}><option value="">Línea base…</option>{baselines.map((b) => <option key={b.id} value={b.id}>{b.code} v{b.formulaVersion}</option>)}</select>
        <select style={input} value={f.formulaKind} onChange={(e) => set("formulaKind", e.target.value)}>{["CONSUMPTION", "INTENSITY", "BASELINE_COMPARISON", "DEVIATION", "ABSOLUTE_SAVINGS", "NORMALIZED_SAVINGS", "COST", "EMISSIONS", "CUSTOM"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        <input style={input} placeholder="Unidad" value={f.unit} onChange={(e) => set("unit", e.target.value)} />
        <input style={input} type="number" step="any" placeholder="Objetivo" value={f.targetValue} onChange={(e) => set("targetValue", e.target.value)} />
        <input style={input} type="number" step="any" placeholder="Valor actual" value={f.currentValue} onChange={(e) => set("currentValue", e.target.value)} />
        <input style={input} type="number" step="any" placeholder="Valor base" value={f.baselineValue} onChange={(e) => set("baselineValue", e.target.value)} />
      </div>
      <button disabled={pending || !filled(f.name) || !filled(f.unit) || !validOptionalNumber(f.targetValue) || !validOptionalNumber(f.currentValue) || !validOptionalNumber(f.baselineValue)} style={primaryBtn} onClick={() => submitCreate(filled(f.name) && filled(f.unit) && validOptionalNumber(f.targetValue) && validOptionalNumber(f.currentValue) && validOptionalNumber(f.baselineValue), "Completa el nombre y la unidad; los valores numéricos deben ser válidos.", () => createOrVersionEnpi({ code: filled(f.code) ? f.code.trim() : undefined, name: f.name.trim(), seuId: f.seuId || undefined, baselineId: f.baselineId || undefined, formulaKind: f.formulaKind as never, unit: f.unit.trim(), targetValue: filled(f.targetValue) ? Number(f.targetValue) : undefined, currentValue: filled(f.currentValue) ? Number(f.currentValue) : undefined, baselineValue: filled(f.baselineValue) ? Number(f.baselineValue) : undefined }), run, onDone)}><Plus size={12} /> Crear / versionar</button>
    </div>
  );
}

function NewMeterForm({ sources, seus, pending, run, onDone }: { sources: EnergyPayload["sources"]; seus: EnergyPayload["seus"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ name: "", sourceId: "", seuId: "", serialNumber: "", unit: "kWh", calibrationDate: "", nextCalibration: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <label className="nf-modal-field"><span className="nf-modal-field-label">Nombre del medidor</span><input style={input} value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
        <label className="nf-modal-field"><span className="nf-modal-field-label">Fuente</span><select style={input} value={f.sourceId} onChange={(e) => set("sourceId", e.target.value)}><option value="">Seleccionar…</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</select></label>
        <label className="nf-modal-field"><span className="nf-modal-field-label">SEU</span><select style={input} value={f.seuId} onChange={(e) => set("seuId", e.target.value)}><option value="">Seleccionar…</option>{seus.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</select></label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        <label className="nf-modal-field"><span className="nf-modal-field-label">Nº de serie</span><input style={input} value={f.serialNumber} onChange={(e) => set("serialNumber", e.target.value)} /></label>
        <label className="nf-modal-field"><span className="nf-modal-field-label">Unidad</span><input style={input} value={f.unit} onChange={(e) => set("unit", e.target.value)} /></label>
        <label className="nf-modal-field"><span className="nf-modal-field-label">Última calibración</span><input style={input} type="date" value={f.calibrationDate} onChange={(e) => set("calibrationDate", e.target.value)} /></label>
        <label className="nf-modal-field"><span className="nf-modal-field-label">Próxima calibración</span><input style={input} type="date" value={f.nextCalibration} onChange={(e) => set("nextCalibration", e.target.value)} /></label>
      </div>
      <button disabled={pending || !filled(f.name) || !filled(f.unit) || (filled(f.calibrationDate) && filled(f.nextCalibration) && !validDateRange(f.calibrationDate, f.nextCalibration))} style={primaryBtn} onClick={() => submitCreate(filled(f.name) && filled(f.unit) && (!filled(f.calibrationDate) || !filled(f.nextCalibration) || validDateRange(f.calibrationDate, f.nextCalibration)), "Completa el nombre y la unidad; la próxima calibración no puede ser anterior a la última.", () => createEnergyMeter({ name: f.name.trim(), sourceId: f.sourceId || undefined, seuId: f.seuId || undefined, serialNumber: filled(f.serialNumber) ? f.serialNumber.trim() : undefined, unit: f.unit.trim(), calibrationDate: f.calibrationDate || undefined, nextCalibration: f.nextCalibration || undefined }), run, onDone)}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewReadingForm({ meters, pending, run, onDone }: { meters: EnergyPayload["meters"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ meterId: "", readingAt: "", value: "", estimated: false });
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <label className="nf-modal-field"><span className="nf-modal-field-label">Medidor</span><select style={input} value={f.meterId} onChange={(e) => set("meterId", e.target.value)}><option value="">Seleccionar…</option>{meters.map((m) => <option key={m.id} value={m.id}>{m.code}</option>)}</select></label>
        <label className="nf-modal-field"><span className="nf-modal-field-label">Fecha de lectura</span><input style={input} type="date" value={f.readingAt} onChange={(e) => set("readingAt", e.target.value)} /></label>
        <label className="nf-modal-field"><span className="nf-modal-field-label">Valor</span><input style={input} type="number" step="any" value={f.value} onChange={(e) => set("value", e.target.value)} /></label>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={f.estimated} onChange={(e) => set("estimated", e.target.checked)} /> Lectura estimada</label>
      <button disabled={pending || !filled(f.meterId) || !validNumber(f.value)} style={primaryBtn} onClick={() => submitCreate(filled(f.meterId) && validNumber(f.value), "Selecciona un medidor e indica un valor numérico igual o mayor que cero.", () => recordEnergyReading({ meterId: f.meterId, readingAt: f.readingAt || undefined, value: Number(f.value), estimated: f.estimated }), run, onDone)}><Plus size={12} /> Registrar</button>
    </div>
  );
}

function NewVariableForm({ pending, run, onDone }: { pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ name: "", unit: "", description: "", variableType: "PRODUCTION" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input style={input} placeholder="Nombre de la variable" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <input style={input} placeholder="Unidad" value={f.unit} onChange={(e) => set("unit", e.target.value)} />
        <select style={input} value={f.variableType} onChange={(e) => set("variableType", e.target.value)}>{["PRODUCTION", "OCCUPANCY", "DEGREE_DAYS", "OPERATING_HOURS", "THROUGHPUT", "WEATHER", "OTHER"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
      </div>
      <input style={input} placeholder="Descripción" value={f.description} onChange={(e) => set("description", e.target.value)} />
      <button disabled={pending || !filled(f.name) || !filled(f.unit)} style={primaryBtn} onClick={() => submitCreate(filled(f.name) && filled(f.unit), "Completa el nombre y la unidad de la variable.", () => createRelevantVariable({ name: f.name.trim(), unit: f.unit.trim(), description: filled(f.description) ? f.description.trim() : undefined, variableType: f.variableType as never }), run, onDone)}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewFactorForm({ pending, run, onDone }: { pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ name: "", value: "", unit: "", description: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input style={input} placeholder="Nombre del factor" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <input style={input} type="number" step="any" placeholder="Valor" value={f.value} onChange={(e) => set("value", e.target.value)} />
        <input style={input} placeholder="Unidad" value={f.unit} onChange={(e) => set("unit", e.target.value)} />
      </div>
      <input style={input} placeholder="Descripción" value={f.description} onChange={(e) => set("description", e.target.value)} />
      <button disabled={pending || !filled(f.name) || !validNumber(f.value) || !filled(f.unit)} style={primaryBtn} onClick={() => submitCreate(filled(f.name) && validNumber(f.value) && filled(f.unit), "Completa nombre, valor y unidad; el valor debe ser numérico.", () => createStaticFactor({ name: f.name.trim(), value: Number(f.value), unit: f.unit.trim(), description: filled(f.description) ? f.description.trim() : undefined }), run, onDone)}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewOpportunityForm({ seus, members, pending, run, onDone }: { seus: EnergyPayload["seus"]; members: Members; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", description: "", seuId: "", estimatedSaving: "", estimatedCost: "", paybackMonths: "", priority: "MEDIUM", ownerId: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input style={input} placeholder="Título de la oportunidad" value={f.title} onChange={(e) => set("title", e.target.value)} />
      <input style={input} placeholder="Descripción" value={f.description} onChange={(e) => set("description", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
        <select style={input} value={f.seuId} onChange={(e) => set("seuId", e.target.value)}><option value="">SEU…</option>{seus.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</select>
        <input style={input} type="number" step="any" placeholder="Ahorro est." value={f.estimatedSaving} onChange={(e) => set("estimatedSaving", e.target.value)} />
        <input style={input} type="number" step="any" placeholder="Coste est." value={f.estimatedCost} onChange={(e) => set("estimatedCost", e.target.value)} />
        <input style={input} type="number" step="any" placeholder="Payback (meses)" value={f.paybackMonths} onChange={(e) => set("paybackMonths", e.target.value)} />
        <select style={input} value={f.priority} onChange={(e) => set("priority", e.target.value)}>{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
      </div>
      <select style={input} value={f.ownerId} onChange={(e) => set("ownerId", e.target.value)}><option value="">Responsable…</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
      <button disabled={pending || !filled(f.title) || !validOptionalNumber(f.estimatedSaving) || !validOptionalNumber(f.estimatedCost) || !validOptionalNumber(f.paybackMonths)} style={primaryBtn} onClick={() => submitCreate(filled(f.title) && validOptionalNumber(f.estimatedSaving) && validOptionalNumber(f.estimatedCost) && validOptionalNumber(f.paybackMonths), "Completa el título; los importes y el payback deben ser números válidos.", () => createEnergyOpportunity({ title: f.title.trim(), description: filled(f.description) ? f.description.trim() : undefined, seuId: f.seuId || undefined, estimatedSaving: filled(f.estimatedSaving) ? Number(f.estimatedSaving) : undefined, estimatedCost: filled(f.estimatedCost) ? Number(f.estimatedCost) : undefined, paybackMonths: filled(f.paybackMonths) ? Number(f.paybackMonths) : undefined, priority: f.priority as never, ownerId: f.ownerId || undefined }), run, onDone)}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewActionPlanForm({ opportunities, members, pending, run, onDone }: { opportunities: EnergyPayload["opportunities"]; members: Members; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", description: "", opportunityId: "", ownerId: "", startDate: "", dueDate: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input style={input} placeholder="Título del plan" value={f.title} onChange={(e) => set("title", e.target.value)} />
      <input style={input} placeholder="Descripción" value={f.description} onChange={(e) => set("description", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        <select style={input} value={f.opportunityId} onChange={(e) => set("opportunityId", e.target.value)}><option value="">Oportunidad…</option>{opportunities.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}</select>
        <select style={input} value={f.ownerId} onChange={(e) => set("ownerId", e.target.value)}><option value="">Responsable…</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <input style={input} type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} />
        <input style={input} type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
      </div>
      <button disabled={pending || !filled(f.title) || (filled(f.startDate) && filled(f.dueDate) && !validDateRange(f.startDate, f.dueDate))} style={primaryBtn} onClick={() => submitCreate(filled(f.title) && (!filled(f.startDate) || !filled(f.dueDate) || validDateRange(f.startDate, f.dueDate)), "Completa el título; la fecha de vencimiento no puede ser anterior al inicio.", () => createEnergyActionPlan({ title: f.title.trim(), description: filled(f.description) ? f.description.trim() : undefined, opportunityId: f.opportunityId || undefined, ownerId: f.ownerId || undefined, startDate: f.startDate || undefined, dueDate: f.dueDate || undefined }), run, onDone)}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewVerificationForm({ plans, pending, run, onDone }: { plans: EnergyPayload["plans"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ actionPlanId: "", periodStart: "", periodEnd: "", baselineConsumption: "", actualConsumption: "", unit: "kWh", formulaKind: "ABSOLUTE_SAVINGS", emissionFactor: "", costPerUnit: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <select style={input} value={f.actionPlanId} onChange={(e) => set("actionPlanId", e.target.value)}><option value="">Plan de acción…</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}</select>
        <input style={input} type="date" value={f.periodStart} onChange={(e) => set("periodStart", e.target.value)} />
        <input style={input} type="date" value={f.periodEnd} onChange={(e) => set("periodEnd", e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        <input style={input} type="number" step="any" placeholder="Consumo base" value={f.baselineConsumption} onChange={(e) => set("baselineConsumption", e.target.value)} />
        <input style={input} type="number" step="any" placeholder="Consumo actual" value={f.actualConsumption} onChange={(e) => set("actualConsumption", e.target.value)} />
        <input style={input} placeholder="Unidad" value={f.unit} onChange={(e) => set("unit", e.target.value)} />
        <select style={input} value={f.formulaKind} onChange={(e) => set("formulaKind", e.target.value)}>{["ABSOLUTE_SAVINGS", "NORMALIZED_SAVINGS", "COST", "EMISSIONS", "CUSTOM"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input style={input} type="number" step="any" placeholder="Factor de emisión (opcional)" value={f.emissionFactor} onChange={(e) => set("emissionFactor", e.target.value)} />
        <input style={input} type="number" step="any" placeholder="Coste/unidad (opcional)" value={f.costPerUnit} onChange={(e) => set("costPerUnit", e.target.value)} />
      </div>
      <button disabled={pending || !filled(f.actionPlanId) || !validDateRange(f.periodStart, f.periodEnd) || !validNumber(f.baselineConsumption) || !validNumber(f.actualConsumption) || !filled(f.unit) || !validOptionalNumber(f.emissionFactor) || !validOptionalNumber(f.costPerUnit)} style={primaryBtn} onClick={() => submitCreate(filled(f.actionPlanId) && validDateRange(f.periodStart, f.periodEnd) && validNumber(f.baselineConsumption) && validNumber(f.actualConsumption) && filled(f.unit) && validOptionalNumber(f.emissionFactor) && validOptionalNumber(f.costPerUnit), "Completa plan, fechas, consumos y unidad; revisa que los valores sean válidos.", () => createEnergySavingVerification({ actionPlanId: f.actionPlanId, periodStart: new Date(`${f.periodStart}T00:00:00.000Z`).toISOString(), periodEnd: new Date(`${f.periodEnd}T00:00:00.000Z`).toISOString(), baselineConsumption: Number(f.baselineConsumption), actualConsumption: Number(f.actualConsumption), unit: f.unit.trim(), formulaKind: f.formulaKind as never, emissionFactor: filled(f.emissionFactor) ? Number(f.emissionFactor) : undefined, costPerUnit: filled(f.costPerUnit) ? Number(f.costPerUnit) : undefined }), run, onDone)}><Plus size={12} /> Calcular y registrar</button>
    </div>
  );
}

function NewProcurementForm({ pending, run, onDone }: { pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", sourceType: "ELECTRICITY", supplierName: "", period: "", recommendation: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input style={input} placeholder="Título de la evaluación" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <select style={input} value={f.sourceType} onChange={(e) => set("sourceType", e.target.value)}>{["ELECTRICITY", "NATURAL_GAS", "DIESEL", "OTHER"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        <input style={input} placeholder="Periodo" value={f.period} onChange={(e) => set("period", e.target.value)} />
      </div>
      <input style={input} placeholder="Nombre del proveedor" value={f.supplierName} onChange={(e) => set("supplierName", e.target.value)} />
      <input style={input} placeholder="Recomendación" value={f.recommendation} onChange={(e) => set("recommendation", e.target.value)} />
      <button disabled={pending || !filled(f.title)} style={primaryBtn} onClick={() => submitCreate(filled(f.title), "Completa el título de la evaluación.", () => createEnergyProcurementEvaluation({ title: f.title.trim(), sourceType: f.sourceType as never, supplierName: filled(f.supplierName) ? f.supplierName.trim() : undefined, period: filled(f.period) ? f.period.trim() : undefined, recommendation: filled(f.recommendation) ? f.recommendation.trim() : undefined }), run, onDone)}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewDesignReviewForm({ pending, run, onDone }: { pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", projectReference: "", description: "", energyConsiderations: "", opportunitiesIdentified: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <input style={input} placeholder="Título del proyecto" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <input style={input} placeholder="Referencia del proyecto" value={f.projectReference} onChange={(e) => set("projectReference", e.target.value)} />
      </div>
      <input style={input} placeholder="Descripción" value={f.description} onChange={(e) => set("description", e.target.value)} />
      <input style={input} placeholder="Consideraciones energéticas" value={f.energyConsiderations} onChange={(e) => set("energyConsiderations", e.target.value)} />
      <input style={input} placeholder="Oportunidades identificadas" value={f.opportunitiesIdentified} onChange={(e) => set("opportunitiesIdentified", e.target.value)} />
      <button disabled={pending || !filled(f.title)} style={primaryBtn} onClick={() => submitCreate(filled(f.title), "Completa el título del proyecto.", () => createEnergyDesignReview({ title: f.title.trim(), projectReference: filled(f.projectReference) ? f.projectReference.trim() : undefined, description: filled(f.description) ? f.description.trim() : undefined, energyConsiderations: filled(f.energyConsiderations) ? f.energyConsiderations.trim() : undefined, opportunitiesIdentified: filled(f.opportunitiesIdentified) ? f.opportunitiesIdentified.trim() : undefined }), run, onDone)}><Plus size={12} /> Crear</button>
    </div>
  );
}
