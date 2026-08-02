"use client";

import { useState, type FormEvent } from "react";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { useServerAction } from "@/hooks/useServerAction";
import {
  createDesignProject, updateDesignProject, transitionDesignProject, deleteDesignProject,
  createDesignStage, startDesignStage, completeDesignStage, deleteDesignStage,
} from "@/lib/actions/design-development";
import type { DesignDevelopmentPayload } from "@/lib/design-development/queries";
import {
  CardActions, EmptyOperational, Field, FormModal, inputStyle, Meta,
  OperationalCard, OperationalGrid, OperationalHeader, OperationalMessages,
} from "./OperationalUi";

type Project = DesignDevelopmentPayload["projects"][number];
type Stage = Project["stages"][number];

const STAGE_LABEL: Record<Stage["stageType"], string> = {
  PLANNING: "Planificación", INPUT: "Entradas", OUTPUT: "Salidas", REVIEW: "Revisión",
  VERIFICATION: "Verificación", VALIDATION: "Validación", CHANGE_CONTROL: "Control de cambios", TRANSFER: "Transferencia",
};

const NEXT_PROJECT_STATUS: Record<Project["status"], Project["status"][]> = {
  PLANNING: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["ON_HOLD", "COMPLETED", "CANCELLED"],
  ON_HOLD: ["IN_PROGRESS", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function DesignDevelopmentLive({ initial }: { initial: DesignDevelopmentPayload }) {
  const { run, isPending, error, setError, success } = useServerAction();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [detail, setDetail] = useState<Project | null>(null);
  const [addingStage, setAddingStage] = useState(false);
  const [completing, setCompleting] = useState<Stage | null>(null);

  const memberOptions = initial.members.map((m) => ({ id: m.id, name: m.name }));

  function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const input = {
      name: String(fd.get("name") ?? ""),
      description: String(fd.get("description") ?? "") || undefined,
      ownerId: String(fd.get("ownerId") ?? "") || undefined,
      processId: String(fd.get("processId") ?? "") || undefined,
      plannedStart: String(fd.get("plannedStart") ?? "") || undefined,
      plannedEnd: String(fd.get("plannedEnd") ?? "") || undefined,
    };
    run(() => editing ? updateDesignProject(editing.id, input) : createDesignProject(input), {
      onSuccess: () => { setCreating(false); setEditing(null); },
      successMessage: editing ? "Proyecto actualizado." : "Proyecto de diseño creado.",
    });
  }

  function submitStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    const fd = new FormData(event.currentTarget);
    const input = {
      projectId: detail.id,
      stageType: (String(fd.get("stageType") ?? "PLANNING")) as Stage["stageType"],
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? "") || undefined,
      responsibleId: String(fd.get("responsibleId") ?? "") || undefined,
    };
    run(() => createDesignStage(input), { onSuccess: () => setAddingStage(false), successMessage: "Etapa añadida." });
  }

  function submitComplete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!completing) return;
    const fd = new FormData(event.currentTarget);
    const result = String(fd.get("result") ?? "");
    run(() => completeDesignStage(completing.id, { result }), { onSuccess: () => setCompleting(null), successMessage: "Etapa completada." });
  }

  return <div>
    <OperationalHeader title="Diseño y desarrollo" subtitle="Proyectos con etapas configurables: entradas, salidas, revisión, verificación, validación, transferencia (§8.3)." canCreate={initial.access.canCreate} actionLabel="Nuevo proyecto" onCreate={() => { setError(""); setEditing(null); setCreating(true); }} />
    <OperationalMessages error={error} success={success} />

    {initial.projects.length === 0 ? <EmptyOperational>No hay proyectos de diseño y desarrollo registrados.</EmptyOperational> : <OperationalGrid>
      {initial.projects.map((p) => {
        const completedStages = p.stages.filter((s) => s.status === "COMPLETED").length;
        return <OperationalCard key={p.id} onClick={() => setDetail(p)}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div><div style={{ fontSize: 11, color: "var(--nf-ink-3)", fontWeight: 700 }}>{p.code}</div><h3 style={{ margin: "6px 0", fontSize: 17 }}>{p.name}</h3></div>
            <Badge status={p.status} />
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--nf-ink-3)" }}>{p.stages.length} etapa(s) · {completedStages} completada(s)</div>
          <CardActions canUpdate={initial.access.canUpdate && p.status !== "COMPLETED"} canDelete={initial.access.canDelete && p.status !== "IN_PROGRESS"} pending={isPending} onEdit={() => { setError(""); setEditing(p); setCreating(true); }} onDelete={() => run(() => deleteDesignProject(p.id), { onSuccess: () => setDetail(null), successMessage: "Proyecto eliminado." })} />
        </OperationalCard>;
      })}
    </OperationalGrid>}

    <FormModal open={creating} title={editing ? "Editar proyecto" : "Nuevo proyecto de diseño"} pending={isPending} error={error} onClose={() => { setCreating(false); setEditing(null); setError(""); }} onSubmit={submitProject}>
      <Field label="Nombre"><input name="name" required className="nf-app-input" style={inputStyle} defaultValue={editing?.name ?? ""} /></Field>
      <Field label="Descripción"><textarea name="description" rows={3} className="nf-app-input" style={inputStyle} defaultValue={editing?.description ?? ""} /></Field>
      <div className="nf-grid-2" style={{ gap: 12 }}>
        <Field label="Responsable"><select name="ownerId" className="nf-app-input" style={inputStyle} defaultValue={editing?.ownerId ?? ""}><option value="">Sin asignar</option>{memberOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field label="Proceso"><select name="processId" className="nf-app-input" style={inputStyle} defaultValue={editing?.processId ?? ""}><option value="">Sin asignar</option>{initial.processes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      </div>
      <div className="nf-grid-2" style={{ gap: 12 }}>
        <Field label="Inicio planificado"><input name="plannedStart" type="date" className="nf-app-input" style={inputStyle} defaultValue={editing?.plannedStart?.slice(0, 10) ?? ""} /></Field>
        <Field label="Fin planificado"><input name="plannedEnd" type="date" className="nf-app-input" style={inputStyle} defaultValue={editing?.plannedEnd?.slice(0, 10) ?? ""} /></Field>
      </div>
    </FormModal>

    <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? "Proyecto"} width={760}>{detail && <div style={{ display: "grid", gap: 16 }}>
      <div className="nf-grid-2"><Meta label="Estado" value={detail.status} /><Meta label="Etapas" value={`${detail.stages.length} (${detail.stages.filter((s) => s.status === "COMPLETED").length} completadas)`} /></div>
      <Meta label="Descripción" value={detail.description} />

      {initial.access.canUpdate && (NEXT_PROJECT_STATUS[detail.status] ?? []).length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {NEXT_PROJECT_STATUS[detail.status].map((status) => <button key={status} type="button" className="nf-app-btn-outline" disabled={isPending} onClick={() => run(() => transitionDesignProject(detail.id, status), { onSuccess: () => setDetail({ ...detail, status }), successMessage: `Proyecto movido a ${status}.` })}>Mover a {status.replaceAll("_", " ")}</button>)}
      </div>}

      <div style={{ borderTop: "1px solid var(--nf-line)", paddingTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h4 style={{ margin: 0 }}>Etapas</h4>
          {initial.access.canCreate && <button type="button" className="nf-app-btn-outline" onClick={() => setAddingStage(true)}>Añadir etapa</button>}
        </div>
        {detail.stages.length === 0 ? <div style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Sin etapas todavía. Añade planificación, entradas, salidas, revisión, verificación, validación o transferencia según aplique.</div> : <div style={{ display: "grid", gap: 8 }}>
          {detail.stages.map((s) => <div key={s.id} style={{ border: "1px solid var(--nf-line)", borderRadius: 10, padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div><strong style={{ fontSize: 13 }}>{STAGE_LABEL[s.stageType]}</strong> · {s.title}</div>
              <Badge status={s.status} />
            </div>
            {s.result && <div style={{ marginTop: 6, fontSize: 12, color: "var(--nf-ink-3)" }}>{s.result}</div>}
            {initial.access.canUpdate && s.status !== "COMPLETED" && <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {s.status === "PENDING" && <button type="button" className="nf-app-btn-outline" disabled={isPending} onClick={() => run(() => startDesignStage(s.id), { successMessage: "Etapa iniciada." })}>Iniciar</button>}
              <button type="button" className="nf-app-btn-primary" disabled={isPending} onClick={() => setCompleting(s)}>Completar</button>
              {initial.access.canDelete && <button type="button" className="nf-app-btn-outline" disabled={isPending} onClick={() => run(() => deleteDesignStage(s.id), { successMessage: "Etapa eliminada." })}>Eliminar</button>}
            </div>}
          </div>)}
        </div>}
      </div>
    </div>}</Modal>

    <FormModal open={addingStage} title="Nueva etapa" pending={isPending} error="" onClose={() => setAddingStage(false)} onSubmit={submitStage}>
      <Field label="Tipo de etapa"><select name="stageType" className="nf-app-input" style={inputStyle}>{Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label="Título"><input name="title" required className="nf-app-input" style={inputStyle} /></Field>
      <Field label="Descripción / criterios de aceptación"><textarea name="description" rows={3} className="nf-app-input" style={inputStyle} /></Field>
      <Field label="Responsable"><select name="responsibleId" className="nf-app-input" style={inputStyle}><option value="">Sin asignar</option>{memberOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
    </FormModal>

    <Modal open={!!completing} onClose={() => setCompleting(null)} title={`Completar: ${completing?.title ?? ""}`} width={520}>{completing && <form onSubmit={submitComplete} style={{ display: "grid", gap: 12 }}>
      <Field label="Resultado"><textarea name="result" required rows={4} className="nf-app-input" style={inputStyle} placeholder="Qué se verificó/validó/produjo y con qué criterio." /></Field>
      <button type="submit" className="nf-app-btn-primary" disabled={isPending}>Marcar completada</button>
    </form>}</Modal>
  </div>;
}
