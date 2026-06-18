"use client";
import Link from "next/link";
import { CalendarDays, ClipboardCheck, Plus, Sparkles, Target, TrendingUp, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import Modal from "@/components/ui/Modal";
import AttestationModal from "@/components/compliance/AttestationModal";
import { useWorkspace, type AuditRow, type ChecklistItem, type NcRow } from "@/context/WorkspaceStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import { AUDIT_ACTIONS, createAuditEvent } from "@/lib/domain/audit-event";

export default function AuditsModule() {
  const { state, dispatch, nextNcCode, showToast } = useWorkspace();
  const perm = useDemoPermission();
  const { audits, auditChecklists, auditProgram, nonconformities, actions } = state;
  const [detail, setDetail] = useState<AuditRow | null>(null);
  const [checklistAudit, setChecklistAudit] = useState<AuditRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [findingAudit, setFindingAudit] = useState<AuditRow | null>(null);
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
  const [findingForm, setFindingForm] = useState({
    title: "",
    severity: "MAJOR" as NcRow["severity"],
    owner: "",
    due: new Date().toISOString().slice(0, 10),
    clause: "",
    rootCause: "",
    correction: "",
    correctiveAction: "",
  });

  function dateInDays(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

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
    showToast("Auditoría creada (sesión local)");
  }

  function openChecklist(a: AuditRow) {
    setChecklistAudit(a);
  }

  function openFinding(a: AuditRow) {
    setFindingForm({
      title: "",
      severity: "MAJOR",
      owner: state.session.name,
      due: dateInDays(30),
      clause: "",
      rootCause: "",
      correction: "",
      correctiveAction: "",
    });
    setFindingAudit(a);
    setDetail(null);
  }

  function submitFinding() {
    if (!findingAudit) return;
    if (!findingForm.title.trim()) {
      showToast("Describe el hallazgo / no conformidad");
      return;
    }
    const code = nextNcCode();
    const nc: NcRow = {
      id: `nc-${Date.now()}`,
      code,
      title: findingForm.title.trim(),
      source: "INTERNAL_AUDIT",
      severity: findingForm.severity,
      status: "OPEN",
      owner: findingForm.owner.trim() || state.session.name,
      due: findingForm.due,
      auditId: findingAudit.id,
      auditTitle: findingAudit.title,
      clause: findingForm.clause.trim() || undefined,
      rootCause: findingForm.rootCause.trim() || "Pendiente de análisis",
      correction: findingForm.correction.trim() || "Pendiente de corrección inmediata",
      correctiveAction: findingForm.correctiveAction.trim() || "Pendiente de definir",
    };
    dispatch({ type: "addNc", nc });
    setFindingAudit(null);
    showToast(`Hallazgo ${code} registrado como NC vinculada a la auditoría`);
  }

  function startAudit(a: AuditRow) {
    dispatch({
      type: "updateAudit",
      id: a.id,
      patch: { status: "IN_PROGRESS", progress: Math.max(a.progress, 5) },
    });
    showToast("Auditoría iniciada (sesión local)");
    setDetail(null);
    setChecklistAudit(prev => (prev?.id === a.id ? { ...prev, status: "IN_PROGRESS", progress: Math.max(prev.progress, 5) } : prev));
  }

  function toggleItem(item: ChecklistItem, done: boolean) {
    if (!checklistAudit) return;
    dispatch({ type: "toggleChecklist", auditId: checklistAudit.id, itemId: item.id, done });
  }

  const checklistItems = checklistAudit ? auditChecklists[checklistAudit.id] ?? [] : [];

  const detailLive = useMemo(() => (detail ? audits.find(a => a.id === detail.id) ?? detail : null), [detail, audits]);
  const detailFindings = useMemo(
    () => (detailLive ? nonconformities.filter(n => n.auditId === detailLive.id) : []),
    [detailLive, nonconformities]
  );
  const detailFindingCodes = useMemo(() => new Set(detailFindings.map(n => n.code)), [detailFindings]);
  const detailActions = useMemo(() => actions.filter(a => detailFindingCodes.has(a.source)), [actions, detailFindingCodes]);

  return (
    <div>
      <SectionTitle
        title="Auditorías"
        sub="Programa anual · alcance, criterios y cierre trazable"
        action={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Plus size={17} strokeWidth={2.25} aria-hidden />
            Nueva auditoría
          </span>
        }
        onAction={openCreate}
      />

      <Card style={{ marginBottom: 20, padding: 0, overflow: "hidden", border: "1px solid var(--nf-line)", borderRadius: 16 }}>
        <div style={{ height: 4, background: "linear-gradient(90deg, #123C66, #2E8B57)" }} />
        <div style={{ padding: "20px 22px 22px", background: "linear-gradient(125deg, rgba(18, 60, 102, 0.08) 0%, rgba(46, 139, 87, 0.05) 55%, #fff 100%)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 11,
                background: "rgba(18, 60, 102, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#123C66",
              }}
            >
              <Target size={22} strokeWidth={2.25} aria-hidden />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--nf-ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Programa {auditProgram.programYear}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--nf-ink)", marginTop: 2, letterSpacing: "-0.02em" }}>Plan de auditoría</div>
            </div>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--nf-ink-2)", fontWeight: 600, marginBottom: 10 }}>
            <UserRound size={16} strokeWidth={2.25} aria-hidden style={{ color: "#123C66" }} />
            {auditProgram.programOwner}
          </div>
          <p style={{ fontSize: 13, color: "var(--nf-ink-3)", margin: "0 0 12px", lineHeight: 1.55, fontWeight: 500 }}>{auditProgram.objectives}</p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#123C66", marginBottom: 12 }}>
            <CalendarDays size={15} strokeWidth={2.25} aria-hidden />
            Próxima revisión dirección: {auditProgram.nextManagementReview}
          </div>
          <div>
            <Link href="/app/reporting" style={{ fontSize: 13, color: "#2E8B57", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
              Generar informe de programa →
            </Link>
          </div>
        </div>
      </Card>

      <div className="nf-kpi-summary" style={{ marginBottom: 20 }}>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(18, 60, 102, 0.16) 0%, rgba(18, 60, 102, 0.06) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#123C66",
            }}
          >
            <ClipboardCheck size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#123C66", letterSpacing: "-0.03em", lineHeight: 1 }}>{audits.length}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Total planificadas</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(214, 138, 26, 0.22) 0%, rgba(214, 138, 26, 0.08) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9a6510",
            }}
          >
            <TrendingUp size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#D68A1A", letterSpacing: "-0.03em", lineHeight: 1 }}>{audits.filter(a => a.status === "IN_PROGRESS").length}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>En curso</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(46, 139, 87, 0.18) 0%, rgba(46, 139, 87, 0.06) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1f6f45",
            }}
          >
            <ClipboardCheck size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#2E8B57", letterSpacing: "-0.03em", lineHeight: 1 }}>{audits.filter(a => a.status === "COMPLETED").length}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Completadas</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(201, 60, 55, 0.18) 0%, rgba(201, 60, 55, 0.06) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#C93C37",
            }}
          >
            <Target size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#C93C37", letterSpacing: "-0.03em", lineHeight: 1 }}>{audits.reduce((s, a) => s + a.findings, 0)}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Hallazgos totales</div>
          </div>
        </div>
      </div>

      {audits.length === 0 ? (
        <Card style={{ padding: 44, textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto 14px",
              borderRadius: 16,
              background: "linear-gradient(135deg, #f3f6fa, #e2e8f0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#123C66",
            }}
          >
            <ClipboardCheck size={28} strokeWidth={2} aria-hidden />
          </div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--nf-ink)" }}>Sin auditorías todavía</p>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--nf-ink-3)" }}>Crea la primera con «Nueva auditoría».</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {audits.map(audit => {
            const accent = audit.type === "EXTERNAL" ? "#D68A1A" : "#123C66";
            return (
              <div key={audit.id} className="nf-kpi-card" onClick={() => setDetail(audit)} role="button" tabIndex={0} onKeyDown={e => (e.key === "Enter" || e.key === " ") && setDetail(audit)}>
                <div style={{ height: 4, background: `linear-gradient(90deg, ${accent}, ${accent}88)` }} />
                <div style={{ padding: "16px 18px 18px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: audit.status !== "PLANNED" ? 14 : 0, flexWrap: "wrap", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            background: audit.type === "EXTERNAL" ? "#fff4e0" : "#e8f0fa",
                            color: audit.type === "EXTERNAL" ? "#9a6510" : "#123C66",
                            padding: "4px 10px",
                            borderRadius: 99,
                            letterSpacing: "0.02em",
                          }}
                        >
                          {audit.type === "EXTERNAL" ? "Externa" : "Interna"}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, background: "#f3f6fa", color: "var(--nf-ink-2)", padding: "4px 10px", borderRadius: 99, border: "1px solid rgba(18, 60, 102, 0.1)" }}>{audit.standard}</span>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--nf-ink)", marginBottom: 6, letterSpacing: "-0.02em", lineHeight: 1.3 }}>{audit.title}</div>
                      <div style={{ fontSize: 12, color: "var(--nf-ink-3)", fontWeight: 600 }}>
                        Auditor: {audit.auditor} · Fecha: {audit.date}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                      {audit.findings > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 800, background: "#fdecec", color: "#C93C37", padding: "4px 10px", borderRadius: 99 }}>{audit.findings} hallazgos</span>
                      )}
                      <Badge status={audit.status} />
                    </div>
                  </div>
                  {audit.status !== "PLANNED" && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--nf-ink-3)", marginBottom: 6, fontWeight: 600 }}>
                        <span>Progreso de ejecución</span>
                        <span style={{ fontWeight: 800, color: accent }}>{audit.progress}%</span>
                      </div>
                      <ProgressBar value={audit.progress} color={audit.status === "COMPLETED" ? "#2E8B57" : accent} height={7} railColor="#eef2f9" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
                ["Hallazgos / NC", detailFindings.length],
                ["Críticos", detailFindings.filter(n => n.severity === "CRITICAL").length],
                ["Progreso", `${detailLive.progress}%`],
              ].map(([k, v]) => (
                <div key={String(k)} style={{ background: "var(--nf-app-surface-2)", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--nf-ink-3)", marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--nf-ink)" }}>{v}</div>
                </div>
              ))}
            </div>
            {detailLive.scope && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "var(--nf-ink-3)", marginBottom: 4 }}>ALCANCE</div>
                <div style={{ fontSize: 13, color: "var(--nf-ink)" }}>{detailLive.scope}</div>
              </div>
            )}
            {detailLive.objectives && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "var(--nf-ink-3)", marginBottom: 4 }}>OBJETIVOS / CRITERIOS</div>
                <div style={{ fontSize: 13, color: "var(--nf-ink)" }}>{detailLive.objectives}</div>
              </div>
            )}
            <div style={{ marginBottom: 16, padding: 12, background: "#fff8f0", borderRadius: 8, border: "1px solid #f5e0c8" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--nf-ink)" }}>Hallazgos / NC vinculadas</div>
                  <div style={{ fontSize: 11, color: "var(--nf-ink-3)", marginTop: 2 }}>
                    {detailActions.length} acciones derivadas en el plan global
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openFinding(detailLive)}
                  style={{ background: "#123C66", color: "#fff", border: "none", borderRadius: 9, padding: "8px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
                >
                  Registrar hallazgo
                </button>
              </div>
              {detailFindings.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--nf-ink-3)", lineHeight: 1.5 }}>
                  Todavía no hay NC vinculadas a esta auditoría.
                </div>
              ) : (
                detailFindings.map(nc => {
                  const actionCount = actions.filter(a => a.source === nc.code).length;
                  return (
                    <div key={nc.id} style={{ fontSize: 12, marginBottom: 8, color: "var(--nf-ink)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <Badge status={nc.severity === "CRITICAL" ? "CRITICAL" : nc.severity === "MAJOR" ? "MAJOR" : "MINOR"} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700 }}>{nc.code} · {nc.title}</div>
                        <div style={{ color: "var(--nf-ink-3)", marginTop: 2 }}>
                          {nc.clause ? `Cláusula ${nc.clause} · ` : ""}{actionCount} acciones vinculadas
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
                <Link href="/app/nonconformities" style={{ fontSize: 12, color: "#123C66", fontWeight: 700, textDecoration: "none" }}>
                  Gestionar en No conformidades →
                </Link>
                <Link href="/app/actions" style={{ fontSize: 12, color: "#2E8B57", fontWeight: 700, textDecoration: "none" }}>
                  Ver plan de acción →
                </Link>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {detailLive.status === "PLANNED" && (
                  <button
                    type="button"
                    onClick={() => startAudit(detailLive)}
                    style={{ flex: 1, minWidth: 140, background: "#123C66", color: "#fff", border: "none", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
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
                    background: detailLive.status === "PLANNED" ? "var(--nf-app-surface-2)" : "#123C66",
                    color: detailLive.status === "PLANNED" ? "#123C66" : "#fff",
                    border: "1px solid var(--nf-line)",
                    borderRadius: 10,
                    padding: "10px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Ver Checklist
                </button>
                {perm.audits.manage && detailLive.status !== "COMPLETED" && detailLive.status !== "PLANNED" && (
                  <button
                    type="button"
                    onClick={() => setCloseAuditAttest(detailLive)}
                    style={{ flex: 1, minWidth: 140, background: "#2E8B57", color: "#fff", border: "none", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                  >
                    Cierre formal
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => showToast("Resumen de hallazgos: revisa NC vinculadas y acciones derivadas.")}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: "#2E8B5718",
                  color: "#2E8B57",
                  border: "1px solid #2E8B5740",
                  borderRadius: 10,
                  padding: "10px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Sparkles size={15} strokeWidth={2} aria-hidden />
                IA: Resumir hallazgos
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!checklistAudit} onClose={() => setChecklistAudit(null)} title={checklistAudit ? `Checklist — ${checklistAudit.title}` : ""} width={640}>
        {checklistAudit && (
          <div>
            <p style={{ fontSize: 13, color: "var(--nf-ink-3)", marginTop: 0 }}>Marca ítems completados. Los cambios se guardan en la sesión actual.</p>
            <div style={{ maxHeight: 400, overflow: "auto", border: "1px solid var(--nf-line)", borderRadius: 12 }}>
              {checklistItems.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--nf-ink-3)" }}>Sin ítems de checklist.</div>
              ) : (
                checklistItems.map(item => (
                  <label
                    key={item.id}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      padding: "12px 14px",
                      borderBottom: "1px solid var(--nf-line)",
                      cursor: "pointer",
                      background: item.done ? "#f0fdf4" : "transparent",
                    }}
                  >
                    <input type="checkbox" checked={item.done} onChange={e => toggleItem(item, e.target.checked)} style={{ marginTop: 3 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: "#123C66", fontWeight: 600 }}>Cláusula {item.clause}</div>
                      <div style={{ fontSize: 13, color: "var(--nf-ink)" }}>{item.requirement}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
            <button type="button" onClick={() => setChecklistAudit(null)} style={{ marginTop: 14, width: "100%", background: "#123C66", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Cerrar
            </button>
          </div>
        )}
      </Modal>

      <Modal open={!!findingAudit} onClose={() => setFindingAudit(null)} title={findingAudit ? `Registrar hallazgo — ${findingAudit.title}` : "Registrar hallazgo"} width={560}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
            Descripción del hallazgo / NC
            <textarea
              className="nf-app-input"
              value={findingForm.title}
              onChange={e => setFindingForm({ ...findingForm, title: e.target.value })}
              rows={3}
              style={{ width: "100%", marginTop: 6, boxSizing: "border-box", resize: "vertical" }}
            />
          </label>
          <div className="nf-grid-2" style={{ gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
              Severidad
              <select
                className="nf-app-input"
                value={findingForm.severity}
                onChange={e => setFindingForm({ ...findingForm, severity: e.target.value as NcRow["severity"] })}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box", cursor: "pointer" }}
              >
                <option value="MINOR">Menor</option>
                <option value="MAJOR">Mayor</option>
                <option value="CRITICAL">Crítica</option>
              </select>
            </label>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
              Cláusula
              <input
                className="nf-app-input"
                value={findingForm.clause}
                onChange={e => setFindingForm({ ...findingForm, clause: e.target.value })}
                placeholder="Ej. 8.5"
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
              />
            </label>
          </div>
          <div className="nf-grid-2" style={{ gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
              Responsable
              <input
                className="nf-app-input"
                value={findingForm.owner}
                onChange={e => setFindingForm({ ...findingForm, owner: e.target.value })}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
              Fecha límite
              <input
                className="nf-app-input"
                type="date"
                value={findingForm.due}
                onChange={e => setFindingForm({ ...findingForm, due: e.target.value })}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
              />
            </label>
          </div>
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
            Causa raíz (borrador)
            <textarea
              className="nf-app-input"
              value={findingForm.rootCause}
              onChange={e => setFindingForm({ ...findingForm, rootCause: e.target.value })}
              rows={2}
              style={{ width: "100%", marginTop: 6, boxSizing: "border-box", resize: "vertical" }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
            Acción correctiva propuesta
            <textarea
              className="nf-app-input"
              value={findingForm.correctiveAction}
              onChange={e => setFindingForm({ ...findingForm, correctiveAction: e.target.value })}
              rows={2}
              style={{ width: "100%", marginTop: 6, boxSizing: "border-box", resize: "vertical" }}
            />
          </label>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={submitFinding} style={{ flex: 1, background: "#123C66", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Registrar como NC
            </button>
            <button type="button" onClick={() => setFindingAudit(null)} style={{ flex: 1, background: "transparent", border: "1px solid var(--nf-line)", borderRadius: 10, padding: "11px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--nf-ink-3)" }}>
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nueva auditoría" width={520}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
            Título
            <input
              className="nf-app-input"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
            />
          </label>
          <div className="nf-grid-2" style={{ gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
              Tipo
              <select
                className="nf-app-input"
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value as AuditRow["type"] })}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box", cursor: "pointer" }}
              >
                <option value="INTERNAL">Interna</option>
                <option value="EXTERNAL">Externa</option>
              </select>
            </label>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
              Norma
              <input
                className="nf-app-input"
                value={form.standard}
                onChange={e => setForm({ ...form, standard: e.target.value })}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
              />
            </label>
          </div>
          <div className="nf-grid-2" style={{ gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
              Fecha
              <input
                className="nf-app-input"
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
              Auditor
              <input
                className="nf-app-input"
                value={form.auditor}
                onChange={e => setForm({ ...form, auditor: e.target.value })}
                style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}
              />
            </label>
          </div>
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
            Alcance
            <textarea
              className="nf-app-input"
              value={form.scope}
              onChange={e => setForm({ ...form, scope: e.target.value })}
              rows={2}
              style={{ width: "100%", marginTop: 6, boxSizing: "border-box", resize: "vertical" }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
            Objetivos
            <textarea
              className="nf-app-input"
              value={form.objectives}
              onChange={e => setForm({ ...form, objectives: e.target.value })}
              rows={2}
              style={{ width: "100%", marginTop: 6, boxSizing: "border-box", resize: "vertical" }}
            />
          </label>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={submitCreate} style={{ flex: 1, background: "#123C66", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Crear
            </button>
            <button type="button" onClick={() => setCreateOpen(false)} style={{ flex: 1, background: "transparent", border: "1px solid var(--nf-line)", borderRadius: 10, padding: "11px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--nf-ink-3)" }}>
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
