"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Package, FlaskConical, GitBranch, AlertTriangle, Shield,
  Crosshair, Activity, ArrowLeftRight, Undo2, Egg, Siren, ArrowRight, Check, Plus, X, MessageSquare, Pencil, Archive, ArchiveRestore,
} from "lucide-react";
import type { FoodSafetyPayload } from "@/lib/food-safety/queries";
import {
  approveHazardAssessment,
  runFoodTraceabilityTest,
  transitionDeviation,
  transitionProcessFlow,
  transitionWithdrawalRecall,
  transitionFoodSafetyEmergency,
  verifyFoodSafetyCorrection,
  createFoodProduct, createRawMaterial, createAllergen, createIntendedUse,
  createProcessFlow, createProcessStep, createFoodHazard, createHazardAssessment,
  createPrerequisiteProgram, createOperationalPrp, createCriticalControlPoint, createCriticalLimit,
  createMonitoringPlan, createMonitoringRecord, createDeviation, createFoodSafetyCorrection,
  createValidationRecord, createVerificationActivity, createTraceabilityLot,
  createWithdrawalRecall, createFoodSafetyEmergency, recordChainCommunication,
  updateFoodSafetyRecord,
} from "@/lib/actions/food-safety";
import Modal from "@/components/ui/Modal";
import IsoMetricCard from "@/components/ui/IsoMetricCard";
import IsoSectionMetrics from "@/components/ui/IsoSectionMetrics";
import IsoTableCard from "@/components/ui/IsoTableCard";
import IsoQuickCreate from "@/components/ui/IsoQuickCreate";
import { useCreateRequest } from "@/hooks/useCreateRequest";
import { useModuleSection } from "@/hooks/useModuleSection";
import { labelForKeyOrRaw } from "@/lib/field-labels";

type Tab =
  | "panel" | "products" | "hazards" | "flows" | "prp" | "ccp"
  | "monitoring" | "deviations" | "traceability" | "recalls" | "allergens" | "emergencies" | "communications";

const SECTION_META: Record<Tab, { title: string; sub: string }> = {
  panel: { title: "Inocuidad alimentaria (HACCP)", sub: "ISO 22000:2018 — visión general de productos, peligros, controles, trazabilidad y retiros." },
  products: { title: "Productos y materias primas", sub: "Catálogo de productos, materias primas, alérgenos y usos previstos." },
  hazards: { title: "Análisis de peligros", sub: "Identificación, evaluación y aprobación de peligros significativos." },
  flows: { title: "Diagramas de flujo", sub: "Procesos, etapas y recorrido operativo de cada producto." },
  prp: { title: "Programas prerrequisito", sub: "PRP y OPRP que sostienen las condiciones de inocuidad." },
  ccp: { title: "Puntos críticos de control", sub: "PCC, límites críticos y criterios para controlar el proceso." },
  monitoring: { title: "Monitoreo y verificación", sub: "Planes, lecturas, validaciones y evidencias de control." },
  deviations: { title: "Desviaciones y correcciones", sub: "Incumplimientos, causas, correcciones y seguimiento de eficacia." },
  traceability: { title: "Trazabilidad", sub: "Lotes, vínculos de cadena y pruebas de trazabilidad adelante/atrás." },
  recalls: { title: "Retiros y recuperaciones", sub: "Gestión de retiros, comunicación y cierre de incidentes de producto." },
  allergens: { title: "Alérgenos", sub: "Catálogo y control de alérgenos presentes en productos y materias primas." },
  emergencies: { title: "Emergencias alimentarias", sub: "Preparación y respuesta ante eventos que afectan la inocuidad." },
  communications: { title: "Comunicaciones de cadena", sub: "Mensajes y coordinación con proveedores, clientes y partes interesadas." },
};

const card: React.CSSProperties = { border: "1px solid var(--nf-line, #e5eaf2)", borderRadius: 14, padding: 18, background: "var(--nf-surface, #fff)" };
const chip = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, display: "inline-block" });
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e5eaf2", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const fmt = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--nf-line)", borderRadius: 8, fontSize: 13, fontFamily: "inherit" };
const primaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 14px", minHeight: 32, border: "1px solid var(--nf-app-accent)", borderRadius: 999, background: "var(--nf-app-accent)", color: "#fff", fontWeight: 600, fontSize: 12, fontFamily: "inherit", cursor: "pointer" };
type Runner = (action: () => Promise<unknown>) => void;
type Members = FoodSafetyPayload["members"];
type FoodEditorKind = "product" | "material" | "allergen" | "intendedUse" | "flow" | "step" | "hazard" | "assessment" | "prp" | "oprp" | "ccp" | "limit" | "plan" | "emergency";

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

