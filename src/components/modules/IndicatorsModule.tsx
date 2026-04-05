"use client";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import { DEMO_INDICATORS } from "@/lib/demo-data";

function MiniChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80, h = 30;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(" ");
  const lastX = (data.length - 1) / (data.length - 1) * w;
  const lastY = h - ((data[data.length - 1] - min) / range) * (h - 4) - 2;
  return (
    <svg width={w} height={h} style={{ overflow: "visible", flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="3" fill={color} />
    </svg>
  );
}

export default function IndicatorsModule() {
  return (
    <div>
      <SectionTitle title="Indicadores y KPIs" sub="Monitoreo de desempeño del sistema de gestión" action="+ Nuevo KPI" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "En objetivo", value: DEMO_INDICATORS.filter(i => i.status === "ON_TRACK").length, color: "#2E8B57" },
          { label: "En riesgo", value: DEMO_INDICATORS.filter(i => i.status === "AT_RISK").length, color: "#D68A1A" },
          { label: "Desviados", value: DEMO_INDICATORS.filter(i => i.status === "OFF_TRACK").length, color: "#C93C37" },
        ].map(s => (
          <Card key={s.label} style={{ textAlign: "center", padding: "14px 12px" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#5E6B7A", marginTop: 2 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        {DEMO_INDICATORS.map(ind => {
          const color = ind.status === "ON_TRACK" ? "#2E8B57" : ind.status === "AT_RISK" ? "#D68A1A" : "#C93C37";
          const pct = Math.min((ind.value / ind.target) * 100, 100);
          return (
            <Card key={ind.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#142033", marginBottom: 2, lineHeight: 1.3 }}>{ind.name}</div>
                  <div style={{ fontSize: 11, color: "#5E6B7A" }}>{ind.period} · {ind.frequency === "monthly" ? "Mensual" : "Trimestral"}</div>
                </div>
                <Badge status={ind.status} />
              </div>

              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 36, fontWeight: 800, color, lineHeight: 1 }}>
                    {ind.value}<span style={{ fontSize: 14, fontWeight: 400, color: "#5E6B7A", marginLeft: 2 }}>{ind.unit}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#5E6B7A", marginTop: 3 }}>
                    Meta: <strong style={{ color: "#142033" }}>{ind.target}{ind.unit}</strong>
                    {" · "}
                    <span style={{ color: ind.trend === "up" ? "#2E8B57" : "#C93C37" }}>
                      {ind.trend === "up" ? "↑" : "↓"} Tendencia
                    </span>
                  </div>
                </div>
                <MiniChart data={ind.history} color={color} />
              </div>

              <div style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#5E6B7A", marginBottom: 5 }}>
                  <span>Cumplimiento de meta</span>
                  <span style={{ fontWeight: 600, color }}>{Math.round(pct)}%</span>
                </div>
                <ProgressBar value={pct} color={color} height={6} />
              </div>

              {ind.clause && (
                <div style={{ fontSize: 11, color: "#5E6B7A", marginTop: 8, display: "flex", gap: 4 }}>
                  <span>Cláusula ISO:</span>
                  <span style={{ background: "#f0f4ff", color: "#123C66", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>{ind.clause}</span>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
