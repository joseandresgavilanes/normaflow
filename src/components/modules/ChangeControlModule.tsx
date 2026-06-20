"use client";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import AttestationModal from "@/components/compliance/AttestationModal";
import AuditTimeline from "@/components/compliance/AuditTimeline";
import { useWorkspace, type ChangeRequestRow } from "@/context/WorkspaceStore";
import { processesLinkedToChange } from "@/lib/process-linking";
import { useCreateFromQuery } from "@/hooks/useCreateFromQuery";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import { AUDIT_ACTIONS, createAuditEvent } from "@/lib/domain/audit-event";
import {
  changeCategoryOptions,
  changeTypeOptions,
  DEFAULT_CHANGE_CATEGORY,
  DEFAULT_CHANGE_TYPE,
} from "@/lib/change-control-catalog";

const FLOW: ChangeRequestRow["status"][] = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "IMPLEMENTED",
  "VERIFIED",
  "CLOSED",
];

function statusLabel(s: ChangeRequestRow["status"]) {
  const m: Record<string, string> = {
    DRAFT: "Borrador",
    SUBMITTED: "Enviado",
    UNDER_REVIEW: "En revisión",
    APPROVED: "Aprobado",
    REJECTED: "Rechazado",
    IMPLEMENTED: "Implementado",
    VERIFIED: "Verificado",
    CLOSED: "Cerrado",
  };
  return m[s] ?? s;
}

