"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import ProgressBar from "@/components/ui/ProgressBar";
import Badge from "@/components/ui/Badge";
import { DEMO_GAP } from "@/lib/demo-data";
import type { GapPayload } from "@/lib/server-queries";

type GapRow = (typeof DEMO_GAP)["iso9001"][number];

export default function GapModule({ live }: { live?: GapPayload | null }) {
  const [standard, setStandard] = useState<"iso9001" | "iso27001">("iso9001");
  const fromDb =
    standard === "iso9001" ? live?.iso9001 : live?.iso27001;
  const data: GapRow[] =
    fromDb && fromDb.length > 0
      ? fromDb.map(r => ({
          clause: r.clause,
          title: r.title,
          score: r.score,
          questions: r.questions,
          answered: r.answered,
          status: r.status,
        }))
      : DEMO_GAP[standard];

  const avg = Math.round(data.reduce((s, g) => s + g.score, 0) / data.length);
  const compliant = data.filter(g => g.status === "COMPLIANT").length;
  const partial = data.filter(g => g.status === "PARTIALLY_COMPLIANT").length;
  const nonCompliant = data.filter(g => g.status === "NON_COMPLIANT").length;

  function exportPdf() {
    window.print();
  }

  return (
    <div>
      <SectionTitle
        title="GAP Assessment"
        sub="Evaluación de brechas frente a los requisitos de la norma"
        action="📄 Exportar PDF"
        onAction={exportPdf}
      />

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
              <div key={g.clause}>
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
                <div style={{ fontSize: 11, color: "#5E6B7A", marginTop: 3 }}>{g.questions} preguntas evaluadas</div>
              </div>
            ))}
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#142033", marginBottom: 14 }}>Estado General</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ProgressBar value={avg} color={avg >= 80 ? "#2E8B57" : avg >= 60 ? "#D68A1A" : "#C93C37"} height={10} />
              <div style={{ fontSize: 13, color: "#5E6B7A", textAlign: "center" }}>
                {avg < 60 ? "Se requieren acciones urgentes" : avg < 80 ? "Mejoras necesarias antes de certificación" : "Listo para auditoría de certificación"}
              </div>
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#142033", marginBottom: 12 }}>Acciones Recomendadas</div>
            {[
              { label: "Implementar revisión por dirección", priority: "CRITICAL" },
              { label: "Definir indicadores de desempeño", priority: "HIGH" },
              { label: "Actualizar mapa de procesos", priority: "MEDIUM" },
              { label: "Formalizar análisis de riesgos", priority: "HIGH" },
            ].map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: i < 3 ? "1px solid #E5EAF2" : "none", alignItems: "flex-start" }}>
                <Badge
                  status={a.priority === "CRITICAL" ? "OFF_TRACK" : a.priority === "HIGH" ? "AT_RISK" : "ON_TRACK"}
                  label={a.priority === "CRITICAL" ? "Crítica" : a.priority === "HIGH" ? "Alta" : "Media"}
                />
                <span style={{ fontSize: 12, color: "#142033" }}>{a.label}</span>
              </div>
            ))}
          </Card>

          <button
            type="button"
            onClick={exportPdf}
            style={{ background: "#123C66", color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%" }}
          >
            📄 Exportar Informe Completo
          </button>
          <button
            type="button"
            style={{ background: "transparent", color: "#2E8B57", border: "1px solid #2E8B5750", borderRadius: 10, padding: "11px", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%" }}
          >
            ✦ Sugerencia IA para plan de acción
          </button>
        </div>
      </div>
    </div>
  );
}
