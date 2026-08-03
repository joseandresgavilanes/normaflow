"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Cross, FileStack, PenTool, ShieldAlert, Truck,
  FlaskConical, Boxes, Siren, Eye, Undo2, Scale, ArrowRight, Check, Plus, X, Settings,
} from "lucide-react";
import type { MedicalDevicesPayload } from "@/lib/medical-devices/queries";
import {
  transitionComplaint,
  transitionDeviceMasterRecord,
  transitionDesignHistoryFile,
  transitionProductRecall,
  transitionAdverseEvent,
  transitionFieldSafetyAction,
  transitionPostMarketSurveillance,
  purgeComplaint,
  purgeAdverseEvent,
  setMdRetentionPolicy,
  createDeviceFamily, createMedicalDevice, createDeviceMasterRecord,
  createDesignHistoryFile, createDesignInput, createDesignOutput, createDesignReview,
  createDesignVerification, createDesignValidation, createDesignTransfer, createDeviceRiskFile,
  createCriticalSupplier, createSupplierQualification, createProcessValidation, createSterilizationValidation,
  createProductionBatch, createDeviceTraceability,
  createComplaint, createAdverseEvent, createPostMarketSurveillance, createFieldSafetyAction, createProductRecall,
  createRegulatoryRequirement, createRegulatorySubmission,
  updateMedicalDeviceRecord,
} from "@/lib/actions/medical-devices";
import {
  nextComplaintStatuses,
  nextRecallStatuses,
  nextRecordStatuses,
  nextAdverseEventStatuses,
  nextFsaStatuses,
  nextPmsStatuses,
} from "@/lib/medical-devices/workflows";
import Modal from "@/components/ui/Modal";
import IsoMetricCard from "@/components/ui/IsoMetricCard";
import IsoSectionMetrics from "@/components/ui/IsoSectionMetrics";
import IsoTableCard from "@/components/ui/IsoTableCard";
import IsoQuickCreate from "@/components/ui/IsoQuickCreate";
import IsoSectionHeader from "@/components/ui/IsoSectionHeader";
import { ConfirmActionModal } from "@/components/ui/ActionDialogs";
import { useCreateRequest } from "@/hooks/useCreateRequest";
import { useModuleSection } from "@/hooks/useModuleSection";
import type {
  MdComplaintStatus, MdRecallStatus, MdRecordStatus,
  MdAdverseEventStatus, MdFsaStatus, MdPmsStatus,
} from "@prisma/client";

type Tab =
  | "panel" | "devices" | "dmr" | "design" | "risks" | "suppliers"
  | "validations" | "batches" | "vigilance" | "regulatory";

const SECTION_META: Record<Tab, { title: string; sub: string }> = {
  panel: { title: "Calidad de dispositivos médicos", sub: "ISO 13485 — visión general de dispositivos, expedientes, diseño, proveedores, lotes y vigilancia." },
  devices: { title: "Dispositivos y familias", sub: "Familias, dispositivos, clasificación y estado de producción." },
  dmr: { title: "Expedientes maestros (DMR)", sub: "Expedientes maestros, versiones y estado de aprobación del dispositivo." },
  design: { title: "Expedientes de diseño (DHF)", sub: "Inputs, outputs, revisiones, verificaciones, validaciones y transferencia." },
  risks: { title: "Archivos de riesgos", sub: "Riesgos de dispositivo, controles y decisiones de aceptación." },
  suppliers: { title: "Proveedores críticos", sub: "Cualificación, seguimiento y desempeño de proveedores críticos." },
  validations: { title: "Validaciones", sub: "Validaciones de proceso y esterilización con sus resultados y evidencias." },
  batches: { title: "Lotes y trazabilidad", sub: "Lotes liberados, fabricación y trazabilidad de dispositivos." },
  vigilance: { title: "Vigilancia post-comercialización", sub: "Quejas, eventos adversos, PMS, acciones de campo y retiros." },
  regulatory: { title: "Requisitos regulatorios", sub: "Requisitos aplicables, presentaciones y seguimiento regulatorio." },
};

const card: React.CSSProperties = { border: "1px solid var(--nf-line, #e5eaf2)", borderRadius: 14, padding: 18, background: "var(--nf-surface, #fff)" };
const chip = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, display: "inline-block" });
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e5eaf2", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const miniBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 7, border: "1px solid #0e7490", background: "#ecfeff", color: "#0e7490", fontWeight: 600, fontSize: 12, cursor: "pointer", marginRight: 4 };
const dangerBtn: React.CSSProperties = { ...miniBtn, borderColor: "#dc2626", background: "#fef2f2", color: "#b91c1c" };
const fmt = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--nf-line)", borderRadius: 8, fontSize: 13, fontFamily: "inherit" };
const primaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 14px", minHeight: 32, border: "1px solid var(--nf-app-accent)", borderRadius: 999, background: "var(--nf-app-accent)", color: "#fff", fontWeight: 600, fontSize: 12, fontFamily: "inherit", cursor: "pointer" };
type Runner = (action: () => Promise<unknown>) => void;
type Devices = MedicalDevicesPayload["devices"];
type MedicalDeviceEditorKind = "family" | "device" | "dmr" | "dhf" | "input" | "output" | "review" | "verification" | "validation" | "transfer" | "risk" | "supplier" | "qualification" | "processValidation" | "sterilizationValidation" | "batch" | "trace" | "complaint" | "adverseEvent" | "pms" | "fieldAction" | "recall" | "requirement" | "submission";

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

