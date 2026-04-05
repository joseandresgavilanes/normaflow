"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import Modal from "@/components/ui/Modal";
import AttestationModal from "@/components/compliance/AttestationModal";
import { useWorkspace, type AuditRow, type ChecklistItem } from "@/context/WorkspaceStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import { AUDIT_ACTIONS, createAuditEvent } from "@/lib/domain/audit-event";

export default function AuditsModule() {
  const { state, dispatch, showToast } = useWorkspace();
  const perm = useDemoPermission();
  const { audits, auditChecklists, auditProgram, auditFindings } = state;
  const [detail, setDetail] = useState<AuditRow | null>(null);
  const [checklistAudit, setChecklistAudit] = useState<AuditRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [closeAuditAttest, setCloseAuditAttest] = useState<AuditRow | null>(null);
  const [form, setForm] = useState({
    title: "",
    type: "INTERNAL" as AuditRow["type"],
    standard: "ISO 9001",
    date: new Date().toISOString().slice(0, 10),
    auditor: "",
    scope: "",
    objectives: "",
  });

  function openCreate() {
    setForm({
      title: "",
      type: "INTERNAL",
      standard: "ISO 9001",
      date: new Date().toISOString().slice(0, 10),
      auditor: state.session.name,
      scope: "",
      objectives: "",
    });
    setCreateOpen(true);
  }

  function submitCreate() {
    if (!form.title.trim()) {
      showToast("Indica el título de la auditoría");
      return;
    }
    const id = `a-${Date.now()}`;
    const audit: AuditRow = {
      id,
      title: form.title.trim(),
      type: form.type,
      standard: form.standard.trim() || "ISO 9001",
      status: "PLANNED",
      date: form.date,
      findings: 0,
      criticals: 0,
      progress: 0,
      auditor: form.auditor.trim() || state.session.name,
      scope: form.scope.trim() || "Por definir",
      objectives: form.objectives.trim() || "Por definir",
    };
    dispatch({ type: "addAudit", audit });
    setCreateOpen(false);
    showToast("Auditoría creada (sesión demo)");
  }

  function openChecklist(a: AuditRow) {
    setChecklistAudit(a);
  }

  function startAudit(a: AuditRow) {
    dispatch({
      type: "updateAudit",
      id: a.id,
      patch: { status: "IN_PROGRESS", progress: Math.max(a.progress, 5) },
    });
    showToast("Auditoría iniciada (demo)");
    setDetail(prev => (prev?.id === a.id ? { ...prev, status: "IN_PROGRESS", progress: Math.max(prev.progress, 5) } : prev));
    setChecklistAudit(prev => (prev?.id === a.id ? { ...prev, status: "IN_PROGRESS", progress: Math.max(prev.progress, 5) } : prev));
  }

  function toggleItem(item: ChecklistItem, done: boolean) {
    if (!checklistAudit) return;
    dispatch({ type: "toggleChecklist", auditId: checklistAudit.id, itemId: item.id, done });
  }

  const checklistItems = checklistAudit ? auditChecklists[checklistAudit.id] ?? [] : [];

  const detailLive = useMemo(() => (detail ? audits.find(a => a.id === detail.id) ?? detail : null), [detail, audits]);

  return (
    <div>
      <SectionTitle title="Auditorías" sub="Programa anual · alcance, criterios y cierre trazable" action="+ Nueva Auditoría" onAction={openCreate} />

      <Card style={{ marginBottom: 20, borderLeft: "4px solid #123C66" }}>
        <div style={{ fontSize: 11, color: "#5E6B7A", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Programa de auditoría {auditProgram.programYear}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#142033", marginBottom: 8 }}>Responsable: {auditProgram.programOwner}</div>
        <p style={{ fontSize: 13, color: "#5E6B7A", margin: "0 0 10px", lineHeight: 1.55 }}>{auditProgram.objectives}</p>
        <div style={{ fontSize: 12, color: "#123C66", fontWeight: 600 }}>Próxima revisión por la dirección: {auditProgram.nextManagementReview}</div>
        <Link href="/app/reporting" style={{ fontSize: 12, color: "#2E8B57", fontWeight: 600, marginTop: 10, display: "inline-block" }}>
          Generar informe de programa →
        </Link>
      </Card>

      <div className="nf-grid-stats" style={{ gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total planificadas", value: audits.length, color: "#123C66" },
          { label: "En curso", value: audits.filter(a => a.status === "IN_PROGRESS").length, color: "#D68A1A" },
          { label: "Completadas", value: audits.filter(a => a.status === "COMPLETED").length, color: "#2E8B57" },
          { label: "Hallazgos totales", value: audits.reduce((s, a) => s + a.findings, 0), color: "#C93C37" },
        ].map(s => (
          <Card key={s.label} style={{ textAlign: "center", padding: "18px 12px" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#5E6B7A", marginTop: 2 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {audits.length === 0 ? (
        <Card style={{ padding: 40, textAlign: "center", color: "#5E6B7A" }}>No hay auditorías. Crea una con + Nueva Auditoría.</Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {audits.map(audit => (
            <Card key={audit.id} onClick={() => setDetail(audit)} style={{ cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: audit.status !== "PLANNED" ? 14 : 0, flexWrap: "wrap", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: 11,
                        background: audit.type === "EXTERNAL" ? "#fff8e6" : "#f0f4ff",
                        color: audit.type === "EXTERNAL" ? "#D68A1A" : "#123C66",
                        padding: "2px 8px",
                        borderRadius: 99,
                        fontWeight: 600,
                      }}
                    >
                      {audit.type === "EXTERNAL" ? "Externa" : "Interna"}
                    </span>
                    <span style={{ fontSize: 11, background: "#F7F9FC", color: "#5E6B7A", padding: "2px 8px", borderRadius: 99, border: "1px solid #E5EAF2" }}>{audit.standard}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#142033", marginBottom: 3 }}>{audit.title}</div>
                  <div style={{ fontSize: 12, color: "#5E6B7A" }}>
                    Auditor: {audit.auditor} · Fecha: {audit.date}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                  {audit.findings > 0 && (
                    <span style={{ fontSize: 12, background: "#fff0f0", color: "#C93C37", padding: "3px 9px", borderRadius: 99, fontWeight: 600 }}>{audit.findings} hallazgos</span>
                  )}
                  <Badge status={audit.status} />
                </div>
              </div>
              {audit.status !== "PLANNED" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#5E6B7A", marginBottom: 6 }}>
                    <span>Progreso de ejecución</span>
                    <span style={{ fontWeight: 600 }}>{audit.progress}%</span>
                  </div>
                  <ProgressBar value={audit.progress} color={audit.status === "COMPLETED" ? "#2E8B57" : "#123C66"} height={6} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detailLive?.title ?? ""} width={560}>
        {detailLive && (
          <div>
            <div className="nf-grid-2" style={{ gap: 12, marginBottom: 20 }}>
              {[
                ["Tipo", detailLive.type === "EXTERNAL" ? "Externa" : "Interna"],
                ["Norma", detailLive.standard],
                ["Fecha", detailLive.date],
                ["Auditor", detailLive.auditor],
                ["Hallazgos", detailLive.findings],
                ["Críticos", detailLive.criticals],
                ["Progreso", `${detailLive.progress}%`],
              ].map(([k, v]) => (
                <div key={String(k)} style={{ background: "#F7F9FC", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, color: "#5E6B7A", marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#142033" }}>{v}</div>
                </div>
              ))}
            </div>
            {detailLive.scope && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "#5E6B7A", marginBottom: 4 }}>ALCANCE</div>
                <div style={{ fontSize: 13, color: "#142033" }}>{detailLive.scope}</div>
              </div>
            )}
            {detailLive.objectives && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#5E6B7A", marginBottom: 4 }}>OBJETIVOS / CRITERIOS</div>
                <div style={{ fontSize: 13, color: "#142033" }}>{detailLive.objectives}</div>
              </div>
            )}
            {auditFindings.filter(f => f.auditId === detailLive.id).length > 0 && (
              <div style={{ marginBottom: 16, padding: 12, background: "#fff8f0", borderRadius: 8, border: "1px solid #f5e0c8" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#142033", marginBottom: 8 }}>Hallazgos registrados</div>
                {auditFindings
                  .filter(f => f.auditId === detailLive.id)
                  .map(f => (
                    <div key={f.id} style={{ fontSize: 12, marginBottom: 6, color: "#142033" }}>
                      <Badge status={f.severity === "CRITICAL" ? "CRITICAL" : f.severity === "MAJOR" ? "MAJOR" : "MINOR"} /> {f.title}
                    </div>
                  ))}
                <Link href="/app/actions" style={{ fontSize: 12, color: "#123C66", fontWeight: 600 }}>
                  Derivar acciones →
                </Link>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {detailLive.status === "PLANNED" && (
                  <button
                    type="button"
                    onClick={() => startAudit(detailLive)}
                    style={{ flex: 1, minWidth: 140, background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                  >
                    Iniciar auditoría
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openChecklist(detailLive)}
                  style={{
                    flex: 1,
                    minWidth: 140,
                    background: detailLive.status === "PLANNED" ? "#F7F9FC" : "#123C66",
                    color: detailLive.status === "PLANNED" ? "#123C66" : "#fff",
                    border: "1px solid #E5EAF2",
                    borderRadius: 8,
                    padding: "9px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Ver Checklist
                </button>
                {perm.audits.manage && detailLive.status !== "COMPLETED" && detailLive.status !== "PLANNED" && (
                  <button
                    type="button"
                    onClick={() => setCloseAuditAttest(detailLive)}
                    style={{ flex: 1, minWidth: 140, background: "#2E8B57", color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                  >
                    Cierre formal
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => showToast("Resumen de hallazgos (demo): revisa NC vinculadas y el plan de acción.")}
                style={{ width: "100%", background: "#2E8B5718", color: "#2E8B57", border: "1px solid #2E8B5740", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                ✦ IA: Resumir hallazgos
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!checklistAudit} onClose={() => setChecklistAudit(null)} title={checklistAudit ? `Checklist — ${checklistAudit.title}` : ""} width={640}>
        {checklistAudit && (
          <div>
            <p style={{ fontSize: 13, color: "#5E6B7A", marginTop: 0 }}>Marca ítems completados. Los cambios se guardan en la sesión actual (demo).</p>
            <div style={{ maxHeight: 400, overflow: "auto", border: "1px solid #E5EAF2", borderRadius: 8 }}>
              {checklistItems.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "#5E6B7A" }}>Sin ítems de checklist.</div>
              ) : (
                checklistItems.map(item => (
                  <label
                    key={item.id}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      padding: "12px 14px",
                      borderBottom: "1px solid #E5EAF2",
                      cursor: "pointer",
                      background: item.done ? "#f0fdf4" : "transparent",
                    }}
                  >
                    <input type="checkbox" checked={item.done} onChange={e => toggleItem(item, e.target.checked)} style={{ marginTop: 3 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: "#123C66", fontWeight: 600 }}>Cláusula {item.clause}</div>
                      <div style={{ fontSize: 13, color: "#142033" }}>{item.requirement}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
            <button type="button" onClick={() => setChecklistAudit(null)} style={{ marginTop: 14, width: "100%", background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Cerrar
            </button>
          </div>
        )}
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nueva auditoría" width={520}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Título
            <input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
            />
          </label>
          <div className="nf-grid-2" style={{ gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Tipo
              <select
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value as AuditRow["type"] })}
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              >
                <option value="INTERNAL">Interna</option>
                <option value="EXTERNAL">Externa</option>
              </select>
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Norma
              <input
                value={form.standard}
                onChange={e => setForm({ ...form, standard: e.target.value })}
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              />
            </label>
          </div>
          <div className="nf-grid-2" style={{ gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Fecha
              <input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Auditor
              <input
                value={form.auditor}
                onChange={e => setForm({ ...form, auditor: e.target.value })}
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              />
            </label>
          </div>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Alcance
            <textarea value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })} rows={2} style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Objetivos
            <textarea value={form.objectives} onChange={e => setForm({ ...form, objectives: e.target.value })} rows={2} style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={submitCreate} style={{ flex: 1, background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Crear
            </button>
            <button type="button" onClick={() => setCreateOpen(false)} style={{ flex: 1, background: "transparent", border: "1px solid #E5EAF2", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", color: "#5E6B7A" }}>
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      <AttestationModal
        open={!!closeAuditAttest}
        onClose={() => setCloseAuditAttest(null)}
        title="Cierre formal de auditoría"
        statement="Certifica que la auditoría ha sido ejecutada según el plan aprobado, que los hallazgos están registrados y que las acciones derivadas han sido comunicadas a los responsables."
        sessionEmail={state.session.email}
        onConfirm={({ reason, attestationAt }) => {
          const a = closeAuditAttest;
          if (!a) return;
          dispatch({
            type: "updateAudit",
            id: a.id,
            patch: { status: "COMPLETED", progress: 100 },
          });
          dispatch({
            type: "appendAudit",
            event: createAuditEvent({
              ts: attestationAt,
              actorName: state.session.name,
              actorEmail: state.session.email,
              action: AUDIT_ACTIONS.AUDIT_CLOSED,
              entityType: "AUDIT",
              entityId: a.id,
              entityLabel: a.title,
              oldValue: a.status,
              newValue: "COMPLETED",
              reason,
              attestation: {
                method: "E_SIGN_SIMULATED",
                statement: "Cierre de auditoría con reconfirmación de identidad",
                confirmedAt: attestationAt,
              },
            }),
          });
          setCloseAuditAttest(null);
          setDetail(null);
          showToast("Auditoría cerrada · registro auditado");
        }}
      />
    </div>
  );
}