export default function ChangeControlModule() {
  const { state, dispatch, showToast, nextChangeCode } = useWorkspace();
  const perm = useDemoPermission();
  const { changeRequests, auditEvents, documents, trainingCourses, processes } = state;
  const [detail, setDetail] = useState<ChangeRequestRow | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [attest, setAttest] = useState<{ mode: "APPROVE" | "REJECT" | "CLOSE"; id: string } | null>(null);
  const [form, setForm] = useState<{
    title: string;
    category: string;
    changeType: string;
    reason: string;
    impact: ChangeRequestRow["impact"];
    processCodes: string[];
  }>({
    title: "",
    category: DEFAULT_CHANGE_CATEGORY,
    changeType: DEFAULT_CHANGE_TYPE,
    reason: "",
    impact: "MEDIUM",
    processCodes: [],
  });
  const [processCodesDraft, setProcessCodesDraft] = useState<string[]>([]);

  const filtered = filter === "ALL" ? changeRequests : changeRequests.filter(c => c.status === filter);
  const detailLive = detail ? changeRequests.find(c => c.id === detail.id) ?? detail : null;
  const changeEvents = useMemo(() => auditEvents.filter(e => e.entityType === "CHANGE_REQUEST" || e.action === "CHANGE_STATUS"), [auditEvents]);
  const linkedProcesses = useMemo(
    () => (detailLive ? processesLinkedToChange(detailLive, processes) : []),
    [detailLive, processes],
  );

  useEffect(() => {
    if (detailLive) setProcessCodesDraft([...detailLive.processCodes]);
  }, [detailLive?.id, detailLive?.processCodes]);

  function toggleProcessCode(code: string) {
    setProcessCodesDraft(prev => (prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]));
  }

  function saveProcessLinks() {
    if (!detailLive) return;
    dispatch({ type: "updateChangeRequest", id: detailLive.id, patch: { processCodes: processCodesDraft } });
    showToast("Procesos vinculados actualizados");
    setDetail(null);
  }

  function logChange(id: string, label: string, oldS: string, newS: string, reason?: string) {
    dispatch({
      type: "appendAudit",
      event: createAuditEvent({
        ts: new Date().toISOString(),
        actorName: state.session.name,
        actorEmail: state.session.email,
        action: AUDIT_ACTIONS.CHANGE_STATUS,
        entityType: "CHANGE_REQUEST",
        entityId: id,
        entityLabel: label,
        oldValue: oldS,
        newValue: newS,
        reason,
      }),
    });
  }

  function transition(
    c: ChangeRequestRow,
    next: ChangeRequestRow["status"],
    reason?: string,
    options?: { closeDetail?: boolean },
  ) {
    const prev = c.status;
    dispatch({ type: "updateChangeRequest", id: c.id, patch: { status: next } });
    logChange(c.id, c.code, prev, next, reason);
    setDetail(d => (d?.id === c.id ? { ...d, status: next } : d));
    showToast(`Estado: ${statusLabel(next)}`);
    if (options?.closeDetail) setDetail(null);
  }

  function submitCreate() {
    if (!form.title.trim() || !form.reason.trim()) {
      showToast("Título y motivo son obligatorios");
      return;
    }
    const code = nextChangeCode();
    const id = `${state.session.activeOrgId}-cr-${Date.now()}`;
    const t = new Date().toISOString().slice(0, 10);
    const row: ChangeRequestRow = {
      id,
      code,
      title: form.title.trim(),
      category: form.category,
      changeType: form.changeType,
      reason: form.reason.trim(),
      impact: form.impact,
      affectedAreas: [],
      documentIds: [],
      processCodes: form.processCodes,
      riskCodes: [],
      trainingCourseIds: [],
      approvers: ["Ana García"],
      status: "DRAFT",
      evidenceIds: [],
      tasks: [{ id: "n1", title: "Evaluar impacto en documentación", done: false }],
      requesterName: state.session.name,
      createdAt: t,
      updatedAt: t,
    };
    dispatch({ type: "addChangeRequest", row });
    dispatch({
      type: "appendAudit",
      event: createAuditEvent({
        ts: new Date().toISOString(),
        actorName: state.session.name,
        actorEmail: state.session.email,
        action: AUDIT_ACTIONS.CHANGE_CREATED,
        entityType: "CHANGE_REQUEST",
        entityId: id,
        entityLabel: code,
      }),
    });
    setCreateOpen(false);
    setForm({ title: "", category: DEFAULT_CHANGE_CATEGORY, changeType: DEFAULT_CHANGE_TYPE, reason: "", impact: "MEDIUM", processCodes: [] });
    showToast("Solicitud de cambio creada");
  }

  function applyAttestation({ reason, attestationAt }: { reason: string; attestationAt: string }) {
    if (!detailLive || !attest) return;
    const c = detailLive;
    if (attest.mode === "APPROVE") {
      transition(c, "APPROVED", reason);
      dispatch({
        type: "appendAudit",
        event: createAuditEvent({
          ts: attestationAt,
          actorName: state.session.name,
          actorEmail: state.session.email,
          action: "CHANGE_APPROVED_ATTESTED",
          entityType: "CHANGE_REQUEST",
          entityId: c.id,
          entityLabel: c.code,
          reason,
          attestation: {
            method: "E_SIGN_SIMULATED",
            statement: "Aprobación formal registrada con reconfirmación de identidad",
            confirmedAt: attestationAt,
          },
        }),
      });
    } else if (attest.mode === "REJECT") {
      transition(c, "REJECTED", reason);
    } else {
      transition(c, "CLOSED", reason);
      dispatch({
        type: "appendAudit",
        event: createAuditEvent({
          ts: attestationAt,
          actorName: state.session.name,
          actorEmail: state.session.email,
          action: "CHANGE_CLOSED_ATTESTED",
          entityType: "CHANGE_REQUEST",
          entityId: c.id,
          entityLabel: c.code,
          reason,
          attestation: {
            method: "E_SIGN_SIMULATED",
            statement: "Cierre formal del cambio",
            confirmedAt: attestationAt,
          },
        }),
      });
    }
    setAttest(null);
    setDetail(null);
  }

  useCreateFromQuery(perm.changes.manage, () => setCreateOpen(true));

  return (
    <div>
      <SectionTitle
        title="Control de cambios"
        sub="Evaluación de impacto, aprobadores, tareas, evidencias y trazabilidad completa"
        action={perm.changes.manage ? "+ Nueva solicitud" : undefined}
        onAction={perm.changes.manage ? () => setCreateOpen(true) : undefined}
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span className="nf-filter-label" style={{ marginRight: 4 }}>
          Estado
        </span>
        {["ALL", "DRAFT", "UNDER_REVIEW", "APPROVED", "IMPLEMENTED", "CLOSED", "REJECTED"].map(s => (
          <button
            key={s}
            type="button"
            className={filter === s ? "nf-chip nf-chip--on" : "nf-chip"}
            onClick={() => setFilter(s)}
          >
            {s === "ALL" ? "Todos" : statusLabel(s as ChangeRequestRow["status"])}
          </button>
        ))}
      </div>

      <Card style={{ padding: 0, marginBottom: 20, overflow: "hidden" }}>
        <div className="nf-data-table-wrap" style={{ border: "none", boxShadow: "none", borderRadius: 0 }}>
          <table className="nf-data-table" style={{ fontSize: 14 }}>
            <thead>
              <tr>
                <th>Código</th>
                <th>Título</th>
                <th>Impacto</th>
                <th>Estado</th>
                <th>Solicitante</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr
                  key={c.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => setDetail(c)}
                >
                  <td style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600, color: "#5266F6" }}>{c.code}</td>
                  <td style={{ fontWeight: 600, color: "var(--nf-ink)" }}>{c.title}</td>
                  <td style={{ fontWeight: 600, color: "var(--nf-ink-2)" }}>{c.impact}</td>
                  <td>
                    <Badge
                      status={c.status === "CLOSED" || c.status === "VERIFIED" ? "ON_TRACK" : c.status === "REJECTED" ? "OFF_TRACK" : "AT_RISK"}
                      label={statusLabel(c.status)}
                    />
                  </td>
                  <td style={{ fontWeight: 600, color: "var(--nf-ink-2)" }}>{c.requesterName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 600, color: "var(--nf-ink)", letterSpacing: "-0.02em" }}>Flujo de estados (referencia)</h3>
        <div className="nf-app-help" style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", fontWeight: 600 }}>
          {FLOW.map((s, i) => (
            <span key={s}>
              {statusLabel(s)}
              {i < FLOW.length - 1 ? " → " : ""}
            </span>
          ))}
          <span style={{ color: "var(--nf-ink)" }}>· Rechazo desde revisión</span>
        </div>
      </Card>

      <Modal open={!!detailLive} onClose={() => setDetail(null)} title={detailLive ? `${detailLive.code} · ${detailLive.title}` : ""} width={640}>
        {detailLive && (
          <div>
            <p className="nf-app-help" style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.65, color: "var(--nf-ink)" }}>{detailLive.reason}</p>
            <div className="nf-grid-2" style={{ gap: 12, marginBottom: 18, fontSize: 13, fontWeight: 600, color: "var(--nf-ink-2)" }}>
              <div>
                <span style={{ color: "var(--nf-ink)", fontWeight: 600 }}>Categoría</span> {detailLive.category}
              </div>
              <div>
                <span style={{ color: "var(--nf-ink)", fontWeight: 600 }}>Tipo</span> {detailLive.changeType}
              </div>
              <div>
                <span style={{ color: "var(--nf-ink)", fontWeight: 600 }}>Aprobadores</span> {detailLive.approvers.join(", ")}
              </div>
              <div>
                <span style={{ color: "var(--nf-ink)", fontWeight: 600 }}>NC vinculada</span>{" "}
                {detailLive.ncId ? <Link href="/app/nonconformities">{detailLive.ncId}</Link> : "—"}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div className="nf-filter-label" style={{ display: "block", marginBottom: 8 }}>
                Documentos afectados
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {detailLive.documentIds.length === 0 ? (
                  <span className="nf-app-help" style={{ fontWeight: 600 }}>Ninguno enlazado</span>
                ) : (
                  detailLive.documentIds.map(did => {
                    const d = documents.find(x => x.id === did);
                    return (
                      <Link key={did} href="/app/documents" style={{ fontSize: 13, fontWeight: 700, color: "#5266F6" }}>
                        {d?.code ?? did}
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div className="nf-filter-label" style={{ display: "block", marginBottom: 8 }}>
                Procesos asociados
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                {processes.map(p => (
                  <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--nf-ink)" }}>
                    <input
                      type="checkbox"
                      checked={processCodesDraft.includes(p.code)}
                      disabled={!perm.changes.manage}
                      onChange={() => toggleProcessCode(p.code)}
                    />
                    <span style={{ fontWeight: 600, color: "#5266F6" }}>{p.code}</span> — {p.name}
                  </label>
                ))}
              </div>
              {perm.changes.manage && (
                <button type="button" onClick={saveProcessLinks} className="nf-app-btn-primary nf-app-btn-sm">
                  Guardar procesos vinculados
                </button>
              )}
              {linkedProcesses.length > 0 && (
                <p className="nf-app-help" style={{ margin: "10px 0 0", fontWeight: 600 }}>
                  En mapa: {linkedProcesses.map(p => p.code).join(", ")}
                </p>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <div className="nf-filter-label" style={{ display: "block", marginBottom: 8 }}>
                Riesgos / formación
              </div>
              <p className="nf-app-help" style={{ margin: 0, fontWeight: 600 }}>
                Riesgos: {detailLive.riskCodes.join(", ") || "—"} · Cursos:{" "}
                {detailLive.trainingCourseIds.map(id => trainingCourses.find(t => t.id === id)?.code ?? id).join(", ") || "—"}
              </p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div className="nf-filter-label" style={{ display: "block", marginBottom: 10 }}>
                Tareas derivadas
              </div>
              {detailLive.tasks.map(t => (
                <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--nf-ink)", marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={t.done}
                    disabled={!perm.changes.manage}
                    onChange={() => {
                      const tasks = detailLive.tasks.map(x => (x.id === t.id ? { ...x, done: !x.done } : x));
                      dispatch({ type: "updateChangeRequest", id: detailLive.id, patch: { tasks } });
                      setDetail({ ...detailLive, tasks });
                    }}
                  />
                  {t.title}
                </label>
              ))}
            </div>
            {perm.changes.manage && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, borderTop: "1px solid var(--nf-line)", paddingTop: 16 }}>
                {detailLive.status === "DRAFT" && (
                  <button type="button" onClick={() => transition(detailLive, "SUBMITTED", undefined, { closeDetail: true })} className="nf-app-btn-primary">
                    Enviar a revisión
                  </button>
                )}
                {detailLive.status === "SUBMITTED" && (
                  <button type="button" onClick={() => transition(detailLive, "UNDER_REVIEW", undefined, { closeDetail: true })} className="nf-app-btn-primary">
                    Marcar en revisión
                  </button>
                )}
                {detailLive.status === "UNDER_REVIEW" && (
                  <>
                    <button type="button" onClick={() => setAttest({ mode: "APPROVE", id: detailLive.id })} className="nf-app-btn-success">
                      Aprobar (con firma simulada)
                    </button>
                    <button type="button" onClick={() => setAttest({ mode: "REJECT", id: detailLive.id })} className="nf-app-btn-danger">
                      Rechazar (con motivo)
                    </button>
                  </>
                )}
                {detailLive.status === "APPROVED" && (
                  <button type="button" onClick={() => transition(detailLive, "IMPLEMENTED", undefined, { closeDetail: true })} className="nf-app-btn-primary">
                    Marcar implementado
                  </button>
                )}
                {detailLive.status === "IMPLEMENTED" && (
                  <button type="button" onClick={() => transition(detailLive, "VERIFIED", undefined, { closeDetail: true })} className="nf-app-btn-primary">
                    Verificar efectividad
                  </button>
                )}
                {detailLive.status === "VERIFIED" && (
                  <button type="button" onClick={() => setAttest({ mode: "CLOSE", id: detailLive.id })} className="nf-app-btn-success">
                    Cerrar cambio (firma simulada)
                  </button>
                )}
              </div>
            )}
            <div style={{ marginTop: 20 }}>
              <div className="nf-filter-label" style={{ display: "block", marginBottom: 10 }}>
                Historial en registro
              </div>
              <AuditTimeline events={changeEvents.filter(e => e.entityId === detailLive.id)} max={20} emptyText="Sin eventos para este cambio." />
            </div>
          </div>
        )}
      </Modal>

      <AttestationModal
        open={!!attest}
        onClose={() => setAttest(null)}
        title={attest?.mode === "APPROVE" ? "Aprobar cambio" : attest?.mode === "REJECT" ? "Rechazar cambio" : "Cerrar cambio"}
        statement={
          attest?.mode === "APPROVE"
            ? "Certifica que ha revisado el impacto del cambio y autoriza su implementación según el procedimiento de gestión de cambios."
            : attest?.mode === "REJECT"
              ? "Registre el rechazo formal de la solicitud. Quedará auditado."
              : "Cierre formal del ciclo de cambio tras verificación."
        }
        sessionEmail={state.session.email}
        onConfirm={applyAttestation}
      />

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nueva solicitud de cambio" width={520}>
        <div className="nf-modal-form">
        <label>Título
        <input
          value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })}
          className="nf-app-input"
        />
        </label>
        <div className="nf-grid-2" style={{ gap: 12 }}>
          <label>Categoría
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              className="nf-app-input"
              style={{ cursor: "pointer" }}
            >
              {changeCategoryOptions().map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>Tipo de cambio
            <select
              value={form.changeType}
              onChange={e => setForm({ ...form, changeType: e.target.value })}
              className="nf-app-input"
              style={{ cursor: "pointer" }}
            >
              {changeTypeOptions().map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>
        <label>Motivo / justificación
        <textarea
          value={form.reason}
          onChange={e => setForm({ ...form, reason: e.target.value })}
          rows={3}
          className="nf-app-input"
          style={{ resize: "vertical" }}
        />
        </label>
        <label>Impacto
        <select
          value={form.impact}
          onChange={e => setForm({ ...form, impact: e.target.value as ChangeRequestRow["impact"] })}
          className="nf-app-input"
        >
          <option value="LOW">Bajo</option>
          <option value="MEDIUM">Medio</option>
          <option value="HIGH">Alto</option>
          <option value="CRITICAL">Crítico</option>
        </select>
        </label>
        <div>
          <div className="nf-modal-field-label" style={{ marginBottom: 8 }}>Procesos afectados</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {processes.map(p => (
            <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={form.processCodes.includes(p.code)}
                onChange={() =>
                  setForm({
                    ...form,
                    processCodes: form.processCodes.includes(p.code)
                      ? form.processCodes.filter(c => c !== p.code)
                      : [...form.processCodes, p.code],
                  })
                }
              />
              {p.code} — {p.name}
            </label>
          ))}
        </div>
        </div>
        <div className="nf-modal-actions">
          <button type="button" className="nf-app-btn-ghost" onClick={() => setCreateOpen(false)}>Cancelar</button>
          <button type="button" className="nf-app-btn-primary" onClick={submitCreate}>Guardar borrador</button>
        </div>
        </div>
      </Modal>
    </div>
  );
}

