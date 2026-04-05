"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import DataTable from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import { useWorkspace, type ActionRow, type NcRow } from "@/context/WorkspaceStore";
import type { Column } from "@/components/ui/Table";

const SEV_COLORS: Record<string, string> = { CRITICAL: "#C93C37", MAJOR: "#D68A1A", MINOR: "#5E6B7A" };

export default function NonconformitiesModule() {
  const { state, dispatch, nextNcCode, nextActionCode, showToast } = useWorkspace();
  const { nonconformities } = state;
  const [detail, setDetail] = useState<NcRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionTitle, setActionTitle] = useState("");
  const [form, setForm] = useState({
    title: "",
    source: "INTERNAL_AUDIT" as NcRow["source"],
    severity: "MAJOR" as NcRow["severity"],
    owner: "",
    due: new Date().toISOString().slice(0, 10),
    rootCause: "",
    correction: "",
    correctiveAction: "",
  });

  const columns: Column<NcRow>[] = [
    { key: "code", label: "#", render: v => <span style={{ color: "#5E6B7A", fontSize: 12, fontWeight: 600 }}>{v}</span> },
    {
      key: "title",
      label: "No Conformidad",
      render: v => <span style={{ fontWeight: 500, maxWidth: 260, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>,
    },
    { key: "source", label: "Origen", render: v => <span style={{ fontSize: 12, color: "#5E6B7A" }}>{v.replace(/_/g, " ")}</span> },
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
    setForm({
      title: "",
      source: "INTERNAL_AUDIT",
      severity: "MAJOR",
      owner: state.session.name,
      due: new Date().toISOString().slice(0, 10),
      rootCause: "",
      correction: "",
      correctiveAction: "",
    });
    setCreateOpen(true);
  }

  function submitNc() {
    if (!form.title.trim()) {
      showToast("Describe la no conformidad");
      return;
    }
    const code = nextNcCode();
    const nc: NcRow = {
      id: `nc-${Date.now()}`,
      code,
      title: form.title.trim(),
      source: form.source,
      severity: form.severity,
      status: "OPEN",
      owner: form.owner.trim() || state.session.name,
      due: form.due,
      rootCause: form.rootCause.trim() || "Pendiente de análisis",
      correction: form.correction.trim() || "Pendiente de corrección inmediata",
      correctiveAction: form.correctiveAction.trim() || "Pendiente de definir",
    };
    dispatch({ type: "addNc", nc });
    setCreateOpen(false);
    setDetail(nc);
    showToast(`NC ${code} registrada (sesión demo)`);
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
    showToast(`Acción ${code} creada y vinculada a ${detail.code} (demo)`);
  }

  return (
    <div>
      <SectionTitle title="No Conformidades y CAPA" sub="Hallazgos, análisis de causa raíz y acciones correctivas" action="+ Registrar NC" onAction={openCreate} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Total", value: nonconformities.length, color: "#123C66" },
          { label: "Abiertas", value: nonconformities.filter(n => n.status === "OPEN").length, color: "#C93C37" },
          { label: "En Curso", value: nonconformities.filter(n => n.status === "IN_PROGRESS").length, color: "#D68A1A" },
          { label: "Cerradas", value: nonconformities.filter(n => n.status === "CLOSED").length, color: "#2E8B57" },
        ].map(s => (
          <Card key={s.label} style={{ textAlign: "center", padding: "16px 12px" }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#5E6B7A", marginTop: 2 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <Card style={{ padding: 0 }}>
        <DataTable columns={columns} rows={nonconformities} onRow={setDetail} emptyText="No hay NC. Registra una con + Registrar NC." />
      </Card>

      <Modal open={!!detail && !actionOpen} onClose={() => setDetail(null)} title={`${detail?.code} — No Conformidad`} width={580}>
        {detail && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#142033", marginBottom: 16 }}>{detail.title}</div>
            {[
              ["Origen", detail.source.replace(/_/g, " ")],
              ["Severidad", detail.severity],
              ["Estado", <Badge key="st" status={detail.status} />],
              ["Responsable", detail.owner],
              ["Fecha límite", detail.due],
            ].map(([k, v]) => (
              <div key={String(k)} style={{ padding: "9px 0", borderBottom: "1px solid #E5EAF2", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#5E6B7A" }}>{k}</span>
                <span style={{ color: "#142033", fontWeight: 500 }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: 14, padding: "12px 14px", background: "#F7F9FC", borderRadius: 8, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "#5E6B7A", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Causa Raíz Identificada</div>
              <div style={{ fontSize: 13, color: "#142033", lineHeight: 1.6 }}>{detail.rootCause}</div>
            </div>
            <div style={{ padding: "12px 14px", background: "#e8f5ee40", border: "1px solid #2E8B5730", borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#2E8B57", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Acción Correctiva</div>
              <div style={{ fontSize: 13, color: "#142033", lineHeight: 1.6 }}>{detail.correctiveAction}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={openActionModal} style={{ flex: 1, background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Crear Acción Correctiva
              </button>
              <button
                type="button"
                onClick={() => showToast("Análisis 5 Porqués (demo): documenta cada nivel en el registro de la NC.")}
                style={{ flex: 1, background: "#2E8B5718", color: "#2E8B57", border: "1px solid #2E8B5740", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                ✦ IA: Análisis 5 Porqués
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Registrar no conformidad" width={520}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Descripción
            <textarea value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} rows={3} style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Origen
              <select
                value={form.source}
                onChange={e => setForm({ ...form, source: e.target.value as NcRow["source"] })}
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              >
                <option value="INTERNAL_AUDIT">Auditoría interna</option>
                <option value="CUSTOMER_COMPLAINT">Reclamación cliente</option>
                <option value="MANAGEMENT_REVIEW">Revisión dirección</option>
              </select>
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Severidad
              <select
                value={form.severity}
                onChange={e => setForm({ ...form, severity: e.target.value as NcRow["severity"] })}
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              >
                <option value="MINOR">Menor</option>
                <option value="MAJOR">Mayor</option>
                <option value="CRITICAL">Crítica</option>
              </select>
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Responsable
              <input
                value={form.owner}
                onChange={e => setForm({ ...form, owner: e.target.value })}
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Fecha límite
              <input
                type="date"
                value={form.due}
                onChange={e => setForm({ ...form, due: e.target.value })}
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              />
            </label>
          </div>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Causa raíz (borrador)
            <textarea value={form.rootCause} onChange={e => setForm({ ...form, rootCause: e.target.value })} rows={2} style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Corrección inmediata
            <textarea value={form.correction} onChange={e => setForm({ ...form, correction: e.target.value })} rows={2} style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Acción correctiva propuesta
            <textarea value={form.correctiveAction} onChange={e => setForm({ ...form, correctiveAction: e.target.value })} rows={2} style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={submitNc} style={{ flex: 1, background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Registrar
            </button>
            <button type="button" onClick={() => setCreateOpen(false)} style={{ flex: 1, background: "transparent", border: "1px solid #E5EAF2", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", color: "#5E6B7A" }}>
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={actionOpen} onClose={() => setActionOpen(false)} title="Nueva acción correctiva" width={480}>
        <label style={{ fontSize: 13, fontWeight: 500, display: "block" }}>
          Título de la acción
          <input
            value={actionTitle}
            onChange={e => setActionTitle(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
          />
        </label>
        <p style={{ fontSize: 12, color: "#5E6B7A" }}>Se vinculará al Plan de Acción con origen {detail?.code}.</p>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button type="button" onClick={submitAction} style={{ flex: 1, background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Crear acción
          </button>
          <button type="button" onClick={() => setActionOpen(false)} style={{ flex: 1, background: "transparent", border: "1px solid #E5EAF2", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", color: "#5E6B7A" }}>
            Cancelar
          </button>
        </div>
      </Modal>
    </div>
  );
}
