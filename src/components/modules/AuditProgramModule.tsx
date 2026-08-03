"use client";

import { useState, type FormEvent } from "react";
import { AuditProgramStatus } from "@prisma/client";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import ProgressBar from "@/components/ui/ProgressBar";
import SectionTitle from "@/components/ui/SectionTitle";
import { useWorkspace } from "@/context/WorkspaceStore";
import { PROGRAM_STATUS_LABELS, AUDIT_STATUS_LABELS } from "@/components/operations/AuditProgramLive";

type DemoAudit = { id: string; title: string; status: string; progress: number; type: string; scheduledDate: string | null };
type DemoProgram = {
  id: string; year: number; title: string; objectives: string; scope: string;
  status: AuditProgramStatus; approvedBy: string | null; approvedAt: string | null; audits: DemoAudit[];
};

function programBadge(s: AuditProgramStatus) {
  return s === "COMPLETED" ? "ON_TRACK" : s === "CANCELLED" ? "OFF_TRACK" : s === "IN_EXECUTION" ? "IN_PROGRESS" : s === "APPROVED" ? "ON_TRACK" : "AT_RISK";
}
const NEXT_ACTIONS: Record<AuditProgramStatus, { to: AuditProgramStatus; label: string; primary?: boolean }[]> = {
  DRAFT: [{ to: "APPROVED", label: "Aprobar programa", primary: true }, { to: "CANCELLED", label: "Cancelar" }],
  APPROVED: [{ to: "IN_EXECUTION", label: "Iniciar ejecución", primary: true }, { to: "CANCELLED", label: "Cancelar" }],
  IN_EXECUTION: [{ to: "COMPLETED", label: "Completar programa", primary: true }, { to: "CANCELLED", label: "Cancelar" }],
  COMPLETED: [],
  CANCELLED: [{ to: "DRAFT", label: "Reabrir como borrador" }],
};
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es") : "—");
let counter = 0;
const uid = (p: string) => `${p}-${Date.now()}-${counter++}`;
const avg = (a: DemoAudit[]) => (a.length ? Math.round(a.reduce((s, x) => s + x.progress, 0) / a.length) : 0);

const SEED: DemoProgram[] = [
  {
    id: "ap-2026", year: 2026, title: "Programa anual de auditorías", objectives: "Verificar conformidad y eficacia del SGC ISO 9001 e ISO 27001.",
    scope: "Todos los procesos certificados y las 2 sedes.", status: "IN_EXECUTION", approvedBy: "Laura Méndez", approvedAt: "2026-01-15",
    audits: [
      { id: "a1", title: "Auditoría interna ISO 9001 — Q2", status: "COMPLETED", progress: 100, type: "INTERNAL", scheduledDate: "2026-05-20" },
      { id: "a2", title: "Auditoría interna ISO 27001 — Q3", status: "IN_PROGRESS", progress: 60, type: "INTERNAL", scheduledDate: "2026-08-12" },
      { id: "a3", title: "Auditoría de seguimiento ISO 9001 — Q4", status: "PLANNED", progress: 0, type: "EXTERNAL", scheduledDate: "2026-11-05" },
    ],
  },
  {
    id: "ap-2025", year: 2025, title: "Programa anual de auditorías", objectives: "Cobertura completa del SGC.", scope: "Sede central.",
    status: "COMPLETED", approvedBy: "Laura Méndez", approvedAt: "2025-01-10",
    audits: [{ id: "a4", title: "Auditoría interna ISO 9001 2025", status: "COMPLETED", progress: 100, type: "INTERNAL", scheduledDate: "2025-06-18" }],
  },
];

