"use client";

import { useI18n } from "@/context/I18nProvider";
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, { bg: string; color: string; label: string }> =
  {
    APPROVED: { bg: "#F0FDF4", color: "#15803D", label: "Aprobado" },
    approved: { bg: "#F0FDF4", color: "#15803D", label: "Aprobado" },
    DRAFT: { bg: "#EEF2FF", color: "#3B4BD8", label: "Borrador" },
    draft: { bg: "#EEF2FF", color: "#3B4BD8", label: "Borrador" },
    IN_REVIEW: { bg: "#FFFBEB", color: "#B45309", label: "En revisión" },
    in_review: { bg: "#FFFBEB", color: "#B45309", label: "En revisión" },
    OBSOLETE: { bg: "#F5F5F5", color: "#525252", label: "Obsoleto" },
    COMPLETED: { bg: "#F0FDF4", color: "#15803D", label: "Completada" },
    IN_PROGRESS: { bg: "#FFFBEB", color: "#B45309", label: "En curso" },
    PLANNED: { bg: "#EEF2FF", color: "#3B4BD8", label: "Planificada" },
    OPEN: { bg: "#FEF2F2", color: "#B91C1C", label: "Abierta" },
    CLOSED: { bg: "#F0FDF4", color: "#15803D", label: "Cerrada" },
    PENDING: { bg: "#EEF2FF", color: "#3B4BD8", label: "Pendiente" },
    PENDING_VALIDATION: {
      bg: "#F5F3FF",
      color: "#7C3AED",
      label: "Pendiente validación",
    },
    UNDER_TREATMENT: {
      bg: "#FFFBEB",
      color: "#B45309",
      label: "En tratamiento",
    },
    MONITORED: { bg: "#EEF2FF", color: "#3B4BD8", label: "Monitoreo" },
    MITIGATED: { bg: "#F0FDF4", color: "#15803D", label: "Mitigado" },
    ACCEPTED: { bg: "#F5F5F5", color: "#525252", label: "Aceptado" },
    IDENTIFIED: { bg: "#EEF2FF", color: "#3B4BD8", label: "Identificado" },
    ON_TRACK: { bg: "#F0FDF4", color: "#15803D", label: "En objetivo" },
    AT_RISK: { bg: "#FFFBEB", color: "#B45309", label: "En riesgo" },
    OFF_TRACK: { bg: "#FEF2F2", color: "#B91C1C", label: "Desviado" },
    ACTIVE: { bg: "#F0FDF4", color: "#15803D", label: "Activo" },
    TRIALING: { bg: "#EEF2FF", color: "#3B4BD8", label: "Trial" },
    CANCELLED: { bg: "#F5F5F5", color: "#525252", label: "Cancelado" },
    CRITICAL: { bg: "#FEF2F2", color: "#B91C1C", label: "Crítica" },
    MAJOR: { bg: "#FFFBEB", color: "#B45309", label: "Mayor" },
    MINOR: { bg: "#F5F5F5", color: "#525252", label: "Menor" },
    IN_REVIEW_STATUS: { bg: "#F5F3FF", color: "#7C3AED", label: "En revisión" },
    success: { bg: "#F0FDF4", color: "#15803D", label: "OK" },
    warning: { bg: "#FFFBEB", color: "#B45309", label: "Atención" },
    danger: { bg: "#FEF2F2", color: "#B91C1C", label: "Alerta" },
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
  const { tx } = useI18n();
  const s = STATUS_MAP[status] ?? {
    bg: "#F5F5F5",
    color: "#525252",
    label: label ?? status,
  };
  const displayLabel = tx(label ?? s.label);
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
  const { tx } = useI18n();
  const map: Record<string, { bg: string; color: string }> = {
    CRITICAL: { bg: "#FEF2F2", color: "#B91C1C" },
    HIGH: { bg: "#FFFBEB", color: "#B45309" },
    MEDIUM: { bg: "#EEF2FF", color: "#3B4BD8" },
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
      {tx(labels[priority] ?? priority)}
    </span>
  );
}
