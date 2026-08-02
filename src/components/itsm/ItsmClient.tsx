"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Server, BookOpen, FileClock, Ticket, AlertOctagon,
  Bug, GitPullRequest, Boxes, Activity, Shield, Truck, ArrowRight, Check, Plus, X, Link2, Pencil, Archive, ArchiveRestore, Trash2,
} from "lucide-react";
import type { ItsmPayload } from "@/lib/itsm/queries";
import {
  transitionItsmChange,
  transitionItsmIncident,
  transitionItsmProblem,
  createITService, createServiceCatalogEntry, createServiceOwner,
  createServiceLevelAgreement, createOperationalLevelAgreement,
  createServiceRequest, createItsmIncident, linkItsmIncidentCrossDomain,
  createItsmProblem, createKnownError,
  createItsmChange, createRelease, createDeployment,
  createConfigurationItem, createCmdbRelationship,
  createAvailabilityPlan, createCapacityPlan, createServiceContinuityPlan,
  createServiceSupplier, createKnowledgeArticle, createServiceReport,
  updateItsmRecord, transitionItsmRecord, setItsmRecordArchived, deleteItsmRecord,
} from "@/lib/actions/itsm";
import {
  nextItsmChangeStatuses,
  nextItsmIncidentStatuses,
  nextItsmProblemStatuses,
} from "@/lib/itsm/workflows";
import type { ITSMChangeStatus, ITSMIncidentStatus, ITSMProblemStatus } from "@prisma/client";
import Modal from "@/components/ui/Modal";
import IsoMetricCard from "@/components/ui/IsoMetricCard";
import IsoSectionMetrics from "@/components/ui/IsoSectionMetrics";
import IsoTableCard from "@/components/ui/IsoTableCard";
import IsoQuickCreate from "@/components/ui/IsoQuickCreate";
import IsoSectionHeader from "@/components/ui/IsoSectionHeader";
import { useCreateRequest } from "@/hooks/useCreateRequest";
import { useModuleSection } from "@/hooks/useModuleSection";
import { ConfirmActionModal } from "@/components/ui/ActionDialogs";

type Tab =
  | "panel" | "catalog" | "sla" | "requests" | "incidents" | "problems"
  | "changes" | "cmdb" | "availability" | "suppliers" | "knowledge";

const SECTION_META: Record<Tab, { title: string; sub: string }> = {
  panel: { title: "Gestión de servicios TI (ITSM)", sub: "ISO/IEC 20000 — visión general de catálogo, SLA, incidentes, problemas, cambios, CMDB y desempeño." },
  catalog: { title: "Catálogo de servicios", sub: "Servicios publicados, entradas de catálogo y responsables del servicio." },
  sla: { title: "Acuerdos de nivel de servicio", sub: "SLA, OLA, objetivos de servicio y seguimiento de incumplimientos." },
  requests: { title: "Solicitudes de servicio", sub: "Solicitudes, atención, responsables y cumplimiento de tiempos acordados." },
  incidents: { title: "Incidentes de servicio", sub: "Incidentes operativos, impacto, resolución y confirmación con el usuario." },
  problems: { title: "Problemas y errores conocidos", sub: "Análisis de causa raíz, errores conocidos y prevención de recurrencias." },
  changes: { title: "Cambios y releases", sub: "Cambios, despliegues, aprobaciones y transición controlada del servicio." },
  cmdb: { title: "CMDB y configuración", sub: "Elementos de configuración, relaciones y estado de los servicios." },
  availability: { title: "Disponibilidad y capacidad", sub: "Planes de disponibilidad, capacidad y continuidad de servicios." },
  suppliers: { title: "Proveedores de servicio", sub: "Proveedores, alcance contratado y evaluación del desempeño." },
  knowledge: { title: "Conocimiento y reportes", sub: "Artículos de conocimiento y reportes de desempeño del servicio." },
};

const card: React.CSSProperties = { border: "1px solid var(--nf-line, #e5eaf2)", borderRadius: 14, padding: 18, background: "var(--nf-surface, #fff)" };
const chip = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, display: "inline-block" });
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e5eaf2", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const actionTd: React.CSSProperties = { ...td, verticalAlign: "middle", whiteSpace: "nowrap" };
const fmt = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

const ITSM_LABELS: Record<string, string> = {
  LOW: "Baja", MEDIUM: "Media", HIGH: "Alta", CRITICAL: "Crítica",
  ACTIVE: "Activo", INACTIVE: "Inactivo", UNDER_REVIEW: "En revisión", RETIRED: "Retirado", ARCHIVED: "Archivado",
  PRIMARY: "Principal", BACKUP: "Suplente", DELEGATE: "Delegado",
  DRAFT: "Borrador", SUPERSEDED: "Sustituido", EXPIRED: "Vencido", APPROVED: "Aprobado",
  NEW: "Nuevo", ASSIGNED: "Asignado", IN_PROGRESS: "En curso", FULFILLED: "Atendido", CLOSED: "Cerrado", CANCELLED: "Cancelado",
  INVESTIGATING: "En investigación", RESOLVED: "Resuelto", CONFIRMED: "Confirmado",
  OPEN: "Abierto", DOCUMENTED: "Documentado", KNOWN_ERROR: "Error conocido", WORKAROUND_AVAILABLE: "Solución temporal disponible",
  STANDARD: "Estándar", NORMAL: "Normal", EMERGENCY: "Emergencia", ASSESSMENT: "En evaluación", AUTHORIZED: "Autorizado", IMPLEMENTING: "En implementación", REVIEW: "En revisión",
  PLANNED: "Planificado", BUILDING: "En preparación", READY: "Listo", RELEASED: "Publicado", ROLLED_BACK: "Revertido",
  PENDING: "Pendiente", SUCCESS: "Correcto", FAILED: "Fallido", DEV: "Desarrollo", TEST: "Pruebas", STAGING: "Preproducción", PROD: "Producción",
  APPLICATION: "Aplicación", SERVER: "Servidor", DATABASE: "Base de datos", NETWORK: "Red", SERVICE: "Servicio", DOCUMENTATION: "Documentación", OTHER: "Otro",
  IN_USE: "En uso", MAINTENANCE: "En mantenimiento", DEPENDS_ON: "Depende de", RUNS_ON: "Se ejecuta en", CONNECTS_TO: "Se conecta a", USES: "Usa", OWNED_BY: "Propiedad de",
  SECURITY: "Seguridad de la información", AI: "Inteligencia artificial", OCCUPATIONAL: "Seguridad y salud en el trabajo",
  EXITING: "En salida", HOWTO: "Guía", FAQ: "Preguntas frecuentes", RUNBOOK: "Procedimiento", SLA: "SLA", INCIDENTS: "Incidentes", AVAILABILITY: "Disponibilidad", CAPACITY: "Capacidad", CONTINUITY: "Continuidad", SUPPLIERS: "Proveedores", PERFORMANCE: "Rendimiento", CUSTOM: "Personalizado",
};
const itsmLabel = (value: string | null | undefined) => value ? (ITSM_LABELS[value] ?? value.replaceAll("_", " ")) : "—";

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--nf-line)", borderRadius: 8, fontSize: 13, fontFamily: "inherit" };
const primaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 14px", minHeight: 32, border: "1px solid var(--nf-app-accent)", borderRadius: 999, background: "var(--nf-app-accent)", color: "#fff", fontWeight: 600, fontSize: 12, fontFamily: "inherit", cursor: "pointer" };
type Runner = (action: () => Promise<unknown>) => void;
type Members = ItsmPayload["members"];
type Services = ItsmPayload["services"];
type ItsmEditorKind = "service" | "catalog" | "owner" | "sla" | "ola" | "request" | "incident" | "problem" | "knownError" | "change" | "release" | "deployment" | "ci" | "relationship" | "availability" | "capacity" | "continuity" | "supplier" | "article" | "report" | "crossLink";
type ArchivableKind = "service" | "catalog" | "owner" | "sla" | "ola" | "knownError" | "ci" | "availability" | "capacity" | "continuity" | "supplier" | "article";
const ARCHIVABLE_KINDS = new Set<ArchivableKind>(["service", "catalog", "owner", "sla", "ola", "knownError", "ci", "availability", "capacity", "continuity", "supplier", "article"]);

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

