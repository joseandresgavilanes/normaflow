import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, { bg: string; color: string; label: string }> = {
  APPROVED: { bg: "#e8f5ee", color: "#2E8B57", label: "Aprobado" },
  approved: { bg: "#e8f5ee", color: "#2E8B57", label: "Aprobado" },
  DRAFT: { bg: "#f0f4ff", color: "#1a5490", label: "Borrador" },
  draft: { bg: "#f0f4ff", color: "#1a5490", label: "Borrador" },
  IN_REVIEW: { bg: "#fff8e6", color: "#D68A1A", label: "En revisión" },
  in_review: { bg: "#fff8e6", color: "#D68A1A", label: "En revisión" },
  OBSOLETE: { bg: "#f5f5f5", color: "#5E6B7A", label: "Obsoleto" },
  COMPLETED: { bg: "#e8f5ee", color: "#2E8B57", label: "Completada" },
  IN_PROGRESS: { bg: "#fff8e6", color: "#D68A1A", label: "En curso" },
  PLANNED: { bg: "#f0f4ff", color: "#1a5490", label: "Planificada" },
  OPEN: { bg: "#fff0f0", color: "#C93C37", label: "Abierta" },
  CLOSED: { bg: "#e8f5ee", color: "#2E8B57", label: "Cerrada" },
  PENDING: { bg: "#f0f4ff", color: "#1a5490", label: "Pendiente" },
  PENDING_VALIDATION: { bg: "#f5f0ff", color: "#6B3FB5", label: "Pendiente validación" },
  UNDER_TREATMENT: { bg: "#fff8e6", color: "#D68A1A", label: "En tratamiento" },
  MONITORED: { bg: "#f0f4ff", color: "#1a5490", label: "Monitoreo" },
  MITIGATED: { bg: "#e8f5ee", color: "#2E8B57", label: "Mitigado" },
  ACCEPTED: { bg: "#f5f5f5", color: "#5E6B7A", label: "Aceptado" },
  IDENTIFIED: { bg: "#f0f4ff", color: "#1a5490", label: "Identificado" },
  ON_TRACK: { bg: "#e8f5ee", color: "#2E8B57", label: "En objetivo" },
  AT_RISK: { bg: "#fff8e6", color: "#D68A1A", label: "En riesgo" },
  OFF_TRACK: { bg: "#fff0f0", color: "#C93C37", label: "Desviado" },
  ACTIVE: { bg: "#e8f5ee", color: "#2E8B57", label: "Activo" },
  TRIALING: { bg: "#f0f4ff", color: "#1a5490", label: "Trial" },
  CANCELLED: { bg: "#f5f5f5", color: "#5E6B7A", label: "Cancelado" },
  CRITICAL: { bg: "#fff0f0", color: "#C93C37", label: "Crítica" },
  MAJOR: { bg: "#fff4e6", color: "#D68A1A", label: "Mayor" },
  MINOR: { bg: "#f5f5f5", color: "#5E6B7A", label: "Menor" },
  IN_REVIEW_STATUS: { bg: "#f5f0ff", color: "#6B3FB5", label: "En revisión" },
  success: { bg: "#e8f5ee", color: "#2E8B57", label: "OK" },
  warning: { bg: "#fff8e6", color: "#D68A1A", label: "Atención" },
  danger: { bg: "#fff0f0", color: "#C93C37", label: "Alerta" },
};

interface BadgeProps {
  status: string;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

export default function Badge({ status, label, size = "sm", className }: BadgeProps) {
  const s = STATUS_MAP[status] ?? { bg: "#f5f5f5", color: "#5E6B7A", label: label ?? status };
  const displayLabel = label ?? s.label;
  return (
    <span
      className={cn("inline-flex items-center rounded-full font-semibold whitespace-nowrap", className)}
      style={{
        background: s.bg, color: s.color,
        padding: size === "sm" ? "2px 8px" : "4px 12px",
        fontSize: size === "sm" ? 11 : 12,
      }}
    >
      {displayLabel}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    CRITICAL: { bg: "#fff0f0", color: "#C93C37" },
    HIGH: { bg: "#fff4e6", color: "#D68A1A" },
    MEDIUM: { bg: "#f0f4ff", color: "#1a5490" },
    LOW: { bg: "#f5f5f5", color: "#5E6B7A" },
  };
  const s = map[priority] ?? map.MEDIUM;
  const labels: Record<string, string> = { CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Media", LOW: "Baja" };
  return (
    <span style={{ background: s.bg, color: s.color, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
      {labels[priority] ?? priority}
    </span>
  );
}
