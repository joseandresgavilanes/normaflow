"use client";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import AttestationModal from "@/components/compliance/AttestationModal";
import AuditTimeline from "@/components/compliance/AuditTimeline";
import { useWorkspace, type ChangeRequestRow } from "@/context/WorkspaceStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import { AUDIT_ACTIONS, createAuditEvent } from "@/lib/domain/audit-event";

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
  const { changeRequests, auditEvents, documents, trainingCourses } = state;
  const [detail, setDetail] = useState<ChangeRequestRow | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [attest, setAttest] = useState<{ mode: "APPROVE" | "REJECT" | "CLOSE"; id: string } | null>(null);
  const [form, setForm] = useState({
    title: "",
    category: "Proceso",
    changeType: "Mejora",
    reason: "",
    impact: "MEDIUM" as ChangeRequestRow["impact"],
  });

  const filtered = filter === "ALL" ? changeRequests : changeRequests.filter(c => c.status === filter);
  const detailLive = detail ? changeRequests.find(c => c.id === detail.id) ?? detail : null;
  const changeEvents = useMemo(() => auditEvents.filter(e => e.entityType === "CHANGE_REQUEST" || e.action === "CHANGE_STATUS"), [auditEvents]);

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

  function transition(c: ChangeRequestRow, next: ChangeRequestRow["status"], reason?: string) {
    const prev = c.status;
    dispatch({ type: "updateChangeRequest", id: c.id, patch: { status: next } });
    logChange(c.id, c.code, prev, next, reason);
    setDetail(d => (d?.id === c.id ? { ...d, status: next } : d));
    showToast(`Estado: ${statusLabel(next)}`);
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
      processCodes: [],
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
    setForm({ title: "", category: "Proceso", changeType: "Mejora", reason: "", impact: "MEDIUM" });
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
  }

  return (
    <div>
      <SectionTitle
        title="Control de cambios"
        sub="Evaluación de impacto, aprobadores, tareas, evidencias y trazabilidad completa"
        action={perm.changes.manage ? "+ Nueva solicitud" : undefined}
        onAction={perm.changes.manage ? () => setCreateOpen(true) : undefined}
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["ALL", "DRAFT", "UNDER_REVIEW", "APPROVED", "IMPLEMENTED", "CLOSED", "REJECTED"].map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: `1px solid ${filter === s ? "#123C66" : "#E5EAF2"}`,
              background: filter === s ? "#123C6615" : "#fff",
              fontSize: 12,
              cursor: "pointer",
              color: filter === s ? "#123C66" : "#5E6B7A",
              fontWeight: filter === s ? 600 : 400,
            }}
          >
            {s === "ALL" ? "Todos" : statusLabel(s as ChangeRequestRow["status"])}
          </button>
        ))}
      </div>

      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F7F9FC", textAlign: "left", color: "#5E6B7A", fontSize: 12 }}>
              <th style={{ padding: 12 }}>Código</th>
              <th style={{ padding: 12 }}>Título</th>
              <th style={{ padding: 12 }}>Impacto</th>
              <th style={{ padding: 12 }}>Estado</th>
              <th style={{ padding: 12 }}>Solicitante</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} style={{ borderTop: "1px solid #E5EAF2", cursor: "pointer" }} onClick={() => setDetail(c)}>
                <td style={{ padding: 12, fontFamily: "monospace", fontWeight: 700, color: "#123C66" }}>{c.code}</td>
                <td style={{ padding: 12, fontWeight: 500 }}>{c.title}</td>
                <td style={{ padding: 12 }}>{c.impact}</td>
                <td style={{ padding: 12 }}>
                  <Badge
                    status={c.status === "CLOSED" || c.status === "VERIFIED" ? "ON_TRACK" : c.status === "REJECTED" ? "OFF_TRACK" : "AT_RISK"}
                    label={statusLabel(c.status)}
                  />
                </td>
                <td style={{ padding: 12, color: "#5E6B7A" }}>{c.requesterName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h3 style={{ marginTop: 0, fontSize: 15, color: "#142033" }}>Flujo de estados (referencia)</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12, color: "#5E6B7A" }}>
          {FLOW.map((s, i) => (
            <span key={s}>
              {statusLabel(s)}
              {i < FLOW.length - 1 ? " → " : ""}
            </span>
          ))}
          <span> · Rechazo desde revisión</span>
        </div>
      </Card>

      <Modal open={!!detailLive} onClose={() => setDetail(null)} title={detailLive ? `${detailLive.code} · ${detailLive.title}` : ""} width={640}>
        {detailLive && (
          <div>
            <p style={{ fontSize: 13, color: "#5E6B7A", lineHeight: 1.6 }}>{detailLive.reason}</p>
            <div className="nf-grid-2" style={{ gap: 10, marginBottom: 16, fontSize: 12 }}>
              <div>
                <strong>Categoría</strong> {detailLive.category}
              </div>
              <div>
                <strong>Tipo</strong> {detailLive.changeType}
              </div>
              <div>
                <strong>Aprobadores</strong> {detailLive.approvers.join(", ")}
              </div>
              <div>
                <strong>NC vinculada</strong> {detailLive.ncId ? <Link href="/app/nonconformities">{detailLive.ncId}</Link> : "—"}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#142033" }}>Documentos afectados</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {detailLive.documentIds.length === 0 ? (
                  <span style={{ color: "#5E6B7A", fontSize: 12 }}>Ninguno enlazado</span>
                ) : (
                  detailLive.documentIds.map(did => {
                    const d = documents.find(x => x.id === did);
                    return (
                      <Link key={did} href="/app/documents" style={{ fontSize: 12, color: "#123C66" }}>
                        {d?.code ?? did}
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Procesos / riesgos / formación</div>
              <p style={{ fontSize: 12, color: "#5E6B7A", margin: 0 }}>
                Procesos: {detailLive.processCodes.join(", ") || "—"} · Riesgos: {detailLive.riskCodes.join(", ") || "—"} · Cursos:{" "}
                {detailLive.trainingCourseIds.map(id => trainingCourses.find(t => t.id === id)?.code ?? id).join(", ") || "—"}
              </p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Tareas derivadas</div>
              {detailLive.tasks.map(t => (
                <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 6 }}>
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
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, borderTop: "1px solid #E5EAF2", paddingTop: 16 }}>
                {detailLive.status === "DRAFT" && (
                  <button type="button" onClick={() => transition(detailLive, "SUBMITTED")} style={btnPrimary}>
                    Enviar a revisión
                  </button>
                )}
                {detailLive.status === "SUBMITTED" && (
                  <button type="button" onClick={() => transition(detailLive, "UNDER_REVIEW")} style={btnPrimary}>
                    Marcar en revisión
                  </button>
                )}
                {detailLive.status === "UNDER_REVIEW" && (
                  <>
                    <button type="button" onClick={() => setAttest({ mode: "APPROVE", id: detailLive.id })} style={btnOk}>
                      Aprobar (con firma simulada)
                    </button>
                    <button type="button" onClick={() => setAttest({ mode: "REJECT", id: detailLive.id })} style={btnDanger}>
                      Rechazar (con motivo)
                    </button>
                  </>
                )}
                {detailLive.status === "APPROVED" && (
                  <button type="button" onClick={() => transition(detailLive, "IMPLEMENTED")} style={btnPrimary}>
                    Marcar implementado
                  </button>
                )}
                {detailLive.status === "IMPLEMENTED" && (
                  <button type="button" onClick={() => transition(detailLive, "VERIFIED")} style={btnPrimary}>
                    Verificar efectividad
                  </button>
                )}
                {detailLive.status === "VERIFIED" && (
                  <button type="button" onClick={() => setAttest({ mode: "CLOSE", id: detailLive.id })} style={btnOk}>
                    Cerrar cambio (firma simulada)
                  </button>
                )}
              </div>
            )}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#142033" }}>Historial en registro</div>
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
        <label style={lbl}>Título</label>
        <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inp} />
        <label style={lbl}>Motivo / justificación</label>
        <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} rows={3} style={inp} />
        <label style={lbl}>Impacto</label>
        <select value={form.impact} onChange={e => setForm({ ...form, impact: e.target.value as ChangeRequestRow["impact"] })} style={inp}>
          <option value="LOW">Bajo</option>
          <option value="MEDIUM">Medio</option>
          <option value="HIGH">Alto</option>
          <option value="CRITICAL">Crítico</option>
        </select>
        <button type="button" onClick={submitCreate} style={{ ...btnPrimary, width: "100%", marginTop: 16 }}>
          Guardar borrador
        </button>
      </Modal>
    </div>
  );
}

const btnPrimary: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "#123C66",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 13,
};
const btnOk: CSSProperties = { ...btnPrimary, background: "#2E8B57" };
const btnDanger: CSSProperties = { ...btnPrimary, background: "#C93C37" };
const lbl: CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#142033" };
const inp: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #E5EAF2",
  marginBottom: 12,
  fontSize: 13,
  boxSizing: "border-box",
};