export default function ItsmClient({ initial, demo = false }: { initial: ItsmPayload; demo?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useModuleSection<Tab>("panel");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ kind: ItsmEditorKind; value: Record<string, any> } | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; kind: ArchivableKind; label: string; archived: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; kind: "relationship" | "crossLink" | "report"; label: string } | null>(null);
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
    run(async () => { await updateItsmRecord(editor.value.id, editor.kind, payload); setEditor(null); });
  }

  function openArchive(kind: ItsmEditorKind, row: Record<string, any>, label: string, archived: boolean) {
    if (ARCHIVABLE_KINDS.has(kind as ArchivableKind)) setArchiveTarget({ id: row.id, kind: kind as ArchivableKind, label, archived });
  }

  function recordActions(kind: ItsmEditorKind, row: Record<string, any>, label: string, archived = false) {
    return <ItsmRowActions>
      <EditButton onClick={() => setEditor({ kind, value: row })} />
      {ARCHIVABLE_KINDS.has(kind as ArchivableKind) && <ItsmTableAction icon={archived ? ArchiveRestore : Archive} variant="secondary" onClick={() => openArchive(kind, row, label, archived)}>{archived ? "Activar" : "Archivar"}</ItsmTableAction>}
    </ItsmRowActions>;
  }

  function removableRecordActions(kind: "relationship" | "crossLink" | "report", row: Record<string, any>, label: string) {
    return <ItsmRowActions><EditButton onClick={() => setEditor({ kind, value: row })} /><ItsmTableAction icon={Trash2} variant="danger" onClick={() => setDeleteTarget({ id: row.id, kind, label })}>Eliminar</ItsmTableAction></ItsmRowActions>;
  }

  return (
    <div className="nf-iso-module" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <IsoSectionHeader headingLevel={1} icon={Server} title={SECTION_META[tab].title} description={SECTION_META[tab].sub}
        action={demo ? <span style={chip("#eef2ff", "#4f46e5")}>Demo</span> : undefined} />

      {error && <div style={{ ...card, borderColor: "#fecaca", background: "#fef2f2", color: "#b91c1c" }}>{error}</div>}

      {tab === "panel" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12 }}>
        <Stat label="Servicios" value={s.services} />
        <Stat label="SLA activos" value={s.activeSlas} />
        <Stat label="Incidentes abiertos" value={s.openIncidents} accent={s.openIncidents ? "#dc2626" : undefined} />
        <Stat label="Problemas abiertos" value={s.openProblems} accent={s.openProblems ? "#d68a1a" : undefined} />
        <Stat label="Cambios abiertos" value={s.openChanges} />
        <Stat label="Incumplimientos SLA" value={s.slaBreaches} accent={s.slaBreaches ? "#dc2626" : undefined} />
      </div> : <IsoSectionMetrics items={tab === "catalog" ? [{ label: "Servicios activos", value: s.services }, { label: "Entradas de catálogo", value: s.catalogEntries }, { label: "Solicitudes abiertas", value: s.openRequests, accent: s.openRequests ? "#dc2626" : undefined }] : tab === "sla" ? [{ label: "SLA activos", value: s.activeSlas }, { label: "Incumplimientos SLA", value: s.slaBreaches, accent: s.slaBreaches ? "#dc2626" : undefined }, { label: "Servicios", value: s.services }] : tab === "requests" ? [{ label: "Solicitudes abiertas", value: s.openRequests, accent: s.openRequests ? "#dc2626" : undefined }, { label: "Servicios", value: s.services }, { label: "SLA activos", value: s.activeSlas }] : tab === "incidents" ? [{ label: "Incidentes abiertos", value: s.openIncidents, accent: s.openIncidents ? "#dc2626" : undefined }, { label: "Incumplimientos SLA", value: s.slaBreaches, accent: s.slaBreaches ? "#dc2626" : undefined }, { label: "Servicios", value: s.services }] : tab === "problems" ? [{ label: "Problemas abiertos", value: s.openProblems, accent: s.openProblems ? "#d68a1a" : undefined }, { label: "Errores conocidos", value: initial.knownErrors.length }, { label: "Incidentes abiertos", value: s.openIncidents, accent: s.openIncidents ? "#dc2626" : undefined }] : tab === "changes" ? [{ label: "Cambios abiertos", value: s.openChanges }, { label: "Releases en curso", value: s.releasesOpen }, { label: "Despliegues", value: initial.deployments.length }] : tab === "cmdb" ? [{ label: "CIs en uso", value: s.cis }, { label: "Relaciones", value: initial.relationships.length }, { label: "Releases", value: s.releasesOpen }] : tab === "availability" ? [{ label: "Planes de disponibilidad", value: initial.availability.length }, { label: "Planes de capacidad", value: initial.capacity.length }, { label: "Continuidad", value: initial.continuity.length }] : tab === "suppliers" ? [{ label: "Proveedores", value: initial.suppliers.length }, { label: "Servicios", value: s.services }, { label: "SLA activos", value: s.activeSlas }] : [{ label: "Artículos publicados", value: s.publishedArticles }, { label: "Reportes", value: initial.reports.length }, { label: "Servicios", value: s.services }]} />}

      {tab === "panel" && (
        <>
          <div className="nf-iso-panel-toolbar"><div><strong>Resumen ITSM</strong><span>Accesos directos a servicios, tickets y cambios.</span></div><IsoQuickCreate modulePath="/app/itsm" items={[{ label: "Nuevo servicio", description: "Registrar servicio IT", section: "catalog", Icon: BookOpen }, { label: "Nuevo SLA", description: "Definir acuerdo de servicio", section: "sla", Icon: FileClock }, { label: "Nueva solicitud", description: "Registrar solicitud de servicio", section: "requests", Icon: Ticket }, { label: "Nuevo incidente de servicio", description: "Abrir incidente", section: "incidents", Icon: AlertOctagon }, { label: "Nuevo problema", description: "Registrar problema", section: "problems", Icon: Bug }, { label: "Nuevo cambio", description: "Solicitar cambio", section: "changes", Icon: GitPullRequest }, { label: "Nuevo elemento de configuración (CI)", description: "Agregar elemento a CMDB", section: "cmdb", Icon: Boxes }, { label: "Nuevo informe", description: "Registrar informe de desempeño", section: "panel", Icon: Activity }]} /></div>
          <div className="nf-iso-dashboard-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><BookOpen size={16} aria-hidden />Catálogo y acuerdos (§8.2–8.3)</h3>
            <Row k="Servicios activos" v={s.services} />
            <Row k="Entradas de catálogo" v={s.catalogEntries} />
            <Row k="SLA activos" v={s.activeSlas} />
            <Row k="Solicitudes abiertas" v={s.openRequests} danger={s.openRequests > 0} />
          </div>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><AlertOctagon size={16} aria-hidden />Resolución (§8.6)</h3>
            <Row k="Incidentes abiertos" v={s.openIncidents} danger={s.openIncidents > 0} />
            <Row k="Problemas abiertos" v={s.openProblems} danger={s.openProblems > 0} />
            <Row k="Incumplimientos SLA" v={s.slaBreaches} danger={s.slaBreaches > 0} />
            <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 12 }}>
              ITSMIncident ≠ SecurityIncident (ISO 27001). Workflow: NEW → ASSIGNED → INVESTIGATING → RESOLVED → CONFIRMED → CLOSED.
            </p>
          </div>
          <div className="nf-iso-dashboard-card" style={card}>
            <h3 style={{ marginTop: 0 }}><GitPullRequest size={16} aria-hidden />Transición y aseguramiento (§8.5–8.7)</h3>
            <Row k="Cambios abiertos" v={s.openChanges} />
            <Row k="Releases en curso" v={s.releasesOpen} />
            <Row k="CIs en uso" v={s.cis} />
            <Row k="Artículos publicados" v={s.publishedArticles} />
          </div>
          <div className="nf-iso-dashboard-card nf-iso-dashboard-card--wide" style={{ ...card, gridColumn: "1 / -1" }}>
            <h3 style={{ marginTop: 0 }}><Activity size={16} aria-hidden />Informes de desempeño (§9.1)</h3>
            {live && can.create && (
              <NewFormToggle label="Nuevo informe">
                {(close) => <NewReportForm services={initial.services} pending={pending} run={run} onDone={close} />}
              </NewFormToggle>
            )}
            <Table headers={["Código", "Título", "Tipo", "Servicio", "Periodo", "Generado", "Acciones"]} title="Registro de informes de servicio" description="Consulta los informes de desempeño, su periodo de cobertura y el servicio asociado.">
              {initial.reports.map((r) => (
                <tr key={r.id}>
                  <td style={td}>{r.code}</td>
                  <td style={td}>{r.title}</td>
                <td style={td}>{itsmLabel(r.reportType)}</td>
                  <td style={td}>{r.service?.code ?? "—"}</td>
                  <td style={td}>{fmt(r.periodStart)} – {fmt(r.periodEnd)}</td>
                  <td style={td}>{fmt(r.generatedAt)}</td>
                  <td style={actionTd}>{live && can.update && removableRecordActions("report", r as any, r.title)}</td>
                </tr>
              ))}
            </Table>
          </div>
          </div>
        </>
      )}

      {tab === "catalog" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo servicio">
              {(close) => <NewServiceForm pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Servicio", "Criticidad", "Estado", "Acciones"]} title="Registro de servicios TI" description="Administra los servicios publicados, su criticidad y su estado operativo.">
            {initial.services.map((svc) => (
              <tr key={svc.id}>
                <td style={td}>{svc.code}</td>
                <td style={td}>{svc.name}</td>
                <td style={td}>{itsmLabel(svc.criticality)}</td>
                <td style={td}>{itsmLabel(svc.status)}</td>
                <td style={actionTd}>{live && can.update && recordActions("service", svc as any, svc.name, svc.status === "RETIRED")}</td>
              </tr>
            ))}
          </Table>
          {live && can.create && (
            <NewFormToggle label="Nueva entrada de catálogo">
              {(close) => <NewCatalogEntryForm services={initial.services} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Entrada", "Servicio", "Solicitable", "Horas est.", "Acciones"]} title="Registro de entradas de catálogo" description="Define las prestaciones que se pueden solicitar para cada servicio TI.">
            {initial.catalog.map((c) => (
              <tr key={c.id}>
                <td style={td}>{c.code}</td>
                <td style={td}>{c.name}</td>
                <td style={td}>{c.service.code}</td>
                <td style={td}>{c.requestable ? "Sí" : "No"}</td>
                <td style={td}>{c.estimatedFulfillmentHours ?? "—"}</td>
                <td style={actionTd}>{live && can.update && recordActions("catalog", c as any, c.name, !c.active)}</td>
              </tr>
            ))}
          </Table>
          {live && can.create && (
            <NewFormToggle label="Nuevo propietario de servicio">
              {(close) => <NewOwnerForm services={initial.services} members={initial.members} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Servicio", "Propietario", "Rol", "Desde", "Acciones"]} title="Registro de propietarios de servicio" description="Asigna responsables y roles de respaldo para la gestión de cada servicio.">
            {initial.owners.map((o) => (
              <tr key={o.id}>
                <td style={td}>{o.code}</td>
                <td style={td}>{o.service.code}</td>
                <td style={td}>{o.ownerName ?? initial.members.find((m) => m.id === o.userId)?.name ?? "—"}</td>
                <td style={td}>{itsmLabel(o.ownershipRole)}</td>
                <td style={td}>{fmt(o.effectiveFrom)}</td>
                <td style={actionTd}>{live && can.update && recordActions("owner", o as any, o.ownerName ?? o.code, Boolean(o.effectiveTo))}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "sla" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo SLA">
              {(close) => <NewSlaForm services={initial.services} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "SLA", "Servicio", "Respuesta", "Resolución", "Disp. %", "Estado", "Acciones"]} title="Registro de acuerdos SLA" description="Controla los tiempos comprometidos y la disponibilidad acordada de cada servicio.">
            {initial.slas.map((sla) => (
              <tr key={sla.id}>
                <td style={td}>{sla.code}</td>
                <td style={td}>{sla.name}</td>
                <td style={td}>{sla.service.code}</td>
                <td style={td}>{sla.responseTimeMinutes} min</td>
                <td style={td}>{sla.resolutionTimeMinutes} min</td>
                <td style={td}>{sla.availabilityTargetPct ?? "—"}</td>
                <td style={td}>{itsmLabel(sla.status)}</td>
                <td style={actionTd}>{live && can.update && recordActions("sla", sla as any, sla.name, sla.status === "SUPERSEDED")}</td>
              </tr>
            ))}
          </Table>
          {live && can.create && (
            <NewFormToggle label="Nuevo OLA">
              {(close) => <NewOlaForm services={initial.services} slas={initial.slas} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "OLA", "Servicio", "SLA", "Equipo", "Acciones"]} title="Registro de acuerdos OLA" description="Documenta los acuerdos internos que respaldan el cumplimiento de los SLA.">
            {initial.olas.map((o) => (
              <tr key={o.id}>
                <td style={td}>{o.code}</td>
                <td style={td}>{o.name}</td>
                <td style={td}>{o.service.code}</td>
                <td style={td}>{o.sla?.code ?? "—"}</td>
                <td style={td}>{o.supportingTeam ?? "—"}</td>
                <td style={actionTd}>{live && can.update && recordActions("ola", o as any, o.name, o.status === "SUPERSEDED")}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "requests" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nueva solicitud">
              {(close) => <NewRequestForm services={initial.services} catalog={initial.catalog} members={initial.members} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Título", "Servicio", "Catálogo", "Prioridad", "Estado", "Vence", "Acciones"]} title="Registro de solicitudes de servicio" description="Da seguimiento a solicitudes, prioridad, vencimiento y estado de atención.">
            {initial.requests.map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.code}</td>
                <td style={td}>{r.title}</td>
                <td style={td}>{r.service?.code ?? "—"}</td>
                <td style={td}>{r.catalogEntry?.code ?? "—"}</td>
                <td style={td}>{itsmLabel(r.priority)}</td>
                <td style={td}>{itsmLabel(r.status)}</td>
                <td style={td}>{fmt(r.dueAt)}</td>
                <td style={actionTd}>
                  {live && can.update && <ItsmRowActions><EditButton onClick={() => setEditor({ kind: "request", value: r as any })} /><LifecycleButton row={r} kind="request" pending={pending} onTransition={(to) => run(() => transitionItsmRecord(r.id, "request", to))} /></ItsmRowActions>}
                </td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "incidents" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo incidente de servicio">
              {(close) => <NewIncidentForm services={initial.services} slas={initial.slas} members={initial.members} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Título", "Servicio", "Prioridad", "Estado", "SLA", "Acciones"]} title="Registro de incidentes de servicio" description="Gestiona los incidentes operativos, su prioridad, SLA y ciclo de resolución.">
            {initial.incidents.map((inc) => {
              const next = nextItsmIncidentStatuses(inc.status as ITSMIncidentStatus)[0];
              return (
                <tr key={inc.id}>
                  <td style={td}>{inc.code}</td>
                  <td style={td}>{inc.title}</td>
                  <td style={td}>{inc.service?.code ?? "—"}</td>
                  <td style={td}>{itsmLabel(inc.priority)}</td>
                  <td style={td}>
                    <span style={chip(inc.status === "CLOSED" ? "#dcfce7" : "#fee2e2", inc.status === "CLOSED" ? "#15803d" : "#b91c1c")}>{itsmLabel(inc.status)}</span>
                    {inc.slaEval?.overallMet === false && <span style={{ ...chip("#fef3c7", "#a16207"), marginLeft: 6 }}>SLA</span>}
                  </td>
                  <td style={td}>{inc.sla?.code ?? "—"}</td>
                  <td style={actionTd}>
                    {live && can.update && <ItsmRowActions><EditButton onClick={() => setEditor({ kind: "incident", value: inc as any })} />
                    {live && next && (can.update || can.approve) && (
                      <ItsmTableAction icon={ArrowRight} disabled={pending} variant="secondary" onClick={() => run(() => transitionItsmIncident(inc.id, next))}>{itsmLabel(next)}</ItsmTableAction>
                    )}
                    </ItsmRowActions>}
                  </td>
                </tr>
              );
            })}
          </Table>

          <div style={card}>
            <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 6 }}><Link2 size={16} /> Vínculos con otros dominios</h3>
            <p style={{ margin: "0 0 8px", color: "#64748b", fontSize: 12 }}>
              Relaciona un incidente de servicio con un incidente de seguridad (ISO 27001), de IA (ISO/IEC 42001) o
              laboral (ISO 45001) — sin fusionar sus workflows. Cada uno conserva su propio estado.
            </p>
            {live && can.create && (
              <NewFormToggle label="Nuevo vínculo">
                {(close) => <NewCrossLinkForm incidents={initial.incidents} options={initial.crossLinkOptions} pending={pending} run={run} onDone={close} />}
              </NewFormToggle>
            )}
            <Table headers={["Incidente ITSM", "Dominio", "Relacionado", "Tipo", "Notas", "Acciones"]} title="Vínculos con otros dominios" description="Relaciona incidentes ITSM con sucesos de seguridad, IA o seguridad y salud sin mezclar sus flujos.">
              {initial.crossLinks.map((l) => (
                <tr key={l.id}>
                  <td style={td}>{l.itsmIncident.code}</td>
                  <td style={td}><span style={chip("#eef2ff", "#4f46e5")}>{itsmLabel(l.targetDomain)}</span></td>
                  <td style={td}>{l.targetLabel}</td>
                  <td style={td}>{l.relationType ?? "—"}</td>
                  <td style={td}>{l.notes ?? "—"}</td>
                  <td style={actionTd}>{live && can.update && removableRecordActions("crossLink", l as any, `${l.itsmIncident.code} — ${l.targetLabel}`)}</td>
                </tr>
              ))}
            </Table>
          </div>
        </div>
      )}

      {tab === "problems" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo problema">
              {(close) => <NewProblemForm services={initial.services} members={initial.members} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Título", "Estado", "Incidentes", "KE", "Acciones"]} title="Registro de problemas" description="Agrupa problemas, incidentes vinculados y errores conocidos para prevenir recurrencias.">
            {initial.problems.map((p) => {
              const next = nextItsmProblemStatuses(p.status as ITSMProblemStatus)[0];
              return (
                <tr key={p.id}>
                  <td style={td}>{p.code}</td>
                  <td style={td}>{p.title}</td>
                  <td style={td}>{itsmLabel(p.status)}</td>
                  <td style={td}>{p._count.incidents}</td>
                  <td style={td}>{p._count.knownErrors}</td>
                  <td style={actionTd}>
                    {live && can.update && <ItsmRowActions><EditButton onClick={() => setEditor({ kind: "problem", value: p as any })} />
                    {live && next && can.update && (
                      <ItsmTableAction icon={ArrowRight} disabled={pending} variant="secondary" onClick={() => run(() => transitionItsmProblem(p.id, next))}>{itsmLabel(next)}</ItsmTableAction>
                    )}
                    </ItsmRowActions>}
                  </td>
                </tr>
              );
            })}
          </Table>
          {live && can.create && (
            <NewFormToggle label="Nuevo error conocido">
              {(close) => <NewKnownErrorForm problems={initial.problems} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Error conocido", "Problema", "Workaround", "Estado", "Acciones"]} title="Registro de errores conocidos" description="Documenta soluciones temporales y correcciones permanentes asociadas a los problemas.">
            {initial.knownErrors.map((k) => (
              <tr key={k.id}>
                <td style={td}>{k.code}</td>
                <td style={td}>{k.title}</td>
                <td style={td}>{k.problem?.code ?? "—"}</td>
                <td style={td}>{k.workaround ?? "—"}</td>
                <td style={td}>{itsmLabel(k.status)}</td>
                <td style={actionTd}>{live && can.update && recordActions("knownError", k as any, k.title, k.status === "RESOLVED")}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "changes" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo cambio">
              {(close) => <NewChangeForm services={initial.services} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Cambio", "Tipo", "Estado", "Riesgo", "Acciones"]} title="Registro de cambios" description="Gestiona la evaluación, autorización, implementación y revisión de cambios TI.">
            {initial.changes.map((c) => {
              const next = nextItsmChangeStatuses(c.status as ITSMChangeStatus)[0];
              return (
                <tr key={c.id}>
                  <td style={td}>{c.code}</td>
                  <td style={td}>{c.title}</td>
                  <td style={td}>{itsmLabel(c.changeType)}</td>
                  <td style={td}>{itsmLabel(c.status)}</td>
                  <td style={td}>{itsmLabel(c.riskLevel)}</td>
                  <td style={actionTd}>
                    {live && can.update && <ItsmRowActions><EditButton onClick={() => setEditor({ kind: "change", value: c as any })} />
                    {live && next && (can.update || can.approve) && (
                      <ItsmTableAction icon={next === "APPROVED" ? Check : ArrowRight} disabled={pending} variant="secondary" onClick={() => run(() => transitionItsmChange(c.id, next))}>{itsmLabel(next)}</ItsmTableAction>
                    )}
                    </ItsmRowActions>}
                  </td>
                </tr>
              );
            })}
          </Table>
          {live && can.create && (
            <NewFormToggle label="Nuevo release">
              {(close) => <NewReleaseForm services={initial.services} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Release", "Versión", "Estado", "Despliegues", "Acciones"]} title="Registro de releases" description="Controla las versiones liberadas, su estado y los despliegues relacionados.">
            {initial.releases.map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.code}</td>
                <td style={td}>{r.title}</td>
                <td style={td}>{r.version}</td>
                <td style={td}>{itsmLabel(r.status)}</td>
                <td style={td}>{r._count.deployments}</td>
                <td style={actionTd}>{live && can.update && <ItsmRowActions><EditButton onClick={() => setEditor({ kind: "release", value: r as any })} /><LifecycleButton row={r} kind="release" pending={pending} onTransition={(to) => run(() => transitionItsmRecord(r.id, "release", to))} /></ItsmRowActions>}</td>
              </tr>
            ))}
          </Table>
          {live && can.create && (
            <NewFormToggle label="Nuevo despliegue">
              {(close) => <NewDeploymentForm releases={initial.releases} cis={initial.cis} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Release", "Entorno", "CI", "Estado", "Acciones"]} title="Registro de despliegues" description="Registra los despliegues por entorno y los elementos de configuración involucrados.">
            {initial.deployments.map((d) => (
              <tr key={d.id}>
                <td style={td}>{d.code}</td>
                <td style={td}>{d.release.code} · {d.release.version}</td>
                <td style={td}>{itsmLabel(d.environment)}</td>
                <td style={td}>{d.configurationItem?.code ?? "—"}</td>
                <td style={td}>{itsmLabel(d.status)}</td>
                <td style={actionTd}>{live && can.update && <ItsmRowActions><EditButton onClick={() => setEditor({ kind: "deployment", value: d as any })} /><LifecycleButton row={d} kind="deployment" pending={pending} onTransition={(to) => run(() => transitionItsmRecord(d.id, "deployment", to))} /></ItsmRowActions>}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "cmdb" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo elemento de configuración (CI)">
              {(close) => <NewCiForm services={initial.services} members={initial.members} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
            <Table headers={["Código", "CI", "Tipo", "Servicio", "Estado", "Criticidad", "Acciones"]} title="Registro de elementos de configuración" description="Mantiene el inventario de CIs, su servicio asociado, criticidad y estado.">
            {initial.cis.map((ci) => (
              <tr key={ci.id}>
                <td style={td}>{ci.code}</td>
                <td style={td}>{ci.name}</td>
                <td style={td}>{itsmLabel(ci.ciType)}</td>
                <td style={td}>{ci.service?.code ?? "—"}</td>
                <td style={td}>{itsmLabel(ci.status)}</td>
                <td style={td}>{itsmLabel(ci.criticality)}</td>
                <td style={actionTd}>{live && can.update && recordActions("ci", ci as any, ci.name, ci.status === "RETIRED")}</td>
              </tr>
            ))}
          </Table>
          {live && can.create && (
            <NewFormToggle label="Nueva relación CMDB">
              {(close) => <NewCmdbRelForm cis={initial.cis} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Origen", "Relación", "Destino", "Acciones"]} title="Registro de relaciones CMDB" description="Visualiza las dependencias entre elementos de configuración y su tipo de relación.">
            {initial.relationships.map((rel) => (
              <tr key={rel.id}>
                <td style={td}>{rel.code}</td>
                <td style={td}>{rel.sourceCi.code}</td>
                <td style={td}>{itsmLabel(rel.relationType)}</td>
                <td style={td}>{rel.targetCi.code}</td>
                <td style={actionTd}>{live && can.update && removableRecordActions("relationship", rel as any, `${rel.sourceCi.code} → ${rel.targetCi.code}`)}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "availability" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo plan de disponibilidad">
              {(close) => <NewAvailabilityForm services={initial.services} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Disponibilidad", "Servicio", "Objetivo %", "Real %", "Estado", "Acciones"]} title="Registro de disponibilidad" description="Compara los objetivos de disponibilidad con el desempeño real de cada servicio.">
            {initial.availability.map((a) => (
              <tr key={a.id}>
                <td style={td}>{a.code}</td>
                <td style={td}>{a.title}</td>
                <td style={td}>{a.service.code}</td>
                <td style={td}>{a.targetPercent}</td>
                <td style={td}>{a.computedAvailability ?? a.actualAvailabilityPct ?? "—"}</td>
                <td style={td}>{itsmLabel(a.status)}</td>
                <td style={actionTd}>{live && can.update && recordActions("availability", a as any, a.title, a.status === "SUPERSEDED")}</td>
              </tr>
            ))}
          </Table>
          {live && can.create && (
            <NewFormToggle label="Nuevo plan de capacidad">
              {(close) => <NewCapacityForm services={initial.services} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Capacidad", "Métrica", "Actual", "Pronóstico", "Umbral %", "Acciones"]} title="Registro de capacidad" description="Monitorea métricas, pronósticos y umbrales para anticipar necesidades de capacidad.">
            {initial.capacity.map((c) => (
              <tr key={c.id}>
                <td style={td}>{c.code}</td>
                <td style={td}>{c.title}</td>
                <td style={td}>{c.metric}</td>
                <td style={td}>{c.currentCapacity ?? "—"}</td>
                <td style={td}>{c.forecastCapacity ?? "—"}</td>
                <td style={td}>{c.thresholdPercent ?? "—"}</td>
                <td style={actionTd}>{live && can.update && recordActions("capacity", c as any, c.title, c.status === "SUPERSEDED")}</td>
              </tr>
            ))}
          </Table>
          {live && can.create && (
            <NewFormToggle label="Nuevo plan de continuidad de servicio">
              {(close) => <NewContinuityForm services={initial.services} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Continuidad", "RTO", "RPO", "BCP", "Estado", "Acciones"]} title="Registro de continuidad de servicio" description="Define la recuperación de servicios TI, RTO, RPO y el plan de continuidad asociado.">
            {initial.continuity.map((c) => (
              <tr key={c.id}>
                <td style={td}>{c.code}</td>
                <td style={td}>{c.title}</td>
                <td style={td}>{c.rtoMinutes ?? "—"} min</td>
                <td style={td}>{c.rpoMinutes ?? "—"} min</td>
                <td style={td}>{c.bcpId ?? "—"}</td>
                <td style={td}>{itsmLabel(c.status)}</td>
                <td style={actionTd}>{live && can.update && recordActions("continuity", c as any, c.title, c.status === "SUPERSEDED")}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "suppliers" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo proveedor de servicio">
              {(close) => <NewSupplierForm services={initial.services} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Proveedor", "Servicio", "Contrato", "Criticidad", "Estado", "Acciones"]} title="Registro de proveedores de servicio" description="Da seguimiento al alcance contratado, criticidad y estado de los proveedores TI.">
            {initial.suppliers.map((srow) => (
              <tr key={srow.id}>
                <td style={td}>{srow.code}</td>
                <td style={td}>{srow.name}</td>
                <td style={td}>{srow.service?.code ?? "—"}</td>
                <td style={td}>{srow.contractRef ?? "—"}</td>
                <td style={td}>{itsmLabel(srow.criticality)}</td>
                <td style={td}>{itsmLabel(srow.status)}</td>
                <td style={actionTd}>{live && can.update && recordActions("supplier", srow as any, srow.name, srow.status === "INACTIVE")}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "knowledge" && (
        <div style={{ display: "grid", gap: 14 }}>
          {live && can.create && (
            <NewFormToggle label="Nuevo artículo">
              {(close) => <NewArticleForm services={initial.services} pending={pending} run={run} onDone={close} />}
            </NewFormToggle>
          )}
          <Table headers={["Código", "Artículo", "Categoría", "Servicio", "Estado", "Acciones"]} title="Registro de conocimiento" description="Centraliza guías, preguntas frecuentes y procedimientos reutilizables para el servicio.">
            {initial.articles.map((a) => (
              <tr key={a.id}>
                <td style={td}>{a.code}</td>
                <td style={td}>{a.title}</td>
                <td style={td}>{itsmLabel(a.category)}</td>
                <td style={td}>{a.service?.code ?? "—"}</td>
                <td style={td}>{itsmLabel(a.status)}</td>
                <td style={actionTd}>{live && can.update && recordActions("article", a as any, a.title, a.status === "ARCHIVED")}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {live && can.update && <Modal open={Boolean(editor)} onClose={() => setEditor(null)} title={editor ? `Editar ${editor.value.code ?? "registro ITSM"}` : "Editar registro ITSM"} width={820}>
        {editor && <ItsmRecordEditor kind={editor.kind} value={editor.value} services={initial.services} members={initial.members} catalog={initial.catalog} slas={initial.slas} releases={initial.releases} cis={initial.cis} problems={initial.problems} pending={pending} onCancel={() => setEditor(null)} onSave={saveEditor} />}
      </Modal>}
      {archiveTarget && <ConfirmActionModal open title={`${archiveTarget.archived ? "Activar" : "Archivar"} registro`} confirmLabel={archiveTarget.archived ? "Activar" : "Archivar"} pending={pending} onCancel={() => setArchiveTarget(null)} onConfirm={() => run(async () => { await setItsmRecordArchived(archiveTarget.id, archiveTarget.kind, !archiveTarget.archived); setArchiveTarget(null); })}>
        {archiveTarget.archived ? `El registro “${archiveTarget.label}” volverá a estar disponible para su uso.` : `El registro “${archiveTarget.label}” se conservará en el historial y dejará de estar activo.`}
      </ConfirmActionModal>}
      {deleteTarget && <ConfirmActionModal open title="Eliminar registro" confirmLabel="Eliminar" danger pending={pending} onCancel={() => setDeleteTarget(null)} onConfirm={() => run(async () => { await deleteItsmRecord(deleteTarget.id, deleteTarget.kind); setDeleteTarget(null); })}>
        ¿Quieres eliminar “${deleteTarget.label}”? Esta acción elimina el registro operativo, pero quedará reflejada en el historial de auditoría.
      </ConfirmActionModal>}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return <IsoMetricCard label={label} value={value} accent={accent} />;
}

function Row({ k, v, danger }: { k: string; v: number | string; danger?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
      <span style={{ color: "#64748b" }}>{k}</span>
      <span style={{ fontWeight: 600, color: danger ? "#b91c1c" : "#0f172a" }}>{v}</span>
    </div>
  );
}

function Table({ headers, title, description, children }: { headers: string[]; title: string; description: string; children: React.ReactNode }) {
  return <IsoTableCard icon={Server} headers={headers} title={title} description={description}>{children}</IsoTableCard>;
}

function ItsmTableAction({ icon: Icon, children, onClick, disabled = false, variant = "default" }: { icon: typeof Pencil; children: React.ReactNode; onClick: () => void; disabled?: boolean; variant?: "default" | "secondary" | "danger" }) {
  const label = typeof children === "string" ? children : "Acción";
  const variantClass = variant === "secondary" ? " nf-table-action--secondary" : variant === "danger" ? " nf-table-action--danger" : "";
  return <button type="button" className={`nf-table-action${variantClass}`} title={label} disabled={disabled} onClick={onClick}><Icon size={14} aria-hidden />{children}</button>;
}

function ItsmRowActions({ children }: { children: React.ReactNode }) {
  return <div className="nf-energy-table-actions">{children}</div>;
}

function EditButton({ onClick }: { onClick: () => void }) {
  return <ItsmTableAction icon={Pencil} onClick={onClick}>Editar</ItsmTableAction>;
}

function LifecycleButton({ row, kind, pending, onTransition }: { row: any; kind: "request" | "release" | "deployment"; pending: boolean; onTransition: (to: string) => void }) {
  const transitions: Record<string, Record<string, string[]>> = {
    request: { NEW: ["IN_PROGRESS", "CANCELLED"], IN_PROGRESS: ["FULFILLED", "CANCELLED"], FULFILLED: ["CLOSED"] },
    release: { PLANNED: ["BUILDING", "ROLLED_BACK"], BUILDING: ["READY", "ROLLED_BACK"], READY: ["RELEASED", "ROLLED_BACK"] },
    deployment: { PENDING: ["IN_PROGRESS", "FAILED", "ROLLED_BACK"], IN_PROGRESS: ["SUCCESS", "FAILED", "ROLLED_BACK"], SUCCESS: ["ROLLED_BACK"], FAILED: ["IN_PROGRESS", "ROLLED_BACK"] },
  };
  const next = transitions[kind][row.status]?.[0];
  return next ? <ItsmTableAction icon={ArrowRight} disabled={pending} variant="secondary" onClick={() => onTransition(next)}>{itsmLabel(next)}</ItsmTableAction> : null;
}

type EditorField = { key: string; label: string; type?: "text" | "textarea" | "number" | "date" | "select" | "checkbox"; options?: string[]; span?: number };

const ITSM_EDITOR_REQUIRED: Partial<Record<ItsmEditorKind, string[]>> = {
  service: ["name"], catalog: ["serviceId", "name"], owner: ["serviceId"], sla: ["serviceId", "name"], ola: ["serviceId", "name"],
  request: ["title"], incident: ["title"], problem: ["title"], knownError: ["title"], change: ["title"], release: ["title", "version"],
  deployment: ["releaseId", "environment"], ci: ["name"], relationship: ["sourceCiId", "relationType", "targetCiId"],
  availability: ["serviceId", "title"], capacity: ["serviceId", "title", "metric"], continuity: ["serviceId", "title"], supplier: ["name"], article: ["title"], report: ["title"],
};

function ItsmRecordEditor({ kind, value, services, members, catalog, slas, releases, cis, problems, pending, onCancel, onSave }: {
  kind: ItsmEditorKind; value: Record<string, any>; services: any[]; members: any[]; catalog: any[]; slas: any[]; releases: any[]; cis: any[]; problems: any[]; pending: boolean; onCancel: () => void; onSave: (payload: Record<string, unknown>) => void;
}) {
  const initial = Object.fromEntries(Object.entries(value).map(([key, current]) => {
    if (key === "service" || key === "sla" || key === "catalogEntry" || key === "release" || key === "configurationItem" || key === "sourceCi" || key === "targetCi" || key === "problem") return [key, current];
    if (current instanceof Date || (typeof current === "string" && /At$|^period(Start|End)$|^effective(To|From)$/.test(key))) return [key, current ? fmt(current) : ""];
    if (key === "tags" || key === "changeCodes") return [key, Array.isArray(current) ? current.join(", ") : ""];
    if (key === "metrics") return [key, current == null ? "" : JSON.stringify(current)];
    return [key, current == null ? "" : current];
  })) as Record<string, any>;
  const [form, setForm] = useState<Record<string, any>>(initial);
  const set = (key: string, next: any) => setForm((prev) => ({ ...prev, [key]: next }));
  const options = (key: string): string[] | undefined => {
    if (key === "serviceId") return services.map((s) => s.id);
    if (key === "catalogEntryId") return catalog.map((c) => c.id);
    if (key === "slaId") return slas.map((s) => s.id);
    if (key === "releaseId") return releases.map((r) => r.id);
    if (key === "configurationItemId" || key === "sourceCiId" || key === "targetCiId") return cis.map((c) => c.id);
    if (key === "problemId") return problems.map((p) => p.id);
    return undefined;
  };
  const labelFor = (key: string, id: string) => {
    if (key === "serviceId") { const s = services.find((x) => x.id === id); return s ? `${s.code} — ${s.name}` : id; }
    if (key === "catalogEntryId") { const c = catalog.find((x) => x.id === id); return c ? `${c.code} — ${c.name}` : id; }
    if (key === "slaId") { const s = slas.find((x) => x.id === id); return s ? `${s.code} — ${s.name}` : id; }
    if (key === "releaseId") { const r = releases.find((x) => x.id === id); return r ? `${r.code} — ${r.version}` : id; }
    if (["configurationItemId", "sourceCiId", "targetCiId"].includes(key)) { const c = cis.find((x) => x.id === id); return c ? `${c.code} — ${c.name}` : id; }
    if (key === "problemId") { const p = problems.find((x) => x.id === id); return p ? `${p.code} — ${p.title}` : id; }
    return id;
  };
  const fieldsByKind: Record<ItsmEditorKind, EditorField[]> = {
    service: [{ key: "name", label: "Nombre" }, { key: "category", label: "Categoría" }, { key: "criticality", label: "Criticidad", type: "select", options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }, { key: "status", label: "Estado", type: "select", options: ["ACTIVE", "UNDER_REVIEW", "RETIRED"] }, { key: "description", label: "Descripción", type: "textarea", span: 2 }],
    catalog: [{ key: "serviceId", label: "Servicio", type: "select" }, { key: "name", label: "Nombre" }, { key: "requestable", label: "Solicitable", type: "checkbox" }, { key: "estimatedFulfillmentHours", label: "Horas estimadas", type: "number" }, { key: "active", label: "Activo", type: "checkbox" }, { key: "description", label: "Descripción", type: "textarea", span: 2 }],
    owner: [{ key: "serviceId", label: "Servicio", type: "select" }, { key: "ownershipRole", label: "Rol", type: "select", options: ["PRIMARY", "BACKUP", "DELEGATE"] }, { key: "userId", label: "Usuario", type: "select" }, { key: "ownerName", label: "Nombre del propietario" }, { key: "effectiveFrom", label: "Desde", type: "date" }, { key: "effectiveTo", label: "Hasta", type: "date" }],
    sla: [{ key: "serviceId", label: "Servicio", type: "select" }, { key: "name", label: "Nombre" }, { key: "priority", label: "Prioridad", type: "select", options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }, { key: "responseTimeMinutes", label: "Respuesta (min)", type: "number" }, { key: "resolutionTimeMinutes", label: "Resolución (min)", type: "number" }, { key: "availabilityTargetPct", label: "Disponibilidad %", type: "number" }, { key: "status", label: "Estado", type: "select", options: ["DRAFT", "ACTIVE", "SUPERSEDED", "EXPIRED"] }, { key: "description", label: "Descripción", type: "textarea", span: 2 }],
    ola: [{ key: "serviceId", label: "Servicio", type: "select" }, { key: "slaId", label: "SLA", type: "select" }, { key: "name", label: "Nombre" }, { key: "supportingTeam", label: "Equipo" }, { key: "responseTimeMinutes", label: "Respuesta (min)", type: "number" }, { key: "resolutionTimeMinutes", label: "Resolución (min)", type: "number" }, { key: "status", label: "Estado", type: "select", options: ["DRAFT", "ACTIVE", "SUPERSEDED", "EXPIRED"] }, { key: "description", label: "Descripción", type: "textarea", span: 2 }],
    request: [{ key: "title", label: "Título" }, { key: "serviceId", label: "Servicio", type: "select" }, { key: "catalogEntryId", label: "Catálogo", type: "select" }, { key: "slaId", label: "SLA", type: "select" }, { key: "assigneeId", label: "Asignado a", type: "select" }, { key: "priority", label: "Prioridad", type: "select", options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }, { key: "dueAt", label: "Vence", type: "date" }, { key: "description", label: "Descripción", type: "textarea", span: 2 }],
    incident: [{ key: "title", label: "Título" }, { key: "serviceId", label: "Servicio", type: "select" }, { key: "slaId", label: "SLA", type: "select" }, { key: "assigneeId", label: "Asignado a", type: "select" }, { key: "priority", label: "Prioridad", type: "select", options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }, { key: "impact", label: "Impacto", type: "select", options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }, { key: "urgency", label: "Urgencia", type: "select", options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }, { key: "resolutionNotes", label: "Notas de resolución", type: "textarea", span: 2 }, { key: "description", label: "Descripción", type: "textarea", span: 2 }],
    problem: [{ key: "title", label: "Título" }, { key: "serviceId", label: "Servicio", type: "select" }, { key: "assigneeId", label: "Asignado a", type: "select" }, { key: "rootCause", label: "Causa raíz", type: "textarea", span: 2 }, { key: "workaround", label: "Workaround", type: "textarea", span: 2 }, { key: "description", label: "Descripción", type: "textarea", span: 2 }],
    knownError: [{ key: "title", label: "Título" }, { key: "problemId", label: "Problema", type: "select" }, { key: "configurationItemId", label: "CI", type: "select" }, { key: "status", label: "Estado", type: "select", options: ["OPEN", "DOCUMENTED", "RESOLVED"] }, { key: "workaround", label: "Workaround", type: "textarea", span: 2 }, { key: "permanentFix", label: "Corrección permanente", type: "textarea", span: 2 }, { key: "description", label: "Descripción", type: "textarea", span: 2 }],
    change: [{ key: "title", label: "Título" }, { key: "serviceId", label: "Servicio", type: "select" }, { key: "changeType", label: "Tipo", type: "select", options: ["STANDARD", "NORMAL", "EMERGENCY"] }, { key: "riskLevel", label: "Riesgo", type: "select", options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }, { key: "impact", label: "Impacto", type: "select", options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }, { key: "scheduledStart", label: "Inicio", type: "date" }, { key: "scheduledEnd", label: "Fin", type: "date" }, { key: "description", label: "Descripción", type: "textarea", span: 2 }],
    release: [{ key: "title", label: "Título" }, { key: "version", label: "Versión" }, { key: "serviceId", label: "Servicio", type: "select" }, { key: "plannedAt", label: "Planificado", type: "date" }, { key: "changeCodes", label: "Cambios (separados por coma)" }, { key: "notes", label: "Notas", type: "textarea", span: 2 }],
    deployment: [{ key: "releaseId", label: "Release", type: "select" }, { key: "environment", label: "Entorno", type: "select", options: ["DEV", "TEST", "STAGING", "PROD"] }, { key: "configurationItemId", label: "CI", type: "select" }, { key: "notes", label: "Notas", type: "textarea", span: 2 }],
    ci: [{ key: "name", label: "Nombre" }, { key: "ciType", label: "Tipo", type: "select", options: ["APPLICATION", "SERVER", "DATABASE", "NETWORK", "SERVICE", "DOCUMENTATION", "OTHER"] }, { key: "serviceId", label: "Servicio", type: "select" }, { key: "ownerId", label: "Propietario", type: "select" }, { key: "criticality", label: "Criticidad", type: "select", options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }, { key: "status", label: "Estado", type: "select", options: ["IN_USE", "MAINTENANCE", "RETIRED", "PLANNED"] }, { key: "version", label: "Versión" }, { key: "serialNumber", label: "Número de serie" }, { key: "notes", label: "Notas", type: "textarea", span: 2 }],
    relationship: [{ key: "sourceCiId", label: "CI origen", type: "select" }, { key: "relationType", label: "Relación", type: "select", options: ["DEPENDS_ON", "RUNS_ON", "CONNECTS_TO", "USES", "OWNED_BY", "OTHER"] }, { key: "targetCiId", label: "CI destino", type: "select" }, { key: "notes", label: "Notas", type: "textarea", span: 2 }],
    availability: [{ key: "serviceId", label: "Servicio", type: "select" }, { key: "title", label: "Título" }, { key: "targetPercent", label: "Objetivo %", type: "number" }, { key: "agreedDowntimeMinutes", label: "Downtime acordado", type: "number" }, { key: "status", label: "Estado", type: "select", options: ["DRAFT", "APPROVED", "ACTIVE", "SUPERSEDED"] }, { key: "periodStart", label: "Inicio", type: "date" }, { key: "periodEnd", label: "Fin", type: "date" }, { key: "notes", label: "Notas", type: "textarea", span: 2 }],
    capacity: [{ key: "serviceId", label: "Servicio", type: "select" }, { key: "title", label: "Título" }, { key: "metric", label: "Métrica" }, { key: "currentCapacity", label: "Capacidad actual", type: "number" }, { key: "forecastCapacity", label: "Pronóstico", type: "number" }, { key: "thresholdPercent", label: "Umbral %", type: "number" }, { key: "status", label: "Estado", type: "select", options: ["DRAFT", "APPROVED", "ACTIVE", "SUPERSEDED"] }, { key: "notes", label: "Notas", type: "textarea", span: 2 }],
    continuity: [{ key: "serviceId", label: "Servicio", type: "select" }, { key: "title", label: "Título" }, { key: "rtoMinutes", label: "RTO (min)", type: "number" }, { key: "rpoMinutes", label: "RPO (min)", type: "number" }, { key: "status", label: "Estado", type: "select", options: ["DRAFT", "APPROVED", "ACTIVE", "SUPERSEDED"] }, { key: "lastTestedAt", label: "Última prueba", type: "date" }, { key: "bcpId", label: "BCP" }, { key: "description", label: "Descripción", type: "textarea", span: 2 }],
    supplier: [{ key: "name", label: "Nombre" }, { key: "serviceId", label: "Servicio", type: "select" }, { key: "contractRef", label: "Contrato" }, { key: "criticality", label: "Criticidad", type: "select", options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }, { key: "status", label: "Estado", type: "select", options: ["ACTIVE", "UNDER_REVIEW", "EXITING", "INACTIVE"] }, { key: "reviewDueAt", label: "Revisión", type: "date" }, { key: "notes", label: "Notas", type: "textarea", span: 2 }],
    article: [{ key: "title", label: "Título" }, { key: "category", label: "Categoría", type: "select", options: ["HOWTO", "KNOWN_ERROR", "FAQ", "RUNBOOK", "OTHER"] }, { key: "serviceId", label: "Servicio", type: "select" }, { key: "status", label: "Estado", type: "select", options: ["DRAFT", "PUBLISHED", "ARCHIVED"] }, { key: "tags", label: "Etiquetas (separadas por coma)" }, { key: "content", label: "Contenido", type: "textarea", span: 2 }],
    report: [{ key: "title", label: "Título" }, { key: "reportType", label: "Tipo", type: "select", options: ["SLA", "INCIDENTS", "AVAILABILITY", "CAPACITY", "CONTINUITY", "SUPPLIERS", "PERFORMANCE", "CUSTOM"] }, { key: "serviceId", label: "Servicio", type: "select" }, { key: "periodStart", label: "Inicio", type: "date" }, { key: "periodEnd", label: "Fin", type: "date" }, { key: "summary", label: "Resumen", type: "textarea", span: 2 }],
    crossLink: [{ key: "relationType", label: "Tipo" }, { key: "notes", label: "Notas", type: "textarea", span: 2 }],
  };
  const fields = fieldsByKind[kind];
  const renderSelectOptions = (field: EditorField) => {
    const dynamic = options(field.key);
    const values = dynamic ?? field.options ?? [];
    return <>{values.map((option) => <option key={option} value={option}>{dynamic ? labelFor(field.key, option) : itsmLabel(option)}</option>)}</>;
  };
  const payload = Object.fromEntries(fields.map((field) => {
    const current = form[field.key];
    if (field.type === "number") return [field.key, current === "" ? undefined : Number(current)];
    if (field.key === "tags" || field.key === "changeCodes") return [field.key, String(current ?? "").split(",").map((x) => x.trim()).filter(Boolean)];
    if (field.type === "checkbox") return [field.key, Boolean(current)];
    return [field.key, current === "" ? undefined : current];
  }));
  const valid = (ITSM_EDITOR_REQUIRED[kind] ?? []).every((key) => String(form[key] ?? "").trim().length > 0);
  return <div className="nf-modal-form nf-iso-edit-form">
    <ItsmModalError />
    <div className="nf-iso-edit-fields" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 9 }}>
      {fields.map((field) => <label key={field.key} style={{ display: "grid", gap: 4, gridColumn: field.span === 2 ? "1 / -1" : undefined, fontSize: 12, color: "#475569" }}>
        <span>{field.label}</span>
        {field.type === "textarea" ? <textarea style={{ ...input, minHeight: 70 }} value={form[field.key] ?? ""} onChange={(e) => set(field.key, e.target.value)} />
          : field.type === "select" ? <select style={input} value={form[field.key] ?? ""} onChange={(e) => set(field.key, e.target.value)}><option value="">—</option>{field.key === "userId" ? members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>) : renderSelectOptions(field)}</select>
          : field.type === "checkbox" ? <input type="checkbox" checked={Boolean(form[field.key])} onChange={(e) => set(field.key, e.target.checked)} />
          : <input style={input} type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={form[field.key] ?? ""} onChange={(e) => set(field.key, e.target.value)} />}
      </label>)}
    </div>
    <div className="nf-modal-actions nf-iso-edit-form-actions"><button type="button" className="nf-app-btn-ghost" onClick={onCancel}>Cancelar</button><button type="button" className="nf-app-btn-primary" disabled={pending || !valid} onClick={() => onSave(payload)}>Guardar cambios</button></div>
  </div>;
}

function ItsmModalError() {
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

// ─── Creation forms ───

function NewServiceForm({ pending, run, onDone }: { pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ name: "", category: "", criticality: "MEDIUM" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input style={input} placeholder="Nombre del servicio" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <input style={input} placeholder="Categoría" value={f.category} onChange={(e) => set("category", e.target.value)} />
        <select style={input} value={f.criticality} onChange={(e) => set("criticality", e.target.value)}>
          {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((c) => <option key={c} value={c}>{itsmLabel(c)}</option>)}
        </select>
      </div>
      <button disabled={pending || !f.name} style={primaryBtn} onClick={() => { run(() => createITService({ name: f.name, category: f.category || undefined, criticality: f.criticality as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function ServiceSelect({ services, value, onChange }: { services: Services; value: string; onChange: (v: string) => void }) {
  return (
    <select style={input} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Servicio…</option>
      {services.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
    </select>
  );
}

function NewCatalogEntryForm({ services, pending, run, onDone }: { services: Services; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ serviceId: "", name: "", estimatedFulfillmentHours: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 8 }}>
        <ServiceSelect services={services} value={f.serviceId} onChange={(v) => set("serviceId", v)} />
        <input style={input} placeholder="Nombre de la entrada" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <input style={input} type="number" min={0} placeholder="Horas est." value={f.estimatedFulfillmentHours} onChange={(e) => set("estimatedFulfillmentHours", e.target.value)} />
      </div>
      <button disabled={pending || !f.serviceId || !f.name} style={primaryBtn} onClick={() => { run(() => createServiceCatalogEntry({ serviceId: f.serviceId, name: f.name, requestable: true, estimatedFulfillmentHours: f.estimatedFulfillmentHours ? Number(f.estimatedFulfillmentHours) : undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewOwnerForm({ services, members, pending, run, onDone }: { services: Services; members: Members; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ serviceId: "", userId: "", ownerName: "", ownershipRole: "PRIMARY" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        <ServiceSelect services={services} value={f.serviceId} onChange={(v) => set("serviceId", v)} />
        <select style={input} value={f.userId} onChange={(e) => set("userId", e.target.value)}>
          <option value="">Miembro…</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <input style={input} placeholder="Nombre (si no es miembro)" value={f.ownerName} onChange={(e) => set("ownerName", e.target.value)} />
        <select style={input} value={f.ownershipRole} onChange={(e) => set("ownershipRole", e.target.value)}>
          {["PRIMARY", "BACKUP", "DELEGATE"].map((r) => <option key={r} value={r}>{itsmLabel(r)}</option>)}
        </select>
      </div>
      <button disabled={pending || !f.serviceId || (!f.userId && !f.ownerName)} style={primaryBtn} onClick={() => { run(() => createServiceOwner({ serviceId: f.serviceId, userId: f.userId || undefined, ownerName: f.ownerName || undefined, ownershipRole: f.ownershipRole as "PRIMARY" | "BACKUP" | "DELEGATE" })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewSlaForm({ services, pending, run, onDone }: { services: Services; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ serviceId: "", name: "", priority: "MEDIUM", responseTimeMinutes: "15", resolutionTimeMinutes: "240", availabilityTargetPct: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 8 }}>
        <ServiceSelect services={services} value={f.serviceId} onChange={(v) => set("serviceId", v)} />
        <input style={input} placeholder="Nombre del SLA" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <select style={input} value={f.priority} onChange={(e) => set("priority", e.target.value)}>
          {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => <option key={p} value={p}>{itsmLabel(p)}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <input style={input} type="number" min={1} placeholder="Respuesta (min)" value={f.responseTimeMinutes} onChange={(e) => set("responseTimeMinutes", e.target.value)} />
        <input style={input} type="number" min={1} placeholder="Resolución (min)" value={f.resolutionTimeMinutes} onChange={(e) => set("resolutionTimeMinutes", e.target.value)} />
        <input style={input} type="number" min={0} max={100} placeholder="Disponibilidad objetivo %" value={f.availabilityTargetPct} onChange={(e) => set("availabilityTargetPct", e.target.value)} />
      </div>
      <button disabled={pending || !f.serviceId || !f.name} style={primaryBtn} onClick={() => { run(() => createServiceLevelAgreement({ serviceId: f.serviceId, name: f.name, priority: f.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL", responseTimeMinutes: Number(f.responseTimeMinutes), resolutionTimeMinutes: Number(f.resolutionTimeMinutes), availabilityTargetPct: f.availabilityTargetPct ? Number(f.availabilityTargetPct) : undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewOlaForm({ services, slas, pending, run, onDone }: { services: Services; slas: ItsmPayload["slas"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ serviceId: "", slaId: "", name: "", supportingTeam: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr 1fr", gap: 8 }}>
        <ServiceSelect services={services} value={f.serviceId} onChange={(v) => set("serviceId", v)} />
        <select style={input} value={f.slaId} onChange={(e) => set("slaId", e.target.value)}>
          <option value="">SLA (opcional)…</option>
          {slas.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
        </select>
        <input style={input} placeholder="Nombre del OLA" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <input style={input} placeholder="Equipo de soporte" value={f.supportingTeam} onChange={(e) => set("supportingTeam", e.target.value)} />
      </div>
      <button disabled={pending || !f.serviceId || !f.name} style={primaryBtn} onClick={() => { run(() => createOperationalLevelAgreement({ serviceId: f.serviceId, slaId: f.slaId || undefined, name: f.name, supportingTeam: f.supportingTeam || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewRequestForm({ services, catalog, members, pending, run, onDone }: { services: Services; catalog: ItsmPayload["catalog"]; members: Members; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", serviceId: "", catalogEntryId: "", assigneeId: "", priority: "MEDIUM" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input style={input} placeholder="Título de la solicitud" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <ServiceSelect services={services} value={f.serviceId} onChange={(v) => set("serviceId", v)} />
        <select style={input} value={f.catalogEntryId} onChange={(e) => set("catalogEntryId", e.target.value)}>
          <option value="">Entrada de catálogo…</option>
          {catalog.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <select style={input} value={f.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}>
          <option value="">Asignar a…</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select style={input} value={f.priority} onChange={(e) => set("priority", e.target.value)}>
          {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => <option key={p} value={p}>{itsmLabel(p)}</option>)}
        </select>
      </div>
      <button disabled={pending || !f.title} style={primaryBtn} onClick={() => { run(() => createServiceRequest({ title: f.title, serviceId: f.serviceId || undefined, catalogEntryId: f.catalogEntryId || undefined, assigneeId: f.assigneeId || undefined, priority: f.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewIncidentForm({ services, slas, members, pending, run, onDone }: { services: Services; slas: ItsmPayload["slas"]; members: Members; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", description: "", serviceId: "", slaId: "", assigneeId: "", priority: "MEDIUM", impact: "MEDIUM", urgency: "MEDIUM" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input style={input} placeholder="Título del incidente" value={f.title} onChange={(e) => set("title", e.target.value)} />
      <input style={input} placeholder="Descripción" value={f.description} onChange={(e) => set("description", e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <ServiceSelect services={services} value={f.serviceId} onChange={(v) => set("serviceId", v)} />
        <select style={input} value={f.slaId} onChange={(e) => set("slaId", e.target.value)}>
          <option value="">SLA…</option>
          {slas.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
        </select>
        <select style={input} value={f.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}>
          <option value="">Asignar a…</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <select style={input} value={f.priority} onChange={(e) => set("priority", e.target.value)}>
          {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => <option key={p} value={p}>Prioridad: {p}</option>)}
        </select>
        <select style={input} value={f.impact} onChange={(e) => set("impact", e.target.value)}>
          {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => <option key={p} value={p}>Impacto: {p}</option>)}
        </select>
        <select style={input} value={f.urgency} onChange={(e) => set("urgency", e.target.value)}>
          {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => <option key={p} value={p}>Urgencia: {p}</option>)}
        </select>
      </div>
      <button disabled={pending || !f.title} style={primaryBtn} onClick={() => { run(() => createItsmIncident({ title: f.title, description: f.description || undefined, serviceId: f.serviceId || undefined, slaId: f.slaId || undefined, assigneeId: f.assigneeId || undefined, priority: f.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL", impact: f.impact as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL", urgency: f.urgency as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewCrossLinkForm({ incidents, options, pending, run, onDone }: {
  incidents: ItsmPayload["incidents"]; options: ItsmPayload["crossLinkOptions"]; pending: boolean; run: Runner; onDone: () => void;
}) {
  const [f, setF] = useState({ itsmIncidentId: "", targetDomain: "SECURITY" as "SECURITY" | "AI" | "OCCUPATIONAL", targetId: "", relationType: "" });
  const set = <K extends keyof typeof f>(k: K, v: typeof f[K]) => setF((p) => ({ ...p, [k]: v }));
  const domainOptions = options[f.targetDomain] ?? [];
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 8 }}>
        <select style={input} value={f.itsmIncidentId} onChange={(e) => set("itsmIncidentId", e.target.value)}>
          <option value="">Incidente ITSM…</option>
          {incidents.map((i) => <option key={i.id} value={i.id}>{i.code}</option>)}
        </select>
        <select style={input} value={f.targetDomain} onChange={(e) => { set("targetDomain", e.target.value as "SECURITY" | "AI" | "OCCUPATIONAL"); set("targetId", ""); }}>
          <option value="SECURITY">Seguridad (ISO 27001)</option>
          <option value="AI">IA (ISO/IEC 42001)</option>
          <option value="OCCUPATIONAL">Laboral (ISO 45001)</option>
        </select>
        <select style={input} value={f.targetId} onChange={(e) => set("targetId", e.target.value)}>
          <option value="">Incidente relacionado…</option>
          {domainOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>
      <input style={input} placeholder="Tipo de relación (opcional, ej. 'causado por')" value={f.relationType} onChange={(e) => set("relationType", e.target.value)} />
      <button disabled={pending || !f.itsmIncidentId || !f.targetId} style={primaryBtn} onClick={() => { run(() => linkItsmIncidentCrossDomain({ itsmIncidentId: f.itsmIncidentId, targetDomain: f.targetDomain, targetId: f.targetId, relationType: f.relationType || undefined })); onDone(); }}><Plus size={12} /> Vincular</button>
    </div>
  );
}

function NewProblemForm({ services, members, pending, run, onDone }: { services: Services; members: Members; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", serviceId: "", assigneeId: "", workaround: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input style={input} placeholder="Título del problema" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <ServiceSelect services={services} value={f.serviceId} onChange={(v) => set("serviceId", v)} />
        <select style={input} value={f.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}>
          <option value="">Asignar a…</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <input style={input} placeholder="Workaround (opcional)" value={f.workaround} onChange={(e) => set("workaround", e.target.value)} />
      <button disabled={pending || !f.title} style={primaryBtn} onClick={() => { run(() => createItsmProblem({ title: f.title, serviceId: f.serviceId || undefined, assigneeId: f.assigneeId || undefined, workaround: f.workaround || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewKnownErrorForm({ problems, pending, run, onDone }: { problems: ItsmPayload["problems"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", problemId: "", workaround: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <input style={input} placeholder="Título del error conocido" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <select style={input} value={f.problemId} onChange={(e) => set("problemId", e.target.value)}>
          <option value="">Problema (opcional)…</option>
          {problems.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
        </select>
      </div>
      <input style={input} placeholder="Workaround" value={f.workaround} onChange={(e) => set("workaround", e.target.value)} />
      <button disabled={pending || !f.title} style={primaryBtn} onClick={() => { run(() => createKnownError({ title: f.title, problemId: f.problemId || undefined, workaround: f.workaround || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewChangeForm({ services, pending, run, onDone }: { services: Services; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", serviceId: "", changeType: "NORMAL", riskLevel: "MEDIUM" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8 }}>
        <input style={input} placeholder="Título del cambio" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <ServiceSelect services={services} value={f.serviceId} onChange={(v) => set("serviceId", v)} />
        <select style={input} value={f.changeType} onChange={(e) => set("changeType", e.target.value)}>
          {["STANDARD", "NORMAL", "EMERGENCY"].map((c) => <option key={c} value={c}>{itsmLabel(c)}</option>)}
        </select>
        <select style={input} value={f.riskLevel} onChange={(e) => set("riskLevel", e.target.value)}>
          {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((c) => <option key={c} value={c}>Riesgo: {itsmLabel(c)}</option>)}
        </select>
      </div>
      <button disabled={pending || !f.title} style={primaryBtn} onClick={() => { run(() => createItsmChange({ title: f.title, serviceId: f.serviceId || undefined, changeType: f.changeType as "STANDARD" | "NORMAL" | "EMERGENCY", riskLevel: f.riskLevel as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL", impact: "MEDIUM" })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewReleaseForm({ services, pending, run, onDone }: { services: Services; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", version: "", serviceId: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input style={input} placeholder="Título del release" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <input style={input} placeholder="Versión" value={f.version} onChange={(e) => set("version", e.target.value)} />
        <ServiceSelect services={services} value={f.serviceId} onChange={(v) => set("serviceId", v)} />
      </div>
      <button disabled={pending || !f.title || !f.version} style={primaryBtn} onClick={() => { run(() => createRelease({ title: f.title, version: f.version, serviceId: f.serviceId || undefined, changeCodes: [] })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewDeploymentForm({ releases, cis, pending, run, onDone }: { releases: ItsmPayload["releases"]; cis: ItsmPayload["cis"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ releaseId: "", environment: "PROD", configurationItemId: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <select style={input} value={f.releaseId} onChange={(e) => set("releaseId", e.target.value)}>
          <option value="">Release…</option>
          {releases.map((r) => <option key={r.id} value={r.id}>{r.code} · {r.version}</option>)}
        </select>
        <select style={input} value={f.environment} onChange={(e) => set("environment", e.target.value)}>
          {["DEV", "TEST", "STAGING", "PROD"].map((e2) => <option key={e2} value={e2}>{itsmLabel(e2)}</option>)}
        </select>
        <select style={input} value={f.configurationItemId} onChange={(e) => set("configurationItemId", e.target.value)}>
          <option value="">CI (opcional)…</option>
          {cis.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
        </select>
      </div>
      <button disabled={pending || !f.releaseId} style={primaryBtn} onClick={() => { run(() => createDeployment({ releaseId: f.releaseId, environment: f.environment as "DEV" | "TEST" | "STAGING" | "PROD", configurationItemId: f.configurationItemId || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewCiForm({ services, members, pending, run, onDone }: { services: Services; members: Members; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ name: "", ciType: "OTHER", serviceId: "", ownerId: "", criticality: "MEDIUM" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input style={input} placeholder="Nombre del CI" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <select style={input} value={f.ciType} onChange={(e) => set("ciType", e.target.value)}>
          {["APPLICATION", "SERVER", "DATABASE", "NETWORK", "SERVICE", "DOCUMENTATION", "OTHER"].map((c) => <option key={c} value={c}>{itsmLabel(c)}</option>)}
        </select>
        <select style={input} value={f.criticality} onChange={(e) => set("criticality", e.target.value)}>
          {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((c) => <option key={c} value={c}>{itsmLabel(c)}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <ServiceSelect services={services} value={f.serviceId} onChange={(v) => set("serviceId", v)} />
        <select style={input} value={f.ownerId} onChange={(e) => set("ownerId", e.target.value)}>
          <option value="">Propietario…</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <button disabled={pending || !f.name} style={primaryBtn} onClick={() => { run(() => createConfigurationItem({ name: f.name, ciType: f.ciType as "APPLICATION" | "SERVER" | "DATABASE" | "NETWORK" | "SERVICE" | "DOCUMENTATION" | "OTHER", serviceId: f.serviceId || undefined, ownerId: f.ownerId || undefined, criticality: f.criticality as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewCmdbRelForm({ cis, pending, run, onDone }: { cis: ItsmPayload["cis"]; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ sourceCiId: "", targetCiId: "", relationType: "DEPENDS_ON" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <select style={input} value={f.sourceCiId} onChange={(e) => set("sourceCiId", e.target.value)}>
          <option value="">CI origen…</option>
          {cis.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
        </select>
        <select style={input} value={f.relationType} onChange={(e) => set("relationType", e.target.value)}>
          {["DEPENDS_ON", "RUNS_ON", "CONNECTS_TO", "USES", "OWNED_BY", "OTHER"].map((r) => <option key={r} value={r}>{itsmLabel(r)}</option>)}
        </select>
        <select style={input} value={f.targetCiId} onChange={(e) => set("targetCiId", e.target.value)}>
          <option value="">CI destino…</option>
          {cis.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
        </select>
      </div>
      <button disabled={pending || !f.sourceCiId || !f.targetCiId} style={primaryBtn} onClick={() => { run(() => createCmdbRelationship({ sourceCiId: f.sourceCiId, targetCiId: f.targetCiId, relationType: f.relationType as "DEPENDS_ON" | "RUNS_ON" | "CONNECTS_TO" | "USES" | "OWNED_BY" | "OTHER" })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewAvailabilityForm({ services, pending, run, onDone }: { services: Services; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ serviceId: "", title: "", targetPercent: "99.9", agreedDowntimeMinutes: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr", gap: 8 }}>
        <ServiceSelect services={services} value={f.serviceId} onChange={(v) => set("serviceId", v)} />
        <input style={input} placeholder="Título" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <input style={input} type="number" min={0} max={100} step="0.01" placeholder="Objetivo %" value={f.targetPercent} onChange={(e) => set("targetPercent", e.target.value)} />
        <input style={input} type="number" min={0} placeholder="Downtime acordado (min)" value={f.agreedDowntimeMinutes} onChange={(e) => set("agreedDowntimeMinutes", e.target.value)} />
      </div>
      <button disabled={pending || !f.serviceId || !f.title} style={primaryBtn} onClick={() => { run(() => createAvailabilityPlan({ serviceId: f.serviceId, title: f.title, targetPercent: Number(f.targetPercent), agreedDowntimeMinutes: f.agreedDowntimeMinutes ? Number(f.agreedDowntimeMinutes) : undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewCapacityForm({ services, pending, run, onDone }: { services: Services; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ serviceId: "", title: "", metric: "", currentCapacity: "", thresholdPercent: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 8 }}>
        <ServiceSelect services={services} value={f.serviceId} onChange={(v) => set("serviceId", v)} />
        <input style={input} placeholder="Título" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <input style={input} placeholder="Métrica (ej. buzones)" value={f.metric} onChange={(e) => set("metric", e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input style={input} type="number" min={0} placeholder="Capacidad actual" value={f.currentCapacity} onChange={(e) => set("currentCapacity", e.target.value)} />
        <input style={input} type="number" min={0} max={100} placeholder="Umbral %" value={f.thresholdPercent} onChange={(e) => set("thresholdPercent", e.target.value)} />
      </div>
      <button disabled={pending || !f.serviceId || !f.title || !f.metric} style={primaryBtn} onClick={() => { run(() => createCapacityPlan({ serviceId: f.serviceId, title: f.title, metric: f.metric, currentCapacity: f.currentCapacity ? Number(f.currentCapacity) : undefined, thresholdPercent: f.thresholdPercent ? Number(f.thresholdPercent) : undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewContinuityForm({ services, pending, run, onDone }: { services: Services; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ serviceId: "", title: "", rtoMinutes: "", rpoMinutes: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr", gap: 8 }}>
        <ServiceSelect services={services} value={f.serviceId} onChange={(v) => set("serviceId", v)} />
        <input style={input} placeholder="Título" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <input style={input} type="number" min={0} placeholder="RTO (min)" value={f.rtoMinutes} onChange={(e) => set("rtoMinutes", e.target.value)} />
        <input style={input} type="number" min={0} placeholder="RPO (min)" value={f.rpoMinutes} onChange={(e) => set("rpoMinutes", e.target.value)} />
      </div>
      <button disabled={pending || !f.serviceId || !f.title} style={primaryBtn} onClick={() => { run(() => createServiceContinuityPlan({ serviceId: f.serviceId, title: f.title, rtoMinutes: f.rtoMinutes ? Number(f.rtoMinutes) : undefined, rpoMinutes: f.rpoMinutes ? Number(f.rpoMinutes) : undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewSupplierForm({ services, pending, run, onDone }: { services: Services; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ name: "", serviceId: "", contractRef: "", criticality: "MEDIUM" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8 }}>
        <input style={input} placeholder="Nombre del proveedor" value={f.name} onChange={(e) => set("name", e.target.value)} />
        <ServiceSelect services={services} value={f.serviceId} onChange={(v) => set("serviceId", v)} />
        <input style={input} placeholder="Contrato" value={f.contractRef} onChange={(e) => set("contractRef", e.target.value)} />
        <select style={input} value={f.criticality} onChange={(e) => set("criticality", e.target.value)}>
          {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((c) => <option key={c} value={c}>{itsmLabel(c)}</option>)}
        </select>
      </div>
      <button disabled={pending || !f.name} style={primaryBtn} onClick={() => { run(() => createServiceSupplier({ name: f.name, serviceId: f.serviceId || undefined, contractRef: f.contractRef || undefined, criticality: f.criticality as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewArticleForm({ services, pending, run, onDone }: { services: Services; pending: boolean; run: Runner; onDone: () => void }) {
  const [f, setF] = useState({ title: "", category: "HOWTO", content: "", serviceId: "", publish: false });
  const set = <K extends keyof typeof f>(k: K, v: typeof f[K]) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input style={input} placeholder="Título del artículo" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <select style={input} value={f.category} onChange={(e) => set("category", e.target.value)}>
          {["HOWTO", "KNOWN_ERROR", "FAQ", "RUNBOOK", "OTHER"].map((c) => <option key={c} value={c}>{itsmLabel(c)}</option>)}
        </select>
        <ServiceSelect services={services} value={f.serviceId} onChange={(v) => set("serviceId", v)} />
      </div>
      <textarea style={{ ...input, minHeight: 70 }} placeholder="Contenido" value={f.content} onChange={(e) => set("content", e.target.value)} />
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
        <input type="checkbox" checked={f.publish} onChange={(e) => set("publish", e.target.checked)} /> Publicar de inmediato
      </label>
      <button disabled={pending || !f.title || !f.content} style={primaryBtn} onClick={() => { run(() => createKnowledgeArticle({ title: f.title, category: f.category as "HOWTO" | "KNOWN_ERROR" | "FAQ" | "RUNBOOK" | "OTHER", content: f.content, serviceId: f.serviceId || undefined, publish: f.publish, tags: [] })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}

function NewReportForm({ services, pending, run, onDone }: { services: Services; pending: boolean; run: Runner; onDone: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ title: "", reportType: "PERFORMANCE", serviceId: "", periodStart: today, periodEnd: today, summary: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input style={input} placeholder="Título del informe" value={f.title} onChange={(e) => set("title", e.target.value)} />
        <select style={input} value={f.reportType} onChange={(e) => set("reportType", e.target.value)}>
          {["SLA", "INCIDENTS", "AVAILABILITY", "CAPACITY", "CONTINUITY", "SUPPLIERS", "PERFORMANCE", "CUSTOM"].map((r) => <option key={r} value={r}>{itsmLabel(r)}</option>)}
        </select>
        <ServiceSelect services={services} value={f.serviceId} onChange={(v) => set("serviceId", v)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input style={input} type="date" value={f.periodStart} onChange={(e) => set("periodStart", e.target.value)} />
        <input style={input} type="date" value={f.periodEnd} onChange={(e) => set("periodEnd", e.target.value)} />
      </div>
      <input style={input} placeholder="Resumen (opcional)" value={f.summary} onChange={(e) => set("summary", e.target.value)} />
      <button disabled={pending || !f.title} style={primaryBtn} onClick={() => { run(() => createServiceReport({ title: f.title, reportType: f.reportType as "SLA" | "INCIDENTS" | "AVAILABILITY" | "CAPACITY" | "CONTINUITY" | "SUPPLIERS" | "PERFORMANCE" | "CUSTOM", serviceId: f.serviceId || undefined, periodStart: f.periodStart, periodEnd: f.periodEnd, summary: f.summary || undefined })); onDone(); }}><Plus size={12} /> Crear</button>
    </div>
  );
}
