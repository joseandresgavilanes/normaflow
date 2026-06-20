import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, { bg: string; color: string; label: string }> =
  {
    APPROVED: { bg: "#F0FDF4", color: "#16A34A", label: "Aprobado" },
    approved: { bg: "#F0FDF4", color: "#16A34A", label: "Aprobado" },
    DRAFT: { bg: "#EEF2FF", color: "#5266F6", label: "Borrador" },
    draft: { bg: "#EEF2FF", color: "#5266F6", label: "Borrador" },
    IN_REVIEW: { bg: "#FFFBEB", color: "#D97706", label: "En revisión" },
    in_review: { bg: "#FFFBEB", color: "#D97706", label: "En revisión" },
    OBSOLETE: { bg: "#F5F5F5", color: "#525252", label: "Obsoleto" },
    COMPLETED: { bg: "#F0FDF4", color: "#16A34A", label: "Completada" },
    IN_PROGRESS: { bg: "#FFFBEB", color: "#D97706", label: "En curso" },
    PLANNED: { bg: "#EEF2FF", color: "#5266F6", label: "Planificada" },
    OPEN: { bg: "#FEF2F2", color: "#DC2626", label: "Abierta" },
    CLOSED: { bg: "#F0FDF4", color: "#16A34A", label: "Cerrada" },
    PENDING: { bg: "#EEF2FF", color: "#5266F6", label: "Pendiente" },
    PENDING_VALIDATION: {
      bg: "#F5F3FF",
      color: "#7C3AED",
      label: "Pendiente validación",
    },
    UNDER_TREATMENT: {
      bg: "#FFFBEB",
      color: "#D97706",
      label: "En tratamiento",
    },
    MONITORED: { bg: "#EEF2FF", color: "#5266F6", label: "Monitoreo" },
    MITIGATED: { bg: "#F0FDF4", color: "#16A34A", label: "Mitigado" },
    ACCEPTED: { bg: "#F5F5F5", color: "#525252", label: "Aceptado" },
    IDENTIFIED: { bg: "#EEF2FF", color: "#5266F6", label: "Identificado" },
    ON_TRACK: { bg: "#F0FDF4", color: "#16A34A", label: "En objetivo" },
    AT_RISK: { bg: "#FFFBEB", color: "#D97706", label: "En riesgo" },
    OFF_TRACK: { bg: "#FEF2F2", color: "#DC2626", label: "Desviado" },
    ACTIVE: { bg: "#F0FDF4", color: "#16A34A", label: "Activo" },
    TRIALING: { bg: "#EEF2FF", color: "#5266F6", label: "Trial" },
    CANCELLED: { bg: "#F5F5F5", color: "#525252", label: "Cancelado" },
    CRITICAL: { bg: "#FEF2F2", color: "#DC2626", label: "Crítica" },
    MAJOR: { bg: "#FFFBEB", color: "#D97706", label: "Mayor" },
    MINOR: { bg: "#F5F5F5", color: "#525252", label: "Menor" },
    IN_REVIEW_STATUS: { bg: "#F5F3FF", color: "#7C3AED", label: "En revisión" },
    success: { bg: "#F0FDF4", color: "#16A34A", label: "OK" },
    warning: { bg: "#FFFBEB", color: "#D97706", label: "Atención" },
    danger: { bg: "#FEF2F2", color: "#DC2626", label: "Alerta" },
  };

interface BadgeProps {
  status: string;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

export default function Badge({
  status,
  label,
  size = "sm",
  className,
}: BadgeProps) {
  const s = STATUS_MAP[status] ?? {
    bg: "#F5F5F5",
    color: "#525252",
    label: label ?? status,
  };
  const displayLabel = label ?? s.label;
  return (
    <span
      className={cn(
        "nf-status-badge inline-flex items-center self-start shrink-0 rounded-full font-medium whitespace-nowrap leading-tight",
        className,
      )}
      style={{
        background: s.bg,
        color: s.color,
        padding: size === "sm" ? "3px 10px" : "4px 12px",
        fontSize: size === "sm" ? 11 : 12,
        lineHeight: 1.25,
      }}
    >
      {displayLabel}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    CRITICAL: { bg: "#FEF2F2", color: "#DC2626" },
    HIGH: { bg: "#FFFBEB", color: "#D97706" },
    MEDIUM: { bg: "#EEF2FF", color: "#5266F6" },
    LOW: { bg: "#F5F5F5", color: "#525252" },
  };
  const s = map[priority] ?? map.MEDIUM;
  const labels: Record<string, string> = {
    CRITICAL: "Crítica",
    HIGH: "Alta",
    MEDIUM: "Media",
    LOW: "Baja",
  };
  return (
    <span
      className="nf-status-badge inline-flex items-center self-start shrink-0 whitespace-nowrap leading-tight"
      style={{
        background: s.bg,
        color: s.color,
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.25,
      }}
    >
      {labels[priority] ?? priority}
    </span>
  );
}
