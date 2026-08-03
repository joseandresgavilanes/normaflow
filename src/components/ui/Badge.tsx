"use client";

import { useI18n } from "@/context/I18nProvider";
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, { bg: string; color: string; label: string }> =
  {
    APPROVED: { bg: "var(--nf-success-subtle)", color: "var(--nf-success-text)", label: "Aprobado" },
    approved: { bg: "var(--nf-success-subtle)", color: "var(--nf-success-text)", label: "Aprobado" },
    DRAFT: { bg: "#EEF2FF", color: "var(--nf-primary-active)", label: "Borrador" },
    draft: { bg: "#EEF2FF", color: "var(--nf-primary-active)", label: "Borrador" },
    IN_REVIEW: { bg: "var(--nf-warning-subtle)", color: "var(--nf-warning-text)", label: "En revisión" },
    in_review: { bg: "var(--nf-warning-subtle)", color: "var(--nf-warning-text)", label: "En revisión" },
    OBSOLETE: { bg: "#F5F5F5", color: "var(--nf-text-secondary)", label: "Obsoleto" },
    COMPLETED: { bg: "var(--nf-success-subtle)", color: "var(--nf-success-text)", label: "Completada" },
    IN_PROGRESS: { bg: "var(--nf-warning-subtle)", color: "var(--nf-warning-text)", label: "En curso" },
    PLANNED: { bg: "#EEF2FF", color: "var(--nf-primary-active)", label: "Planificada" },
    OPEN: { bg: "var(--nf-danger-subtle)", color: "var(--nf-danger-text)", label: "Abierta" },
    CLOSED: { bg: "var(--nf-success-subtle)", color: "var(--nf-success-text)", label: "Cerrada" },
    PENDING: { bg: "#EEF2FF", color: "var(--nf-primary-active)", label: "Pendiente" },
    PENDING_VALIDATION: {
      bg: "#F5F3FF",
      color: "#7C3AED",
      label: "Pendiente validación",
    },
    UNDER_TREATMENT: {
      bg: "var(--nf-warning-subtle)",
      color: "var(--nf-warning-text)",
      label: "En tratamiento",
    },
    MONITORED: { bg: "#EEF2FF", color: "var(--nf-primary-active)", label: "Monitoreo" },
    MITIGATED: { bg: "var(--nf-success-subtle)", color: "var(--nf-success-text)", label: "Mitigado" },
    ACCEPTED: { bg: "#F5F5F5", color: "var(--nf-text-secondary)", label: "Aceptado" },
    IDENTIFIED: { bg: "#EEF2FF", color: "var(--nf-primary-active)", label: "Identificado" },
    ON_TRACK: { bg: "var(--nf-success-subtle)", color: "var(--nf-success-text)", label: "En objetivo" },
    AT_RISK: { bg: "var(--nf-warning-subtle)", color: "var(--nf-warning-text)", label: "En riesgo" },
    OFF_TRACK: { bg: "var(--nf-danger-subtle)", color: "var(--nf-danger-text)", label: "Desviado" },
    ACTIVE: { bg: "var(--nf-success-subtle)", color: "var(--nf-success-text)", label: "Activo" },
    TRIALING: { bg: "#EEF2FF", color: "var(--nf-primary-active)", label: "Trial" },
    CANCELLED: { bg: "#F5F5F5", color: "var(--nf-text-secondary)", label: "Cancelado" },
    CRITICAL: { bg: "var(--nf-danger-subtle)", color: "var(--nf-danger-text)", label: "Crítica" },
    MAJOR: { bg: "var(--nf-warning-subtle)", color: "var(--nf-warning-text)", label: "Mayor" },
    MINOR: { bg: "#F5F5F5", color: "var(--nf-text-secondary)", label: "Menor" },
    IN_REVIEW_STATUS: { bg: "#F5F3FF", color: "#7C3AED", label: "En revisión" },
    success: { bg: "var(--nf-success-subtle)", color: "var(--nf-success-text)", label: "OK" },
    warning: { bg: "var(--nf-warning-subtle)", color: "var(--nf-warning-text)", label: "Atención" },
    danger: { bg: "var(--nf-danger-subtle)", color: "var(--nf-danger-text)", label: "Alerta" },
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
    color: "var(--nf-text-secondary)",
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
    CRITICAL: { bg: "var(--nf-danger-subtle)", color: "var(--nf-danger-text)" },
    HIGH: { bg: "var(--nf-warning-subtle)", color: "var(--nf-warning-text)" },
    MEDIUM: { bg: "#EEF2FF", color: "var(--nf-primary-active)" },
    LOW: { bg: "#F5F5F5", color: "var(--nf-text-secondary)" },
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