export default function MedicalDevicesClient({ initial, demo = false }: { initial: MedicalDevicesPayload; demo?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useModuleSection<Tab>("panel");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ kind: MedicalDeviceEditorKind; value: Record<string, any> } | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<{ id: string; kind: "complaint" | "adverseEvent"; label: string } | null>(null);
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
    const sensitive = ["complaint", "adverseEvent", "pms", "fieldAction", "recall"].includes(editor.kind);
    if (sensitive && !can.sensitiveUpdate) return;
    if (!sensitive && !can.update) return;
    run(async () => { await updateMedicalDeviceRecord(editor.value.id, editor.kind, payload); setEditor(null); });
  }

  function canEdit(kind: MedicalDeviceEditorKind) {
    return ["complaint", "adverseEvent", "pms", "fieldAction", "recall"].includes(kind) ? can.sensitiveUpdate : can.update;
  }

  return (
    <div className="nf-iso-module" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <IsoSectionHeader headingLevel={1} icon={Cross} title={SECTION_META[tab].title} description={SECTION_META[tab].sub}
        action={demo ? <span style={chip("#eef2ff", "#4f46e5")}>Demo</span> : undefined} />

      <div style={{ ...card, borderColor: "#fde68a", background: "#fffbeb", color: "#92400e", fontSize: 13 }}>
        {initial.disclaimer}
      </div>

      {error && <div style={{ ...card, borderColor: "#fecaca", background: "#fef2f2", color: "#b91c1c" }}>{error}</div>}

      {tab === "panel" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12 }}>
        <Stat label="Dispositivos" value={s.devices} />
        <Stat label="DMR aprobados" value={s.dmrsApproved} />
        <Stat label="Cobertura inputs %" value={s.inputCoveragePercent} />
        <Stat label="Quejas abiertas" value={s.openComplaints} accent={s.openComplaints ? "#dc2626" : undefined} />
        <Stat label="Eventos adversos" value={s.openAdverseEvents} accent={s.openAdverseEvents ? "#dc2626" : undefined} />
        <Stat label="Retiros abiertos" value={s.openRecalls} accent={s.openRecalls ? "#dc2626" : undefined} />
      </div> : <IsoSectionMetrics items={tab === "devices" ? [{ label: "Dispositivos activos", value: s.devices }, { label: "Familias", value: initial.families.length }, { label: "Lotes liberados", value: s.batchesReleased }] : tab === "dmr" ? [{ label: "DMR aprobados", value: s.dmrsApproved }, { label: "DMR registrados", value: initial.dmrs.length }, { label: "Dispositivos", value: s.devices }] : tab === "design" ? [{ label: "DHF abiertos", value: s.dhfsOpen, accent: s.dhfsOpen ? "#d68a1a" : undefined }, { label: "Cobertura inputs", value: s.inputCoveragePercent, suffix: "%" }, { label: "Dispositivos", value: s.devices }] : tab === "risks" ? [{ label: "Archivos de riesgo", value: initial.riskFiles.length }, { label: "Dispositivos", value: s.devices }, { label: "DHF abiertos", value: s.dhfsOpen, accent: s.dhfsOpen ? "#d68a1a" : undefined }] : tab === "suppliers" ? [{ label: "Proveedores críticos", value: s.criticalSuppliers }, { label: "Cualificaciones", value: initial.qualifications.length }, { label: "Dispositivos", value: s.devices }] : tab === "validations" ? [{ label: "Validaciones de proceso", value: initial.processVals.length }, { label: "Esterilización", value: initial.sterVals.length }, { label: "Dispositivos", value: s.devices }] : tab === "batches" ? [{ label: "Lotes registrados", value: initial.batches.length }, { label: "Lotes liberados", value: s.batchesReleased }, { label: "Trazas", value: initial.traces.length }] : tab === "vigilance" ? [{ label: "Quejas abiertas", value: s.openComplaints, accent: s.openComplaints ? "#dc2626" : undefined }, { label: "Eventos adversos", value: s.openAdverseEvents, accent: s.openAdverseEvents ? "#dc2626" : undefined }, { label: "Retiros abiertos", value: s.openRecalls, accent: s.openRecalls ? "#dc2626" : undefined }] : [{ label: "Requisitos activos", value: s.activeRequirements }, { label: "Presentaciones", value: initial.submissions.length }, { label: "Dispositivos", value: s.devices }]} />}

      {tab === "panel" && (
        <>
          <div className="nf-iso-panel-toolbar"><div><strong>Resumen de dispositivos médicos</strong><span>Accesos directos a calidad, diseño y vigilancia.</span></div><IsoQuickCreate modulePath="/app/medical-devices" items={[{ label: "Nueva familia", description: "Crear familia de dispositivos", section: "devices", Icon: Cross }, { label: "Nuevo dispositivo", description: "Registrar dispositivo", section: "devices", Icon: Cross }, { label: "Nuevo expediente maestro (DMR)", description: "Crear expediente maestro", section: "dmr", Icon: FileStack }, { label: "Nuevo DHF", description: "Abrir expediente de diseño", section: "design", Icon: PenTool }, { label: "Nuevo archivo de riesgos", description: "Registrar riesgo de dispositivo", section: "risks", Icon: ShieldAlert }, { label: "Nuevo proveedor crítico", description: "Calificar proveedor", section: "suppliers", Icon: Truck }, { label: "Nueva validación", description: "Registrar validación", section: "validations", Icon: FlaskConical }, { label: "Nuevo lote", description: "Registrar lote", section: "batches", Icon: Boxes }, { label: "Nueva queja", description: "Registrar queja", section: "vigilance", Icon: Siren }, { label: "Nuevo requisito regulatorio", description: "Agregar requisito", section: "regulatory", Icon: Scale }]} /></div>
          <div className="nf-iso-dashboard-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><FileStack size={16} aria-hidden />Expediente y diseño (§4.2, §7.3)</h3>
            <Row k="Dispositivos activos/producción" v={s.devices} />
            <Row k="DMR aprobados" v={s.dmrsApproved} />
            <Row k="DHF abiertos" v={s.dhfsOpen} />
            <Row k="Cobertura inputs→outputs" v={`${s.inputCoveragePercent}%`} danger={s.inputCoveragePercent < 100} />
          </div>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><Truck size={16} aria-hidden />Producción y proveedores (§7.4–7.5)</h3>
            <Row k="Proveedores críticos" v={s.criticalSuppliers} />
            <Row k="Lotes liberados" v={s.batchesReleased} />
            <Row k="Validaciones de proceso" v={initial.processVals.length} />
            <Row k="Validaciones de esterilización" v={initial.sterVals.length} />
          </div>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><Eye size={16} aria-hidden />Vigilancia (§8.2–8.3)</h3>
            {s.sensitiveLocked ? (
              <p style={{ margin: 0, color: "#b45309", fontSize: 13 }}>
                Datos de quejas, eventos adversos, PMS, FSCA y retiros requieren permiso <code>md-sensitive</code>.
              </p>
            ) : (
              <>
                <Row k="Quejas abiertas" v={s.openComplaints} danger={s.openComplaints > 0} />
                <Row k="Eventos adversos abiertos" v={s.openAdverseEvents} danger={s.openAdverseEvents > 0} />
                <Row k="Retiros abiertos" v={s.openRecalls} danger={s.openRecalls > 0} />
                <Row k="Retención configurada" v={`${initial.retentionYears} años`} />
              </>
            )}
            <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 12 }}>
              Solo referencias opacas de sujeto — sin PII clínica innecesaria. Texto libre cifrado en reposo.
            </p>
          </div>
          </div>
        </>
      )}

      {tab === "devices" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <NewFormToggle label="Nueva familia">{(close) => <NewFamilyForm pending={pending} run={run} onDone={close} />}</NewFormToggle>
              <NewFormToggle label="Nuevo dispositivo">{(close) => <NewDeviceForm families={initial.families} pending={pending} run={run} onDone={close} />}</NewFormToggle>
            </div>
          )}
          <Table headers={["Código", "Familia", "Nombre", "Acciones"]}>
            {initial.families.map((f) => (
              <tr key={f.id}>
                <td style={td}>{f.code}</td>
                <td style={td}>{f.name}</td>
                <td style={td}>{live && can.update && <EditButton onClick={() => setEditor({ kind: "family", value: f as any })} />}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Código", "Nombre", "Familia", "Clase", "UDI-DI", "Estado", "Acciones"]}>
            {initial.devices.map((d) => (
              <tr key={d.id}>
                <td style={td}>{d.code}</td>
                <td style={td}>{d.name}</td>
                <td style={td}>{d.family?.code ?? "—"}</td>
                <td style={td}>{d.classification ?? "—"}</td>
                <td style={td}>{d.udiDi ?? "—"}</td>
                <td style={td}>{d.status}</td>
                <td style={td}>{live && can.update && <EditButton onClick={() => setEditor({ kind: "device", value: d as any })} />}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "dmr" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && <NewFormToggle label="Nuevo expediente maestro (DMR)">{(close) => <NewDmrForm devices={initial.devices} pending={pending} run={run} onDone={close} />}</NewFormToggle>}
          <Table headers={["Código", "Ver.", "Dispositivo", "Título", "Estado", "Acciones"]}>
            {initial.dmrs.map((r) => {
              const next = nextRecordStatuses(r.status as MdRecordStatus)[0];
              return (
                <tr key={r.id}>
                  <td style={td}>{r.code}</td>
                  <td style={td}>{r.version}</td>
                  <td style={td}>{r.device.code}</td>
                  <td style={td}>{r.title}</td>
                  <td style={td}>{r.status}</td>
                  <td style={td}>
                    {live && can.update && <EditButton onClick={() => setEditor({ kind: "dmr", value: r as any })} />}
                    {live && next && can.approve && (
                      <button disabled={pending} style={miniBtn} onClick={() => run(() => transitionDeviceMasterRecord(r.id, next))}>
                        <ArrowRight size={12} /> {next} <Check size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        </div>
      )}

      {tab === "design" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <NewFormToggle label="Nuevo DHF">{(close) => <NewDhfForm devices={initial.devices} pending={pending} run={run} onDone={close} />}</NewFormToggle>
              <NewFormToggle label="Nuevo input">{(close) => <NewDesignInputForm dhfs={initial.dhfs} pending={pending} run={run} onDone={close} />}</NewFormToggle>
              <NewFormToggle label="Nuevo output">{(close) => <NewDesignOutputForm dhfs={initial.dhfs} pending={pending} run={run} onDone={close} />}</NewFormToggle>
              <NewFormToggle label="Nueva revisión">{(close) => <NewDesignReviewForm dhfs={initial.dhfs} pending={pending} run={run} onDone={close} />}</NewFormToggle>
              <NewFormToggle label="Nueva verificación">{(close) => <NewDesignVerificationForm dhfs={initial.dhfs} pending={pending} run={run} onDone={close} />}</NewFormToggle>
              <NewFormToggle label="Nueva validación">{(close) => <NewDesignValidationForm dhfs={initial.dhfs} pending={pending} run={run} onDone={close} />}</NewFormToggle>
              <NewFormToggle label="Nueva transferencia">{(close) => <NewDesignTransferForm dhfs={initial.dhfs} pending={pending} run={run} onDone={close} />}</NewFormToggle>
            </div>
          )}
          <Table headers={["DHF", "Dispositivo", "Estado", "In", "Out", "Rev", "Ver", "Val", "Acciones"]}>
            {initial.dhfs.map((d) => (
              <tr key={d.id}>
                <td style={td}>{d.code}</td>
                <td style={td}>{d.device.code}</td>
                <td style={td}>{d.status}</td>
                <td style={td}>{d._count.inputs}</td>
                <td style={td}>{d._count.outputs}</td>
                <td style={td}>{d._count.reviews}</td>
                <td style={td}>{d._count.verifications}</td>
                <td style={td}>{d._count.validations}</td>
                <td style={td}>{live && can.update && <><EditButton onClick={() => setEditor({ kind: "dhf", value: d as any })} /><RecordTransitionButton row={d} pending={pending} onTransition={(to) => run(() => transitionDesignHistoryFile(d.id, to))} approve={can.approve} /></>}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Input", "Requisito", "Estado", "Acciones"]}>
            {initial.inputs.map((i) => (
              <tr key={i.id}>
                <td style={td}>{i.code}</td>
                <td style={td}>{i.requirement}</td>
                <td style={td}>{i.status}</td>
                <td style={td}>{live && can.update && <EditButton onClick={() => setEditor({ kind: "input", value: i as any })} />}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Output", "Descripción", "Inputs enlazados", "Acciones"]}>
            {initial.outputs.map((o) => (
              <tr key={o.id}>
                <td style={td}>{o.code}</td>
                <td style={td}>{o.description}</td>
                <td style={td}>{(o.linkedInputCodes ?? []).join(", ") || "—"}</td>
                <td style={td}>{live && can.update && <EditButton onClick={() => setEditor({ kind: "output", value: o as any })} />}</td>
              </tr>
            ))}
          </Table>
          {initial.coverage.uncovered.length > 0 && (
            <div style={{ ...card, borderColor: "#fde68a", background: "#fffbeb" }}>
              Inputs sin output: {initial.coverage.uncovered.join(", ")}
            </div>
          )}
          <Table headers={["Revisión", "DHF", "Resultado", "Hallazgos", "Acciones"]}>
            {initial.reviews.map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.code}</td>
                <td style={td}>{initial.dhfs.find((d) => d.id === r.dhfId)?.code ?? "—"}</td>
                <td style={td}>{r.outcome}</td>
                <td style={td}>{r.findings ?? "—"}</td>
                <td style={td}>{live && can.update && <EditButton onClick={() => setEditor({ kind: "review", value: r as any })} />}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Verificación", "DHF", "Método", "Resultado", "Fecha", "Acciones"]}>
            {initial.verifications.map((v) => (
              <tr key={v.id}>
                <td style={td}>{v.code}</td>
                <td style={td}>{initial.dhfs.find((d) => d.id === v.dhfId)?.code ?? "—"}</td>
                <td style={td}>{v.method ?? "—"}</td>
                <td style={td}>{v.result}</td>
                <td style={td}>{fmt(v.verifiedAt)}</td>
                <td style={td}>{live && can.update && <EditButton onClick={() => setEditor({ kind: "verification", value: v as any })} />}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Validación", "DHF", "Necesidad", "Resultado", "Fecha", "Acciones"]}>
            {initial.validations.map((v) => (
              <tr key={v.id}>
                <td style={td}>{v.code}</td>
                <td style={td}>{initial.dhfs.find((d) => d.id === v.dhfId)?.code ?? "—"}</td>
                <td style={td}>{v.userNeedsRef ?? "—"}</td>
                <td style={td}>{v.result}</td>
                <td style={td}>{fmt(v.validatedAt)}</td>
                <td style={td}>{live && can.update && <EditButton onClick={() => setEditor({ kind: "validation", value: v as any })} />}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Transferencia", "DHF", "Sede receptora", "Estado", "Acciones"]}>
            {initial.transfers.map((t) => (
              <tr key={t.id}>
                <td style={td}>{t.code}</td>
                <td style={td}>{initial.dhfs.find((d) => d.id === t.dhfId)?.code ?? "—"}</td>
                <td style={td}>{t.receivingSite ?? "—"}</td>
                <td style={td}>{t.status}</td>
                <td style={td}>{live && can.update && <EditButton onClick={() => setEditor({ kind: "transfer", value: t as any })} />}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "risks" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && <NewFormToggle label="Nuevo archivo de riesgos">{(close) => <NewRiskFileForm devices={initial.devices} pending={pending} run={run} onDone={close} />}</NewFormToggle>}
          <Table headers={["Código", "Ver.", "Dispositivo", "Título", "Metodología", "Estado", "Acciones"]}>
            {initial.riskFiles.map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.code}</td>
                <td style={td}>{r.version}</td>
                <td style={td}>{r.device.code}</td>
                <td style={td}>{r.title}</td>
                <td style={td}>{r.methodology ?? "—"}</td>
                <td style={td}>{r.status}</td>
                <td style={td}>{live && can.update && <EditButton onClick={() => setEditor({ kind: "risk", value: r as any })} />}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "suppliers" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <NewFormToggle label="Nuevo proveedor crítico">{(close) => <NewCriticalSupplierForm pending={pending} run={run} onDone={close} />}</NewFormToggle>
              <NewFormToggle label="Nueva cualificación">{(close) => <NewQualificationForm suppliers={initial.suppliers} pending={pending} run={run} onDone={close} />}</NewFormToggle>
            </div>
          )}
          <Table headers={["Código", "Nombre", "Tipo", "Criticidad", "Estado", "Acciones"]}>
            {initial.suppliers.map((srow) => (
              <tr key={srow.id}>
                <td style={td}>{srow.code}</td>
                <td style={td}>{srow.name}</td>
                <td style={td}>{srow.serviceType ?? "—"}</td>
                <td style={td}>{srow.criticality}</td>
                <td style={td}>{srow.status}</td>
                <td style={td}>{live && can.update && <EditButton onClick={() => setEditor({ kind: "supplier", value: srow as any })} />}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Código", "Proveedor", "Estado", "Próx. revisión", "Acciones"]}>
            {initial.qualifications.map((q) => (
              <tr key={q.id}>
                <td style={td}>{q.code}</td>
                <td style={td}>{q.criticalSupplier.code}</td>
                <td style={td}>{q.status}</td>
                <td style={td}>{fmt(q.nextReviewAt)}</td>
                <td style={td}>{live && can.update && <EditButton onClick={() => setEditor({ kind: "qualification", value: q as any })} />}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "validations" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <NewFormToggle label="Nueva validación de proceso">{(close) => <NewProcessValidationForm devices={initial.devices} pending={pending} run={run} onDone={close} />}</NewFormToggle>
              <NewFormToggle label="Nueva validación de esterilización">{(close) => <NewSterilizationValidationForm devices={initial.devices} pending={pending} run={run} onDone={close} />}</NewFormToggle>
            </div>
          )}
          <Table headers={["Proceso", "Dispositivo", "Título", "Resultado", "Fecha", "Acciones"]}>
            {initial.processVals.map((v) => (
              <tr key={v.id}>
                <td style={td}>{v.code}</td>
                <td style={td}>{v.device?.code ?? "—"}</td>
                <td style={td}>{v.title}</td>
                <td style={td}>{v.result}</td>
                <td style={td}>{fmt(v.validatedAt)}</td>
                <td style={td}>{live && can.update && <EditButton onClick={() => setEditor({ kind: "processValidation", value: v as any })} />}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Esterilización", "Dispositivo", "Método", "Resultado", "Fecha", "Acciones"]}>
            {initial.sterVals.map((v) => (
              <tr key={v.id}>
                <td style={td}>{v.code}</td>
                <td style={td}>{v.device?.code ?? "—"}</td>
                <td style={td}>{v.method}</td>
                <td style={td}>{v.result}</td>
                <td style={td}>{fmt(v.validatedAt)}</td>
                <td style={td}>{live && can.update && <EditButton onClick={() => setEditor({ kind: "sterilizationValidation", value: v as any })} />}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "batches" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <NewFormToggle label="Nuevo lote">{(close) => <NewBatchForm devices={initial.devices} pending={pending} run={run} onDone={close} />}</NewFormToggle>
              <NewFormToggle label="Nueva traza">{(close) => <NewTraceabilityForm batches={initial.batches} pending={pending} run={run} onDone={close} />}</NewFormToggle>
            </div>
          )}
          <Table headers={["Código", "Lote", "Dispositivo", "Cantidad", "Estado", "Fabricado", "Acciones"]}>
            {initial.batches.map((b) => (
              <tr key={b.id}>
                <td style={td}>{b.code}</td>
                <td style={td}>{b.lotNumber}</td>
                <td style={td}>{b.device.code}</td>
                <td style={td}>{b.quantity ?? "—"} {b.unit ?? ""}</td>
                <td style={td}>{b.status}</td>
                <td style={td}>{fmt(b.manufacturedAt)}</td>
                <td style={td}>{live && can.update && <EditButton onClick={() => setEditor({ kind: "batch", value: b as any })} />}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Traza", "Lote", "Lote proveedor", "Distribución", "Cuenta", "Notas", "Acciones"]}>
            {initial.traces.map((t) => (
              <tr key={t.id}>
                <td style={td}>{t.code}</td>
                <td style={td}>{t.batch.lotNumber}</td>
                <td style={td}>{t.supplierLot ?? "—"}</td>
                <td style={td}>{t.distributionRef ?? "—"}</td>
                <td style={td}>{t.customerAccountRef ?? "—"}</td>
                <td style={td}>{t.notes ?? "—"}</td>
                <td style={td}>{live && can.update && <EditButton onClick={() => setEditor({ kind: "trace", value: t as any })} />}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "vigilance" && (
        s.sensitiveLocked ? (
          <div style={{ ...card, borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" }}>
            <Eye size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />
            Vigilancia bloqueada: se requiere <strong>md-sensitive:read</strong> para quejas, eventos adversos, PMS, acciones de campo y retiros.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {live && can.approve && (
              <NewFormToggle label="Configurar retención">{(close) => <RetentionPolicyForm current={initial.retentionYears} pending={pending} run={run} onDone={close} />}</NewFormToggle>
            )}
            {live && can.sensitiveCreate && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <NewFormToggle label="Nueva queja">{(close) => <NewComplaintForm devices={initial.devices} batches={initial.batches} pending={pending} run={run} onDone={close} />}</NewFormToggle>
                <NewFormToggle label="Nuevo evento adverso">{(close) => <NewAdverseEventForm devices={initial.devices} batches={initial.batches} complaints={initial.complaints} pending={pending} run={run} onDone={close} />}</NewFormToggle>
                <NewFormToggle label="Nueva vigilancia PMS">{(close) => <NewPmsForm devices={initial.devices} pending={pending} run={run} onDone={close} />}</NewFormToggle>
                <NewFormToggle label="Nueva acción de campo">{(close) => <NewFieldSafetyActionForm devices={initial.devices} pending={pending} run={run} onDone={close} />}</NewFormToggle>
                <NewFormToggle label="Nuevo retiro">{(close) => <NewRecallForm devices={initial.devices} pending={pending} run={run} onDone={close} />}</NewFormToggle>
              </div>
            )}
            <Table headers={["Queja", "Dispositivo", "Fuente", "Estado", "Sujeto", "Retención", "Acciones"]}>
              {initial.complaints.map((c) => {
                const next = nextComplaintStatuses(c.status as MdComplaintStatus)[0];
                const purgeable = !!c.retentionUntil && new Date(c.retentionUntil) <= new Date() && !c.purgedAt;
                return (
                  <tr key={c.id}>
                    <td style={td}>{c.code}</td>
                    <td style={td}>{c.device?.code ?? "—"}</td>
                    <td style={td}>{c.source}</td>
                    <td style={td}>{c.status}</td>
                    <td style={td}>{c.anonymizedSubjectRef ?? "—"}</td>
                    <td style={td}>{c.purgedAt ? "Purgado" : fmt(c.retentionUntil)}</td>
                    <td style={td}>
                      {live && can.sensitiveUpdate && <EditButton onClick={() => setEditor({ kind: "complaint", value: c as any })} />}
                      {live && next && can.sensitiveUpdate && (
                        <button disabled={pending} style={miniBtn} onClick={() => run(() => transitionComplaint(c.id, next))}>
                          <ArrowRight size={12} /> {next}
                        </button>
                      )}
                      {live && purgeable && can.sensitiveDelete && (
                        <button disabled={pending} style={dangerBtn} onClick={() => setPurgeTarget({ id: c.id, kind: "complaint", label: c.code })}>
                          <X size={12} /> Purgar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Table>
            <Table headers={["Evento", "Dispositivo", "Severidad", "Reportable", "Estado", "Sujeto", "Retención", "Acciones"]}>
              {initial.adverseEvents.map((e) => {
                const next = nextAdverseEventStatuses(e.status as MdAdverseEventStatus)[0];
                const purgeable = !!e.retentionUntil && new Date(e.retentionUntil) <= new Date() && !e.purgedAt;
                return (
                  <tr key={e.id}>
                    <td style={td}>{e.code}</td>
                    <td style={td}>{e.device?.code ?? "—"}</td>
                    <td style={td}>{e.severity}</td>
                    <td style={td}>{e.reportable ? "Sí" : "No"}</td>
                    <td style={td}>{e.status}</td>
                    <td style={td}>{e.anonymizedSubjectRef ?? "—"}</td>
                    <td style={td}>{e.purgedAt ? "Purgado" : fmt(e.retentionUntil)}</td>
                    <td style={td}>
                      {live && can.sensitiveUpdate && <EditButton onClick={() => setEditor({ kind: "adverseEvent", value: e as any })} />}
                      {live && next && can.sensitiveUpdate && (
                        <button disabled={pending} style={miniBtn} onClick={() => run(() => transitionAdverseEvent(e.id, next))}>
                          <ArrowRight size={12} /> {next}
                        </button>
                      )}
                      {live && purgeable && can.sensitiveDelete && (
                        <button disabled={pending} style={dangerBtn} onClick={() => setPurgeTarget({ id: e.id, kind: "adverseEvent", label: e.code })}>
                          <X size={12} /> Purgar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Table>
            <Table headers={["PMS", "Dispositivo", "Periodo", "Estado", "Acciones"]}>
              {initial.pms.map((p) => {
                const next = nextPmsStatuses(p.status as MdPmsStatus)[0];
                return (
                  <tr key={p.id}>
                    <td style={td}>{p.code}</td>
                    <td style={td}>{p.device.code}</td>
                    <td style={td}>{fmt(p.periodStart)} → {fmt(p.periodEnd)}</td>
                    <td style={td}>{p.status}</td>
                    <td style={td}>
                      {live && can.sensitiveUpdate && <EditButton onClick={() => setEditor({ kind: "pms", value: p as any })} />}
                      {live && next && can.sensitiveUpdate && (
                        <button disabled={pending} style={miniBtn} onClick={() => run(() => transitionPostMarketSurveillance(p.id, next))}>
                          <ArrowRight size={12} /> {next}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Table>
            <Table headers={["Tipo", "Código", "Dispositivo", "Título", "Estado", "Acciones"]}>
              {[
                ...initial.fieldActions.map((f) => ({ kind: "FSCA" as const, ...f })),
                ...initial.recalls.map((r) => ({ kind: "RETIRO" as const, ...r })),
              ].map((row) => {
                const isRecall = row.kind === "RETIRO";
                const nextRecall = isRecall ? nextRecallStatuses(row.status as MdRecallStatus)[0] : null;
                const nextFsa = !isRecall ? nextFsaStatuses(row.status as MdFsaStatus)[0] : null;
                return (
                  <tr key={row.id}>
                    <td style={td}>{row.kind}</td>
                    <td style={td}>{row.code}</td>
                    <td style={td}>{row.device?.code ?? "—"}</td>
                    <td style={td}>{row.title}</td>
                    <td style={td}>{row.status}</td>
                    <td style={td}>
                      {live && can.sensitiveUpdate && <EditButton onClick={() => setEditor({ kind: isRecall ? "recall" : "fieldAction", value: row as any })} />}
                      {live && isRecall && nextRecall && can.sensitiveUpdate && (
                        <button disabled={pending} style={miniBtn} onClick={() => run(() => transitionProductRecall(row.id, nextRecall))}>
                          <Undo2 size={12} /> {nextRecall}
                        </button>
                      )}
                      {live && !isRecall && nextFsa && can.sensitiveUpdate && (
                        <button disabled={pending} style={miniBtn} onClick={() => run(() => transitionFieldSafetyAction(row.id, nextFsa))}>
                          <ArrowRight size={12} /> {nextFsa}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Table>
          </div>
        )
      )}

      {tab === "regulatory" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <NewFormToggle label="Nuevo requisito regulatorio">{(close) => <NewRegulatoryRequirementForm pending={pending} run={run} onDone={close} />}</NewFormToggle>
              <NewFormToggle label="Nueva presentación">{(close) => <NewRegulatorySubmissionForm devices={initial.devices} pending={pending} run={run} onDone={close} />}</NewFormToggle>
            </div>
          )}
          <Table headers={["Código", "Marco", "Título", "Jurisdicción", "Activo", "Acciones"]}>
            {initial.requirements.map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.code}</td>
                <td style={td}>{r.framework}</td>
                <td style={td}>{r.title}</td>
                <td style={td}>{r.jurisdiction ?? "—"}</td>
                <td style={td}>{r.active ? "Sí" : "No"}</td>
                <td style={td}>{live && can.update && <EditButton onClick={() => setEditor({ kind: "requirement", value: r as any })} />}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Código", "Dispositivo", "Jurisdicción", "Tipo", "Estado", "Enviado", "Acciones"]}>
            {initial.submissions.map((srow) => (
              <tr key={srow.id}>
                <td style={td}>{srow.code}</td>
                <td style={td}>{srow.device?.code ?? "—"}</td>
                <td style={td}>{srow.jurisdiction}</td>
                <td style={td}>{srow.submissionType}</td>
                <td style={td}>{srow.status}</td>
                <td style={td}>{fmt(srow.submittedAt)}</td>
                <td style={td}>{live && can.update && <EditButton onClick={() => setEditor({ kind: "submission", value: srow as any })} />}</td>
              </tr>
            ))}
          </Table>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 12 }}>
            Requisitos regulatorios configurables por organización. NormaFlow no certifica cumplimiento nacional.
          </p>
        </div>
      )}
      {live && editor && canEdit(editor.kind) && <Modal open={Boolean(editor)} onClose={() => setEditor(null)} title={`Editar ${editor.value.code ?? "expediente médico"}`} width={840}>
        <MedicalDeviceRecordEditor kind={editor.kind} value={editor.value} families={initial.families} devices={initial.devices} dhfs={initial.dhfs} suppliers={initial.suppliers} batches={initial.batches} complaints={initial.complaints} processVals={initial.processVals} pending={pending} onCancel={() => setEditor(null)} onSave={saveEditor} />
      </Modal>}
      {purgeTarget && <ConfirmActionModal open title="Purgar registro sensible" confirmLabel="Purgar definitivamente" danger pending={pending} onCancel={() => setPurgeTarget(null)} onConfirm={() => run(async () => {
        if (purgeTarget.kind === "complaint") await purgeComplaint(purgeTarget.id);
        else await purgeAdverseEvent(purgeTarget.id);
        setPurgeTarget(null);
      })}>
        Vas a purgar de forma definitiva el registro {purgeTarget.label}. Esta operación elimina información sensible conforme a la política de retención y no se puede deshacer.
      </ConfirmActionModal>}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return <IsoMetricCard label={label} value={value} accent={accent} />;
}

function Row({ k, v, danger }: { k: string; v: string | number; danger?: boolean }) {
  return (
    <div className="nf-iso-dashboard-row">
      <span className="nf-iso-dashboard-row-label">{k}</span>
      <strong className="nf-iso-dashboard-row-value" style={{ color: danger ? "#dc2626" : undefined }}>{v}</strong>
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return <IsoTableCard icon={Cross} headers={headers}>{children}</IsoTableCard>;
}

function EditButton({ onClick }: { onClick: () => void }) {
  return <button type="button" style={miniBtn} onClick={onClick}>Editar</button>;
}

function RecordTransitionButton({ row, pending, approve, onTransition }: { row: any; pending: boolean; approve: boolean; onTransition: (to: MdRecordStatus) => void }) {
  const next = nextRecordStatuses(row.status as MdRecordStatus)[0];
  return next && (next !== "APPROVED" || approve) ? <button type="button" disabled={pending} style={miniBtn} onClick={() => onTransition(next)}><ArrowRight size={12} /> {next}</button> : null;
}

type MdEditorField = { key: string; label: string; type?: "text" | "textarea" | "number" | "date" | "select" | "checkbox"; options?: string[]; span?: number };

const MD_EDITOR_REQUIRED: Partial<Record<MedicalDeviceEditorKind, string[]>> = {
  family: ["name"], device: ["name", "familyId", "classification"], dmr: ["deviceId", "version", "title"], dhf: ["deviceId", "title"],
  input: ["dhfId", "requirement"], output: ["dhfId", "description"], review: ["dhfId", "outcome"], verification: ["dhfId", "method", "result"], validation: ["dhfId", "method", "result"],
  transfer: ["dhfId", "status"], risk: ["deviceId", "version", "title"], supplier: ["name", "criticality", "status"], qualification: ["criticalSupplierId", "status"],
  processValidation: ["title", "result"], sterilizationValidation: ["deviceId", "method", "result"], batch: ["deviceId", "lotNumber", "quantity", "status"], trace: ["batchId"],
  complaint: ["deviceId", "source", "description"], adverseEvent: ["deviceId", "severity", "description"], pms: ["deviceId", "title"], fieldAction: ["deviceId", "title", "actionType"], recall: ["deviceId", "title"],
  requirement: ["jurisdiction", "framework", "title"], submission: ["deviceId", "jurisdiction", "submissionType", "status"],
};

function MedicalDeviceRecordEditor({ kind, value, families, devices, dhfs, suppliers, batches, complaints, processVals, pending, onCancel, onSave }: {
  kind: MedicalDeviceEditorKind; value: Record<string, any>; families: any[]; devices: any[]; dhfs: any[]; suppliers: any[]; batches: any[]; complaints: any[]; processVals: any[]; pending: boolean; onCancel: () => void; onSave: (payload: Record<string, unknown>) => void;
}) {
  const dateKeys = new Set(["reviewDate", "verifiedAt", "validatedAt", "transferredAt", "nextReviewAt", "manufacturedAt", "expiryAt", "periodStart", "periodEnd", "submittedAt"]);
  const initial = Object.fromEntries(Object.entries(value).map(([key, current]) => {
    if (dateKeys.has(key)) return [key, current ? fmt(current) : ""];
    if (["linkedInputCodes", "linkedRiskIds", "lotNumbers", "previousIds"].includes(key)) return [key, Array.isArray(current) ? current.join(", ") : ""];
    return [key, current == null ? "" : current];
  })) as Record<string, any>;
  const [form, setForm] = useState<Record<string, any>>(initial);
  const set = (key: string, next: any) => setForm((prev) => ({ ...prev, [key]: next }));
  const fields: Record<MedicalDeviceEditorKind, MdEditorField[]> = {
    family: [{ key: "name", label: "Nombre" }, { key: "active", label: "Activo", type: "checkbox" }, { key: "description", label: "Descripción", type: "textarea", span: 2 }],
    device: [{ key: "name", label: "Nombre" }, { key: "modelNumber", label: "Modelo" }, { key: "udiDi", label: "UDI-DI" }, { key: "familyId", label: "Familia", type: "select" }, { key: "classification", label: "Clasificación" }, { key: "status", label: "Estado", type: "select", options: ["DEVELOPMENT", "DESIGN_TRANSFER", "PRODUCTION", "ACTIVE", "OBSOLETE", "WITHDRAWN"] }, { key: "intendedUse", label: "Uso previsto", type: "textarea", span: 2 }],
    dmr: [{ key: "deviceId", label: "Dispositivo", type: "select" }, { key: "version", label: "Versión" }, { key: "title", label: "Título" }, { key: "documentId", label: "Documento" }, { key: "summary", label: "Resumen", type: "textarea", span: 2 }],
    dhf: [{ key: "deviceId", label: "Dispositivo", type: "select" }, { key: "title", label: "Título" }, { key: "documentId", label: "Documento" }],
    input: [{ key: "dhfId", label: "DHF", type: "select" }, { key: "status", label: "Estado", type: "select", options: ["OPEN", "ADDRESSED", "VERIFIED", "CLOSED"] }, { key: "requirement", label: "Requisito", type: "textarea", span: 2 }, { key: "source", label: "Fuente", span: 2 }],
    output: [{ key: "dhfId", label: "DHF", type: "select" }, { key: "status", label: "Estado", type: "select", options: ["OPEN", "ADDRESSED", "VERIFIED", "CLOSED"] }, { key: "description", label: "Descripción", type: "textarea", span: 2 }, { key: "linkedInputCodes", label: "Inputs enlazados (coma)", span: 2 }, { key: "documentId", label: "Documento" }],
    review: [{ key: "dhfId", label: "DHF", type: "select" }, { key: "reviewDate", label: "Fecha", type: "date" }, { key: "outcome", label: "Resultado", type: "select", options: ["PENDING", "APPROVED", "APPROVED_WITH_ACTIONS", "REJECTED"] }, { key: "documentId", label: "Documento" }, { key: "findings", label: "Hallazgos", type: "textarea", span: 2 }],
    verification: [{ key: "dhfId", label: "DHF", type: "select" }, { key: "result", label: "Resultado", type: "select", options: ["PENDING", "PASS", "FAIL", "CONDITIONAL"] }, { key: "method", label: "Método", type: "textarea", span: 2 }, { key: "acceptanceCriteria", label: "Criterios de aceptación", type: "textarea", span: 2 }, { key: "evidenceId", label: "Evidencia" }, { key: "documentId", label: "Documento" }],
    validation: [{ key: "dhfId", label: "DHF", type: "select" }, { key: "result", label: "Resultado", type: "select", options: ["PENDING", "PASS", "FAIL", "CONDITIONAL"] }, { key: "method", label: "Método", type: "textarea", span: 2 }, { key: "userNeedsRef", label: "Referencia necesidad de usuario", span: 2 }, { key: "evidenceId", label: "Evidencia" }, { key: "documentId", label: "Documento" }],
    transfer: [{ key: "dhfId", label: "DHF", type: "select" }, { key: "status", label: "Estado", type: "select", options: ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] }, { key: "transferredAt", label: "Fecha", type: "date" }, { key: "receivingSite", label: "Sede receptora" }, { key: "checklistSummary", label: "Checklist", type: "textarea", span: 2 }],
    risk: [{ key: "deviceId", label: "Dispositivo", type: "select" }, { key: "version", label: "Versión" }, { key: "title", label: "Título" }, { key: "status", label: "Estado", type: "select", options: ["DRAFT", "UNDER_REVIEW", "APPROVED", "SUPERSEDED"] }, { key: "methodology", label: "Metodología" }, { key: "residualRiskSummary", label: "Riesgo residual", type: "textarea", span: 2 }, { key: "linkedRiskIds", label: "Riesgos enlazados (coma)", span: 2 }],
    supplier: [{ key: "name", label: "Nombre" }, { key: "supplierId", label: "Proveedor maestro" }, { key: "serviceType", label: "Tipo de servicio" }, { key: "criticality", label: "Criticidad", type: "select", options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }, { key: "status", label: "Estado", type: "select", options: ["ACTIVE", "UNDER_REVIEW", "SUSPENDED", "EXITING"] }, { key: "documentId", label: "Documento" }],
    qualification: [{ key: "criticalSupplierId", label: "Proveedor crítico", type: "select" }, { key: "status", label: "Estado", type: "select", options: ["PENDING", "QUALIFIED", "CONDITIONAL", "DISQUALIFIED", "EXPIRED"] }, { key: "nextReviewAt", label: "Próxima revisión", type: "date" }, { key: "evidenceId", label: "Evidencia" }, { key: "scope", label: "Alcance", type: "textarea", span: 2 }],
    processValidation: [{ key: "title", label: "Título" }, { key: "deviceId", label: "Dispositivo", type: "select" }, { key: "processId", label: "Proceso" }, { key: "protocolRef", label: "Protocolo" }, { key: "result", label: "Resultado", type: "select", options: ["PENDING", "PASS", "FAIL", "CONDITIONAL"] }, { key: "evidenceId", label: "Evidencia" }],
    sterilizationValidation: [{ key: "deviceId", label: "Dispositivo", type: "select" }, { key: "method", label: "Método" }, { key: "sterilityAssuranceLevel", label: "SAL" }, { key: "result", label: "Resultado", type: "select", options: ["PENDING", "PASS", "FAIL", "CONDITIONAL"] }, { key: "evidenceId", label: "Evidencia" }],
    batch: [{ key: "deviceId", label: "Dispositivo", type: "select" }, { key: "lotNumber", label: "Lote" }, { key: "quantity", label: "Cantidad", type: "number" }, { key: "unit", label: "Unidad" }, { key: "status", label: "Estado", type: "select", options: ["IN_PRODUCTION", "QUARANTINE", "RELEASED", "REJECTED", "RECALLED"] }, { key: "manufacturedAt", label: "Fabricado", type: "date" }, { key: "expiryAt", label: "Vencimiento", type: "date" }, { key: "processValidationId", label: "Validación", type: "select" }, { key: "notes", label: "Notas", type: "textarea", span: 2 }],
    trace: [{ key: "batchId", label: "Lote", type: "select" }, { key: "componentLot", label: "Lote componente" }, { key: "supplierLot", label: "Lote proveedor" }, { key: "distributionRef", label: "Distribución" }, { key: "customerAccountRef", label: "Cuenta opaca" }, { key: "previousIds", label: "IDs previos (coma)" }, { key: "notes", label: "Notas", type: "textarea", span: 2 }],
    complaint: [{ key: "deviceId", label: "Dispositivo", type: "select" }, { key: "batchId", label: "Lote", type: "select" }, { key: "source", label: "Fuente", type: "select", options: ["CUSTOMER", "DISTRIBUTOR", "HEALTHCARE_PROFESSIONAL", "AUTHORITY", "INTERNAL", "OTHER"] }, { key: "category", label: "Categoría" }, { key: "anonymizedSubjectRef", label: "Sujeto opaco" }, { key: "capaId", label: "CAPA" }, { key: "description", label: "Descripción", type: "textarea", span: 2 }, { key: "investigationSummary", label: "Investigación", type: "textarea", span: 2 }],
    adverseEvent: [{ key: "deviceId", label: "Dispositivo", type: "select" }, { key: "batchId", label: "Lote", type: "select" }, { key: "complaintId", label: "Queja", type: "select" }, { key: "severity", label: "Severidad", type: "select", options: ["MINOR", "MODERATE", "SERIOUS", "DEATH"] }, { key: "reportable", label: "Reportable", type: "checkbox" }, { key: "anonymizedSubjectRef", label: "Sujeto opaco" }, { key: "description", label: "Descripción", type: "textarea", span: 2 }],
    pms: [{ key: "deviceId", label: "Dispositivo", type: "select" }, { key: "title", label: "Título" }, { key: "periodStart", label: "Inicio", type: "date" }, { key: "periodEnd", label: "Fin", type: "date" }, { key: "findings", label: "Hallazgos", type: "textarea", span: 2 }],
    fieldAction: [{ key: "deviceId", label: "Dispositivo", type: "select" }, { key: "title", label: "Título" }, { key: "actionType", label: "Tipo", type: "select", options: ["FSCA", "FSN", "ADVISORY", "OTHER"] }, { key: "lotNumbers", label: "Lotes (coma)", span: 2 }, { key: "reason", label: "Motivo", type: "textarea", span: 2 }],
    recall: [{ key: "deviceId", label: "Dispositivo", type: "select" }, { key: "title", label: "Título" }, { key: "authorityNotified", label: "Autoridad notificada", type: "checkbox" }, { key: "lotNumbers", label: "Lotes (coma)", span: 2 }, { key: "reason", label: "Motivo", type: "textarea", span: 2 }],
    requirement: [{ key: "jurisdiction", label: "Jurisdicción" }, { key: "framework", label: "Marco" }, { key: "clauseRef", label: "Cláusula" }, { key: "mandatory", label: "Obligatorio", type: "checkbox" }, { key: "active", label: "Activo", type: "checkbox" }, { key: "title", label: "Título" }, { key: "description", label: "Descripción", type: "textarea", span: 2 }],
    submission: [{ key: "deviceId", label: "Dispositivo", type: "select" }, { key: "jurisdiction", label: "Jurisdicción" }, { key: "submissionType", label: "Tipo" }, { key: "status", label: "Estado", type: "select", options: ["DRAFT", "PREPARED", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "WITHDRAWN"] }, { key: "submittedAt", label: "Enviado", type: "date" }, { key: "referenceNumber", label: "Referencia" }, { key: "summary", label: "Resumen", type: "textarea", span: 2 }],
  };
  const fieldsFor = fields[kind];
  const dynamicOptions = (key: string) => key === "familyId" ? families : key === "deviceId" ? devices : key === "dhfId" ? dhfs : key === "criticalSupplierId" ? suppliers : key === "batchId" ? batches : key === "complaintId" ? complaints : key === "processValidationId" ? processVals : [];
  const labelFor = (key: string, item: any) => key === "familyId" ? `${item.code} — ${item.name}` : key === "deviceId" ? `${item.code} — ${item.name}` : key === "dhfId" ? item.code : key === "criticalSupplierId" ? `${item.code} — ${item.name}` : key === "batchId" ? `${item.code} — ${item.lotNumber}` : key === "complaintId" ? item.code : item.code;
  const payload = Object.fromEntries(fieldsFor.map((field) => {
    const current = form[field.key];
    if (["linkedInputCodes", "linkedRiskIds", "lotNumbers", "previousIds"].includes(field.key)) return [field.key, String(current ?? "").split(",").map((x) => x.trim()).filter(Boolean)];
    if (field.type === "number") return [field.key, current === "" ? undefined : Number(current)];
    if (field.type === "checkbox") return [field.key, Boolean(current)];
    return [field.key, current === "" ? undefined : current];
  }));
  const valid = (MD_EDITOR_REQUIRED[kind] ?? []).every((key) => String(form[key] ?? "").trim().length > 0);
  return <div className="nf-modal-form nf-iso-edit-form">
    <MedicalModalError />
    <div className="nf-iso-edit-fields" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 9 }}>
      {fieldsFor.map((field) => <label key={field.key} style={{ display: "grid", gap: 4, gridColumn: field.span === 2 ? "1 / -1" : undefined, fontSize: 12, color: "#475569" }}>
        <span>{field.label}</span>
        {field.type === "textarea" ? <textarea style={{ ...input, minHeight: 70 }} value={form[field.key] ?? ""} onChange={(e) => set(field.key, e.target.value)} />
          : field.type === "select" ? <select style={input} value={form[field.key] ?? ""} onChange={(e) => set(field.key, e.target.value)}><option value="">—</option>{dynamicOptions(field.key).length ? dynamicOptions(field.key).map((item: any) => <option key={item.id} value={item.id}>{labelFor(field.key, item)}</option>) : (field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}</select>
          : field.type === "checkbox" ? <input type="checkbox" checked={Boolean(form[field.key])} onChange={(e) => set(field.key, e.target.checked)} />
          : <input style={input} type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={form[field.key] ?? ""} onChange={(e) => set(field.key, e.target.value)} />}
      </label>)}
    </div>
    <div className="nf-modal-actions nf-iso-edit-form-actions"><button type="button" style={{ ...miniBtn, background: "#fff" }} onClick={onCancel}>Cancelar</button><button type="button" disabled={pending || !valid} style={primaryBtn} onClick={() => onSave(payload)}>Guardar cambios</button></div>
  </div>;
}

function MedicalModalError() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const handleError = (event: Event) => {
      const next = (event as CustomEvent<{ message?: unknown }>).detail?.message;
      if (next) setMessage(String(next));
    };
    window.addEventListener("normaflow:server-action-error", handleError);
    return () => window.removeEventListener("normaflow:server-action-error", handleError);
  }, []);
  return message ? <div className="nf-modal-error" role="alert">{message}</div> : null;
}

// ─── Forms: devices ───

function NewFamilyForm({ pending, run, onDone }: { pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ name: "", description: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input aria-label="Nombre de la familia" style={input} placeholder="Nombre de la familia" value={f.name} onChange={(e) => set("name", e.target.value)} />
      <input aria-label="Descripción" style={input} placeholder="Descripción" value={f.description} onChange={(e) => set("description", e.target.value)} />
      <button disabled={pending || !f.name} style={primaryBtn} onClick={() => { run(() => createDeviceFamily({ name: f.name, description: f.description || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewDeviceForm({ families, pending, run, onDone }: { families: MedicalDevicesPayload["families"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ name: "", familyId: "", modelNumber: "", udiDi: "", classification: "", intendedUse: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input aria-label="Nombre del dispositivo" style={input} placeholder="Nombre del dispositivo" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <select aria-label="Familia" style={input} value={f.familyId} onChange={(e) => set("familyId", e.target.value)}><option value="">Familia…</option>{families.map((fam) => <option key={fam.id} value={fam.id}>{fam.code} — {fam.name}</option>)}</select>
        <input aria-label="Clasificación (p. ej. IIa)" style={input} placeholder="Clasificación (p. ej. IIa)" value={f.classification} onChange={(e) => set("classification", e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input aria-label="Modelo" style={input} placeholder="Modelo" value={f.modelNumber} onChange={(e) => set("modelNumber", e.target.value)} />
        <input aria-label="UDI-DI" style={input} placeholder="UDI-DI" value={f.udiDi} onChange={(e) => set("udiDi", e.target.value)} />
      </div>
      <input aria-label="Uso previsto" style={input} placeholder="Uso previsto" value={f.intendedUse} onChange={(e) => set("intendedUse", e.target.value)} />
      <button disabled={pending || !f.name} style={primaryBtn} onClick={() => { run(() => createMedicalDevice({ name: f.name, familyId: f.familyId || undefined, modelNumber: f.modelNumber || undefined, udiDi: f.udiDi || undefined, classification: f.classification || undefined, intendedUse: f.intendedUse || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewDmrForm({ devices, pending, run, onDone }: { devices: Devices; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ deviceId: "", title: "", version: "1", summary: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 60px", gap: 8 }}>
        <select aria-label="Dispositivo" style={input} value={f.deviceId} onChange={(e) => set("deviceId", e.target.value)}><option value="">Dispositivo…</option>{devices.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}</select>
        <input aria-label="Título" style={input} placeholder="Título" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <input aria-label="Ver." style={input} placeholder="Ver." value={f.version} onChange={(e) => set("version", e.target.value)} />
      </div>
      <input aria-label="Resumen" style={input} placeholder="Resumen" value={f.summary} onChange={(e) => set("summary", e.target.value)} />
      <button disabled={pending || !f.deviceId || !f.title} style={primaryBtn} onClick={() => { run(() => createDeviceMasterRecord({ deviceId: f.deviceId, title: f.title, version: f.version || undefined, summary: f.summary || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

// ─── Forms: design ───

function NewDhfForm({ devices, pending, run, onDone }: { devices: Devices; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ deviceId: "", title: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <select aria-label="Dispositivo" style={input} value={f.deviceId} onChange={(e) => set("deviceId", e.target.value)}><option value="">Dispositivo…</option>{devices.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}</select>
        <input aria-label="Título del DHF" style={input} placeholder="Título del DHF" value={f.title} onChange={(e) => set("title", e.target.value)} />
      </div>
      <button disabled={pending || !f.deviceId || !f.title} style={primaryBtn} onClick={() => { run(() => createDesignHistoryFile({ deviceId: f.deviceId, title: f.title })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewDesignInputForm({ dhfs, pending, run, onDone }: { dhfs: MedicalDevicesPayload["dhfs"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ dhfId: "", requirement: "", source: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <select aria-label="DHF" style={input} value={f.dhfId} onChange={(e) => set("dhfId", e.target.value)}><option value="">DHF…</option>{dhfs.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select>
      <input aria-label="Requisito" style={input} placeholder="Requisito" value={f.requirement} onChange={(e) => set("requirement", e.target.value)} />
      <input aria-label="Fuente" style={input} placeholder="Fuente" value={f.source} onChange={(e) => set("source", e.target.value)} />
      <button disabled={pending || !f.dhfId || !f.requirement} style={primaryBtn} onClick={() => { run(() => createDesignInput({ dhfId: f.dhfId, requirement: f.requirement, source: f.source || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewDesignOutputForm({ dhfs, pending, run, onDone }: { dhfs: MedicalDevicesPayload["dhfs"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ dhfId: "", description: "", linkedInputCodes: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <select aria-label="DHF" style={input} value={f.dhfId} onChange={(e) => set("dhfId", e.target.value)}><option value="">DHF…</option>{dhfs.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select>
      <input aria-label="Descripción del output" style={input} placeholder="Descripción del output" value={f.description} onChange={(e) => set("description", e.target.value)} />
      <input aria-label="Códigos de inputs enlazados (coma)" style={input} placeholder="Códigos de inputs enlazados (coma)" value={f.linkedInputCodes} onChange={(e) => set("linkedInputCodes", e.target.value)} />
      <button disabled={pending || !f.dhfId || !f.description} style={primaryBtn} onClick={() => { run(() => createDesignOutput({ dhfId: f.dhfId, description: f.description, linkedInputCodes: f.linkedInputCodes ? f.linkedInputCodes.split(",").map((s) => s.trim()).filter(Boolean) : [] })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewDesignReviewForm({ dhfs, pending, run, onDone }: { dhfs: MedicalDevicesPayload["dhfs"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ dhfId: "", outcome: "PENDING" as "PENDING" | "APPROVED" | "APPROVED_WITH_ACTIONS" | "REJECTED", findings: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v as never }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <select aria-label="DHF" style={input} value={f.dhfId} onChange={(e) => set("dhfId", e.target.value)}><option value="">DHF…</option>{dhfs.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select>
        <select aria-label="Resultado" style={input} value={f.outcome} onChange={(e) => set("outcome", e.target.value)}>
          <option value="PENDING">Pendiente</option><option value="APPROVED">Aprobada</option>
          <option value="APPROVED_WITH_ACTIONS">Aprobada con acciones</option><option value="REJECTED">Rechazada</option>
        </select>
      </div>
      <input aria-label="Hallazgos" style={input} placeholder="Hallazgos" value={f.findings} onChange={(e) => set("findings", e.target.value)} />
      <button disabled={pending || !f.dhfId} style={primaryBtn} onClick={() => { run(() => createDesignReview({ dhfId: f.dhfId, outcome: f.outcome, findings: f.findings || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewDesignVerificationForm({ dhfs, pending, run, onDone }: { dhfs: MedicalDevicesPayload["dhfs"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ dhfId: "", method: "", acceptanceCriteria: "", result: "PENDING" as "PENDING" | "PASS" | "FAIL" | "CONDITIONAL" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v as never }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <select aria-label="DHF" style={input} value={f.dhfId} onChange={(e) => set("dhfId", e.target.value)}><option value="">DHF…</option>{dhfs.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select>
        <select aria-label="Resultado" style={input} value={f.result} onChange={(e) => set("result", e.target.value)}><option value="PENDING">Pendiente</option><option value="PASS">Pasa</option><option value="FAIL">Falla</option><option value="CONDITIONAL">Condicional</option></select>
      </div>
      <input aria-label="Método" style={input} placeholder="Método" value={f.method} onChange={(e) => set("method", e.target.value)} />
      <input aria-label="Criterio de aceptación" style={input} placeholder="Criterio de aceptación" value={f.acceptanceCriteria} onChange={(e) => set("acceptanceCriteria", e.target.value)} />
      <button disabled={pending || !f.dhfId} style={primaryBtn} onClick={() => { run(() => createDesignVerification({ dhfId: f.dhfId, method: f.method || undefined, acceptanceCriteria: f.acceptanceCriteria || undefined, result: f.result })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewDesignValidationForm({ dhfs, pending, run, onDone }: { dhfs: MedicalDevicesPayload["dhfs"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ dhfId: "", method: "", userNeedsRef: "", result: "PENDING" as "PENDING" | "PASS" | "FAIL" | "CONDITIONAL" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v as never }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <select aria-label="DHF" style={input} value={f.dhfId} onChange={(e) => set("dhfId", e.target.value)}><option value="">DHF…</option>{dhfs.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select>
        <select aria-label="Resultado" style={input} value={f.result} onChange={(e) => set("result", e.target.value)}><option value="PENDING">Pendiente</option><option value="PASS">Pasa</option><option value="FAIL">Falla</option><option value="CONDITIONAL">Condicional</option></select>
      </div>
      <input aria-label="Método" style={input} placeholder="Método" value={f.method} onChange={(e) => set("method", e.target.value)} />
      <input aria-label="Referencia de necesidad de usuario" style={input} placeholder="Referencia de necesidad de usuario" value={f.userNeedsRef} onChange={(e) => set("userNeedsRef", e.target.value)} />
      <button disabled={pending || !f.dhfId} style={primaryBtn} onClick={() => { run(() => createDesignValidation({ dhfId: f.dhfId, method: f.method || undefined, userNeedsRef: f.userNeedsRef || undefined, result: f.result })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewDesignTransferForm({ dhfs, pending, run, onDone }: { dhfs: MedicalDevicesPayload["dhfs"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ dhfId: "", receivingSite: "", checklistSummary: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <select aria-label="DHF" style={input} value={f.dhfId} onChange={(e) => set("dhfId", e.target.value)}><option value="">DHF…</option>{dhfs.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select>
        <input aria-label="Sede receptora" style={input} placeholder="Sede receptora" value={f.receivingSite} onChange={(e) => set("receivingSite", e.target.value)} />
      </div>
      <input aria-label="Resumen de checklist" style={input} placeholder="Resumen de checklist" value={f.checklistSummary} onChange={(e) => set("checklistSummary", e.target.value)} />
      <button disabled={pending || !f.dhfId} style={primaryBtn} onClick={() => { run(() => createDesignTransfer({ dhfId: f.dhfId, receivingSite: f.receivingSite || undefined, checklistSummary: f.checklistSummary || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

// ─── Forms: risks / suppliers / validations / batches ───

function NewRiskFileForm({ devices, pending, run, onDone }: { devices: Devices; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ deviceId: "", title: "", methodology: "", residualRiskSummary: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <select aria-label="Dispositivo" style={input} value={f.deviceId} onChange={(e) => set("deviceId", e.target.value)}><option value="">Dispositivo…</option>{devices.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}</select>
        <input aria-label="Título" style={input} placeholder="Título" value={f.title} onChange={(e) => set("title", e.target.value)} />
      </div>
      <input aria-label="Metodología (p. ej. ISO 14971 configurable)" style={input} placeholder="Metodología (p. ej. ISO 14971 configurable)" value={f.methodology} onChange={(e) => set("methodology", e.target.value)} />
      <input aria-label="Resumen del riesgo residual" style={input} placeholder="Resumen del riesgo residual" value={f.residualRiskSummary} onChange={(e) => set("residualRiskSummary", e.target.value)} />
      <button disabled={pending || !f.deviceId || !f.title} style={primaryBtn} onClick={() => { run(() => createDeviceRiskFile({ deviceId: f.deviceId, title: f.title, methodology: f.methodology || undefined, residualRiskSummary: f.residualRiskSummary || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewCriticalSupplierForm({ pending, run, onDone }: { pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ name: "", serviceType: "", criticality: "HIGH" as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v as never }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <input aria-label="Nombre del proveedor" style={input} placeholder="Nombre del proveedor" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <select aria-label="Criticidad" style={input} value={f.criticality} onChange={(e) => set("criticality", e.target.value)}><option value="LOW">Baja</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option></select>
      </div>
      <input aria-label="Tipo de servicio / componente" style={input} placeholder="Tipo de servicio / componente" value={f.serviceType} onChange={(e) => set("serviceType", e.target.value)} />
      <button disabled={pending || !f.name} style={primaryBtn} onClick={() => { run(() => createCriticalSupplier({ name: f.name, serviceType: f.serviceType || undefined, criticality: f.criticality })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewQualificationForm({ suppliers, pending, run, onDone }: { suppliers: MedicalDevicesPayload["suppliers"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ criticalSupplierId: "", scope: "", status: "PENDING" as "PENDING" | "QUALIFIED" | "CONDITIONAL" | "DISQUALIFIED" | "EXPIRED", nextReviewAt: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v as never }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <select aria-label="Proveedor" style={input} value={f.criticalSupplierId} onChange={(e) => set("criticalSupplierId", e.target.value)}><option value="">Proveedor…</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select>
        <select aria-label="Estado" style={input} value={f.status} onChange={(e) => set("status", e.target.value)}><option value="PENDING">Pendiente</option><option value="QUALIFIED">Cualificado</option><option value="CONDITIONAL">Condicional</option><option value="DISQUALIFIED">Descalificado</option><option value="EXPIRED">Vencido</option></select>
        <input aria-label="Próxima revisión" style={input} type="date" value={f.nextReviewAt} onChange={(e) => set("nextReviewAt", e.target.value)} />
      </div>
      <input aria-label="Alcance" style={input} placeholder="Alcance" value={f.scope} onChange={(e) => set("scope", e.target.value)} />
      <button disabled={pending || !f.criticalSupplierId} style={primaryBtn} onClick={() => { run(() => createSupplierQualification({ criticalSupplierId: f.criticalSupplierId, scope: f.scope || undefined, status: f.status, nextReviewAt: f.nextReviewAt || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewProcessValidationForm({ devices, pending, run, onDone }: { devices: Devices; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", deviceId: "", protocolRef: "", result: "PENDING" as "PENDING" | "PASS" | "FAIL" | "CONDITIONAL" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v as never }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input aria-label="Título" style={input} placeholder="Título" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <select aria-label="Dispositivo (opcional)" style={input} value={f.deviceId} onChange={(e) => set("deviceId", e.target.value)}><option value="">Dispositivo (opcional)…</option>{devices.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select>
        <select aria-label="Resultado" style={input} value={f.result} onChange={(e) => set("result", e.target.value)}><option value="PENDING">Pendiente</option><option value="PASS">Pasa</option><option value="FAIL">Falla</option><option value="CONDITIONAL">Condicional</option></select>
      </div>
      <input aria-label="Referencia de protocolo (IQ/OQ/PQ)" style={input} placeholder="Referencia de protocolo (IQ/OQ/PQ)" value={f.protocolRef} onChange={(e) => set("protocolRef", e.target.value)} />
      <button disabled={pending || !f.title} style={primaryBtn} onClick={() => { run(() => createProcessValidation({ title: f.title, deviceId: f.deviceId || undefined, protocolRef: f.protocolRef || undefined, result: f.result })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewSterilizationValidationForm({ devices, pending, run, onDone }: { devices: Devices; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ method: "", deviceId: "", sterilityAssuranceLevel: "", result: "PENDING" as "PENDING" | "PASS" | "FAIL" | "CONDITIONAL" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v as never }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input aria-label="Método de esterilización" style={input} placeholder="Método de esterilización" value={f.method} onChange={(e) => set("method", e.target.value)} />
        <select aria-label="Dispositivo (opcional)" style={input} value={f.deviceId} onChange={(e) => set("deviceId", e.target.value)}><option value="">Dispositivo (opcional)…</option>{devices.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select>
        <select aria-label="Resultado" style={input} value={f.result} onChange={(e) => set("result", e.target.value)}><option value="PENDING">Pendiente</option><option value="PASS">Pasa</option><option value="FAIL">Falla</option><option value="CONDITIONAL">Condicional</option></select>
      </div>
      <input aria-label="Nivel de garantía de esterilidad (SAL)" style={input} placeholder="Nivel de garantía de esterilidad (SAL)" value={f.sterilityAssuranceLevel} onChange={(e) => set("sterilityAssuranceLevel", e.target.value)} />
      <button disabled={pending || !f.method} style={primaryBtn} onClick={() => { run(() => createSterilizationValidation({ method: f.method, deviceId: f.deviceId || undefined, sterilityAssuranceLevel: f.sterilityAssuranceLevel || undefined, result: f.result })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewBatchForm({ devices, pending, run, onDone }: { devices: Devices; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ deviceId: "", lotNumber: "", quantity: "", unit: "", expiryAt: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <select aria-label="Dispositivo" style={input} value={f.deviceId} onChange={(e) => set("deviceId", e.target.value)}><option value="">Dispositivo…</option>{devices.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select>
        <input aria-label="Número de lote" style={input} placeholder="Número de lote" value={f.lotNumber} onChange={(e) => set("lotNumber", e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <input aria-label="Cantidad" style={input} type="number" placeholder="Cantidad" value={f.quantity} onChange={(e) => set("quantity", e.target.value)} />
        <input aria-label="Unidad" style={input} placeholder="Unidad" value={f.unit} onChange={(e) => set("unit", e.target.value)} />
        <input aria-label="Caduca" style={input} type="date" placeholder="Caduca" value={f.expiryAt} onChange={(e) => set("expiryAt", e.target.value)} />
      </div>
      <button disabled={pending || !f.deviceId || !f.lotNumber} style={primaryBtn} onClick={() => { run(() => createProductionBatch({ deviceId: f.deviceId, lotNumber: f.lotNumber, quantity: f.quantity ? Number(f.quantity) : undefined, unit: f.unit || undefined, expiryAt: f.expiryAt || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewTraceabilityForm({ batches, pending, run, onDone }: { batches: MedicalDevicesPayload["batches"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ batchId: "", componentLot: "", supplierLot: "", distributionRef: "", customerAccountRef: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <select aria-label="Lote" style={input} value={f.batchId} onChange={(e) => set("batchId", e.target.value)}><option value="">Lote…</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.code} — {b.lotNumber}</option>)}</select>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input aria-label="Lote de componente" style={input} placeholder="Lote de componente" value={f.componentLot} onChange={(e) => set("componentLot", e.target.value)} />
        <input aria-label="Lote de proveedor" style={input} placeholder="Lote de proveedor" value={f.supplierLot} onChange={(e) => set("supplierLot", e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input aria-label="Referencia de distribución" style={input} placeholder="Referencia de distribución" value={f.distributionRef} onChange={(e) => set("distributionRef", e.target.value)} />
        <input aria-label="Cuenta de cliente (referencia opaca)" style={input} placeholder="Cuenta de cliente (referencia opaca)" value={f.customerAccountRef} onChange={(e) => set("customerAccountRef", e.target.value)} />
      </div>
      <button disabled={pending || !f.batchId} style={primaryBtn} onClick={() => { run(() => createDeviceTraceability({ batchId: f.batchId, componentLot: f.componentLot || undefined, supplierLot: f.supplierLot || undefined, distributionRef: f.distributionRef || undefined, customerAccountRef: f.customerAccountRef || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

// ─── Forms: vigilance ───

function RetentionPolicyForm({ current, pending, run, onDone }: { current: number; pending: boolean; run: Runner; onDone: () => void }) {
  const [years, setYears] = useState(String(current));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
        <Settings size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
        Años de conservación de quejas y eventos adversos tras su cierre. La retención regulatoria real depende de la jurisdicción del fabricante.
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input aria-label="Años" style={{ ...input, width: 100 }} type="number" min={1} max={50} value={years} onChange={(e) => setYears(e.target.value)} />
        <span style={{ fontSize: 12.5 }}>años</span>
      </div>
      <button disabled={pending || !years} style={primaryBtn} onClick={() => { run(() => setMdRetentionPolicy({ retentionYears: Number(years) })); onDone(); }}><Check size={12} /> Guardar</button>
    </div>
  );
}

function NewComplaintForm({ devices, batches, pending, run, onDone }: { devices: Devices; batches: MedicalDevicesPayload["batches"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ deviceId: "", batchId: "", source: "CUSTOMER" as "CUSTOMER" | "DISTRIBUTOR" | "HEALTHCARE_PROFESSIONAL" | "AUTHORITY" | "INTERNAL" | "OTHER", category: "", description: "", anonymizedSubjectRef: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v as never }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <select aria-label="Dispositivo (opcional)" style={input} value={f.deviceId} onChange={(e) => set("deviceId", e.target.value)}><option value="">Dispositivo (opcional)…</option>{devices.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select>
        <select aria-label="Lote (opcional)" style={input} value={f.batchId} onChange={(e) => set("batchId", e.target.value)}><option value="">Lote (opcional)…</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.lotNumber}</option>)}</select>
        <select aria-label="Fuente" style={input} value={f.source} onChange={(e) => set("source", e.target.value)}>
          <option value="CUSTOMER">Cliente</option><option value="DISTRIBUTOR">Distribuidor</option>
          <option value="HEALTHCARE_PROFESSIONAL">Profesional sanitario</option><option value="AUTHORITY">Autoridad</option>
          <option value="INTERNAL">Interno</option><option value="OTHER">Otro</option>
        </select>
      </div>
      <input aria-label="Categoría" style={input} placeholder="Categoría" value={f.category} onChange={(e) => set("category", e.target.value)} />
      <textarea aria-label="Descripción (sin PII clínica — usar referencia opaca)" style={{ ...input, minHeight: 60 }} placeholder="Descripción (sin PII clínica — usar referencia opaca)" value={f.description} onChange={(e) => set("description", e.target.value)} />
      <input aria-label="Referencia opaca de sujeto (p. ej. CASE-0001)" style={input} placeholder="Referencia opaca de sujeto (p. ej. CASE-0001)" value={f.anonymizedSubjectRef} onChange={(e) => set("anonymizedSubjectRef", e.target.value)} />
      <button disabled={pending || !f.description} style={primaryBtn} onClick={() => { run(() => createComplaint({ deviceId: f.deviceId || undefined, batchId: f.batchId || undefined, source: f.source, category: f.category || undefined, description: f.description, anonymizedSubjectRef: f.anonymizedSubjectRef || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewAdverseEventForm({ devices, batches, complaints, pending, run, onDone }: {
  devices: Devices; batches: MedicalDevicesPayload["batches"]; complaints: MedicalDevicesPayload["complaints"]; pending: boolean; run: Runner; onDone: () => void;
}) {
  const [f, setF] = useState({ deviceId: "", batchId: "", complaintId: "", severity: "MODERATE" as "MINOR" | "MODERATE" | "SERIOUS" | "DEATH", reportable: false, description: "", anonymizedSubjectRef: "" });
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v as never }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <select aria-label="Dispositivo (opcional)" style={input} value={f.deviceId} onChange={(e) => set("deviceId", e.target.value)}><option value="">Dispositivo (opcional)…</option>{devices.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select>
        <select aria-label="Lote (opcional)" style={input} value={f.batchId} onChange={(e) => set("batchId", e.target.value)}><option value="">Lote (opcional)…</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.lotNumber}</option>)}</select>
        <select aria-label="Queja relacionada (opcional)" style={input} value={f.complaintId} onChange={(e) => set("complaintId", e.target.value)}><option value="">Queja relacionada (opcional)…</option>{complaints.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}</select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <select aria-label="Severidad" style={input} value={f.severity} onChange={(e) => set("severity", e.target.value)}><option value="MINOR">Menor</option><option value="MODERATE">Moderado</option><option value="SERIOUS">Grave</option><option value="DEATH">Muerte</option></select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={f.reportable} onChange={(e) => set("reportable", e.target.checked)} /> Reportable a autoridad</label>
      </div>
      <textarea aria-label="Descripción (sin PII clínica — usar referencia opaca)" style={{ ...input, minHeight: 60 }} placeholder="Descripción (sin PII clínica — usar referencia opaca)" value={f.description} onChange={(e) => set("description", e.target.value)} />
      <input aria-label="Referencia opaca de sujeto" style={input} placeholder="Referencia opaca de sujeto" value={f.anonymizedSubjectRef} onChange={(e) => set("anonymizedSubjectRef", e.target.value)} />
      <button disabled={pending || !f.description} style={primaryBtn} onClick={() => { run(() => createAdverseEvent({ deviceId: f.deviceId || undefined, batchId: f.batchId || undefined, complaintId: f.complaintId || undefined, severity: f.severity, reportable: f.reportable, description: f.description, anonymizedSubjectRef: f.anonymizedSubjectRef || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewPmsForm({ devices, pending, run, onDone }: { devices: Devices; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ deviceId: "", title: "", periodStart: "", periodEnd: "", findings: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <select aria-label="Dispositivo" style={input} value={f.deviceId} onChange={(e) => set("deviceId", e.target.value)}><option value="">Dispositivo…</option>{devices.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select>
        <input aria-label="Título" style={input} placeholder="Título" value={f.title} onChange={(e) => set("title", e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input aria-label="Inicio del periodo" style={input} type="date" value={f.periodStart} onChange={(e) => set("periodStart", e.target.value)} />
        <input aria-label="Fin del periodo" style={input} type="date" value={f.periodEnd} onChange={(e) => set("periodEnd", e.target.value)} />
      </div>
      <textarea aria-label="Hallazgos (sin PII clínica)" style={{ ...input, minHeight: 50 }} placeholder="Hallazgos (sin PII clínica)" value={f.findings} onChange={(e) => set("findings", e.target.value)} />
      <button disabled={pending || !f.deviceId || !f.title || !f.periodStart || !f.periodEnd} style={primaryBtn} onClick={() => { run(() => createPostMarketSurveillance({ deviceId: f.deviceId, title: f.title, periodStart: f.periodStart, periodEnd: f.periodEnd, findings: f.findings || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewFieldSafetyActionForm({ devices, pending, run, onDone }: { devices: Devices; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ deviceId: "", title: "", actionType: "FSCA" as "FSCA" | "FSN" | "ADVISORY" | "OTHER", reason: "", lotNumbers: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v as never }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 8 }}>
        <select aria-label="Dispositivo (opcional)" style={input} value={f.deviceId} onChange={(e) => set("deviceId", e.target.value)}><option value="">Dispositivo (opcional)…</option>{devices.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select>
        <input aria-label="Título" style={input} placeholder="Título" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <select aria-label="Tipo de acción" style={input} value={f.actionType} onChange={(e) => set("actionType", e.target.value)}><option value="FSCA">FSCA</option><option value="FSN">FSN</option><option value="ADVISORY">Aviso</option><option value="OTHER">Otro</option></select>
      </div>
      <textarea aria-label="Motivo (sin PII clínica)" style={{ ...input, minHeight: 50 }} placeholder="Motivo (sin PII clínica)" value={f.reason} onChange={(e) => set("reason", e.target.value)} />
      <input aria-label="Lotes afectados (coma)" style={input} placeholder="Lotes afectados (coma)" value={f.lotNumbers} onChange={(e) => set("lotNumbers", e.target.value)} />
      <button disabled={pending || !f.title} style={primaryBtn} onClick={() => { run(() => createFieldSafetyAction({ deviceId: f.deviceId || undefined, title: f.title, actionType: f.actionType, reason: f.reason || undefined, lotNumbers: f.lotNumbers ? f.lotNumbers.split(",").map((s) => s.trim()).filter(Boolean) : [] })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewRecallForm({ devices, pending, run, onDone }: { devices: Devices; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ deviceId: "", title: "", reason: "", lotNumbers: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <select aria-label="Dispositivo (opcional)" style={input} value={f.deviceId} onChange={(e) => set("deviceId", e.target.value)}><option value="">Dispositivo (opcional)…</option>{devices.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select>
        <input aria-label="Título" style={input} placeholder="Título" value={f.title} onChange={(e) => set("title", e.target.value)} />
      </div>
      <textarea aria-label="Motivo del retiro" style={{ ...input, minHeight: 50 }} placeholder="Motivo del retiro" value={f.reason} onChange={(e) => set("reason", e.target.value)} />
      <input aria-label="Lotes afectados (coma) — obligatorio" style={input} placeholder="Lotes afectados (coma) — obligatorio" value={f.lotNumbers} onChange={(e) => set("lotNumbers", e.target.value)} />
      <button disabled={pending || !f.title || !f.reason || !f.lotNumbers} style={primaryBtn} onClick={() => { run(() => createProductRecall({ deviceId: f.deviceId || undefined, title: f.title, reason: f.reason, lotNumbers: f.lotNumbers.split(",").map((s) => s.trim()).filter(Boolean) })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

// ─── Forms: regulatory ───

function NewRegulatoryRequirementForm({ pending, run, onDone }: { pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ jurisdiction: "", framework: "", clauseRef: "", title: "", description: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <input aria-label="Jurisdicción" style={input} placeholder="Jurisdicción" value={f.jurisdiction} onChange={(e) => set("jurisdiction", e.target.value)} />
        <input aria-label="Marco (p. ej. MDR)" style={input} placeholder="Marco (p. ej. MDR)" value={f.framework} onChange={(e) => set("framework", e.target.value)} />
        <input aria-label="Cláusula" style={input} placeholder="Cláusula" value={f.clauseRef} onChange={(e) => set("clauseRef", e.target.value)} />
      </div>
      <input aria-label="Título" style={input} placeholder="Título" value={f.title} onChange={(e) => set("title", e.target.value)} />
      <input aria-label="Descripción" style={input} placeholder="Descripción" value={f.description} onChange={(e) => set("description", e.target.value)} />
      <button disabled={pending || !f.jurisdiction || !f.framework || !f.title} style={primaryBtn} onClick={() => { run(() => createRegulatoryRequirement({ jurisdiction: f.jurisdiction, framework: f.framework, clauseRef: f.clauseRef || undefined, title: f.title, description: f.description || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewRegulatorySubmissionForm({ devices, pending, run, onDone }: { devices: Devices; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ deviceId: "", jurisdiction: "", submissionType: "", referenceNumber: "", summary: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <select aria-label="Dispositivo (opcional)" style={input} value={f.deviceId} onChange={(e) => set("deviceId", e.target.value)}><option value="">Dispositivo (opcional)…</option>{devices.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select>
        <input aria-label="Jurisdicción" style={input} placeholder="Jurisdicción" value={f.jurisdiction} onChange={(e) => set("jurisdiction", e.target.value)} />
        <input aria-label="Tipo de presentación" style={input} placeholder="Tipo de presentación" value={f.submissionType} onChange={(e) => set("submissionType", e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <input aria-label="N.º de referencia" style={input} placeholder="N.º de referencia" value={f.referenceNumber} onChange={(e) => set("referenceNumber", e.target.value)} />
        <input aria-label="Resumen" style={input} placeholder="Resumen" value={f.summary} onChange={(e) => set("summary", e.target.value)} />
      </div>
      <button disabled={pending || !f.jurisdiction || !f.submissionType} style={primaryBtn} onClick={() => { run(() => createRegulatorySubmission({ deviceId: f.deviceId || undefined, jurisdiction: f.jurisdiction, submissionType: f.submissionType, referenceNumber: f.referenceNumber || undefined, summary: f.summary || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}
