"use client";
import { useMemo, useState } from "react";
import { useCreateFromQuery } from "@/hooks/useCreateFromQuery";
import { AlertTriangle, CheckCircle2, ClipboardList, Plus, Sparkles, Timer } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import DataTable from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import AttestationModal from "@/components/compliance/AttestationModal";
import { useWorkspace, type ActionRow, type NcRow } from "@/context/WorkspaceStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import { AUDIT_ACTIONS, createAuditEvent } from "@/lib/domain/audit-event";
import type { Column } from "@/components/ui/Table";

const SEV_COLORS: Record<string, string> = { CRITICAL: "#DC2626", MAJOR: "#D97706", MINOR: "var(--nf-ink-3)" };

export default function NonconformitiesModule() {
  const { state, dispatch, nextNcCode, nextActionCode, showToast } = useWorkspace();
  const perm = useDemoPermission();
  const { nonconformities, audits } = state;
  const [detail, setDetail] = useState<NcRow | null>(null);
  const [closeNcAttest, setCloseNcAttest] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionTitle, setActionTitle] = useState("");
  const [form, setForm] = useState({
    title: "",
    source: "INTERNAL_AUDIT" as NcRow["source"],
    severity: "MAJOR" as NcRow["severity"],
    owner: "",
    due: new Date().toISOString().slice(0, 10),
    auditId: "",
    clause: "",
    rootCause: "",
    correction: "",
    correctiveAction: "",
  });

  const columns: Column<NcRow>[] = [
    { key: "code", label: "#", render: v => <span style={{ color: "var(--nf-ink-3)", fontSize: 12, fontWeight: 600 }}>{v}</span> },
    {
      key: "title",
      label: "No Conformidad",
      render: v => <span style={{ fontWeight: 500, maxWidth: 260, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>,
    },
    { key: "source", label: "Origen", render: v => <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{v.replace(/_/g, " ")}</span> },
    {
      key: "severity",
      label: "Severidad",
      render: v => (
        <span style={{ background: SEV_COLORS[v] + "18", color: SEV_COLORS[v], padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
          {v === "CRITICAL" ? "Crítica" : v === "MAJOR" ? "Mayor" : "Menor"}
        </span>
      ),
    },
    { key: "status", label: "Estado", render: v => <Badge status={v} /> },
    {
      key: "owner",
      label: "Responsable",
      render: v => (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Avatar name={v} size={22} />
          <span style={{ fontSize: 12 }}>{v.split(" ")[0]}</span>
        </div>
      ),
    },
    { key: "due", label: "Fecha límite" },
  ];

  function openCreate() {
    const defaultAuditId = audits.find(a => a.type === "INTERNAL")?.id ?? audits[0]?.id ?? "";
    setForm({
      title: "",
      source: "INTERNAL_AUDIT",
      severity: "MAJOR",
      owner: state.session.name,
      due: new Date().toISOString().slice(0, 10),
      auditId: defaultAuditId,
      clause: "",
      rootCause: "",
      correction: "",
      correctiveAction: "",
    });
    setCreateOpen(true);
  }

  useCreateFromQuery(true, openCreate);

  function submitNc() {
    if (!form.title.trim()) {
      showToast("Describe la no conformidad");
      return;
    }
    const code = nextNcCode();
    const linkedAudit = form.source === "INTERNAL_AUDIT" ? audits.find(a => a.id === form.auditId) : undefined;
    const nc: NcRow = {
      id: `nc-${Date.now()}`,
      code,
      title: form.title.trim(),
      source: form.source,
      severity: form.severity,
      status: "OPEN",
      owner: form.owner.trim() || state.session.name,
      due: form.due,
      auditId: linkedAudit?.id,
      auditTitle: linkedAudit?.title,
      clause: form.clause.trim() || undefined,
      rootCause: form.rootCause.trim() || "Pendiente de análisis",
      correction: form.correction.trim() || "Pendiente de corrección inmediata",
      correctiveAction: form.correctiveAction.trim() || "Pendiente de definir",
    };
    dispatch({ type: "addNc", nc });
    setCreateOpen(false);
    showToast(`NC ${code} registrada (sesión local)`);
  }

  function openActionModal() {
    if (!detail) return;
    setActionTitle(`Acción correctiva — ${detail.code}`);
    setActionOpen(true);
  }

  function submitAction() {
    if (!detail) return;
    if (!actionTitle.trim()) {
      showToast("Indica el título de la acción");
      return;
    }
    const code = nextActionCode();
    const action: ActionRow = {
      id: `ac-${Date.now()}`,
      code,
      title: actionTitle.trim(),
      priority: detail.severity === "CRITICAL" ? "CRITICAL" : detail.severity === "MAJOR" ? "HIGH" : "MEDIUM",
      status: "PENDING",
      due: detail.due,
      owner: detail.owner,
      source: detail.code,
      progress: 0,
      type: "CORRECTIVE",
    };
    dispatch({ type: "addAction", action });
    setActionOpen(false);
    setDetail(null);
    showToast(`Acción ${code} creada y vinculada a ${detail.code} (sesión local)`);
  }

  const detailLive = useMemo(() => (detail ? nonconformities.find(n => n.id === detail.id) ?? detail : null), [detail, nonconformities]);
  const detailAudit = useMemo(() => (detailLive?.auditId ? audits.find(a => a.id === detailLive.auditId) ?? null : null), [detailLive?.auditId, audits]);

  return (
    <div>
      <SectionTitle
        title="No Conformidades y CAPA"
        sub="Hallazgos, análisis de causa raíz y acciones correctivas"
        action={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Plus size={17} strokeWidth={2.25} aria-hidden />
            Registrar NC
          </span>
        }
        onAction={openCreate}
      />

      <div className="nf-kpi-summary" style={{ marginBottom: 18 }}>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--nf-app-accent-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#5266F6",
            }}
          >
            <ClipboardList size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "#5266F6", letterSpacing: "-0.03em", lineHeight: 1 }}>{nonconformities.length}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Total NC</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#FEF2F2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#DC2626",
            }}
          >
            <AlertTriangle size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "#DC2626", letterSpacing: "-0.03em", lineHeight: 1 }}>
              {nonconformities.filter(n => n.status === "OPEN").length}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Abiertas</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#FFFBEB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9a6510",
            }}
          >
            <Timer size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "#D97706", letterSpacing: "-0.03em", lineHeight: 1 }}>
              {nonconformities.filter(n => n.status === "IN_PROGRESS").length}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>En curso</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#F0FDF4",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1f6f45",
            }}
          >
            <CheckCircle2 size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "#16A34A", letterSpacing: "-0.03em", lineHeight: 1 }}>
              {nonconformities.filter(n => n.status === "CLOSED").length}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Cerradas</div>
          </div>
        </div>
      </div>

      <Card style={{ padding: 0 }}>
        <DataTable columns={columns} rows={nonconformities} onRow={setDetail} emptyText="No hay NC. Registra una con + Registrar NC." />
      </Card>

      <Modal open={!!detailLive && !actionOpen} onClose={() => setDetail(null)} title={`${detailLive?.code} — No Conformidad`} width={580}>
        {detailLive && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--nf-ink)", marginBottom: 16, letterSpacing: "-0.02em", lineHeight: 1.35 }}>{detailLive.title}</div>
            {[
              ["Origen", detailLive.source.replace(/_/g, " ")],
              ["Severidad", detailLive.severity],
              ["Estado", <Badge key="st" status={detailLive.status} />],
              ["Responsable", detailLive.owner],
              ["Fecha límite", detailLive.due],
            ].map(([k, v]) => (
              <div key={String(k)} style={{ padding: "9px 0", borderBottom: "1px solid var(--nf-line)", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--nf-ink-3)" }}>{k}</span>
                <span style={{ color: "var(--nf-ink)", fontWeight: 500 }}>{v}</span>
              </div>
            ))}
            {(detailAudit || detailLive.clause) && (
              <div style={{ marginTop: 12, padding: "10px 12px", background: "#fff8f0", border: "1px solid #f5e0c8", borderRadius: 8, fontSize: 12, color: "var(--nf-ink)" }}>
                {detailAudit && (
                  <div>
                    <strong>Auditoría vinculada:</strong> {detailAudit.title}
                  </div>
                )}
                {detailLive.clause && (
                  <div style={{ marginTop: detailAudit ? 4 : 0 }}>
                    <strong>Cláusula:</strong> {detailLive.clause}
                  </div>
                )}
              </div>
            )}
            <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--nf-app-surface-2)", borderRadius: 8, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "var(--nf-ink-3)", marginBottom: 4, textTransform: "none", letterSpacing: "0.5px" }}>Causa Raíz Identificada</div>
              <div style={{ fontSize: 13, color: "var(--nf-ink)", lineHeight: 1.6 }}>{detailLive.rootCause}</div>
            </div>
            <div style={{ padding: "12px 14px", background: "#e8f5ee40", border: "1px solid #16A34A30", borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#16A34A", marginBottom: 4, textTransform: "none", letterSpacing: "0.5px" }}>Acción Correctiva</div>
              <div style={{ fontSize: 13, color: "var(--nf-ink)", lineHeight: 1.6 }}>{detailLive.correctiveAction}</div>
            </div>
            {detailLive.effectivenessCheck && (
              <div style={{ padding: "12px 14px", background: "#f0f4ff", borderRadius: 8, marginBottom: 16, fontSize: 13, color: "var(--nf-ink)" }}>
                <strong>Verificación de eficacia:</strong> {detailLive.effectivenessCheck}
              </div>
            )}
            <div className="nf-action-bar">
              <button type="button" onClick={openActionModal} className="nf-app-btn-primary" style={{ flex: 1, minWidth: 140 }}>
                Crear Acción Correctiva
              </button>
              {perm.nc.manage && detailLive.status !== "CLOSED" && (
                <button
                  type="button"
                  onClick={() => setCloseNcAttest(true)}
                  className="nf-app-btn-success"
                  style={{ flex: 1, minWidth: 140 }}
                >
                  Cerrar NC (firma simulada)
                </button>
              )}
              <button
                type="button"
                onClick={() => showToast("Análisis 5 Porqués: documenta cada nivel en el registro de la NC.")}
                className="nf-app-btn-soft-success"
                style={{ flex: 1, minWidth: 140 }}
              >
                <Sparkles size={15} strokeWidth={2} aria-hidden />
                IA: Análisis 5 Porqués
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Registrar no conformidad" width={520}>
        <div className="nf-modal-form">
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
            Descripción
            <textarea
              className="nf-app-input"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              rows={3}
              style={{ width: "100%", marginTop: 6, boxSizing: "border-box", resize: "vertical" }}
            />
          </label>
          <div className="nf-grid-2" style={{ gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
              Origen
              <select
                className="nf-app-input"
                value={form.source}
                onChange={e => {
                  const source = e.target.value as NcRow["source"];
                  setForm({
                    ...form,
                    source,
                    auditId: source === "INTERNAL_AUDIT" ? form.auditId || audits.find(a => a.type === "INTERNAL")?.id || audits[0]?.id || "" : "",
                    clause: source === "INTERNAL_AUDIT" ? form.clause : "",
                  });
                }}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box", cursor: "pointer" }}
              >
                <option value="INTERNAL_AUDIT">Auditoría interna</option>
                <option value="CUSTOMER_COMPLAINT">Reclamación cliente</option>
                <option value="MANAGEMENT_REVIEW">Revisión dirección</option>
              </select>
            </label>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
              Severidad
              <select
                className="nf-app-input"
                value={form.severity}
                onChange={e => setForm({ ...form, severity: e.target.value as NcRow["severity"] })}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box", cursor: "pointer" }}
              >
                <option value="MINOR">Menor</option>
                <option value="MAJOR">Mayor</option>
                <option value="CRITICAL">Crítica</option>
              </select>
            </label>
          </div>
          {form.source === "INTERNAL_AUDIT" && (
            <div className="nf-grid-2" style={{ gap: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
                Auditoría relacionada
                <select
                  className="nf-app-input"
                  value={form.auditId}
                  onChange={e => setForm({ ...form, auditId: e.target.value })}
                  style={{ width: "100%", marginTop: 6, boxSizing: "border-box", cursor: "pointer" }}
                >
                  {audits.map(audit => (
                    <option key={audit.id} value={audit.id}>
                      {audit.title}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
                Cláusula
                <input
                  className="nf-app-input"
                  value={form.clause}
                  onChange={e => setForm({ ...form, clause: e.target.value })}
                  placeholder="Ej. 8.5"
                  style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
                />
              </label>
            </div>
          )}
          <div className="nf-grid-2" style={{ gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
              Responsable
              <input
                className="nf-app-input"
                value={form.owner}
                onChange={e => setForm({ ...form, owner: e.target.value })}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
              Fecha límite
              <input
                className="nf-app-input"
                type="date"
                value={form.due}
                onChange={e => setForm({ ...form, due: e.target.value })}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
              />
            </label>
          </div>
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
            Causa raíz (borrador)
            <textarea
              className="nf-app-input"
              value={form.rootCause}
              onChange={e => setForm({ ...form, rootCause: e.target.value })}
              rows={2}
              style={{ width: "100%", marginTop: 6, boxSizing: "border-box", resize: "vertical" }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
            Corrección inmediata
            <textarea
              className="nf-app-input"
              value={form.correction}
              onChange={e => setForm({ ...form, correction: e.target.value })}
              rows={2}
              style={{ width: "100%", marginTop: 6, boxSizing: "border-box", resize: "vertical" }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
            Acción correctiva propuesta
            <textarea
              className="nf-app-input"
              value={form.correctiveAction}
              onChange={e => setForm({ ...form, correctiveAction: e.target.value })}
              rows={2}
              style={{ width: "100%", marginTop: 6, boxSizing: "border-box", resize: "vertical" }}
            />
          </label>
          <div className="nf-modal-actions">
            <button type="button" className="nf-app-btn-ghost" onClick={() => setCreateOpen(false)}>Cancelar</button>
            <button type="button" className="nf-app-btn-primary" onClick={submitNc}>Registrar</button>
          </div>
        </div>
      </Modal>

      <Modal open={actionOpen} onClose={() => setActionOpen(false)} title="Nueva acción correctiva" width={480}>
        <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)", display: "block" }}>
          Título de la acción
          <input
            className="nf-app-input"
            value={actionTitle}
            onChange={e => setActionTitle(e.target.value)}
            style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
          />
        </label>
        <p style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 10 }}>Se vinculará al Plan de Acción con origen {detail?.code}.</p>
        <div className="nf-modal-actions">
          <button type="button" className="nf-app-btn-ghost" onClick={() => setActionOpen(false)}>Cancelar</button>
          <button type="button" className="nf-app-btn-primary" onClick={submitAction}>Crear acción</button>
        </div>
      </Modal>

      <AttestationModal
        open={closeNcAttest && !!detailLive}
        onClose={() => setCloseNcAttest(false)}
        title="Cierre de no conformidad (CAPA)"
        statement="Certifica que las acciones correctivas han sido implementadas, que la eficacia ha sido evaluada y que es apropiado cerrar formalmente esta NC."
        sessionEmail={state.session.email}
        onConfirm={({ reason, attestationAt }) => {
          const n = detailLive ?? (detail ? nonconformities.find(x => x.id === detail.id) : null);
          if (!n) return;
          dispatch({
            type: "updateNc",
            id: n.id,
            patch: {
              status: "CLOSED",
              effectivenessCheck: reason,
            },
          });
          dispatch({
            type: "appendAudit",
            event: createAuditEvent({
              ts: attestationAt,
              actorName: state.session.name,
              actorEmail: state.session.email,
              action: AUDIT_ACTIONS.NC_CLOSED,
              entityType: "NONCONFORMITY",
              entityId: n.id,
              entityLabel: n.code,
              oldValue: n.status,
              newValue: "CLOSED",
              reason,
              attestation: {
                method: "E_SIGN_SIMULATED",
                statement: "Cierre NC con verificación de eficacia",
                confirmedAt: attestationAt,
              },
            }),
          });
          setCloseNcAttest(false);
          setDetail(null);
          showToast("NC cerrada · trazabilidad y eficacia registradas");
        }}
      />
    </div>
  );
}
