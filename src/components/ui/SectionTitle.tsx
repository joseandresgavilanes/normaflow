import type { ReactNode } from "react";

interface SectionTitleProps {
  title: string;
  sub?: string;
  action?: ReactNode;
  onAction?: () => void;
  /** Por defecto `nf-app-btn-ghost`; usa `nf-app-btn-primary` para CTAs destacadas. */
  actionButtonClass?: string;
}
export default function SectionTitle({
  title,
  sub,
  action,
  onAction,
  actionButtonClass,
}: SectionTitleProps) {
  const dead = Boolean(action) && !onAction;
  return (
    <div className="nf-section-title">
      <div>
        <h2 className="nf-app-page-title">{title}</h2>
        {sub && <p className="nf-app-page-sub">{sub}</p>}
      </div>
      {action && (
        <button
          type="button"
          onClick={onAction}
          disabled={dead}
          title={dead ? "Acción no disponible en este contexto" : undefined}
          className={actionButtonClass ?? "nf-app-btn-ghost"}
        >
          {action}
        </button>
      )}
    </div>
  );
}
