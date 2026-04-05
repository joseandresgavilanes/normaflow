"use client";
import { useState } from "react";

const CONTEXT_LABELS: Record<string, string> = {
  gap: "GAP Assessment",
  risk: "Gestión de Riesgos",
  document: "Control de Documentos",
  audit: "Auditorías",
  nc: "No Conformidades",
};

const PROMPTS: Record<string, string> = {
  gap: "Soy el compliance manager de Tecnoserv Industrial S.A. Estamos realizando un GAP assessment para ISO 9001:2015. Las cláusulas con menor puntuación son: 9 (Evaluación del desempeño, 55%) y 6 (Planificación, 60%). ¿Qué acciones prioritarias recomiendas para mejorar rápidamente nuestro nivel de cumplimiento?",
  risk: "Tenemos un riesgo crítico: 'Fuga de datos de clientes' con score 20 (probabilidad 4, impacto 5) en ISO 27001. El control actual es cifrado AES-256 + DLP. ¿Qué tratamiento adicional y controles del Anexo A recomiendas implementar?",
  document: "Necesito generar un borrador de Procedimiento de Gestión de Incidentes de Seguridad (ISO 27001, cláusula 6.1). Debe incluir: objeto, alcance, responsabilidades, flujo de proceso y registros requeridos.",
  audit: "Hemos completado una auditoría interna ISO 9001 con 8 hallazgos: 1 no conformidad mayor (documentación desactualizada en producción), 4 no conformidades menores y 3 observaciones. ¿Cómo priorizamos las acciones correctivas y qué plazos son razonables?",
  nc: "Tenemos una no conformidad mayor: 'Documentación de proceso de producción desactualizada desde hace 8 meses'. Causa raíz aparente: ausencia de proceso formal de revisión periódica. ¿Cómo aplicamos análisis de los 5 porqués y qué acciones correctivas son más eficaces?",
};

export default function AIPanel({ open, onClose, context }: { open: boolean; onClose: () => void; context: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  const callAI = async (promptOverride?: string) => {
    setLoading(true);
    setResult("");
    setConfirmed(false);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: promptOverride || PROMPTS[context] || PROMPTS.gap, context }),
      });
      const data = await res.json();
      setResult(data.text || "No se pudo generar la sugerencia.");
    } catch {
      setResult("Error al conectar con el asistente. Verifica tu conexión e inténtalo de nuevo.");
    }
    setLoading(false);
  };

  if (!open) return null;

  return (
    <div
      className="nf-ai-panel"
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        bottom: 0,
        background: "#fff",
        borderLeft: "1px solid #E5EAF2",
        zIndex: 900,
        display: "flex",
        flexDirection: "column",
        boxShadow: "-8px 0 40px rgba(0,0,0,0.07)",
      }}
    >
      <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #E5EAF2", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16, color: "#2E8B57" }}>✦</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#142033" }}>Asistente IA</span>
          </div>
          <div style={{ fontSize: 11, color: "#5E6B7A", marginTop: 2 }}>Las sugerencias requieren confirmación humana antes de guardarse</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "#5E6B7A", cursor: "pointer" }}>×</button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Context badge */}
        <div style={{ background: "#F7F9FC", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#5E6B7A", border: "1px solid #E5EAF2" }}>
          <strong style={{ color: "#142033" }}>Contexto:</strong> {CONTEXT_LABELS[context] ?? "General"}
        </div>

        {/* Custom prompt */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: "#5E6B7A", display: "block", marginBottom: 6 }}>Pregunta personalizada (opcional)</label>
          <textarea
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            placeholder="Escribe tu consulta específica..."
            rows={3}
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
          />
        </div>

        {!result && !loading && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 10, color: "#2E8B57" }}>✦</div>
            <p style={{ fontSize: 13, color: "#5E6B7A", lineHeight: 1.6, marginBottom: 0 }}>El asistente analizará el contexto y generará sugerencias basadas en mejores prácticas ISO.</p>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 13, color: "#5E6B7A", marginBottom: 10 }}>Analizando contexto...</div>
            <div style={{ height: 3, background: "#E5EAF2", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: "50%", background: "#123C66", borderRadius: 99, animation: "slide 1.2s ease-in-out infinite alternate" }} />
            </div>
            <style>{`@keyframes slide{from{margin-left:0}to{margin-left:50%}}`}</style>
          </div>
        )}

        {result && !loading && (
          <div>
            <div style={{ background: "#F7F9FC", border: "1px solid #E5EAF2", borderRadius: 10, padding: 16, fontSize: 13, lineHeight: 1.75, color: "#142033", whiteSpace: "pre-wrap" }}>
              {result}
            </div>
            {!confirmed ? (
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button onClick={() => setConfirmed(true)} style={{ flex: 1, background: "#2E8B57", color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  ✓ Confirmar y aplicar
                </button>
                <button onClick={() => setResult("")} style={{ flex: 1, background: "transparent", color: "#5E6B7A", border: "1px solid #E5EAF2", borderRadius: 8, padding: "9px", fontSize: 13, cursor: "pointer" }}>
                  Descartar
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 10, background: "#e8f5ee", border: "1px solid #2E8B5740", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#2E8B57", fontWeight: 500 }}>
                ✓ Sugerencia confirmada y registrada con revisión humana
              </div>
            )}
            <button onClick={() => callAI(customPrompt || undefined)} style={{ marginTop: 10, width: "100%", background: "transparent", color: "#123C66", border: "1px solid #E5EAF2", borderRadius: 8, padding: "7px", fontSize: 13, cursor: "pointer" }}>
              ↻ Regenerar
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: 16, borderTop: "1px solid #E5EAF2" }}>
        <button
          onClick={() => callAI(customPrompt || undefined)}
          disabled={loading}
          style={{ width: "100%", background: loading ? "#E5EAF2" : "#123C66", color: loading ? "#5E6B7A" : "#fff", border: "none", borderRadius: 8, padding: "11px", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "Generando..." : "✦ Generar sugerencia"}
        </button>
      </div>
    </div>
  );
}