export default function AuditProgramModule() {
  const { showToast } = useWorkspace();
  const [programs, setPrograms] = useState<DemoProgram[]>(SEED);
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = detailId ? programs.find(p => p.id === detailId) ?? null : null;

  function submitCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") ?? "").trim();
    const year = Number(fd.get("year") ?? 0);
    if (!title) { showToast("Indica el título"); return; }
    const p: DemoProgram = {
      id: uid("ap"), year, title, objectives: String(fd.get("objectives") ?? "").trim(),
      scope: String(fd.get("scope") ?? "").trim(), status: "DRAFT", approvedBy: null, approvedAt: null, audits: [],
    };
    setPrograms(prev => [p, ...prev]);
    setCreating(false);
    showToast("Programa creado (sesión local)");
  }

  function changeStatus(id: string, to: AuditProgramStatus, label: string) {
    setPrograms(prev => prev.map(p => p.id === id ? {
      ...p, status: to,
      approvedBy: to === "APPROVED" ? "Ana García" : to === "DRAFT" ? null : p.approvedBy,
      approvedAt: to === "APPROVED" ? new Date().toISOString() : to === "DRAFT" ? null : p.approvedAt,
    } : p));
    showToast(`${label} ✓`);
  }

  return (
    <div>
      <SectionTitle title="Programa anual de auditorías" sub={`${programs.length} programas · ISO 9001 cláusula 9.2.2`} action="+ Nuevo programa" onAction={() => setCreating(true)} />

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))" }}>
        {programs.map(p => (
          <Card key={p.id} style={{ cursor: "pointer" }} onClick={() => setDetailId(p.id)}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "ui-monospace, monospace", color: "var(--nf-primary-active)", fontSize: 12, fontWeight: 600 }}>{p.year}</div>
                <h3 style={{ margin: "6px 0 5px", fontSize: 18, color: "var(--nf-ink)" }}>{p.title}</h3>
                <div style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{p.audits.filter(a => a.status === "COMPLETED").length}/{p.audits.length} auditorías completadas</div>
              </div>
              <Badge status={programBadge(p.status)} label={PROGRAM_STATUS_LABELS[p.status]} />
            </div>
            <div style={{ marginTop: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--nf-ink-3)", marginBottom: 4 }}>
                <span>Avance del programa</span><span style={{ fontWeight: 700 }}>{avg(p.audits)}%</span>
              </div>
              <ProgressBar value={avg(p.audits)} color={avg(p.audits) >= 80 ? "var(--nf-success)" : avg(p.audits) >= 40 ? "var(--nf-warning)" : "var(--nf-primary)"} height={7} railColor="#eef2f9" />
            </div>
          </Card>
        ))}
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nuevo programa anual" width={540}>
        <form className="nf-modal-form" onSubmit={submitCreate}>
          <div className="nf-grid-2" style={{ gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 700 }}>Año<input name="year" type="number" min="2000" max="2100" className="nf-app-input" style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }} defaultValue={new Date().getFullYear()} required /></label>
            <label style={{ fontSize: 13, fontWeight: 700 }}>Título<input name="title" className="nf-app-input" style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }} required /></label>
          </div>
          <label style={{ fontSize: 13, fontWeight: 700 }}>Objetivos<textarea name="objectives" className="nf-app-input" rows={2} style={{ width: "100%", marginTop: 6, boxSizing: "border-box", resize: "vertical" }} /></label>
          <label style={{ fontSize: 13, fontWeight: 700 }}>Alcance<textarea name="scope" className="nf-app-input" rows={2} style={{ width: "100%", marginTop: 6, boxSizing: "border-box", resize: "vertical" }} /></label>
          <div className="nf-modal-actions">
            <button type="button" className="nf-app-btn-ghost" onClick={() => setCreating(false)}>Cancelar</button>
            <button type="submit" className="nf-app-btn-primary">Crear</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetailId(null)} title={detail ? `${detail.year} · ${detail.title}` : "Programa"} width={720}>
        {detail && (
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Badge status={programBadge(detail.status)} label={PROGRAM_STATUS_LABELS[detail.status]} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {NEXT_ACTIONS[detail.status].map(a => (
                  <button key={a.to} type="button" className={a.primary ? "nf-app-btn-primary" : "nf-app-btn-ghost"} onClick={() => changeStatus(detail.id, a.to, a.label)}>{a.label}</button>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 13, color: "var(--nf-ink-2)", lineHeight: 1.6 }}>
              <strong>Objetivos:</strong> {detail.objectives || "—"}<br />
              <strong>Alcance:</strong> {detail.scope || "—"}<br />
              <strong>Aprobado por:</strong> {detail.approvedBy ?? "—"} · {fmt(detail.approvedAt)}
            </div>
            <section>
              <strong style={{ fontSize: 14 }}>Auditorías del programa · {detail.audits.length}</strong>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {detail.audits.length === 0 && <p style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Sin auditorías enlazadas.</p>}
                {detail.audits.map(a => (
                  <div key={a.id} style={{ padding: 10, border: "1px solid var(--nf-line)", borderRadius: 9 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{a.title}</span>
                      <Badge status={a.status === "COMPLETED" ? "ON_TRACK" : a.status === "CANCELLED" ? "OFF_TRACK" : a.status === "IN_PROGRESS" ? "IN_PROGRESS" : "AT_RISK"} label={AUDIT_STATUS_LABELS[a.status] ?? a.status} />
                    </div>
                    <div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 4 }}>{a.type} · {fmt(a.scheduledDate)} · {a.progress}%</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </Modal>
    </div>
  );
}
