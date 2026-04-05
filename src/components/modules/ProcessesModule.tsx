"use client";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import {
  useWorkspace,
  type ProcessRow,
  type DocumentRow,
  type RiskRow,
  type IndicatorRow,
  type ChangeRequestRow,
  type TrainingAssignmentRow,
  type TrainingCourseRow,
} from "@/context/WorkspaceStore";

function linkBlock(title: string, href: string, children: ReactNode) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <span style={{ fontWeight: 700, color: "#5E6B7A", fontSize: 11 }}>{title}</span>
        <Link href={href} style={{ fontSize: 11, color: "#123C66", fontWeight: 600 }}>
          Abrir módulo →
        </Link>
      </div>
      {children}
    </div>
  );
}

function ProcessDetailBody({
  detail,
  documents,
  risks,
  indicators,
  changeRequests,
  trainingAssignments,
  trainingCourses,
}: {
  detail: ProcessRow;
  documents: DocumentRow[];
  risks: RiskRow[];
  indicators: IndicatorRow[];
  changeRequests: ChangeRequestRow[];
  trainingAssignments: TrainingAssignmentRow[];
  trainingCourses: TrainingCourseRow[];
}) {
  const linkedDocs = useMemo(() => {
    const byCode = documents.filter(d => detail.linkedDocCodes?.includes(d.code));
    const byProcess = documents.filter(d => d.linkedProcessCode === detail.code);
    const m = new Map<string, DocumentRow>();
    for (const d of [...byCode, ...byProcess]) m.set(d.id, d);
    return [...m.values()];
  }, [detail.code, detail.linkedDocCodes, documents]);

  const linkedRisks = useMemo(
    () => risks.filter(r => detail.linkedRiskCodes?.includes(r.code)),
    [detail.linkedRiskCodes, risks]
  );
  const linkedIndicators = useMemo(
    () => indicators.filter(i => detail.linkedIndicatorNames?.includes(i.name)),
    [detail.linkedIndicatorNames, indicators]
  );
  const linkedChanges = useMemo(
    () => changeRequests.filter(c => c.processCodes?.includes(detail.code)),
    [changeRequests, detail.code]
  );
  const processTraining = useMemo(
    () => trainingAssignments.filter(t => t.processCode === detail.code),
    [detail.code, trainingAssignments]
  );

  function courseTitle(id: string) {
    return trainingCourses.find(c => c.id === id)?.title ?? id;
  }

  function trainStatusLabel(s: TrainingAssignmentRow["status"]) {
    const map: Record<string, string> = {
      ASSIGNED: "Asignado",
      IN_PROGRESS: "En progreso",
      COMPLETED: "Completado",
      OVERDUE: "Vencido",
      RETRAINING_REQUIRED: "Reentrenamiento",
    };
    return map[s] ?? s;
  }

  function changeStatusLabel(s: ChangeRequestRow["status"]) {
    const map: Record<string, string> = {
      DRAFT: "Borrador",
      SUBMITTED: "Enviado",
      UNDER_REVIEW: "En revisión",
      APPROVED: "Aprobado",
      REJECTED: "Rechazado",
      IMPLEMENTED: "Implementado",
      VERIFIED: "Verificado",
      CLOSED: "Cerrado",
    };
    return map[s] ?? s;
  }

  return (
    <div style={{ fontSize: 14, color: "#142033" }}>
      <p style={{ marginTop: 0, color: "#5E6B7A" }}>
        {detail.code} · {detail.type} · Responsable: <strong style={{ color: "#142033" }}>{detail.owner}</strong>
      </p>
      {detail.description && <p style={{ lineHeight: 1.55 }}>{detail.description}</p>}
      <div className="nf-grid-2" style={{ gap: 16, marginTop: 16 }}>
        <div>
          <div style={{ fontWeight: 700, color: "#5E6B7A", fontSize: 11, marginBottom: 6 }}>ENTRADAS</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {detail.inputs.map((i, idx) => (
              <li key={idx}>{i}</li>
            ))}
          </ul>
        </div>
        <div>
          <div style={{ fontWeight: 700, color: "#5E6B7A", fontSize: 11, marginBottom: 6 }}>SALIDAS</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {detail.outputs.map((o, idx) => (
              <li key={idx}>{o}</li>
            ))}
          </ul>
        </div>
      </div>

      <div
        style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: "1px solid #E5EAF2",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: "#123C66", marginBottom: 4 }}>Cumplimiento y vínculos</div>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#5E6B7A", lineHeight: 1.5 }}>
          Trazabilidad entre proceso, documentos controlados, riesgos, indicadores, cambios y formación asignada al mismo código de proceso.
        </p>

        {linkBlock(
          "Documentos",
          "/app/documents",
          linkedDocs.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {linkedDocs.map(d => (
                <li key={d.id}>
                  <span style={{ fontWeight: 600 }}>{d.code}</span> — {d.title}{" "}
                  <span style={{ color: "#9aa5b1" }}>({d.status})</span>
                </li>
              ))}
            </ul>
          ) : (
            <span style={{ fontSize: 12, color: "#9aa5b1" }}>Ninguno enlazado por código o proceso.</span>
          )
        )}

        {linkBlock(
          "Riesgos",
          "/app/risks",
          linkedRisks.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {linkedRisks.map(r => (
                <li key={r.id}>
                  <span style={{ fontWeight: 600 }}>{r.code}</span> — {r.title}{" "}
                  <span style={{ color: "#9aa5b1" }}>· {r.owner}</span>
                </li>
              ))}
            </ul>
          ) : (
            <span style={{ fontSize: 12, color: "#9aa5b1" }}>Sin riesgos vinculados en el mapa demo.</span>
          )
        )}

        {linkBlock(
          "Indicadores",
          "/app/indicators",
          linkedIndicators.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {linkedIndicators.map(ind => (
                <li key={ind.id}>
                  {ind.name} — <span style={{ color: "#5E6B7A" }}>{ind.value}</span> / objetivo {ind.target} {ind.unit}
                </li>
              ))}
            </ul>
          ) : (
            <span style={{ fontSize: 12, color: "#9aa5b1" }}>Sin KPI enlazados.</span>
          )
        )}

        {linkBlock(
          "Control de cambios",
          "/app/changes",
          linkedChanges.length ? (
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", fontSize: 13 }}>
              {linkedChanges.map(c => (
                <li key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600 }}>{c.code}</span>
                  <span>{c.title}</span>
                  <Badge
                    status={
                      c.status === "CLOSED" || c.status === "VERIFIED"
                        ? "ON_TRACK"
                        : c.status === "REJECTED"
                          ? "OFF_TRACK"
                          : "AT_RISK"
                    }
                    label={changeStatusLabel(c.status)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <span style={{ fontSize: 12, color: "#9aa5b1" }}>No hay solicitudes de cambio con este proceso.</span>
          )
        )}

        {linkBlock(
          "Formación",
          "/app/training",
          processTraining.length ? (
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", fontSize: 13 }}>
              {processTraining.map(t => (
                <li key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  <span>{t.assigneeName}</span>
                  <span style={{ color: "#5E6B7A" }}>· {courseTitle(t.courseId)}</span>
                  <Badge
                    status={
                      t.status === "COMPLETED"
                        ? "COMPLETED"
                        : t.status === "OVERDUE" || t.status === "RETRAINING_REQUIRED"
                          ? "OPEN"
                          : "IN_PROGRESS"
                    }
                    label={trainStatusLabel(t.status)}
                  />
                  {t.triggeredByDocumentCode && (
                    <span style={{ fontSize: 11, color: "#9aa5b1" }}>Doc {t.triggeredByDocumentCode}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <span style={{ fontSize: 12, color: "#9aa5b1" }}>Sin asignaciones con código de proceso {detail.code}.</span>
          )
        )}
      </div>
    </div>
  );
}

export default function ProcessesModule() {
  const { state, dispatch, showToast } = useWorkspace();
  const { processes, documents, risks, indicators, changeRequests, trainingAssignments, trainingCourses } = state;
  const [detail, setDetail] = useState<ProcessRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", type: "core", description: "", owner: "", inputs: "", outputs: "" });

  function openCreate() {
    setForm({ name: "", code: "", type: "core", description: "", owner: state.session.name, inputs: "", outputs: "" });
    setCreateOpen(true);
  }

  function submitCreate() {
    if (!form.name.trim()) {
      showToast("Indica el nombre del proceso");
      return;
    }
    const p: ProcessRow = {
      id: `p-${Date.now()}`,
      name: form.name.trim(),
      code: form.code.trim() || `P-${String(processes.length + 1).padStart(2, "0")}`,
      type: form.type as ProcessRow["type"],
      description: form.description.trim() || "",
      owner: form.owner.trim() || state.session.name,
      inputs: form.inputs
        .split(",")
        .map(s => s.trim())
        .filter(Boolean),
      outputs: form.outputs
        .split(",")
        .map(s => s.trim())
        .filter(Boolean),
      siteId: `${state.session.activeOrgId}-s1`,
      linkedRiskCodes: [],
      linkedDocCodes: [],
      linkedIndicatorNames: [],
    };
    dispatch({ type: "addProcess", p });
    setCreateOpen(false);
    showToast("Proceso añadido (sesión demo)");
  }

  return (
    <div>
      <SectionTitle title="Mapa de procesos" sub={`${processes.length} procesos en el espacio de trabajo`} action="+ Nuevo proceso" onAction={openCreate} />

      {processes.length === 0 ? (
        <Card style={{ padding: 40, textAlign: "center", color: "#5E6B7A" }}>
          <p style={{ margin: 0 }}>Aún no hay procesos. Crea el primero para enlazar documentos, riesgos e indicadores.</p>
        </Card>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {processes.map(p => (
            <Card key={p.id} onClick={() => setDetail(p)} style={{ padding: "20px 22px", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#123C66", marginBottom: 4 }}>{p.code || "—"}</div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "#142033", margin: "0 0 6px" }}>{p.name}</h3>
                  {p.type && (
                    <span style={{ fontSize: 11, background: "#F7F9FC", border: "1px solid #E5EAF2", padding: "2px 8px", borderRadius: 99, color: "#5E6B7A" }}>{p.type}</span>
                  )}
                  {p.description && <p style={{ fontSize: 14, color: "#5E6B7A", marginTop: 10, lineHeight: 1.55, marginBottom: 0 }}>{p.description}</p>}
                  <p style={{ fontSize: 12, color: "#5E6B7A", marginTop: 8 }}>Responsable: {p.owner}</p>
                </div>
              </div>
              <div className="nf-grid-2" style={{ gap: 16, marginTop: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#5E6B7A", textTransform: "uppercase", marginBottom: 6 }}>Entradas</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#142033" }}>
                    {p.inputs.map((i, idx) => (
                      <li key={idx}>{i}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#5E6B7A", textTransform: "uppercase", marginBottom: 6 }}>Salidas</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#142033" }}>
                    {p.outputs.map((o, idx) => (
                      <li key={idx}>{o}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ""} width={640}>
        {detail && (
          <ProcessDetailBody
            detail={detail}
            documents={documents}
            risks={risks}
            indicators={indicators}
            changeRequests={changeRequests}
            trainingAssignments={trainingAssignments}
            trainingCourses={trainingCourses}
          />
        )}
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo proceso" width={520}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Nombre
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
            />
          </label>
          <div className="nf-grid-2" style={{ gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Código
              <input
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value })}
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Tipo
              <select
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              >
                <option value="core">Core</option>
                <option value="support">Soporte</option>
              </select>
            </label>
          </div>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Responsable
            <input
              value={form.owner}
              onChange={e => setForm({ ...form, owner: e.target.value })}
              style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Descripción
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Entradas (separadas por coma)
            <input
              value={form.inputs}
              onChange={e => setForm({ ...form, inputs: e.target.value })}
              style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Salidas (separadas por coma)
            <input
              value={form.outputs}
              onChange={e => setForm({ ...form, outputs: e.target.value })}
              style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
            />
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
    </div>
  );
}
