"use client";

import { useState, type FormEvent } from "react";
import { ManagementReviewStatus, ManagementReviewTopic } from "@prisma/client";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import SectionTitle from "@/components/ui/SectionTitle";
import Card from "@/components/ui/Card";
import { useWorkspace } from "@/context/WorkspaceStore";
import { TOPIC_LABELS } from "@/components/operations/ManagementReviewLive";

type DemoInput = { id: string; topic: ManagementReviewTopic; content: string };
type DemoDecision = { id: string; topic: string; decision: string; owner: string; dueDate: string | null };
type DemoReview = {
  id: string;
  title: string;
  status: ManagementReviewStatus;
  scheduledDate: string | null;
  heldAt: string | null;
  chair: string;
  attendees: string[];
  summary: string;
  inputs: DemoInput[];
  decisions: DemoDecision[];
};

const STATUS_LABELS: Record<ManagementReviewStatus, string> = {
  PLANNED: "Planificada",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};
function statusBadge(s: ManagementReviewStatus) {
  return s === "COMPLETED" ? "ON_TRACK" : s === "CANCELLED" ? "OFF_TRACK" : s === "IN_PROGRESS" ? "IN_PROGRESS" : "AT_RISK";
}
const NEXT_STATUS: Partial<Record<ManagementReviewStatus, ManagementReviewStatus>> = { PLANNED: "IN_PROGRESS", IN_PROGRESS: "COMPLETED" };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es") : "—");
let counter = 0;
const uid = (p: string) => `${p}-${Date.now()}-${counter++}`;

const SEED: DemoReview[] = [
  {
    id: "mr-2025", title: "Revisión por la dirección 2025", status: "COMPLETED",
    scheduledDate: "2025-12-10", heldAt: "2025-12-12", chair: "Laura Méndez",
    attendees: ["Dirección general", "Calidad", "Operaciones", "TI"],
    summary: "El SGC se mantiene eficaz y adecuado. Se aprueban 3 mejoras y recursos para el plan 2026.",
    inputs: [
      { id: "i1", topic: "AUDIT_RESULTS", content: "2 auditorías internas completadas; 4 NC menores, todas cerradas." },
      { id: "i2", topic: "CUSTOMER_FEEDBACK", content: "Satisfacción del cliente 92% (+3 pts vs 2024)." },
      { id: "i3", topic: "PROCESS_PERFORMANCE", content: "Indicadores clave dentro de meta salvo tiempo de respuesta de soporte." },
    ],
    decisions: [
      { id: "d1", topic: "Recursos", decision: "Aprobar contratación de 1 analista de calidad.", owner: "Laura Méndez", dueDate: "2026-02-28" },
      { id: "d2", topic: "Mejora", decision: "Automatizar el seguimiento de acciones correctivas.", owner: "Carlos Méndez", dueDate: "2026-03-31" },
    ],
  },
  {
    id: "mr-2026", title: "Revisión por la dirección 2026", status: "PLANNED",
    scheduledDate: "2026-07-18", heldAt: null, chair: "Laura Méndez",
    attendees: ["Dirección general", "Calidad"], summary: "",
    inputs: [], decisions: [],
  },
];

