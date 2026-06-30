"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileDown, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import ProgressBar from "@/components/ui/ProgressBar";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { DEMO_GAP } from "@/lib/demo-data";
import type { GapPayload } from "@/lib/server-queries";
import { updateAssessmentAnswer } from "@/lib/actions/gap";
import { useWorkspace } from "@/context/WorkspaceStore";
import type { GapClauseState } from "@/lib/demo/seed-entities";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import type { ClauseStatus } from "@prisma/client";

type GapRow = (typeof DEMO_GAP)["iso9001"][number];
type LiveGapRow = NonNullable<GapPayload["iso9001"]>[number];

const CLAUSE_STATUS_OPTIONS: { value: ClauseStatus; label: string }[] = [
  { value: "COMPLIANT", label: "Conforme" },
  { value: "PARTIALLY_COMPLIANT", label: "Parcialmente conforme" },
  { value: "NON_COMPLIANT", label: "No conforme" },
  { value: "NOT_EVALUATED", label: "Sin evaluar" },
  { value: "NOT_APPLICABLE", label: "No aplica" },
];

function mapWorkspaceRow(g: GapClauseState): GapRow {
  return {
    clause: g.clause,
    title: g.title,
    score: g.score,
    questions: g.questions,
    answered: g.answered,
    status: g.status,
  };
}

