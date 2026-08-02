"use client";

import type { LucideIcon, } from "lucide-react";
import { AlertTriangle, Inbox, Lock, SearchX, ServerCrash, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/context/I18nProvider";

/**
 * Estados vacíos y de error, unificados.
 *
 * Antes había ocho implementaciones distintas y la genérica era la cadena
 * "Sin registros", que no dice qué es el módulo, para qué sirve ni qué hacer.
 */
export type EmptyStateKind =
  | "empty"        // primer uso: el módulo existe pero no hay datos
  | "no-results"   // hay datos, el filtro no devuelve nada
  | "forbidden"    // sin permisos
  | "locked"       // pack o plan no contratado
  | "network"      // error de red
  | "server";      // error de servidor

const PRESETS: Record<EmptyStateKind, { Icon: LucideIcon; tone: string }> = {
  empty: { Icon: Inbox, tone: "neutral" },
  "no-results": { Icon: SearchX, tone: "neutral" },
  forbidden: { Icon: Lock, tone: "warning" },
  locked: { Icon: Lock, tone: "warning" },
  network: { Icon: WifiOff, tone: "danger" },
  server: { Icon: ServerCrash, tone: "danger" },
};

export default function EmptyState({
  kind = "empty",
  title,
  /** Qué es el módulo y para qué sirve. No omitir en el estado de primer uso. */
  description,
  /** Acción principal: qué hacer ahora. */
  action,
  /** Enlace de ayuda o documentación. */
  help,
  icon,
  compact = false,
}: {
  kind?: EmptyStateKind;
  title: string;
  description?: string;
  action?: ReactNode;
  help?: ReactNode;
  icon?: LucideIcon;
  compact?: boolean;
}) {
  const { tx } = useI18n();
  const preset = PRESETS[kind];
  const Icon = icon ?? preset.Icon;

  return (
    <div className="nf-empty" data-tone={preset.tone} data-compact={compact || undefined} role="status">
      <span className="nf-empty__icon" aria-hidden>
        <Icon size={compact ? 18 : 22} strokeWidth={1.75} />
      </span>
      <p className="nf-empty__title">{tx(title)}</p>
      {description && <p className="nf-empty__desc">{tx(description)}</p>}
      {(action || help) && (
        <div className="nf-empty__actions">
          {action}
          {help}
        </div>
      )}
    </div>
  );
}

/** Variante para un fallo recuperable: siempre ofrece una vía de salida. */
export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = "Reintentar",
}: {
  title: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const { tx } = useI18n();
  return (
    <EmptyState
      kind="server"
      icon={AlertTriangle}
      title={title}
      description={description}
      action={
        onRetry ? (
          <button type="button" className="nf-app-btn-outline nf-app-btn-sm" onClick={onRetry}>
            {tx(retryLabel)}
          </button>
        ) : undefined
      }
    />
  );
}