export default function ManagementReviewModule() {
  const { showToast } = useWorkspace();
  const [reviews, setReviews] = useState<DemoReview[]>(SEED);
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = detailId ? reviews.find(r => r.id === detailId) ?? null : null;

  function patch(id: string, fn: (r: DemoReview) => DemoReview) {
    setReviews(prev => prev.map(r => (r.id === id ? fn(r) : r)));
  }

  function submitCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") ?? "").trim();
    if (!title) { showToast("Indica el título"); return; }
    const r: DemoReview = {
      id: uid("mr"), title, status: "PLANNED",
      scheduledDate: String(fd.get("scheduledDate") ?? "") || null, heldAt: null,
      chair: String(fd.get("chair") ?? "").trim(),
      attendees: String(fd.get("attendees") ?? "").split(",").map(s => s.trim()).filter(Boolean),
      summary: "", inputs: [], decisions: [],
    };
    setReviews(prev => [r, ...prev]);
    setCreating(false);
    showToast("Revisión creada (sesión local)");
  }

  function advance(r: DemoReview) {
    const next = NEXT_STATUS[r.status];
    if (!next) return;
    patch(r.id, x => ({ ...x, status: next, heldAt: next === "COMPLETED" ? new Date().toISOString() : x.heldAt }));
    showToast(next === "COMPLETED" ? "Revisión cerrada" : "Revisión en curso");
  }

  function addInput(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const form = e.currentTarget; const fd = new FormData(form);
    const content = String(fd.get("content") ?? "").trim();
    if (!content) return;
    patch(id, r => ({ ...r, inputs: [...r.inputs, { id: uid("i"), topic: fd.get("topic") as ManagementReviewTopic, content }] }));
    form.reset();
  }

  function addDecision(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const form = e.currentTarget; const fd = new FormData(form);
    const topic = String(fd.get("dtopic") ?? "").trim(); const decision = String(fd.get("decision") ?? "").trim();
    if (!topic || !decision) return;
    patch(id, r => ({ ...r, decisions: [...r.decisions, { id: uid("d"), topic, decision, owner: String(fd.get("owner") ?? "").trim(), dueDate: String(fd.get("dueDate") ?? "") || null }] }));
    form.reset();
  }

  return (
    <div>
      <SectionTitle
        title="Revisión por la dirección"
        sub={`${reviews.length} revisiones · ISO 9001 cláusula 9.3`}
        action="+ Nueva revisión"
        onAction={() => setCreating(true)}
      />

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))" }}>
        {reviews.map(r => (
          <Card key={r.id} style={{ cursor: "pointer" }} onClick={() => setDetailId(r.id)}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: "0 0 6px", fontSize: 18, color: "var(--nf-ink)" }}>{r.title}</h3>
                <div style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>Programada: {fmt(r.scheduledDate)} · {r.chair || "Sin presidente"}</div>
              </div>
              <Badge status={statusBadge(r.status)} label={STATUS_LABELS[r.status]} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, marginTop: 13 }}>
              {[["Entradas", r.inputs.length], ["Decisiones", r.decisions.length], ["Acciones", r.decisions.length]].map(([l, v]) => (
                <div key={String(l)} style={{ background: "var(--nf-app-surface-1)", borderRadius: 9, padding: "8px 4px", textAlign: "center" }}>
                  <strong style={{ display: "block", color: "var(--nf-primary-active)" }}>{v}</strong>
                  <span style={{ fontSize: 9, color: "var(--nf-ink-3)", textTransform: "none" }}>{l}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nueva revisión por la dirección" width={520}>
        <form className="nf-modal-form" onSubmit={submitCreate}>
          <label style={{ fontSize: 13, fontWeight: 700 }}>Título<input name="title" className="nf-app-input" style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }} required /></label>
          <div className="nf-grid-2" style={{ gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 700 }}>Fecha programada<input name="scheduledDate" type="date" className="nf-app-input" style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }} /></label>
            <label style={{ fontSize: 13, fontWeight: 700 }}>Presidente<input name="chair" className="nf-app-input" style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }} /></label>
          </div>
          <label style={{ fontSize: 13, fontWeight: 700 }}>Asistentes (separados por comas)<input name="attendees" className="nf-app-input" style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }} /></label>
          <div className="nf-modal-actions">
            <button type="button" className="nf-app-btn-ghost" onClick={() => setCreating(false)}>Cancelar</button>
            <button type="submit" className="nf-app-btn-primary">Crear</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetailId(null)} title={detail?.title ?? "Revisión"} width={760}>
        {detail && (
          <div style={{ display: "grid", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Estado: <strong style={{ color: "var(--nf-ink)" }}>{STATUS_LABELS[detail.status]}</strong> · Presidente: {detail.chair || "—"} · Realizada: {fmt(detail.heldAt)}</span>
              {NEXT_STATUS[detail.status] && (
                <button type="button" className="nf-app-btn-primary" onClick={() => advance(detail)}>{detail.status === "PLANNED" ? "Iniciar revisión" : "Cerrar revisión"}</button>
              )}
            </div>

            <section>
              <strong style={{ fontSize: 14 }}>Entradas (9.3.2) · {detail.inputs.length}</strong>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {detail.inputs.length === 0 && <p style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Sin entradas.</p>}
                {detail.inputs.map(i => (
                  <div key={i.id} style={{ padding: 10, border: "1px solid var(--nf-line)", borderRadius: 9 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--nf-primary-active)" }}>{TOPIC_LABELS[i.topic]}</span>
                    <p style={{ margin: "4px 0 0", fontSize: 13 }}>{i.content}</p>
                  </div>
                ))}
              </div>
              {detail.status !== "COMPLETED" && detail.status !== "CANCELLED" && (
                <form onSubmit={e => addInput(e, detail.id)} style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  <div className="nf-grid-2" style={{ gap: 8 }}>
                    <select aria-label="Tema" name="topic" className="nf-app-input" style={{ width: "100%", boxSizing: "border-box" }} defaultValue="AUDIT_RESULTS">
                      {Object.entries(TOPIC_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <button type="submit" className="nf-app-btn-outline">Añadir entrada</button>
                  </div>
                  <textarea aria-label="Resumen de la entrada" name="content" className="nf-app-input" style={{ width: "100%", boxSizing: "border-box" }} rows={2} placeholder="Resumen de la entrada…" required />
                </form>
              )}
            </section>

            <section>
              <strong style={{ fontSize: 14 }}>Decisiones y acciones (9.3.3) · {detail.decisions.length}</strong>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {detail.decisions.length === 0 && <p style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Sin decisiones.</p>}
                {detail.decisions.map(d => (
                  <div key={d.id} style={{ padding: 10, border: "1px solid var(--nf-line)", borderRadius: 9 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{d.topic}</span>
                    <p style={{ margin: "4px 0", fontSize: 13 }}>{d.decision}</p>
                    <div style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{d.owner || "Sin responsable"}{d.dueDate ? ` · vence ${fmt(d.dueDate)}` : ""}</div>
                  </div>
                ))}
              </div>
              {detail.status !== "COMPLETED" && detail.status !== "CANCELLED" && (
                <form onSubmit={e => addDecision(e, detail.id)} style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  <div className="nf-grid-2" style={{ gap: 8 }}>
                    <input aria-label="Tema" name="dtopic" className="nf-app-input" style={{ width: "100%", boxSizing: "border-box" }} placeholder="Tema" required />
                    <input aria-label="Responsable" name="owner" className="nf-app-input" style={{ width: "100%", boxSizing: "border-box" }} placeholder="Responsable" />
                  </div>
                  <textarea aria-label="Decisión / acción" name="decision" className="nf-app-input" style={{ width: "100%", boxSizing: "border-box" }} rows={2} placeholder="Decisión / acción…" required />
                  <div className="nf-grid-2" style={{ gap: 8 }}>
                    <input aria-label="Fecha de vencimiento" name="dueDate" type="date" className="nf-app-input" style={{ width: "100%", boxSizing: "border-box" }} />
                    <button type="submit" className="nf-app-btn-outline">Registrar decisión</button>
                  </div>
                </form>
              )}
            </section>

            {detail.summary && (
              <section>
                <strong style={{ fontSize: 14 }}>Conclusiones</strong>
                <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--nf-ink-2)", lineHeight: 1.6 }}>{detail.summary}</p>
              </section>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