export default function GapModule({ live }: { live?: GapPayload | null }) {
  const { state, dispatch, showToast } = useWorkspace();
  const perm = useDemoPermission();
  const canEdit = perm.gap.manage;

  const readOnlyLive = live != null;

  const [standard, setStandard] = useState<"iso9001" | "iso27001">("iso9001");
  const [clauseModal, setClauseModal] = useState<GapClauseState | null>(null);
  const [commentDraft, setCommentDraft] = useState("");

  // Live (DB-backed) clause editing
  const router = useRouter();
  const [liveEdit, setLiveEdit] = useState<LiveGapRow | null>(null);
  const [editScore, setEditScore] = useState(0);
  const [editStatus, setEditStatus] = useState<ClauseStatus>("NOT_EVALUATED");
  const [editComment, setEditComment] = useState("");
  const [editError, setEditError] = useState("");
  const [isPending, startTransition] = useTransition();
  const liveEditable = readOnlyLive && canEdit;

  const fromDb = standard === "iso9001" ? live?.iso9001 : live?.iso27001;

  const data: GapRow[] = useMemo(() => {
    if (readOnlyLive) {
      return (fromDb ?? []).map(r => ({
        clause: r.clause,
        title: r.title,
        score: r.score,
        questions: r.questions,
        answered: r.answered,
        status: r.status,
      }));
    }
    const src = standard === "iso9001" ? state.gapIso9001 : state.gapIso27001;
    return src.map(mapWorkspaceRow);
  }, [readOnlyLive, fromDb, standard, state.gapIso9001, state.gapIso27001]);

  const fullClause = useMemo(() => {
    if (!clauseModal) return null;
    const list = standard === "iso9001" ? state.gapIso9001 : state.gapIso27001;
    return list.find(c => c.clause === clauseModal.clause) ?? clauseModal;
  }, [clauseModal, standard, state.gapIso9001, state.gapIso27001]);

  const avg = Math.round(data.reduce((s, g) => s + g.score, 0) / Math.max(1, data.length));
  const compliant = data.filter(g => g.status === "COMPLIANT").length;
  const partial = data.filter(g => g.status === "PARTIALLY_COMPLIANT").length;
  const nonCompliant = data.filter(g => g.status === "NON_COMPLIANT").length;

  const weakClauses = data.filter(g => g.score < 70).slice(0, 4);

  function exportPdf() {
    window.print();
  }

  function openClause(row: GapRow) {
    if (readOnlyLive) {
      if (!liveEditable) return;
      const liveRow = (fromDb ?? []).find(r => r.clause === row.clause);
      if (!liveRow) return;
      setLiveEdit(liveRow);
      setEditScore(liveRow.score);
      setEditStatus(liveRow.clauseStatus);
      setEditComment(liveRow.comment ?? "");
      setEditError("");
      return;
    }
    const list = standard === "iso9001" ? state.gapIso9001 : state.gapIso27001;
    const full = list.find(c => c.clause === row.clause);
    if (full) {
      setClauseModal(full);
      setCommentDraft(full.comment);
    }
  }

  function closeLiveEdit() {
    if (isPending) return;
    setLiveEdit(null);
    setEditError("");
  }

  function saveLiveEdit() {
    if (!liveEdit) return;
    setEditError("");
    startTransition(async () => {
      try {
        await updateAssessmentAnswer(liveEdit.answerId, {
          score: editScore,
          status: editStatus,
          comment: editComment,
        });
        setLiveEdit(null);
        showToast("Evaluación de la cláusula guardada");
        router.refresh();
      } catch (err) {
        setEditError(err instanceof Error ? err.message : "No se pudo guardar la evaluación.");
      }
    });
  }

  function saveComment() {
    if (!fullClause || readOnlyLive || !canEdit) return;
    dispatch({
      type: "updateGapComment",
      standard,
      clause: fullClause.clause,
      comment: commentDraft.trim(),
    });
    showToast("Comentario guardado");
  }

  function setAnswer(questionId: string, answer: "YES" | "NO" | "NA") {
    if (!fullClause || readOnlyLive || !canEdit) return;
    dispatch({ type: "updateGapQuestion", standard, clause: fullClause.clause, questionId, answer });
  }

  function aiSuggest() {
    showToast("Borrador IA: priorizar cláusulas con score bajo 70% y vincular acciones correctivas en el Plan de Acción.");
  }

  return (
    <div>
      <SectionTitle
        title="GAP Assessment"
        sub={readOnlyLive ? (liveEditable ? "Datos de tu organización — pulse una cláusula para evaluar" : "Datos desde tu organización (solo lectura)") : "Evaluación de brechas — respuestas editables en el workspace"}
        action={
          <>
            <FileDown size={15} strokeWidth={2} aria-hidden />
            Exportar PDF
          </>
        }
        onAction={exportPdf}
      />

      {!readOnlyLive && !canEdit && (
        <p style={{ fontSize: 13, color: "#D97706", marginBottom: 16 }}>
          Su rol no permite editar respuestas GAP. Puede revisar puntuaciones y exportar.
        </p>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[{ key: "iso9001", label: "ISO 9001:2015" }, { key: "iso27001", label: "ISO 27001:2022" }].map(s => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStandard(s.key as "iso9001" | "iso27001")}
            style={{
              padding: "7px 18px",
              borderRadius: 8,
              border: `1px solid ${standard === s.key ? "#5266F6" : "var(--nf-line)"}`,
              background: standard === s.key ? "#5266F6" : "transparent",
              color: standard === s.key ? "#fff" : "var(--nf-ink-3)",
              fontSize: 13,
              fontWeight: standard === s.key ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="nf-app-split-2">
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 13, color: "var(--nf-ink-3)", marginBottom: 4 }}>Cumplimiento Global</div>
              <div
                style={{
                  fontSize: 44,
                  fontWeight: 600,
                  color: avg >= 80 ? "#16A34A" : avg >= 60 ? "#D97706" : "#DC2626",
                  lineHeight: 1,
                }}
              >
                {avg}%
              </div>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              {[
                { label: "Conforme", count: compliant, color: "#16A34A" },
                { label: "Parcial", count: partial, color: "#D97706" },
                { label: "No conforme", count: nonCompliant, color: "#DC2626" },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 600, color: s.color }}>{s.count}</div>
                  <div style={{ fontSize: 11, color: "var(--nf-ink-3)" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {data.map(g => (
              <button
                key={g.clause}
                type="button"
                onClick={() => openClause(g)}
                disabled={readOnlyLive && !liveEditable}
                style={{
                  textAlign: "left",
                  background: readOnlyLive && !liveEditable ? "transparent" : "#f3f6fa",
                  border: "1px solid rgba(82, 102, 246, 0.08)",
                  borderRadius: 10,
                  padding: "12px 14px",
                  cursor: readOnlyLive && !liveEditable ? "default" : "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#5266F6", marginRight: 8 }}>{g.clause}.</span>
                    <span style={{ fontSize: 13, color: "var(--nf-ink)", fontWeight: 500 }}>{g.title}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: g.score >= 80 ? "#16A34A" : g.score >= 60 ? "#D97706" : "#DC2626",
                      }}
                    >
                      {g.score}%
                    </span>
                    <Badge
                      status={g.status === "COMPLIANT" ? "ON_TRACK" : g.status === "PARTIALLY_COMPLIANT" ? "AT_RISK" : "OFF_TRACK"}
                      label={g.status === "COMPLIANT" ? "Conforme" : g.status === "PARTIALLY_COMPLIANT" ? "Parcialmente" : "No conforme"}
                    />
                  </div>
                </div>
                <ProgressBar value={g.score} color={g.score >= 80 ? "#16A34A" : g.score >= 60 ? "#D97706" : "#DC2626"} height={7} railColor="#eef2f9" />
                <div style={{ fontSize: 11, color: "var(--nf-ink-3)", marginTop: 3 }}>
                  {g.answered}/{g.questions} respuestas · {(!readOnlyLive && canEdit) || liveEditable ? "Pulse para editar" : "Detalle"}
                </div>
              </button>
            ))}
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--nf-ink)", marginBottom: 14 }}>Resumen ejecutivo</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ProgressBar value={avg} color={avg >= 80 ? "#16A34A" : avg >= 60 ? "#D97706" : "#DC2626"} height={10} railColor="#eef2f9" />
              <div style={{ fontSize: 13, color: "var(--nf-ink-3)", lineHeight: 1.5 }}>
                {avg < 60
                  ? "Se requieren acciones urgentes antes de una auditoría de certificación."
                  : avg < 80
                    ? "Mejoras focalizadas en cláusulas parciales reducirán el riesgo de hallazgos mayores."
                    : "El sistema muestra madurez alineada con los requisitos; mantenga evidencias al día."}
              </div>
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--nf-ink)", marginBottom: 12 }}>Recomendaciones</div>
            {weakClauses.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--nf-ink-3)", margin: 0 }}>No hay cláusulas críticas por debajo del umbral del 70%.</p>
            ) : (
              weakClauses.map((g, i) => (
                <div
                  key={g.clause}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "7px 0",
                    borderBottom: i < weakClauses.length - 1 ? "1px solid var(--nf-line)" : "none",
                    alignItems: "flex-start",
                  }}
                >
                  <Badge status="AT_RISK" label={g.clause} />
                  <span style={{ fontSize: 12, color: "var(--nf-ink)" }}>
                    Reforzar evidencias en «{g.title}» (score {g.score}%).
                  </span>
                </div>
              ))
            )}
          </Card>

          <button
            type="button"
            onClick={exportPdf}
            className="nf-app-btn-primary"
            style={{ width: "100%" }}
          >
            <FileDown size={17} strokeWidth={2} aria-hidden />
            Exportar informe completo
          </button>
          <button
            type="button"
            onClick={aiSuggest}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: "transparent",
              color: "#16A34A",
              border: "1px solid #16A34A50",
              borderRadius: 10,
              padding: "11px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              width: "100%",
            }}
          >
            <Sparkles size={16} strokeWidth={2} aria-hidden />
            Sugerencia IA para plan de acción
          </button>
        </div>
      </div>

      {fullClause && (
        <Modal
          open={!!fullClause}
          title={`Cláusula ${fullClause.clause} · ${fullClause.title}`}
          onClose={() => {
            setClauseModal(null);
            setCommentDraft("");
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginBottom: 6 }}>
              Puntuación {fullClause.score}% · {fullClause.answered}/{fullClause.questions} respuestas
            </div>
            <ProgressBar value={fullClause.score} color={fullClause.score >= 80 ? "#16A34A" : fullClause.score >= 60 ? "#D97706" : "#DC2626"} height={8} railColor="#eef2f9" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {fullClause.questionsDetail.map(q => (
              <div key={q.id} style={{ paddingBottom: 12, borderBottom: "1px solid var(--nf-line)" }}>
                <p style={{ fontSize: 13, color: "var(--nf-ink)", margin: "0 0 8px", lineHeight: 1.45 }}>{q.text}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(["YES", "NO", "NA"] as const).map(a => (
                    <button
                      key={a}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setAnswer(q.id, a)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: `1px solid ${q.answer === a ? "#5266F6" : "var(--nf-line)"}`,
                        background: q.answer === a ? "#5266F6" : "#f3f6fa",
                        color: q.answer === a ? "#fff" : "var(--nf-ink)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: canEdit ? "pointer" : "not-allowed",
                        opacity: canEdit ? 1 : 0.55,
                      }}
                    >
                      {a === "YES" ? "Sí" : a === "NO" ? "No" : "N/A"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <label>Comentarios / evidencia
          <textarea
            value={commentDraft}
            onChange={e => setCommentDraft(e.target.value)}
            disabled={!canEdit}
            rows={3}
            className="nf-app-input"
            style={{ resize: "vertical" }}
          />
          </label>
          <div className="nf-modal-actions">
            <button type="button" className="nf-app-btn-ghost" onClick={() => { setClauseModal(null); setCommentDraft(""); }}>Cerrar</button>
            {canEdit && (
              <button type="button" className="nf-app-btn-primary" onClick={() => { saveComment(); setClauseModal(null); setCommentDraft(""); }}>Guardar y cerrar</button>
            )}
          </div>
        </Modal>
      )}

      {liveEdit && (
        <Modal
          open={!!liveEdit}
          title={`Cláusula ${liveEdit.clause} · ${liveEdit.title}`}
          onClose={closeLiveEdit}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label className="nf-modal-field-label" htmlFor="gap-score">
                Puntuación de cumplimiento · <strong>{editScore}%</strong>
              </label>
              <input
                id="gap-score"
                type="range"
                min={0}
                max={100}
                step={5}
                value={editScore}
                disabled={isPending}
                onChange={e => setEditScore(Number(e.target.value))}
                style={{ width: "100%", marginTop: 8, accentColor: "#5266F6" }}
              />
              <ProgressBar
                value={editScore}
                color={editScore >= 80 ? "#16A34A" : editScore >= 40 ? "#D97706" : "#DC2626"}
                height={8}
                railColor="#eef2f9"
              />
            </div>

            <div>
              <label className="nf-modal-field-label" htmlFor="gap-status">Estado</label>
              <select
                id="gap-status"
                value={editStatus}
                disabled={isPending}
                onChange={e => setEditStatus(e.target.value as ClauseStatus)}
                className="nf-app-input"
                style={{ marginTop: 6 }}
              >
                {CLAUSE_STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="nf-modal-field-label" htmlFor="gap-comment">Comentarios / evidencia</label>
              <textarea
                id="gap-comment"
                value={editComment}
                onChange={e => setEditComment(e.target.value)}
                disabled={isPending}
                rows={3}
                className="nf-app-input"
                style={{ resize: "vertical", marginTop: 6 }}
                placeholder="Hallazgos, evidencia revisada, brechas identificadas…"
              />
            </div>

            {editError && <div className="nf-alert nf-alert--error">{editError}</div>}
          </div>

          <div className="nf-modal-actions">
            <button type="button" className="nf-app-btn-ghost" onClick={closeLiveEdit} disabled={isPending}>Cancelar</button>
            <button type="button" className="nf-app-btn-primary" onClick={saveLiveEdit} disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar evaluación"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
