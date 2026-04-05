"use client";
import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import ProgressBar from "@/components/ui/ProgressBar";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { DEMO_GAP } from "@/lib/demo-data";
import type { GapPayload } from "@/lib/server-queries";
import { useWorkspace } from "@/context/WorkspaceStore";
import type { GapClauseState } from "@/lib/demo/seed-entities";
import { useDemoPermission } from "@/hooks/useDemoPermission";

type GapRow = (typeof DEMO_GAP)["iso9001"][number];

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

  const readOnlyLive = Boolean(live && (live.iso9001?.length || live.iso27001?.length));

  const [standard, setStandard] = useState<"iso9001" | "iso27001">("iso9001");
  const [clauseModal, setClauseModal] = useState<GapClauseState | null>(null);
  const [commentDraft, setCommentDraft] = useState("");

  const fromDb = standard === "iso9001" ? live?.iso9001 : live?.iso27001;

  const data: GapRow[] = useMemo(() => {
    if (readOnlyLive && fromDb && fromDb.length > 0) {
      return fromDb.map(r => ({
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
    if (readOnlyLive) return;
    const list = standard === "iso9001" ? state.gapIso9001 : state.gapIso27001;
    const full = list.find(c => c.clause === row.clause);
    if (full) {
      setClauseModal(full);
      setCommentDraft(full.comment);
    }
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
    showToast("Borrador IA (demo): priorizar cláusulas con score bajo 70% y vincular acciones correctivas en el Plan de Acción.");
  }

  return (
    <div>
      <SectionTitle
        title="GAP Assessment"
        sub={readOnlyLive ? "Datos desde tu organización (solo lectura)" : "Evaluación de brechas — respuestas editables en sesión demo"}
        action="📄 Exportar PDF"
        onAction={exportPdf}
      />

      {!readOnlyLive && !canEdit && (
        <p style={{ fontSize: 13, color: "#D68A1A", marginBottom: 16 }}>
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
              border: `1px solid ${standard === s.key ? "#123C66" : "#E5EAF2"}`,
              background: standard === s.key ? "#123C66" : "transparent",
              color: standard === s.key ? "#fff" : "#5E6B7A",
              fontSize: 13,
              fontWeight: standard === s.key ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 13, color: "#5E6B7A", marginBottom: 4 }}>Cumplimiento Global</div>
              <div
                style={{
                  fontSize: 44,
                  fontWeight: 800,
                  color: avg >= 80 ? "#2E8B57" : avg >= 60 ? "#D68A1A" : "#C93C37",
                  lineHeight: 1,
                }}
              >
                {avg}%
              </div>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              {[
                { label: "Conforme", count: compliant, color: "#2E8B57" },
                { label: "Parcial", count: partial, color: "#D68A1A" },
                { label: "No conforme", count: nonCompliant, color: "#C93C37" },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.count}</div>
                  <div style={{ fontSize: 11, color: "#5E6B7A" }}>{s.label}</div>
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
                disabled={readOnlyLive}
                style={{
                  textAlign: "left",
                  background: readOnlyLive ? "transparent" : "#fafbfd",
                  border: "1px solid #E5EAF2",
                  borderRadius: 10,
                  padding: "12px 14px",
                  cursor: readOnlyLive ? "default" : "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#123C66", marginRight: 8 }}>{g.clause}.</span>
                    <span style={{ fontSize: 13, color: "#142033", fontWeight: 500 }}>{g.title}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: g.score >= 80 ? "#2E8B57" : g.score >= 60 ? "#D68A1A" : "#C93C37",
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
                <ProgressBar value={g.score} color={g.score >= 80 ? "#2E8B57" : g.score >= 60 ? "#D68A1A" : "#C93C37"} height={7} />
                <div style={{ fontSize: 11, color: "#5E6B7A", marginTop: 3 }}>
                  {g.answered}/{g.questions} respuestas · {!readOnlyLive && canEdit ? "Pulse para editar" : "Detalle"}
                </div>
              </button>
            ))}
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#142033", marginBottom: 14 }}>Resumen ejecutivo</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ProgressBar value={avg} color={avg >= 80 ? "#2E8B57" : avg >= 60 ? "#D68A1A" : "#C93C37"} height={10} />
              <div style={{ fontSize: 13, color: "#5E6B7A", lineHeight: 1.5 }}>
                {avg < 60
                  ? "Se requieren acciones urgentes antes de una auditoría de certificación."
                  : avg < 80
                    ? "Mejoras focalizadas en cláusulas parciales reducirán el riesgo de hallazgos mayores."
                    : "El sistema muestra madurez alineada con los requisitos; mantenga evidencias al día."}
              </div>
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#142033", marginBottom: 12 }}>Recomendaciones</div>
            {weakClauses.length === 0 ? (
              <p style={{ fontSize: 12, color: "#5E6B7A", margin: 0 }}>No hay cláusulas críticas por debajo del umbral del 70%.</p>
            ) : (
              weakClauses.map((g, i) => (
                <div
                  key={g.clause}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "7px 0",
                    borderBottom: i < weakClauses.length - 1 ? "1px solid #E5EAF2" : "none",
                    alignItems: "flex-start",
                  }}
                >
                  <Badge status="AT_RISK" label={g.clause} />
                  <span style={{ fontSize: 12, color: "#142033" }}>
                    Reforzar evidencias en «{g.title}» (score {g.score}%).
                  </span>
                </div>
              ))
            )}
          </Card>

          <button
            type="button"
            onClick={exportPdf}
            style={{ background: "#123C66", color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%" }}
          >
            📄 Exportar informe completo
          </button>
          <button
            type="button"
            onClick={aiSuggest}
            style={{ background: "transparent", color: "#2E8B57", border: "1px solid #2E8B5750", borderRadius: 10, padding: "11px", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%" }}
          >
            ✦ Sugerencia IA para plan de acción
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
            <div style={{ fontSize: 12, color: "#5E6B7A", marginBottom: 6 }}>
              Puntuación {fullClause.score}% · {fullClause.answered}/{fullClause.questions} respuestas
            </div>
            <ProgressBar value={fullClause.score} color={fullClause.score >= 80 ? "#2E8B57" : fullClause.score >= 60 ? "#D68A1A" : "#C93C37"} height={8} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {fullClause.questionsDetail.map(q => (
              <div key={q.id} style={{ paddingBottom: 12, borderBottom: "1px solid #E5EAF2" }}>
                <p style={{ fontSize: 13, color: "#142033", margin: "0 0 8px", lineHeight: 1.45 }}>{q.text}</p>
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
                        border: `1px solid ${q.answer === a ? "#123C66" : "#E5EAF2"}`,
                        background: q.answer === a ? "#123C66" : "#fff",
                        color: q.answer === a ? "#fff" : "#142033",
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
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#142033", marginBottom: 6 }}>Comentarios / evidencia</label>
          <textarea
            value={commentDraft}
            onChange={e => setCommentDraft(e.target.value)}
            disabled={!canEdit}
            rows={3}
            style={{ width: "100%", borderRadius: 8, border: "1px solid #E5EAF2", padding: 10, fontSize: 13, resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => {
                setClauseModal(null);
                setCommentDraft("");
              }}
              style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #E5EAF2", background: "#fff", cursor: "pointer" }}
            >
              Cerrar
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  saveComment();
                  setClauseModal(null);
                  setCommentDraft("");
                }}
                style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#123C66", color: "#fff", fontWeight: 600, cursor: "pointer" }}
              >
                Guardar y cerrar
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
