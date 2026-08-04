"use client";

import { Activity, AlertTriangle, BarChart3, Boxes, FileCheck2, Gauge, Handshake, Lightbulb, Search, ShieldCheck, Target, Users } from "lucide-react";

const METRIC_STYLES = [
  { match: /riesgo|peligro|incidente|vencid|abiert|no conform|fallo|rechaz/i, Icon: AlertTriangle, color: "var(--nf-danger-text)", background: "var(--nf-danger-subtle)" },
  { match: /cumpl|control|cobertura|aprob|eficaz|activo|evaluad/i, Icon: ShieldCheck, color: "var(--nf-success-text)", background: "var(--nf-surface-sunken)" },
  { match: /objetiv|accion|mejora|ahorro|oportun/i, Icon: Target, color: "var(--nf-warning-text)", background: "var(--nf-warning-subtle)" },
  { match: /proveedor|socio|tercero|personal|usuario/i, Icon: Handshake, color: "var(--nf-primary-active)", background: "var(--nf-surface-selected)" },
  { match: /producto|dispositivo|sistema|servicio|lote|dataset|modelo/i, Icon: Boxes, color: "var(--nf-info-text)", background: "var(--nf-info-subtle)" },
  { match: /evidencia|document|registro|obligacion|requisito/i, Icon: FileCheck2, color: "var(--nf-primary-active)", background: "var(--nf-primary-subtle)" },
  { match: /consumo|coste|energia|enpi|medidor|lectura|desempeño/i, Icon: Gauge, color: "var(--nf-warning)", background: "var(--nf-warning-subtle)" },
  { match: /indicador|tendencia|medicion|monitoreo|prueba/i, Icon: BarChart3, color: "var(--nf-primary-active)", background: "var(--nf-surface-selected)" },
  { match: /fuente|revisi|traza|seguimiento/i, Icon: Search, color: "var(--nf-text-secondary)", background: "var(--nf-surface-muted)" },
  { match: /person|humana|equipo|actividad/i, Icon: Users, color: "var(--nf-info-text)", background: "var(--nf-success-subtle)" },
] as const;

export default function IsoMetricCard({ label, value, suffix, accent }: { label: string; value: string | number; suffix?: string; accent?: string }) {
  const style = METRIC_STYLES.find((item) => item.match.test(label)) ?? { Icon: Activity, color: "var(--nf-primary-active)", background: "var(--nf-primary-subtle)" };
  const color = accent ?? style.color;
  const Icon = style.Icon;
  return (
    <div className="nf-iso-metric-card">
      <div className="nf-iso-metric-icon" style={{ color, background: accent ? `${accent}18` : style.background }}><Icon size={18} aria-hidden /></div>
      <div className="nf-iso-metric-copy"><div className="nf-iso-metric-value" style={{ color }}>{value}{suffix ?? ""}</div><div className="nf-iso-metric-label">{label}</div></div>
    </div>
  );
}