export default function FoodSafetyClient({ initial, demo = false }: { initial: FoodSafetyPayload; demo?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useModuleSection<Tab>("panel");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [traceMsg, setTraceMsg] = useState<string | null>(initial.lastTraceTest?.summary ?? null);
  const [editor, setEditor] = useState<{ kind: FoodEditorKind; value: any } | null>(null);
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
    run(async () => { await updateFoodSafetyRecord(editor.value.id, editor.kind, payload); setEditor(null); });
  }

  return (
    <div className="nf-iso-module" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#ccfbf1", display: "grid", placeItems: "center" }}>
          <Shield size={22} color="#0f766e" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>{SECTION_META[tab].title}</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
            {SECTION_META[tab].sub}
          </p>
        </div>
        {demo && <span style={{ ...chip("#eef2ff", "#4f46e5"), marginLeft: "auto" }}>Demo</span>}
      </header>

      {error && <div style={{ ...card, borderColor: "#fecaca", background: "var(--nf-danger-subtle)", color: "var(--nf-danger-text)" }}>{error}</div>}
      {traceMsg && <div style={{ ...card, borderColor: "#99f6e4", background: "#f0fdfa", color: "#0f766e", fontSize: 13 }}>{traceMsg}</div>}

      {tab === "panel" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12 }}>
        <Stat label="Productos" value={s.products} />
        <Stat label="Peligros sig." value={s.significantHazards} accent={s.significantHazards ? "#0f766e" : undefined} />
        <Stat label="PCC" value={s.ccps} />
        <Stat label="Fuera de límite" value={s.outOfLimit} accent={s.outOfLimit ? "var(--nf-danger)" : undefined} />
        <Stat label="Desviaciones abiertas" value={s.openDeviations} accent={s.openDeviations ? "#d68a1a" : undefined} />
        <Stat label="Retiros abiertos" value={s.openRecalls} accent={s.openRecalls ? "var(--nf-danger)" : undefined} />
      </div> : <IsoSectionMetrics items={tab === "products" ? [{ label: "Productos activos", value: s.products }, { label: "Materias primas", value: s.materials }, { label: "Alérgenos", value: s.allergens }] : tab === "hazards" ? [{ label: "Peligros evaluados", value: s.hazards }, { label: "Significativos", value: s.significantHazards, accent: s.significantHazards ? "#0f766e" : undefined }, { label: "PCC definidos", value: s.ccps }] : tab === "flows" ? [{ label: "Flujos aprobados", value: s.flows }, { label: "Productos", value: s.products }, { label: "Peligros activos", value: s.hazards }] : tab === "prp" ? [{ label: "PRP activos", value: s.prps }, { label: "OPRP activos", value: s.oprps }, { label: "Validaciones pendientes", value: s.pendingValidations, accent: s.pendingValidations ? "#d68a1a" : undefined }] : tab === "ccp" ? [{ label: "PCC activos", value: s.ccps }, { label: "Fuera de límite", value: s.outOfLimit, accent: s.outOfLimit ? "var(--nf-danger)" : undefined }, { label: "Planes de monitoreo", value: initial.plans.length }] : tab === "monitoring" ? [{ label: "Planes de monitoreo", value: initial.plans.length }, { label: "Fuera de límite", value: s.outOfLimit, accent: s.outOfLimit ? "var(--nf-danger)" : undefined }, { label: "Validaciones pendientes", value: s.pendingValidations, accent: s.pendingValidations ? "#d68a1a" : undefined }] : tab === "deviations" ? [{ label: "Desviaciones abiertas", value: s.openDeviations, accent: s.openDeviations ? "#d68a1a" : undefined }, { label: "Correcciones", value: initial.corrections.length }, { label: "Fuera de límite", value: s.outOfLimit, accent: s.outOfLimit ? "var(--nf-danger)" : undefined }] : tab === "traceability" ? [{ label: "Lotes registrados", value: s.lots }, { label: "Productos", value: s.products }, { label: "Pruebas pendientes", value: s.pendingVerifications, accent: s.pendingVerifications ? "#d68a1a" : undefined }] : tab === "recalls" ? [{ label: "Retiros abiertos", value: s.openRecalls, accent: s.openRecalls ? "var(--nf-danger)" : undefined }, { label: "Lotes trazables", value: s.lots }, { label: "Emergencias", value: s.openEmergencies, accent: s.openEmergencies ? "var(--nf-danger)" : undefined }] : tab === "allergens" ? [{ label: "Alérgenos activos", value: s.allergens }, { label: "Productos", value: s.products }, { label: "Materias primas", value: s.materials }] : tab === "emergencies" ? [{ label: "Emergencias abiertas", value: s.openEmergencies, accent: s.openEmergencies ? "var(--nf-danger)" : undefined }, { label: "Retiros abiertos", value: s.openRecalls, accent: s.openRecalls ? "var(--nf-danger)" : undefined }, { label: "Validaciones pendientes", value: s.pendingValidations, accent: s.pendingValidations ? "#d68a1a" : undefined }] : [{ label: "Comunicaciones", value: initial.communications.length }, { label: "Lotes", value: s.lots }, { label: "Emergencias", value: s.openEmergencies, accent: s.openEmergencies ? "var(--nf-danger)" : undefined }]} />}

      {tab === "panel" && (
        <>
          <div className="nf-iso-panel-toolbar"><div><strong>Resumen de inocuidad</strong><span>Accesos directos a los registros de control.</span></div><IsoQuickCreate modulePath="/app/food-safety" items={[{ label: "Nuevo producto", description: "Registrar producto alimentario", section: "products", Icon: Package }, { label: "Nuevo diagrama de flujo", description: "Documentar un proceso", section: "flows", Icon: GitBranch }, { label: "Nuevo peligro", description: "Agregar peligro al análisis", section: "hazards", Icon: AlertTriangle }, { label: "Nuevo PRP", description: "Crear programa prerrequisito", section: "prp", Icon: Shield }, { label: "Nuevo PCC", description: "Definir punto crítico", section: "ccp", Icon: Crosshair }, { label: "Nuevo plan de monitoreo", description: "Configurar seguimiento", section: "monitoring", Icon: Activity }, { label: "Nueva desviación", description: "Registrar desviación", section: "deviations", Icon: AlertTriangle }, { label: "Nuevo lote", description: "Registrar trazabilidad", section: "traceability", Icon: ArrowLeftRight }, { label: "Nuevo retiro / recall", description: "Gestionar retiro de producto", section: "recalls", Icon: Undo2 }]} /></div>
          <div className="nf-iso-dashboard-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><GitBranch size={16} aria-hidden />Producto y proceso (§8.1–8.5)</h3>
            <Row k="Productos activos" v={s.products} />
            <Row k="Materias primas" v={s.materials} />
            <Row k="Flujos aprobados" v={s.flows} />
            <Row k="Peligros activos" v={s.hazards} />
            <Row k="Evaluaciones significativas" v={s.significantHazards} danger={s.significantHazards > 0} />
          </div>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><Crosshair size={16} aria-hidden />Control (§8.2, §8.5)</h3>
            <Row k="PRP" v={s.prps} />
            <Row k="OPRP" v={s.oprps} />
            <Row k="PCC" v={s.ccps} />
            <Row k="Registros fuera de límite" v={s.outOfLimit} danger={s.outOfLimit > 0} />
            <Row k="Desviaciones abiertas" v={s.openDeviations} danger={s.openDeviations > 0} />
          </div>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><ArrowLeftRight size={16} aria-hidden />Trazabilidad y crisis (§8.3–8.4, §8.9)</h3>
            <Row k="Lotes" v={s.lots} />
            <Row k="Retiros abiertos" v={s.openRecalls} danger={s.openRecalls > 0} />
            <Row k="Alérgenos" v={s.allergens} />
            <Row k="Emergencias abiertas" v={s.openEmergencies} danger={s.openEmergencies > 0} />
            <Row k="Validaciones pendientes" v={s.pendingValidations} />
            <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 12 }}>
              La prueba de trazabilidad recorre previousLotIds hacia atrás (proveedor) y hacia adelante (cliente/distribución).
            </p>
          </div>
          </div>
        </>
      )}

      {tab === "products" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo producto">
              {(close) => <NewProductForm pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Producto", "Categoría", "Alérgenos", "Vida útil", ...(live && can.update ? ["Acciones"] : [])]} title="Registro de productos" description="Consulta y administra los productos del catálogo, sus alérgenos y su vida útil.">
            {initial.products.map((p) => (
              <tr key={p.id}>
                <td style={td}>{p.code}</td>
                <td style={td}>{p.name}</td>
                <td style={td}>{p.category ?? "—"}</td>
                <td style={td}>{p.allergenCodes.join(", ") || "—"}</td>
                <td style={td}>{p.shelfLifeDays ?? "—"}</td>
                {live && can.update && <td style={td}><FoodRowActions><FoodTableAction icon={Pencil} onClick={() => setEditor({ kind: "product", value: p })}>Editar</FoodTableAction><FoodTableAction icon={p.active ? Archive : ArchiveRestore} variant="secondary" onClick={() => run(() => updateFoodSafetyRecord(p.id, "product", { active: !p.active }))}>{p.active ? "Archivar" : "Activar"}</FoodTableAction></FoodRowActions></td>}
              </tr>
            ))}
            {initial.products.length === 0 && <tr><td style={td} colSpan={5}>Sin productos registrados.</td></tr>}
          </Table>
          {live && can.create && (
            <NewFormToggle label="Nueva materia prima">
              {(close) => <NewMaterialForm pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Materia prima", "Proveedor", "Alérgenos", ...(live && can.update ? ["Acciones"] : [])]} title="Registro de materias primas" description="Administra las materias primas, proveedores y alérgenos asociados.">
            {initial.materials.map((m) => (
              <tr key={m.id}>
                <td style={td}>{m.code}</td>
                <td style={td}>{m.name}</td>
                <td style={td}>{m.supplierId ?? "—"}</td>
                <td style={td}>{m.allergenCodes.join(", ") || "—"}</td>
                {live && can.update && <td style={td}><FoodRowActions><FoodTableAction icon={Pencil} onClick={() => setEditor({ kind: "material", value: m })}>Editar</FoodTableAction><FoodTableAction icon={m.active ? Archive : ArchiveRestore} variant="secondary" onClick={() => run(() => updateFoodSafetyRecord(m.id, "material", { active: !m.active }))}>{m.active ? "Archivar" : "Activar"}</FoodTableAction></FoodRowActions></td>}
              </tr>
            ))}
            {initial.materials.length === 0 && <tr><td style={td} colSpan={4}>Sin materias primas registradas.</td></tr>}
          </Table>
          {live && can.create && (
            <NewFormToggle label="Nuevo uso previsto">
              {(close) => <NewIntendedUseForm products={initial.products} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Producto", "Grupo consumidor", "Vulnerables", "Mal uso previsible", ...(live && can.update ? ["Acciones"] : [])]} title="Registro de usos previstos" description="Documenta el público objetivo, los grupos vulnerables y los riesgos de mal uso de cada producto.">
            {initial.intendedUses.map((u) => (
              <tr key={u.id}>
                <td style={td}>{u.code}</td>
                <td style={td}>{u.product.code}</td>
                <td style={td}>{u.consumerGroup ?? "—"}</td>
                <td style={td}>{u.vulnerableConsumers ? "Sí" : "No"}</td>
                <td style={td}>{u.misusePotential ?? "—"}</td>
                {live && can.update && <td style={td}><FoodRowActions><FoodTableAction icon={Pencil} onClick={() => setEditor({ kind: "intendedUse", value: u })}>Editar</FoodTableAction></FoodRowActions></td>}
              </tr>
            ))}
            {initial.intendedUses.length === 0 && <tr><td style={td} colSpan={5}>Sin usos previstos registrados.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "flows" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo diagrama de flujo">
              {(close) => <NewFlowForm products={initial.products} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Versión", "Producto", "Título", "Pasos", "Estado", "Acción"]} title="Registro de diagramas de flujo" description="Controla las versiones, productos asociados y estado de aprobación de cada flujo.">
            {initial.flows.map((f) => (
              <tr key={f.id}>
                <td style={td}>{f.code}</td>
                <td style={td}>{f.version}</td>
                <td style={td}>{f.product.code}</td>
                <td style={td}>{f.title}</td>
                <td style={td}>{f._count.steps}</td>
                <td style={td}><span style={chip("#f1f5f9", "#334155")}>{f.status}</span></td>
                <td style={td}><FoodRowActions>
                  {live && can.update && f.status !== "APPROVED" && <FoodTableAction icon={Pencil} onClick={() => setEditor({ kind: "flow", value: f })}>Editar</FoodTableAction>}
                  {live && can.approve && f.status !== "APPROVED" && (
                    <FoodTableAction icon={Check} variant="primary" disabled={pending} onClick={() => run(() => transitionProcessFlow(f.id, "APPROVED"))}>Aprobar</FoodTableAction>
                  )}
                </FoodRowActions></td>
              </tr>
            ))}
          </Table>
          {live && can.create && (
            <NewFormToggle label="Nueva etapa de proceso">
              {(close) => <NewStepForm flows={initial.flows} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Flujo", "Secuencia", "Etapa", "Tipo", "Temp./tiempo", ...(live && can.update ? ["Acciones"] : [])]} title="Registro de etapas de proceso" description="Documenta las etapas y los parámetros críticos de cada diagrama de flujo.">
            {initial.steps.map((st) => (
              <tr key={st.id}>
                <td style={td}>{st.code}</td>
                <td style={td}>{st.flow.code}</td>
                <td style={td}>{st.sequence}</td>
                <td style={td}>{st.name}</td>
                <td style={td}>{st.stepType}</td>
                <td style={td}>{[st.temperature, st.timeParam].filter(Boolean).join(" / ") || "—"}</td>
                {live && can.update && <td style={td}><FoodRowActions><FoodTableAction icon={Pencil} onClick={() => setEditor({ kind: "step", value: st })}>Editar</FoodTableAction></FoodRowActions></td>}
              </tr>
            ))}
            {initial.steps.length === 0 && <tr><td style={td} colSpan={6}>Sin etapas de proceso registradas.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "hazards" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo peligro">
              {(close) => <NewHazardForm pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Peligro", "Tipo", "Fuente", "Activo", ...(live && can.update ? ["Acciones"] : [])]} title="Registro de peligros" description="Identifica los peligros de inocuidad, su tipo y su fuente potencial.">
            {initial.hazards.map((h) => (
              <tr key={h.id}>
                <td style={td}>{h.code}</td>
                <td style={td}>{h.name}</td>
                <td style={td}>{h.hazardType}</td>
                <td style={td}>{h.source ?? "—"}</td>
                <td style={td}>{h.active ? "Sí" : "No"}</td>
                {live && can.update && <td style={td}><FoodRowActions><FoodTableAction icon={Pencil} onClick={() => setEditor({ kind: "hazard", value: h })}>Editar</FoodTableAction><FoodTableAction icon={h.active ? Archive : ArchiveRestore} variant="secondary" onClick={() => run(() => updateFoodSafetyRecord(h.id, "hazard", { active: !h.active }))}>{h.active ? "Archivar" : "Activar"}</FoodTableAction></FoodRowActions></td>}
              </tr>
            ))}
            {initial.hazards.length === 0 && <tr><td style={td} colSpan={5}>Sin peligros registrados.</td></tr>}
          </Table>
          {live && can.create && (
            <NewFormToggle label="Nueva evaluación de peligro">
              {(close) => <NewAssessmentForm hazards={initial.hazards} steps={initial.steps} products={initial.products} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Peligro", "Tipo", "Paso", "Sev×Prob", "Sig.", "Decisión", "Estado", "Acción"]} title="Registro de evaluaciones de peligro" description="Consulta la evaluación de severidad, probabilidad y decisión de control de cada peligro.">
            {initial.assessments.map((a) => (
              <tr key={a.id}>
                <td style={td}>{a.code}</td>
                <td style={td}>{a.hazard.code} — {a.hazard.name}</td>
                <td style={td}>{a.hazard.hazardType}</td>
                <td style={td}>{a.step?.code ?? "—"}</td>
                <td style={td}>{a.severity}×{a.likelihood}={a.score}</td>
                <td style={td}>{a.significant ? "Sí" : "No"}</td>
                <td style={td}><span style={chip(a.controlDecision === "CCP" ? "var(--nf-warning-border)" : "#f1f5f9", a.controlDecision === "CCP" ? "#a16207" : "#334155")}>{a.controlDecision}</span></td>
                <td style={td}>{a.status}</td>
                <td style={td}><FoodRowActions>
                  {live && can.update && a.status !== "APPROVED" && <FoodTableAction icon={Pencil} onClick={() => setEditor({ kind: "assessment", value: a })}>Editar</FoodTableAction>}
                  {live && can.approve && a.status !== "APPROVED" && (
                    <FoodTableAction icon={Check} variant="primary" disabled={pending} onClick={() => run(() => approveHazardAssessment(a.id))}>Aprobar</FoodTableAction>
                  )}
                </FoodRowActions></td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "prp" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo PRP">
              {(close) => <NewPrpForm members={initial.members} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "PRP", "Categoría", "Frecuencia", "Activo", ...(live && can.update ? ["Acciones"] : [])]} title="Registro de programas prerrequisito" description="Administra los PRP que sostienen las condiciones básicas de inocuidad.">
            {initial.prps.map((p) => (
              <tr key={p.id}>
                <td style={td}>{p.code}</td>
                <td style={td}>{p.name}</td>
                <td style={td}>{p.category}</td>
                <td style={td}>{p.frequency ?? "—"}</td>
                <td style={td}>{p.active ? "Sí" : "No"}</td>
                {live && can.update && <td style={td}><FoodRowActions><FoodTableAction icon={Pencil} onClick={() => setEditor({ kind: "prp", value: p })}>Editar</FoodTableAction><FoodTableAction icon={p.active ? Archive : ArchiveRestore} variant="secondary" onClick={() => run(() => updateFoodSafetyRecord(p.id, "prp", { active: !p.active }))}>{p.active ? "Archivar" : "Activar"}</FoodTableAction></FoodRowActions></td>}
              </tr>
            ))}
            {initial.prps.length === 0 && <tr><td style={td} colSpan={5}>Sin PRP registrados.</td></tr>}
          </Table>
          {live && can.create && (
            <NewFormToggle label="Nuevo OPRP">
              {(close) => <NewOprpForm assessments={initial.assessments} steps={initial.steps} members={initial.members} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "OPRP", "Paso", "Evaluación", "Monitoreo", ...(live && can.update ? ["Acciones"] : [])]} title="Registro de programas prerrequisito operativos" description="Vincula los OPRP con su etapa, evaluación de peligro y método de monitoreo.">
            {initial.oprps.map((o) => (
              <tr key={o.id}>
                <td style={td}>{o.code}</td>
                <td style={td}>{o.name}</td>
                <td style={td}>{o.step?.code ?? "—"}</td>
                <td style={td}>{o.hazardAssessment?.code ?? "—"}</td>
                <td style={td}>{o.monitoringFrequency ?? o.monitoringMethod ?? "—"}</td>
                {live && can.update && <td style={td}><FoodRowActions><FoodTableAction icon={Pencil} onClick={() => setEditor({ kind: "oprp", value: o })}>Editar</FoodTableAction><FoodTableAction icon={o.active ? Archive : ArchiveRestore} variant="secondary" onClick={() => run(() => updateFoodSafetyRecord(o.id, "oprp", { active: !o.active }))}>{o.active ? "Archivar" : "Activar"}</FoodTableAction></FoodRowActions></td>}
              </tr>
            ))}
            {initial.oprps.length === 0 && <tr><td style={td} colSpan={5}>Sin OPRP registrados.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "ccp" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo PCC">
              {(close) => <NewCcpForm steps={initial.steps} assessments={initial.assessments} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "PCC", "Paso", "Límites", "Planes", "Desviaciones", ...(live && can.update ? ["Acciones"] : [])]} title="Registro de puntos críticos de control" description="Supervisa los PCC, sus límites, planes de monitoreo y desviaciones relacionadas.">
            {initial.ccps.map((c) => (
              <tr key={c.id}>
                <td style={td}>{c.code}</td>
                <td style={td}>{c.name}</td>
                <td style={td}>{c.step.code}</td>
                <td style={td}>{c._count.limits}</td>
                <td style={td}>{c._count.monitoringPlans}</td>
                <td style={td}>{c._count.deviations}</td>
                {live && can.update && <td style={td}><FoodRowActions><FoodTableAction icon={Pencil} onClick={() => setEditor({ kind: "ccp", value: c })}>Editar</FoodTableAction><FoodTableAction icon={c.active ? Archive : ArchiveRestore} variant="secondary" onClick={() => run(() => updateFoodSafetyRecord(c.id, "ccp", { active: !c.active }))}>{c.active ? "Archivar" : "Activar"}</FoodTableAction></FoodRowActions></td>}
              </tr>
            ))}
            {initial.ccps.length === 0 && <tr><td style={td} colSpan={6}>Sin PCC registrados.</td></tr>}
          </Table>
          {live && can.create && (
            <NewFormToggle label="Nuevo límite crítico">
              {(close) => <NewLimitForm ccps={initial.ccps} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "PCC", "Parámetro", "Operador", "Min", "Max", "Unidad", ...(live && can.update ? ["Acciones"] : [])]} title="Registro de límites críticos" description="Define los valores y criterios que mantienen cada PCC dentro de control.">
            {initial.limits.map((l) => (
              <tr key={l.id}>
                <td style={td}>{l.code}</td>
                <td style={td}>{l.ccp.code}</td>
                <td style={td}>{l.parameter}</td>
                <td style={td}>{l.operator}</td>
                <td style={td}>{l.minValue ?? "—"}</td>
                <td style={td}>{l.maxValue ?? "—"}</td>
                <td style={td}>{l.unit ?? "—"}</td>
                {live && can.update && <td style={td}><FoodRowActions><FoodTableAction icon={Pencil} onClick={() => setEditor({ kind: "limit", value: l })}>Editar</FoodTableAction></FoodRowActions></td>}
              </tr>
            ))}
            {initial.limits.length === 0 && <tr><td style={td} colSpan={7}>Sin límites críticos registrados.</td></tr>}
          </Table>
          {live && can.create && (
            <NewFormToggle label="Nueva validación">
              {(close) => <NewValidationForm pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Validación", "Objetivo", "Resultado", "Validada"]} title="Registro de validaciones" description="Conserva la evidencia de que los controles de inocuidad son eficaces.">
            {initial.validations.map((v) => (
              <tr key={v.id}>
                <td style={td}>{v.code}</td>
                <td style={td}>{v.title}</td>
                <td style={td}>{v.targetType} {v.targetCode ?? ""}</td>
                <td style={td}><span style={chip(v.result === "VALID" ? "var(--nf-success-border)" : v.result === "INVALID" ? "var(--nf-danger-border)" : "#f1f5f9", v.result === "VALID" ? "var(--nf-success-text)" : v.result === "INVALID" ? "var(--nf-danger-text)" : "#334155")}>{v.result}</span></td>
                <td style={td}>{fmt(v.validatedAt)}</td>
              </tr>
            ))}
            {initial.validations.length === 0 && <tr><td style={td} colSpan={5}>Sin validaciones registradas.</td></tr>}
          </Table>
          {live && can.create && (
            <NewFormToggle label="Nueva actividad de verificación">
              {(close) => <NewVerificationForm members={initial.members} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Actividad", "Tipo", "Resultado", "Programada"]} title="Registro de actividades de verificación" description="Planifica y consulta las verificaciones del sistema de inocuidad.">
            {initial.verifications.map((v) => (
              <tr key={v.id}>
                <td style={td}>{v.code}</td>
                <td style={td}>{v.title}</td>
                <td style={td}>{v.activityType}</td>
                <td style={td}><span style={chip(v.result === "CONFORMING" ? "var(--nf-success-border)" : v.result === "NONCONFORMING" ? "var(--nf-danger-border)" : "#f1f5f9", v.result === "CONFORMING" ? "var(--nf-success-text)" : v.result === "NONCONFORMING" ? "var(--nf-danger-text)" : "#334155")}>{v.result}</span></td>
                <td style={td}>{fmt(v.scheduledFor)}</td>
              </tr>
            ))}
            {initial.verifications.length === 0 && <tr><td style={td} colSpan={5}>Sin actividades de verificación registradas.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "monitoring" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo plan de monitoreo">
              {(close) => <NewMonitoringPlanForm ccps={initial.ccps} oprps={initial.oprps} members={initial.members} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          {live && can.create && (
            <NewFormToggle label="Registrar lectura de monitoreo">
              {(close) => <NewMonitoringRecordForm plans={initial.plans} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Plan", "PCC/OPRP", "Método", "Frecuencia", "Registros", "Activo", ...(live && can.update ? ["Acciones"] : [])]} title="Registro de planes de monitoreo" description="Gestiona los planes, su método, frecuencia y registros de seguimiento.">
            {initial.plans.map((p) => (
              <tr key={p.id}>
                <td style={td}>{p.code}</td><td style={td}>{p.title}</td><td style={td}>{p.ccp?.code ?? p.oprp?.code ?? "—"}</td><td style={td}>{p.method ?? "—"}</td><td style={td}>{p.frequency ?? "—"}</td><td style={td}>{p._count.records}</td><td style={td}>{p.active ? "Sí" : "No"}</td>
                {live && can.update && <td style={td}><FoodRowActions><FoodTableAction icon={Pencil} onClick={() => setEditor({ kind: "plan", value: p })}>Editar</FoodTableAction><FoodTableAction icon={p.active ? Archive : ArchiveRestore} variant="secondary" onClick={() => run(() => updateFoodSafetyRecord(p.id, "plan", { active: !p.active }))}>{p.active ? "Archivar" : "Activar"}</FoodTableAction></FoodRowActions></td>}
              </tr>
            ))}
          </Table>
          <Table headers={["Código", "Plan", "Fecha", "Valor", "Dentro límite", "Notas"]} title="Registro de lecturas de monitoreo" description="Consulta las mediciones registradas y verifica si se encuentran dentro de los límites.">
            {initial.records.map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.code}</td>
                <td style={td}>{r.plan.code}</td>
                <td style={td}>{fmt(r.recordedAt)}</td>
                <td style={td}>{r.valueNumeric ?? r.valueText ?? "—"} {r.unit ?? ""}</td>
                <td style={td}>
                  <span style={chip(r.withinLimits ? "var(--nf-success-border)" : "var(--nf-danger-border)", r.withinLimits ? "var(--nf-success-text)" : "var(--nf-danger-text)")}>
                    {r.withinLimits ? "Sí" : "No"}
                  </span>
                </td>
                <td style={td}>{r.notes ?? "—"}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "deviations" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nueva desviación">
              {(close) => <NewDeviationForm ccps={initial.ccps} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Título", "PCC", "Severidad", "Estado", "Lotes", "Acción"]} title="Registro de desviaciones" description="Da seguimiento a las desviaciones detectadas, su severidad y los lotes afectados.">
            {initial.deviations.map((d) => (
              <tr key={d.id}>
                <td style={td}>{d.code}</td>
                <td style={td}>{d.title}</td>
                <td style={td}>{d.ccp?.code ?? "—"}</td>
                <td style={td}>{d.severity}</td>
                <td style={td}>{d.status}</td>
                <td style={td}>{d.lotCodes.join(", ") || "—"}</td>
                <td style={td}><FoodRowActions>
                  {live && can.update && d.status !== "CLOSED" && d.status !== "VERIFIED" && (
                    <FoodTableAction icon={ArrowRight} variant="primary" disabled={pending} onClick={() => run(() => transitionDeviation(d.id, "UNDER_CORRECTION"))}>En corrección</FoodTableAction>
                  )}
                </FoodRowActions></td>
              </tr>
            ))}
          </Table>
          {live && can.create && (
            <NewFormToggle label="Nueva corrección">
              {(close) => <NewCorrectionForm deviations={initial.deviations} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Desviación", "Acción", "Efectiva", "Verificar"]} title="Registro de correcciones" description="Documenta las correcciones aplicadas y su verificación de eficacia.">
            {initial.corrections.map((c) => (
              <tr key={c.id}>
                <td style={td}>{c.code}</td>
                <td style={td}>{c.deviation.code}</td>
                <td style={td}>{c.actionTaken}</td>
                <td style={td}>{c.effective == null ? "—" : c.effective ? "Sí" : "No"}</td>
                <td style={td}><FoodRowActions>
                  {live && can.approve && c.effective == null && (
                    <FoodTableAction icon={Check} variant="primary" disabled={pending} onClick={() => run(() => verifyFoodSafetyCorrection(c.id, true))}>Verificar</FoodTableAction>
                  )}
                </FoodRowActions></td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "traceability" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo lote">
              {(close) => <NewLotForm products={initial.products} materials={initial.materials} lots={initial.lots} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Tipo", "Producto/MP", "Proveedor", "Cliente", "Previos", "Estado", "Prueba"]} title="Registro de trazabilidad" description="Relaciona lotes, proveedores y clientes para facilitar la trazabilidad completa.">
            {initial.lots.map((l) => (
              <tr key={l.id}>
                <td style={td}>{l.code}</td>
                <td style={td}>{l.lotType}</td>
                <td style={td}>{l.product?.code ?? l.rawMaterial?.code ?? "—"}</td>
                <td style={td}>{l.supplierId ?? "—"}</td>
                <td style={td}>{l.customerName ?? "—"}</td>
                <td style={td}>{l.previousLotIds.length}</td>
                <td style={td}>{l.status}</td>
                <td style={td}><FoodRowActions>
                  {live ? (
                    <FoodTableAction icon={ArrowLeftRight} variant="primary" disabled={pending} onClick={() => run(async () => {
                        const res = await runFoodTraceabilityTest(l.id);
                        setTraceMsg(res.summary);
                      })}>Probar trazabilidad</FoodTableAction>
                  ) : null}
                </FoodRowActions></td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "recalls" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo retiro / recall">
              {(close) => <NewRecallForm lots={initial.lots} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Título", "Tipo", "Lotes", "Estado", "Acción"]} title="Registro de retiros y recuperaciones" description="Gestiona los retiros de producto y su estado de avance.">
            {initial.recalls.map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.code}</td>
                <td style={td}>{r.title}</td>
                <td style={td}>{r.recallType}</td>
                <td style={td}>{r.lotCodes.join(", ")}</td>
                <td style={td}>{r.status}</td>
                <td style={td}><FoodRowActions>
                  {live && can.update && r.status !== "CLOSED" && (
                    <FoodTableAction icon={ArrowRight} variant="primary" disabled={pending} onClick={() => run(() => transitionWithdrawalRecall(r.id, "IN_PROGRESS"))}>Avanzar</FoodTableAction>
                  )}
                </FoodRowActions></td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "allergens" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo alérgeno">
              {(close) => <NewAllergenForm pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Nombre", "Categoría", "Activo", ...(live && can.update ? ["Acciones"] : [])]} title="Registro de alérgenos" description="Mantén el catálogo de alérgenos utilizado para productos y materias primas.">
            {initial.allergens.map((a) => (
              <tr key={a.id}>
                <td style={td}>{a.code}</td>
                <td style={td}>{a.name}</td>
                <td style={td}>{a.category ?? "—"}</td>
                <td style={td}>{a.active ? "Sí" : "No"}</td>
                {live && can.update && <td style={td}><FoodRowActions><FoodTableAction icon={Pencil} onClick={() => setEditor({ kind: "allergen", value: a })}>Editar</FoodTableAction><FoodTableAction icon={a.active ? Archive : ArchiveRestore} variant="secondary" onClick={() => run(() => updateFoodSafetyRecord(a.id, "allergen", { active: !a.active }))}>{a.active ? "Archivar" : "Activar"}</FoodTableAction></FoodRowActions></td>}
              </tr>
            ))}
            {initial.allergens.length === 0 && <tr><td style={td} colSpan={4 + (live && can.update ? 1 : 0)}>Sin alérgenos registrados.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "emergencies" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nueva emergencia de inocuidad">
              {(close) => <NewEmergencyForm pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Título", "Tipo", "Estado", "Activada", ...(live && can.update ? ["Acciones"] : [])]} title="Registro de emergencias de inocuidad" description="Registra y da seguimiento a los eventos que pueden afectar la inocuidad alimentaria.">
            {initial.emergencies.map((e) => (
              <tr key={e.id}>
                <td style={td}>{e.code}</td>
                <td style={td}>{e.title}</td>
                <td style={td}>{e.emergencyType}</td>
                <td style={td}>{e.status}</td>
                <td style={td}>{fmt(e.activatedAt)}</td>
                {live && can.update && <td style={td}><FoodRowActions><FoodTableAction icon={Pencil} onClick={() => setEditor({ kind: "emergency", value: e })}>Editar</FoodTableAction>{e.status !== "CLOSED" && <FoodTableAction icon={Check} variant="secondary" onClick={() => run(() => transitionFoodSafetyEmergency(e.id, "CLOSED"))}>Cerrar</FoodTableAction>}</FoodRowActions></td>}
              </tr>
            ))}
            {initial.emergencies.length === 0 && <tr><td style={td} colSpan={5}>Sin emergencias registradas.</td></tr>}
          </Table>
        </div>
      )}

      {tab === "communications" && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ ...card, borderColor: "#99f6e4", background: "#f0fdfa", color: "#0f766e", fontSize: 13 }}>
            Comunicación con proveedores, clientes o autoridades sobre asuntos de inocuidad
            (§7.4) — cambios de especificación, retiros, incidentes de alérgenos, requisitos legales.
          </div>
          {live && can.create && (
            <NewFormToggle label="Nueva comunicación">
              {(close) => <NewCommunicationForm pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Asunto", "Parte", "Canal", "Fecha"]} title="Registro de comunicaciones de cadena" description="Conserva las comunicaciones enviadas a proveedores, clientes y autoridades.">
            {initial.communications.map((c) => (
              <tr key={c.id}>
                <td style={td}>{c.code}</td>
                <td style={td}>{c.subject}<div style={{ color: "#64748b", fontSize: 12 }}>{c.content?.slice(0, 100) ?? ""}</div></td>
                <td style={td}>{c.audience ?? "—"}</td>
                <td style={td}>{c.channel ?? "—"}</td>
                <td style={td}>{fmt(c.communicatedAt)}</td>
              </tr>
            ))}
            {initial.communications.length === 0 && <tr><td style={td} colSpan={5}>Sin comunicaciones de cadena registradas.</td></tr>}
          </Table>
        </div>
      )}
      <Modal open={Boolean(editor)} onClose={() => setEditor(null)} title="Editar registro de inocuidad" width={780}>
        {editor && <FoodSafetyRecordEditor kind={editor.kind} value={editor.value} products={initial.products} materials={initial.materials} flows={initial.flows} steps={initial.steps} hazards={initial.hazards} assessments={initial.assessments} ccps={initial.ccps} oprps={initial.oprps} plans={initial.plans} members={initial.members} onCancel={() => setEditor(null)} onSave={saveEditor} />}
      </Modal>
    </div>
  );
}

function Stat({ label, value, suffix = "", accent }: { label: string; value: number; suffix?: string; accent?: string }) {
  return <IsoMetricCard label={label} value={value} suffix={suffix} accent={accent} />;
}

function Row({ k, v, suffix = "", danger }: { k: string; v: number | string; suffix?: string; danger?: boolean }) {
  return (
    <div className="nf-iso-dashboard-row">
      <span className="nf-iso-dashboard-row-label">{k}</span>
      <span className="nf-iso-dashboard-row-value" style={{ color: danger ? "var(--nf-danger-text)" : undefined }}>{v}{suffix}</span>
    </div>
  );
}

function Table({ headers, children, title, description }: { headers: string[]; children: React.ReactNode; title?: string; description?: string }) {
  return <IsoTableCard icon={Shield} headers={headers} title={title} description={description}>{children}</IsoTableCard>;
}

function FoodTableAction({ icon: Icon, children, onClick, variant = "default", disabled = false }: { icon: typeof Pencil; children: React.ReactNode; onClick: () => void; variant?: "default" | "primary" | "secondary"; disabled?: boolean }) {
  return <button type="button" className={`nf-table-action nf-table-action--${variant}`} disabled={disabled} onClick={onClick}><Icon size={13} strokeWidth={2} aria-hidden /><span>{children}</span></button>;
}

function FoodRowActions({ children }: { children: React.ReactNode }) {
  return <div className="nf-energy-table-actions">{children}</div>;
}

function FoodSafetyRecordEditor({ kind, value, products, materials, flows, steps, hazards, assessments, ccps, oprps, plans, members, onCancel, onSave }: {
  kind: FoodEditorKind;
  value: any;
  products: FoodSafetyPayload["products"];
  materials: FoodSafetyPayload["materials"];
  flows: FoodSafetyPayload["flows"];
  steps: FoodSafetyPayload["steps"];
  hazards: FoodSafetyPayload["hazards"];
  assessments: FoodSafetyPayload["assessments"];
  ccps: FoodSafetyPayload["ccps"];
  oprps: FoodSafetyPayload["oprps"];
  plans: FoodSafetyPayload["plans"];
  members: Members;
  onCancel: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const dateKeys = new Set(["verifiedAt", "effectiveFrom", "effectiveTo"]);
    const keys = ["name", "title", "description", "category", "shelfLifeDays", "storageConditions", "allergenCodes", "processId", "documentId", "supplierId", "specification", "active", "productId", "consumerGroup", "preparationMethod", "vulnerableConsumers", "misusePotential", "notes", "version", "status", "verifiedOnSite", "flowId", "sequence", "stepType", "temperature", "timeParam", "hazardType", "source", "hazardId", "stepId", "severity", "likelihood", "controlDecision", "justification", "existingMeasures", "responsibleId", "frequency", "evidenceId", "hazardAssessmentId", "monitoringMethod", "monitoringFrequency", "correctionAction", "ccpId", "hazardControlled", "parameter", "operator", "minValue", "maxValue", "targetValue", "unit", "method", "oprpId", "recallId", "capaId", "emergencyType"];
    return Object.fromEntries(keys.map((key) => [key, value[key] == null ? "" : dateKeys.has(key) ? fmt(value[key]) : Array.isArray(value[key]) ? value[key].join(", ") : String(value[key])])) as Record<string, string>;
  });
  const set = (key: string, next: string) => setForm((current) => ({ ...current, [key]: next }));
  const optional = (key: string) => form[key]?.trim() ? form[key] : undefined;
  const number = (key: string) => form[key]?.trim() ? Number(form[key]) : undefined;
  const ref = (key: string, options: { id: string; label: string }[], placeholder: string) => <select style={input} value={form[key] ?? ""} onChange={(e) => set(key, e.target.value)}><option value="">{placeholder}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>;
  const select = (key: string, options: string[]) => <select aria-label={labelForKeyOrRaw(key)} style={input} value={form[key] ?? ""} onChange={(e) => set(key, e.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  const field = (key: string, placeholder: string, type = "text") => <input aria-label={placeholder} style={input} type={type} placeholder={placeholder} value={form[key] ?? ""} onChange={(e) => set(key, e.target.value)} />;
  const active = <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={form.active === "true"} onChange={(e) => set("active", String(e.target.checked))} /> Activo</label>;
  const save = () => {
    if (kind === "product") onSave({ name: form.name, description: optional("description"), category: optional("category"), shelfLifeDays: number("shelfLifeDays"), storageConditions: optional("storageConditions"), allergenCodes: form.allergenCodes ? form.allergenCodes.split(",").map((item) => item.trim()).filter(Boolean) : [], processId: optional("processId"), documentId: optional("documentId"), active: form.active === "true" });
    if (kind === "material") onSave({ name: form.name, description: optional("description"), supplierId: optional("supplierId"), specification: optional("specification"), allergenCodes: form.allergenCodes ? form.allergenCodes.split(",").map((item) => item.trim()).filter(Boolean) : [], storageConditions: optional("storageConditions"), documentId: optional("documentId"), active: form.active === "true" });
    if (kind === "allergen") onSave({ name: form.name, category: optional("category"), description: optional("description"), active: form.active === "true" });
    if (kind === "intendedUse") onSave({ productId: form.productId, consumerGroup: optional("consumerGroup"), preparationMethod: optional("preparationMethod"), vulnerableConsumers: form.vulnerableConsumers === "true", misusePotential: optional("misusePotential"), notes: optional("notes") });
    if (kind === "flow") onSave({ productId: form.productId, title: form.title, version: form.version, notes: optional("notes"), documentId: optional("documentId"), status: form.status, verifiedOnSite: form.verifiedOnSite === "true" });
    if (kind === "step") onSave({ flowId: form.flowId, sequence: Number(form.sequence), name: form.name, stepType: form.stepType, description: optional("description"), processId: optional("processId"), temperature: optional("temperature"), timeParam: optional("timeParam") });
    if (kind === "hazard") onSave({ name: form.name, hazardType: form.hazardType, description: optional("description"), source: optional("source"), active: form.active === "true" });
    if (kind === "assessment") onSave({ hazardId: form.hazardId, stepId: optional("stepId"), productId: optional("productId"), severity: Number(form.severity), likelihood: Number(form.likelihood), controlDecision: form.controlDecision, justification: optional("justification"), existingMeasures: optional("existingMeasures") });
    if (kind === "prp") onSave({ name: form.name, category: form.category, description: optional("description"), responsibleId: optional("responsibleId"), frequency: optional("frequency"), documentId: optional("documentId"), evidenceId: optional("evidenceId"), active: form.active === "true" });
    if (kind === "oprp") onSave({ name: form.name, hazardAssessmentId: optional("hazardAssessmentId"), stepId: optional("stepId"), description: optional("description"), monitoringMethod: optional("monitoringMethod"), monitoringFrequency: optional("monitoringFrequency"), correctionAction: optional("correctionAction"), responsibleId: optional("responsibleId"), documentId: optional("documentId"), active: form.active === "true" });
    if (kind === "ccp") onSave({ name: form.name, stepId: form.stepId, hazardAssessmentId: optional("hazardAssessmentId"), justification: optional("justification"), hazardControlled: optional("hazardControlled"), active: form.active === "true" });
    if (kind === "limit") onSave({ ccpId: form.ccpId, parameter: form.parameter, operator: form.operator, minValue: number("minValue"), maxValue: number("maxValue"), targetValue: number("targetValue"), unit: optional("unit"), rationale: optional("rationale") });
    if (kind === "plan") onSave({ title: form.title, ccpId: optional("ccpId"), oprpId: optional("oprpId"), method: optional("method"), frequency: optional("frequency"), responsibleId: optional("responsibleId"), parameter: optional("parameter"), active: form.active === "true" });
    if (kind === "emergency") onSave({ title: form.title, emergencyType: form.emergencyType, description: optional("description"), recallId: optional("recallId"), capaId: optional("capaId"), documentId: optional("documentId"), evidenceId: optional("evidenceId") });
  };
  return <div className="nf-iso-edit-form" style={{ display: "grid", gap: 9 }}>
    {(kind === "product" || kind === "material") && <><div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>{field("name", "Nombre")}{field("category", "Categoría")}{field("shelfLifeDays", "Vida útil (días)", "number")}</div>{field("description", "Descripción")}{field("storageConditions", "Condiciones de almacenamiento")}{field("allergenCodes", "Alérgenos (códigos separados por coma)")}{kind === "material" ? field("supplierId", "Proveedor (ID)") : field("processId", "Proceso (ID)")}{field("documentId", "Documento (ID)")}{kind === "material" && field("specification", "Especificación")}{active}</>}
    {kind === "allergen" && <><div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>{field("name", "Nombre")}{field("category", "Categoría")}</div>{field("description", "Descripción")}{active}</>}
    {kind === "intendedUse" && <><div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>{ref("productId", products.map((row) => ({ id: row.id, label: `${row.code} · ${row.name}` })), "Producto…")}{field("consumerGroup", "Grupo consumidor")}</div>{field("preparationMethod", "Método de preparación")}{field("misusePotential", "Mal uso previsible")}{field("notes", "Notas")}<label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={form.vulnerableConsumers === "true"} onChange={(e) => set("vulnerableConsumers", String(e.target.checked))} /> Consumidores vulnerables</label></>}
    {kind === "flow" && <><div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>{ref("productId", products.map((row) => ({ id: row.id, label: row.code })), "Producto…")}{field("title", "Título")}{field("version", "Versión")}</div>{field("notes", "Notas")}{field("documentId", "Documento (ID)")}{select("status", ["DRAFT", "IN_REVIEW", "APPROVED", "SUPERSEDED"])}<label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={form.verifiedOnSite === "true"} onChange={(e) => set("verifiedOnSite", String(e.target.checked))} /> Verificado en sitio</label></>}
    {kind === "step" && <><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 8 }}>{ref("flowId", flows.map((row) => ({ id: row.id, label: `${row.code} v${row.version}` })), "Flujo…")}{field("sequence", "Secuencia", "number")}{field("name", "Nombre de etapa")}</div>{select("stepType", ["RECEIPT", "STORAGE", "PREP", "PROCESS", "COOKING", "COOLING", "PACKAGING", "DISTRIBUTION", "OTHER"])}{field("description", "Descripción")}{field("temperature", "Temperatura")}{field("timeParam", "Tiempo")}{field("processId", "Proceso (ID)")}</>}
    {kind === "hazard" && <><div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>{field("name", "Nombre")}{select("hazardType", ["BIOLOGICAL", "CHEMICAL", "PHYSICAL", "ALLERGEN"])}</div>{field("source", "Fuente")}{field("description", "Descripción")}{active}</>}
    {kind === "assessment" && <><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{ref("hazardId", hazards.map((row) => ({ id: row.id, label: row.code })), "Peligro…")}{ref("stepId", steps.map((row) => ({ id: row.id, label: row.code })), "Etapa…")}</div><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>{field("severity", "Severidad", "number")}{field("likelihood", "Probabilidad", "number")}{select("controlDecision", ["NONE", "PRP", "OPRP", "CCP"])}</div>{field("justification", "Justificación")}{field("existingMeasures", "Medidas existentes")}</>}
    {(kind === "prp" || kind === "oprp") && <><div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>{field("name", "Nombre")}{kind === "prp" ? select("category", ["HYGIENE", "PEST_CONTROL", "WATER", "CLEANING", "MAINTENANCE", "PERSONNEL", "SUPPLIER", "WASTE", "ALLERGEN_CONTROL", "OTHER"]) : field("monitoringFrequency", "Frecuencia")}</div>{field("description", "Descripción")}{kind === "oprp" ? <>{ref("hazardAssessmentId", assessments.map((row) => ({ id: row.id, label: row.code })), "Evaluación…")}{ref("stepId", steps.map((row) => ({ id: row.id, label: row.code })), "Etapa…")}{field("monitoringMethod", "Método de monitoreo")}{field("correctionAction", "Acción correctiva")}</> : <>{field("frequency", "Frecuencia")}{ref("responsibleId", members.map((row) => ({ id: row.id, label: row.name })), "Responsable…")}{field("evidenceId", "Evidencia (ID)")}</>}{field("documentId", "Documento (ID)")}{active}</>}
    {kind === "ccp" && <><div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>{field("name", "Nombre")}{ref("stepId", steps.map((row) => ({ id: row.id, label: row.code })), "Etapa…")}</div>{ref("hazardAssessmentId", assessments.map((row) => ({ id: row.id, label: row.code })), "Evaluación…")}{field("justification", "Justificación")}{field("hazardControlled", "Peligro controlado")}{active}</>}
    {kind === "limit" && <><div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 8 }}>{ref("ccpId", ccps.map((row) => ({ id: row.id, label: row.code })), "PCC…")}{field("parameter", "Parámetro")}{select("operator", ["LT", "LTE", "GT", "GTE", "EQ", "BETWEEN"])}</div><div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>{field("minValue", "Mínimo", "number")}{field("maxValue", "Máximo", "number")}{field("targetValue", "Objetivo", "number")}{field("unit", "Unidad")}</div>{field("rationale", "Justificación")}</>}
    {kind === "plan" && <><div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>{field("title", "Título")}{field("parameter", "Parámetro")}</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{ref("ccpId", ccps.map((row) => ({ id: row.id, label: row.code })), "PCC…")}{ref("oprpId", oprps.map((row) => ({ id: row.id, label: row.code })), "OPRP…")}</div>{field("method", "Método")}{field("frequency", "Frecuencia")}{ref("responsibleId", members.map((row) => ({ id: row.id, label: row.name })), "Responsable…")}{active}</>}
    {kind === "emergency" && <><div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>{field("title", "Título")}{select("emergencyType", ["CONTAMINATION", "ALLERGEN_INCIDENT", "RECALL_EVENT", "SUPPLY_DISRUPTION", "FACILITY", "OTHER"])}</div>{field("description", "Descripción")}{field("recallId", "Retiro (ID)")}{field("capaId", "CAPA (ID)")}{field("documentId", "Documento (ID)")}{field("evidenceId", "Evidencia (ID)")}</>}
    <div className="nf-modal-actions nf-iso-edit-form-actions"><button type="button" className="nf-app-btn-ghost" onClick={onCancel}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={!((form.name || form.title || form.parameter || form.hazardId).trim())} onClick={save}>Guardar cambios</button></div>
  </div>;
}

// ─────────────────────────────────────────────────────
// Formularios de creación
// ─────────────────────────────────────────────────────

function NewProductForm({ pending, run, onDone }: { pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ name: "", category: "", shelfLifeDays: "", storageConditions: "", allergenCodes: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <FoodModalField label="Nombre del producto"><input aria-label="Nombre" style={input} placeholder="Ej. Salsa de tomate" value={f.name} onChange={(e) => set("name", e.target.value)} /></FoodModalField>
        <FoodModalField label="Categoría"><input aria-label="Categoría" style={input} placeholder="Ej. Salsas" value={f.category} onChange={(e) => set("category", e.target.value)} /></FoodModalField>
        <FoodModalField label="Vida útil (días)"><input aria-label="Vida útil (días)" style={input} type="number" min={0} placeholder="Ej. 180" value={f.shelfLifeDays} onChange={(e) => set("shelfLifeDays", e.target.value)} /></FoodModalField>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <FoodModalField label="Condiciones de almacenamiento"><input aria-label="Condiciones de almacenamiento" style={input} placeholder="Ej. Refrigerado entre 2 y 8 °C" value={f.storageConditions} onChange={(e) => set("storageConditions", e.target.value)} /></FoodModalField>
        <FoodModalField label="Códigos de alérgenos"><input aria-label="Separados por coma" style={input} placeholder="Separados por coma" value={f.allergenCodes} onChange={(e) => set("allergenCodes", e.target.value)} /></FoodModalField>
      </div>
      <button className="nf-app-btn-primary" disabled={pending || !f.name} style={primaryBtn} onClick={() => { run(() => createFoodProduct({ name: f.name, category: f.category || undefined, shelfLifeDays: f.shelfLifeDays ? Number(f.shelfLifeDays) : undefined, storageConditions: f.storageConditions || undefined, allergenCodes: f.allergenCodes ? f.allergenCodes.split(",").map((s) => s.trim()).filter(Boolean) : [] })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewMaterialForm({ pending, run, onDone }: { pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ name: "", specification: "", storageConditions: "", allergenCodes: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <FoodModalField label="Nombre de la materia prima"><input aria-label="Nombre" style={input} placeholder="Ej. Tomate triturado" value={f.name} onChange={(e) => set("name", e.target.value)} /></FoodModalField>
        <FoodModalField label="Especificación"><input aria-label="Material de envase" style={input} placeholder="Ej. Grado alimentario" value={f.specification} onChange={(e) => set("specification", e.target.value)} /></FoodModalField>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <FoodModalField label="Condiciones de almacenamiento"><input aria-label="Condiciones de almacenamiento" style={input} placeholder="Ej. Lugar seco y ventilado" value={f.storageConditions} onChange={(e) => set("storageConditions", e.target.value)} /></FoodModalField>
        <FoodModalField label="Códigos de alérgenos"><input aria-label="Separados por coma" style={input} placeholder="Separados por coma" value={f.allergenCodes} onChange={(e) => set("allergenCodes", e.target.value)} /></FoodModalField>
      </div>
      <button className="nf-app-btn-primary" disabled={pending || !f.name} style={primaryBtn} onClick={() => { run(() => createRawMaterial({ name: f.name, specification: f.specification || undefined, storageConditions: f.storageConditions || undefined, allergenCodes: f.allergenCodes ? f.allergenCodes.split(",").map((s) => s.trim()).filter(Boolean) : [] })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function FoodModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="nf-modal-field"><span className="nf-modal-field-label">{label}</span>{children}</label>;
}

function NewAllergenForm({ pending, run, onDone }: { pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ name: "", category: "", description: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <FoodModalField label="Nombre del alérgeno"><input aria-label="Nombre" style={input} placeholder="Ej. Leche" value={f.name} onChange={(e) => set("name", e.target.value)} /></FoodModalField>
        <FoodModalField label="Categoría"><input aria-label="Categoría" style={input} placeholder="Ej. EU-14" value={f.category} onChange={(e) => set("category", e.target.value)} /></FoodModalField>
      </div>
      <FoodModalField label="Descripción"><input aria-label="Describe el alérgeno o su clasificación" style={input} placeholder="Describe el alérgeno o su clasificación" value={f.description} onChange={(e) => set("description", e.target.value)} /></FoodModalField>
      <button className="nf-app-btn-primary" disabled={pending || !f.name} style={primaryBtn} onClick={() => { run(() => createAllergen({ name: f.name, category: f.category || undefined, description: f.description || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewIntendedUseForm({ products, pending, run, onDone }: { products: FoodSafetyPayload["products"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ productId: "", consumerGroup: "", preparationMethod: "", vulnerableConsumers: false, misusePotential: "" });
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <FoodModalField label="Producto"><select aria-label="Seleccionar producto" style={input} value={f.productId} onChange={(e) => set("productId", e.target.value)}><option value="">Seleccionar producto…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}</select></FoodModalField>
        <FoodModalField label="Grupo de consumidores"><input aria-label="Consumidor previsto" style={input} placeholder="Ej. Consumidor general" value={f.consumerGroup} onChange={(e) => set("consumerGroup", e.target.value)} /></FoodModalField>
      </div>
      <FoodModalField label="Método de preparación"><input aria-label="Uso previsto" style={input} placeholder="Ej. Listo para consumo" value={f.preparationMethod} onChange={(e) => set("preparationMethod", e.target.value)} /></FoodModalField>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={f.vulnerableConsumers} onChange={(e) => set("vulnerableConsumers", e.target.checked)} /> Incluye consumidores vulnerables</label>
      <FoodModalField label="Mal uso previsible"><input aria-label="Describe posibles usos incorrectos" style={input} placeholder="Describe posibles usos incorrectos" value={f.misusePotential} onChange={(e) => set("misusePotential", e.target.value)} /></FoodModalField>
      <button className="nf-app-btn-primary" disabled={pending || !f.productId} style={primaryBtn} onClick={() => { run(() => createIntendedUse({ productId: f.productId, consumerGroup: f.consumerGroup || undefined, preparationMethod: f.preparationMethod || undefined, vulnerableConsumers: f.vulnerableConsumers, misusePotential: f.misusePotential || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewFlowForm({ products, pending, run, onDone }: { products: FoodSafetyPayload["products"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ productId: "", title: "", version: "1", notes: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 8 }}>
        <select aria-label="Producto" style={input} value={f.productId} onChange={(e) => set("productId", e.target.value)}><option value="">Producto…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}</select>
        <input aria-label="Título del flujo" style={input} placeholder="Título del flujo" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <input aria-label="Versión" style={input} placeholder="Versión" value={f.version} onChange={(e) => set("version", e.target.value)} />
      </div>
      <input aria-label="Notas" style={input} placeholder="Notas" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      <button disabled={pending || !f.productId || !f.title} style={primaryBtn} onClick={() => { run(() => createProcessFlow({ productId: f.productId, title: f.title, version: f.version, notes: f.notes || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewStepForm({ flows, pending, run, onDone }: { flows: FoodSafetyPayload["flows"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ flowId: "", sequence: "1", name: "", stepType: "PROCESS", temperature: "", timeParam: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr 1fr", gap: 8 }}>
        <select aria-label="Flujo" style={input} value={f.flowId} onChange={(e) => set("flowId", e.target.value)}><option value="">Flujo…</option>{flows.map((fl) => <option key={fl.id} value={fl.id}>{fl.code} v{fl.version}</option>)}</select>
        <input aria-label="Secuencia" style={input} type="number" min={1} placeholder="Secuencia" value={f.sequence} onChange={(e) => set("sequence", e.target.value)} />
        <input aria-label="Nombre de la etapa" style={input} placeholder="Nombre de la etapa" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <select aria-label="Tipo de paso" style={input} value={f.stepType} onChange={(e) => set("stepType", e.target.value)}>{["RECEIPT", "STORAGE", "PREP", "PROCESS", "COOKING", "COOLING", "PACKAGING", "DISTRIBUTION", "OTHER"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input aria-label="Temperatura" style={input} placeholder="Temperatura" value={f.temperature} onChange={(e) => set("temperature", e.target.value)} />
        <input aria-label="Tiempo" style={input} placeholder="Tiempo" value={f.timeParam} onChange={(e) => set("timeParam", e.target.value)} />
      </div>
      <button disabled={pending || !f.flowId || !f.name} style={primaryBtn} onClick={() => { run(() => createProcessStep({ flowId: f.flowId, sequence: Number(f.sequence), name: f.name, stepType: f.stepType as never, temperature: f.temperature || undefined, timeParam: f.timeParam || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewHazardForm({ pending, run, onDone }: { pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ name: "", hazardType: "BIOLOGICAL", source: "", description: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <input aria-label="Nombre del peligro" style={input} placeholder="Nombre del peligro" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <select aria-label="Tipo de peligro" style={input} value={f.hazardType} onChange={(e) => set("hazardType", e.target.value)}>{["BIOLOGICAL", "CHEMICAL", "PHYSICAL", "ALLERGEN"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
      </div>
      <input aria-label="Fuente" style={input} placeholder="Fuente" value={f.source} onChange={(e) => set("source", e.target.value)} />
      <input aria-label="Descripción" style={input} placeholder="Descripción" value={f.description} onChange={(e) => set("description", e.target.value)} />
      <button disabled={pending || !f.name} style={primaryBtn} onClick={() => { run(() => createFoodHazard({ name: f.name, hazardType: f.hazardType as never, source: f.source || undefined, description: f.description || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewAssessmentForm({ hazards, steps, products, pending, run, onDone }: {
  hazards: FoodSafetyPayload["hazards"]; steps: FoodSafetyPayload["steps"]; products: FoodSafetyPayload["products"];
  pending: boolean; run: Runner; onDone: () => void;
}) {
  const [f, setF] = useState({ hazardId: "", stepId: "", productId: "", severity: 3, likelihood: 3, justification: "", existingMeasures: "" });
  const set = (k: string, v: string | number) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <select aria-label="Peligro" style={input} value={f.hazardId} onChange={(e) => set("hazardId", e.target.value)}><option value="">Peligro…</option>{hazards.map((h) => <option key={h.id} value={h.id}>{h.code} — {h.name}</option>)}</select>
        <select aria-label="Etapa" style={input} value={f.stepId} onChange={(e) => set("stepId", e.target.value)}><option value="">Etapa…</option>{steps.map((st) => <option key={st.id} value={st.id}>{st.code} — {st.name}</option>)}</select>
        <select aria-label="Producto" style={input} value={f.productId} onChange={(e) => set("productId", e.target.value)}><option value="">Producto…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}</select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <select aria-label="Severidad" style={input} value={f.severity} onChange={(e) => set("severity", Number(e.target.value))}>{[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>Severidad {v}</option>)}</select>
        <select aria-label="Probabilidad" style={input} value={f.likelihood} onChange={(e) => set("likelihood", Number(e.target.value))}>{[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>Probabilidad {v}</option>)}</select>
      </div>
      <input aria-label="Justificación" style={input} placeholder="Justificación" value={f.justification} onChange={(e) => set("justification", e.target.value)} />
      <input aria-label="Medidas existentes" style={input} placeholder="Medidas existentes" value={f.existingMeasures} onChange={(e) => set("existingMeasures", e.target.value)} />
      <button disabled={pending || !f.hazardId} style={primaryBtn} onClick={() => { run(() => createHazardAssessment({ hazardId: f.hazardId, stepId: f.stepId || undefined, productId: f.productId || undefined, severity: f.severity, likelihood: f.likelihood, justification: f.justification || undefined, existingMeasures: f.existingMeasures || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewPrpForm({ members, pending, run, onDone }: { members: Members; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ name: "", category: "OTHER", frequency: "", responsibleId: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <input aria-label="Nombre del PRP" style={input} placeholder="Nombre del PRP" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <select aria-label="Categoría" style={input} value={f.category} onChange={(e) => set("category", e.target.value)}>{["HYGIENE", "PEST_CONTROL", "WATER", "CLEANING", "MAINTENANCE", "PERSONNEL", "SUPPLIER", "WASTE", "ALLERGEN_CONTROL", "OTHER"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input aria-label="Frecuencia" style={input} placeholder="Frecuencia" value={f.frequency} onChange={(e) => set("frequency", e.target.value)} />
        <select aria-label="Responsable" style={input} value={f.responsibleId} onChange={(e) => set("responsibleId", e.target.value)}><option value="">Responsable…</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
      </div>
      <button disabled={pending || !f.name} style={primaryBtn} onClick={() => { run(() => createPrerequisiteProgram({ name: f.name, category: f.category as never, frequency: f.frequency || undefined, responsibleId: f.responsibleId || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewOprpForm({ assessments, steps, members, pending, run, onDone }: {
  assessments: FoodSafetyPayload["assessments"]; steps: FoodSafetyPayload["steps"]; members: Members;
  pending: boolean; run: Runner; onDone: () => void;
}) {
  const [f, setF] = useState({ name: "", hazardAssessmentId: "", stepId: "", monitoringMethod: "", monitoringFrequency: "", correctionAction: "", responsibleId: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input aria-label="Nombre del OPRP" style={input} placeholder="Nombre del OPRP" value={f.name} onChange={(e) => set("name", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <select aria-label="Evaluación de peligro" style={input} value={f.hazardAssessmentId} onChange={(e) => set("hazardAssessmentId", e.target.value)}><option value="">Evaluación de peligro…</option>{assessments.map((a) => <option key={a.id} value={a.id}>{a.code}</option>)}</select>
        <select aria-label="Etapa" style={input} value={f.stepId} onChange={(e) => set("stepId", e.target.value)}><option value="">Etapa…</option>{steps.map((st) => <option key={st.id} value={st.id}>{st.code}</option>)}</select>
        <select aria-label="Responsable" style={input} value={f.responsibleId} onChange={(e) => set("responsibleId", e.target.value)}><option value="">Responsable…</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input aria-label="Método de monitoreo" style={input} placeholder="Método de monitoreo" value={f.monitoringMethod} onChange={(e) => set("monitoringMethod", e.target.value)} />
        <input aria-label="Frecuencia de monitoreo" style={input} placeholder="Frecuencia de monitoreo" value={f.monitoringFrequency} onChange={(e) => set("monitoringFrequency", e.target.value)} />
      </div>
      <input aria-label="Acción de corrección" style={input} placeholder="Acción de corrección" value={f.correctionAction} onChange={(e) => set("correctionAction", e.target.value)} />
      <button disabled={pending || !f.name} style={primaryBtn} onClick={() => { run(() => createOperationalPrp({ name: f.name, hazardAssessmentId: f.hazardAssessmentId || undefined, stepId: f.stepId || undefined, monitoringMethod: f.monitoringMethod || undefined, monitoringFrequency: f.monitoringFrequency || undefined, correctionAction: f.correctionAction || undefined, responsibleId: f.responsibleId || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewCcpForm({ steps, assessments, pending, run, onDone }: { steps: FoodSafetyPayload["steps"]; assessments: FoodSafetyPayload["assessments"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ name: "", stepId: "", hazardAssessmentId: "", justification: "", hazardControlled: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input aria-label="Nombre del PCC" style={input} placeholder="Nombre del PCC" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <select aria-label="Etapa" style={input} value={f.stepId} onChange={(e) => set("stepId", e.target.value)}><option value="">Etapa…</option>{steps.map((st) => <option key={st.id} value={st.id}>{st.code} — {st.name}</option>)}</select>
        <select aria-label="Evaluación" style={input} value={f.hazardAssessmentId} onChange={(e) => set("hazardAssessmentId", e.target.value)}><option value="">Evaluación…</option>{assessments.map((a) => <option key={a.id} value={a.id}>{a.code}</option>)}</select>
      </div>
      <input aria-label="Peligro controlado" style={input} placeholder="Peligro controlado" value={f.hazardControlled} onChange={(e) => set("hazardControlled", e.target.value)} />
      <input aria-label="Justificación (árbol de decisión)" style={input} placeholder="Justificación (árbol de decisión)" value={f.justification} onChange={(e) => set("justification", e.target.value)} />
      <button disabled={pending || !f.name || !f.stepId} style={primaryBtn} onClick={() => { run(() => createCriticalControlPoint({ name: f.name, stepId: f.stepId, hazardAssessmentId: f.hazardAssessmentId || undefined, justification: f.justification || undefined, hazardControlled: f.hazardControlled || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewLimitForm({ ccps, pending, run, onDone }: { ccps: FoodSafetyPayload["ccps"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ ccpId: "", parameter: "", operator: "BETWEEN", minValue: "", maxValue: "", targetValue: "", unit: "", rationale: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <select aria-label="PCC" style={input} value={f.ccpId} onChange={(e) => set("ccpId", e.target.value)}><option value="">PCC…</option>{ccps.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}</select>
        <input aria-label="Parámetro" style={input} placeholder="Parámetro" value={f.parameter} onChange={(e) => set("parameter", e.target.value)} />
        <select aria-label="Operador" style={input} value={f.operator} onChange={(e) => set("operator", e.target.value)}>{["LT", "LTE", "GT", "GTE", "EQ", "BETWEEN"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        <input aria-label="Mínimo" style={input} type="number" step="any" placeholder="Mínimo" value={f.minValue} onChange={(e) => set("minValue", e.target.value)} />
        <input aria-label="Máximo" style={input} type="number" step="any" placeholder="Máximo" value={f.maxValue} onChange={(e) => set("maxValue", e.target.value)} />
        <input aria-label="Objetivo" style={input} type="number" step="any" placeholder="Objetivo" value={f.targetValue} onChange={(e) => set("targetValue", e.target.value)} />
        <input aria-label="Unidad" style={input} placeholder="Unidad" value={f.unit} onChange={(e) => set("unit", e.target.value)} />
      </div>
      <input aria-label="Fundamento (referencia científica)" style={input} placeholder="Fundamento (referencia científica)" value={f.rationale} onChange={(e) => set("rationale", e.target.value)} />
      <button disabled={pending || !f.ccpId || !f.parameter} style={primaryBtn} onClick={() => { run(() => createCriticalLimit({ ccpId: f.ccpId, parameter: f.parameter, operator: f.operator as never, minValue: f.minValue ? Number(f.minValue) : undefined, maxValue: f.maxValue ? Number(f.maxValue) : undefined, targetValue: f.targetValue ? Number(f.targetValue) : undefined, unit: f.unit || undefined, rationale: f.rationale || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewMonitoringPlanForm({ ccps, oprps, members, pending, run, onDone }: {
  ccps: FoodSafetyPayload["ccps"]; oprps: FoodSafetyPayload["oprps"]; members: Members;
  pending: boolean; run: Runner; onDone: () => void;
}) {
  const [f, setF] = useState({ title: "", ccpId: "", oprpId: "", method: "", frequency: "", parameter: "", responsibleId: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input aria-label="Título del plan" style={input} placeholder="Título del plan" value={f.title} onChange={(e) => set("title", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <select aria-label="PCC" style={input} value={f.ccpId} onChange={(e) => set("ccpId", e.target.value)}><option value="">PCC…</option>{ccps.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}</select>
        <select aria-label="OPRP" style={input} value={f.oprpId} onChange={(e) => set("oprpId", e.target.value)}><option value="">OPRP…</option>{oprps.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}</select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <input aria-label="Método" style={input} placeholder="Método" value={f.method} onChange={(e) => set("method", e.target.value)} />
        <input aria-label="Frecuencia" style={input} placeholder="Frecuencia" value={f.frequency} onChange={(e) => set("frequency", e.target.value)} />
        <input aria-label="Parámetro" style={input} placeholder="Parámetro" value={f.parameter} onChange={(e) => set("parameter", e.target.value)} />
      </div>
      <select aria-label="Responsable" style={input} value={f.responsibleId} onChange={(e) => set("responsibleId", e.target.value)}><option value="">Responsable…</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
      <button disabled={pending || !f.title || (!f.ccpId && !f.oprpId)} style={primaryBtn} onClick={() => { run(() => createMonitoringPlan({ title: f.title, ccpId: f.ccpId || undefined, oprpId: f.oprpId || undefined, method: f.method || undefined, frequency: f.frequency || undefined, parameter: f.parameter || undefined, responsibleId: f.responsibleId || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewMonitoringRecordForm({ plans, pending, run, onDone }: { plans: FoodSafetyPayload["plans"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ planId: "", valueNumeric: "", unit: "", notes: "", autoOpenDeviation: true });
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <select aria-label="Plan de monitoreo" style={input} value={f.planId} onChange={(e) => set("planId", e.target.value)}><option value="">Plan de monitoreo…</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.title}</option>)}</select>
        <input aria-label="Valor" style={input} type="number" step="any" placeholder="Valor" value={f.valueNumeric} onChange={(e) => set("valueNumeric", e.target.value)} />
        <input aria-label="Unidad" style={input} placeholder="Unidad" value={f.unit} onChange={(e) => set("unit", e.target.value)} />
      </div>
      <input aria-label="Notas" style={input} placeholder="Notas" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={f.autoOpenDeviation} onChange={(e) => set("autoOpenDeviation", e.target.checked)} /> Abrir desviación automáticamente si está fuera de límite</label>
      <button disabled={pending || !f.planId} style={primaryBtn} onClick={() => { run(() => createMonitoringRecord({ planId: f.planId, valueNumeric: f.valueNumeric ? Number(f.valueNumeric) : undefined, unit: f.unit || undefined, notes: f.notes || undefined, autoOpenDeviation: f.autoOpenDeviation })); onDone(); }}><Plus size={12} /> Registrar</button>
    </div>
  );
}

function NewDeviationForm({ ccps, pending, run, onDone }: { ccps: FoodSafetyPayload["ccps"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", description: "", ccpId: "", severity: "MODERATE", productHold: false, lotCodes: "" });
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input aria-label="Título de la desviación" style={input} placeholder="Título de la desviación" value={f.title} onChange={(e) => set("title", e.target.value)} />
      <input aria-label="Descripción" style={input} placeholder="Descripción" value={f.description} onChange={(e) => set("description", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <select aria-label="PCC" style={input} value={f.ccpId} onChange={(e) => set("ccpId", e.target.value)}><option value="">PCC…</option>{ccps.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}</select>
        <select aria-label="Severidad" style={input} value={f.severity} onChange={(e) => set("severity", e.target.value)}>{["MINOR", "MODERATE", "MAJOR", "CRITICAL"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        <input aria-label="Códigos de lote (coma)" style={input} placeholder="Códigos de lote (coma)" value={f.lotCodes} onChange={(e) => set("lotCodes", e.target.value)} />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={f.productHold} onChange={(e) => set("productHold", e.target.checked)} /> Retener producto</label>
      <button disabled={pending || !f.title} style={primaryBtn} onClick={() => { run(() => createDeviation({ title: f.title, description: f.description || undefined, ccpId: f.ccpId || undefined, severity: f.severity as never, productHold: f.productHold, lotCodes: f.lotCodes ? f.lotCodes.split(",").map((s) => s.trim()).filter(Boolean) : [] })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewCorrectionForm({ deviations, pending, run, onDone }: { deviations: FoodSafetyPayload["deviations"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ deviationId: "", actionTaken: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <select aria-label="Desviación" style={input} value={f.deviationId} onChange={(e) => set("deviationId", e.target.value)}><option value="">Desviación…</option>{deviations.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.title}</option>)}</select>
      <input aria-label="Acción tomada" style={input} placeholder="Acción tomada" value={f.actionTaken} onChange={(e) => set("actionTaken", e.target.value)} />
      <button disabled={pending || !f.deviationId || !f.actionTaken} style={primaryBtn} onClick={() => { run(() => createFoodSafetyCorrection({ deviationId: f.deviationId, actionTaken: f.actionTaken })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewValidationForm({ pending, run, onDone }: { pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", targetType: "CCP", targetCode: "", method: "", result: "PENDING", findings: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input aria-label="Título de la validación" style={input} placeholder="Título de la validación" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <select aria-label="Tipo de objetivo" style={input} value={f.targetType} onChange={(e) => set("targetType", e.target.value)}>{["CCP", "OPRP", "PRP", "PROCESS", "OTHER"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        <input aria-label="Código objetivo" style={input} placeholder="Código objetivo" value={f.targetCode} onChange={(e) => set("targetCode", e.target.value)} />
      </div>
      <input aria-label="Método" style={input} placeholder="Método" value={f.method} onChange={(e) => set("method", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <select aria-label="Resultado" style={input} value={f.result} onChange={(e) => set("result", e.target.value)}>{["PENDING", "VALID", "INVALID", "CONDITIONAL"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        <input aria-label="Hallazgos" style={input} placeholder="Hallazgos" value={f.findings} onChange={(e) => set("findings", e.target.value)} />
      </div>
      <button disabled={pending || !f.title} style={primaryBtn} onClick={() => { run(() => createValidationRecord({ title: f.title, targetType: f.targetType as never, targetCode: f.targetCode || undefined, method: f.method || undefined, result: f.result as never, findings: f.findings || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewVerificationForm({ members, pending, run, onDone }: { members: Members; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", activityType: "INTERNAL_AUDIT", scheduledFor: "", result: "PENDING", findings: "", responsibleId: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input aria-label="Título de la actividad" style={input} placeholder="Título de la actividad" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <select aria-label="Tipo de actividad" style={input} value={f.activityType} onChange={(e) => set("activityType", e.target.value)}>{["INTERNAL_AUDIT", "RECORD_REVIEW", "CALIBRATION_CHECK", "SAMPLING", "SUPPLIER_AUDIT", "OTHER"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        <input aria-label="Fecha prevista" style={input} type="date" value={f.scheduledFor} onChange={(e) => set("scheduledFor", e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 8 }}>
        <select aria-label="Resultado" style={input} value={f.result} onChange={(e) => set("result", e.target.value)}>{["PENDING", "CONFORMING", "NONCONFORMING", "PARTIAL"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        <select aria-label="Responsable" style={input} value={f.responsibleId} onChange={(e) => set("responsibleId", e.target.value)}><option value="">Responsable…</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <input aria-label="Hallazgos" style={input} placeholder="Hallazgos" value={f.findings} onChange={(e) => set("findings", e.target.value)} />
      </div>
      <button disabled={pending || !f.title} style={primaryBtn} onClick={() => { run(() => createVerificationActivity({ title: f.title, activityType: f.activityType as never, scheduledFor: f.scheduledFor || undefined, result: f.result as never, findings: f.findings || undefined, responsibleId: f.responsibleId || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewLotForm({ products, materials, lots, pending, run, onDone }: {
  products: FoodSafetyPayload["products"]; materials: FoodSafetyPayload["materials"]; lots: FoodSafetyPayload["lots"];
  pending: boolean; run: Runner; onDone: () => void;
}) {
  const [f, setF] = useState({ lotType: "FINISHED", productId: "", rawMaterialId: "", customerName: "", quantity: "", unit: "", previousLotIds: [] as string[] });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const togglePrev = (id: string) => setF((p) => ({ ...p, previousLotIds: p.previousLotIds.includes(id) ? p.previousLotIds.filter((x) => x !== id) : [...p.previousLotIds, id] }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <select aria-label="Tipo de lote" style={input} value={f.lotType} onChange={(e) => set("lotType", e.target.value)}>{["RAW_MATERIAL", "INTERMEDIATE", "FINISHED", "DISTRIBUTED"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        <select aria-label="Producto" style={input} value={f.productId} onChange={(e) => set("productId", e.target.value)}><option value="">Producto…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}</select>
        <select aria-label="Materia prima" style={input} value={f.rawMaterialId} onChange={(e) => set("rawMaterialId", e.target.value)}><option value="">Materia prima…</option>{materials.map((m) => <option key={m.id} value={m.id}>{m.code}</option>)}</select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input aria-label="Cliente (si es distribución)" style={input} placeholder="Cliente (si es distribución)" value={f.customerName} onChange={(e) => set("customerName", e.target.value)} />
        <input aria-label="Cantidad" style={input} type="number" step="any" placeholder="Cantidad" value={f.quantity} onChange={(e) => set("quantity", e.target.value)} />
        <input aria-label="Unidad" style={input} placeholder="Unidad" value={f.unit} onChange={(e) => set("unit", e.target.value)} />
      </div>
      <div>
        <label style={{ fontSize: 12, color: "#64748b" }}>Lotes previos (trazabilidad hacia atrás):</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          {lots.map((l) => (
            <label key={l.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, border: "1px solid #e5eaf2", borderRadius: 6, padding: "3px 7px" }}>
              <input type="checkbox" checked={f.previousLotIds.includes(l.id)} onChange={() => togglePrev(l.id)} /> {l.code}
            </label>
          ))}
        </div>
      </div>
      <button disabled={pending || (f.lotType === "RAW_MATERIAL" ? !f.rawMaterialId : !f.productId)} style={primaryBtn} onClick={() => { run(() => createTraceabilityLot({ lotType: f.lotType as never, productId: f.productId || undefined, rawMaterialId: f.rawMaterialId || undefined, customerName: f.customerName || undefined, quantity: f.quantity ? Number(f.quantity) : undefined, unit: f.unit || undefined, previousLotIds: f.previousLotIds })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewRecallForm({ lots, pending, run, onDone }: { lots: FoodSafetyPayload["lots"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", reason: "", recallType: "WITHDRAWAL", lotCodes: [] as string[], authorityNotified: false });
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const toggleLot = (code: string) => setF((p) => ({ ...p, lotCodes: p.lotCodes.includes(code) ? p.lotCodes.filter((x) => x !== code) : [...p.lotCodes, code] }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <input aria-label="Título del retiro" style={input} placeholder="Título del retiro" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <select aria-label="Tipo de retirada" style={input} value={f.recallType} onChange={(e) => set("recallType", e.target.value)}>{["WITHDRAWAL", "RECALL", "STOCK_RECOVERY"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
      </div>
      <input aria-label="Motivo" style={input} placeholder="Motivo" value={f.reason} onChange={(e) => set("reason", e.target.value)} />
      <div>
        <label style={{ fontSize: 12, color: "#64748b" }}>Lotes afectados (la trazabilidad expande adelante/atrás automáticamente):</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          {lots.map((l) => (
            <label key={l.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, border: "1px solid #e5eaf2", borderRadius: 6, padding: "3px 7px" }}>
              <input type="checkbox" checked={f.lotCodes.includes(l.code)} onChange={() => toggleLot(l.code)} /> {l.code}
            </label>
          ))}
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={f.authorityNotified} onChange={(e) => set("authorityNotified", e.target.checked)} /> Autoridad notificada</label>
      <button disabled={pending || !f.title || !f.reason || f.lotCodes.length === 0} style={primaryBtn} onClick={() => { run(() => createWithdrawalRecall({ title: f.title, reason: f.reason, recallType: f.recallType as never, lotCodes: f.lotCodes, authorityNotified: f.authorityNotified })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewEmergencyForm({ pending, run, onDone }: { pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", emergencyType: "OTHER", description: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <input aria-label="Título de la emergencia" style={input} placeholder="Título de la emergencia" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <select aria-label="Tipo de emergencia" style={input} value={f.emergencyType} onChange={(e) => set("emergencyType", e.target.value)}>{["CONTAMINATION", "ALLERGEN_INCIDENT", "RECALL_EVENT", "SUPPLY_DISRUPTION", "FACILITY", "OTHER"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
      </div>
      <input aria-label="Descripción" style={input} placeholder="Descripción" value={f.description} onChange={(e) => set("description", e.target.value)} />
      <button disabled={pending || !f.title} style={primaryBtn} onClick={() => { run(() => createFoodSafetyEmergency({ title: f.title, emergencyType: f.emergencyType as never, description: f.description || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewCommunicationForm({ pending, run, onDone }: { pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ subject: "", content: "", party: "SUPPLIER", partyName: "", channel: "", relatedCode: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input aria-label="Asunto" style={input} placeholder="Asunto" value={f.subject} onChange={(e) => set("subject", e.target.value)} />
        <select aria-label="Parte" style={input} value={f.party} onChange={(e) => set("party", e.target.value)}>{["SUPPLIER", "CUSTOMER", "AUTHORITY", "OTHER"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
        <input aria-label="Nombre de la parte" style={input} placeholder="Nombre de la parte" value={f.partyName} onChange={(e) => set("partyName", e.target.value)} />
      </div>
      <textarea aria-label="Contenido" style={{ ...input, minHeight: 70 }} placeholder="Contenido" value={f.content} onChange={(e) => set("content", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input aria-label="Canal (email, llamada…)" style={input} placeholder="Canal (email, llamada…)" value={f.channel} onChange={(e) => set("channel", e.target.value)} />
        <input aria-label="Código relacionado (retiro, lote…)" style={input} placeholder="Código relacionado (retiro, lote…)" value={f.relatedCode} onChange={(e) => set("relatedCode", e.target.value)} />
      </div>
      <button disabled={pending || !f.subject} style={primaryBtn} onClick={() => { run(() => recordChainCommunication({ subject: f.subject, content: f.content || undefined, party: f.party as never, partyName: f.partyName || undefined, channel: f.channel || undefined, relatedCode: f.relatedCode || undefined })); onDone(); }}><Plus size={12} /> Registrar</button>
    </div>
  );
}
