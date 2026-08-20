"use client";

import { useI18n } from "@/context/I18nProvider";
import { cn } from "@/lib/utils";
/* El catálogo se comparte con los gráficos y las tablas: vivía aquí y por eso
   cualquier otra pantalla pintaba el enum crudo. */
import { STATUS_STYLES } from "@/lib/status-labels";

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
  const s = STATUS_STYLES[status] ?? {
    bg: "var(--nf-surface-muted)",
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
    MEDIUM: { bg: "var(--nf-primary-subtle)", color: "var(--nf-primary-active)" },
    LOW: { bg: "var(--nf-surface-muted)", color: "var(--nf-text-secondary)" },
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
