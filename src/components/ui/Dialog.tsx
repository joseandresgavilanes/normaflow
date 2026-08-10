"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Button, { ButtonGroup } from "@/components/ui/Button";
import { useAnnounce } from "@/components/ui/LiveRegion";
import { useDialogLayer } from "@/hooks/useDialogLayer";
import { useI18n } from "@/context/I18nProvider";
import { cn } from "@/lib/utils";

/**
 * Diálogo accesible único.
 *
 * El inventario del código encontró 25 implementaciones con estos fallos:
 * ninguna trampa de foco, ningún foco inicial, ninguna devolución de foco,
 * `aria-modal` sin aislar el fondo, `role="dialog"` puesto en el overlay en
 * vez de en el panel, 12 modales ad-hoc sin nombre accesible ni Escape ni
 * bloqueo de scroll, `Escape` cerrando toda la pila a la vez, ninguna
 * confirmación destructiva con `role="alertdialog"` y ningún aviso de cambios
 * sin guardar.
 *
 * Este componente los corrige todos. La gestión de capa vive en
 * `useDialogLayer`.
 */

export type DialogSize = "sm" | "md" | "lg" | "xl";
export type DialogTone = "neutral" | "danger";
export type DialogCloseReason = "escape" | "overlay" | "closeButton" | "cancel";

export type DialogProps = {
  open: boolean;
  onClose: (reason: DialogCloseReason) => void;
  /** Obligatorio: genera el nombre accesible del diálogo. */
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  size?: DialogSize;
  tone?: DialogTone;
  /**
   * Confirmación destructiva. Cambia el rol a `alertdialog`, que interrumpe al
   * lector de pantalla en lugar de esperar a que llegue navegando.
   */
  destructive?: boolean;
  /** Hay cambios sin guardar: Escape y clic fuera piden confirmación. */
  dirty?: boolean;
  dirtyMessage?: string;
  /** Desactiva todas las vías de cierre implícitas (pasos que exigen decisión). */
  dismissible?: boolean;
  showCloseButton?: boolean;
  /** Error de servidor. Se enlaza por `aria-describedby` y lleva `role="alert"`. */
  error?: ReactNode;
  /** Bloquea el cierre y deshabilita las acciones mientras corre el servidor. */
  pending?: boolean;
  /** Envuelve el cuerpo en un `<form>` para que Enter envíe. */
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  footer?: ReactNode;
  primaryAction?: {
    label: string;
    onClick?: () => void;
    type?: "submit" | "button";
    disabled?: boolean;
    loading?: boolean;
  };
  secondaryAction?: { label: string; onClick?: () => void };
  className?: string;
  "data-testid"?: string;
};

export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  tone = "neutral",
  destructive = false,
  dirty = false,
  dirtyMessage = "Hay cambios sin guardar. ¿Descartarlos?",
  dismissible = true,
  showCloseButton = true,
  error,
  pending = false,
  onSubmit,
  footer,
  primaryAction,
  secondaryAction,
  className,
  "data-testid": testId,
}: DialogProps) {
  const { t, tx } = useI18n();
  const announce = useAnnounce();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const errorId = useId();
  const [mounted, setMounted] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  // El portal solo existe en cliente.
  useEffect(() => setMounted(true), []);

  const requestClose = useCallback(
    (reason: DialogCloseReason) => {
      if (pending) return;
      if (!dismissible && reason !== "cancel") return;
      // Cerrar con cambios sin guardar pedía confirmación en cero sitios del
      // código actual: Escape descartaba formularios de hasta 20 campos.
      if (dirty && (reason === "escape" || reason === "overlay")) {
        setConfirmingDiscard(true);
        return;
      }
      onClose(reason);
    },
    [dirty, dismissible, onClose, pending],
  );

  useDialogLayer({
    open,
    panelRef,
    onEscape: () => requestClose("escape"),
    closeOnEscape: dismissible,
  });

  // Un error de servidor debe anunciarse, no solo pintarse.
  useEffect(() => {
    if (open && typeof error === "string" && error) announce(error, "assertive");
  }, [announce, error, open]);

  // El clic en el velo compara el origen del `mousedown` con el del `mouseup`:
  // arrastrar una selección de texto desde dentro del panel y soltar fuera
  // cerraba el formulario y perdía los datos.
  const pointerDownTarget = useRef<EventTarget | null>(null);

  if (!open || !mounted) return null;

  const container = document.getElementById("nf-modal-root") ?? document.body;

  const body = (
    <>
      {description && (
        <p id={descId} className="nf-dialog__desc">
          {typeof description === "string" ? tx(description) : description}
        </p>
      )}
      {error && (
        <div id={errorId} className="nf-dialog__error" role="alert">
          {typeof error === "string" ? tx(error) : error}
        </div>
      )}
      {children}
    </>
  );

  const actions = footer ?? (
    (primaryAction || secondaryAction) && (
      <ButtonGroup align="end">
        {secondaryAction && (
          <Button variant="ghost" onClick={secondaryAction.onClick ?? (() => requestClose("cancel"))} disabled={pending}>
            {tx(secondaryAction.label)}
          </Button>
        )}
        {primaryAction && (
          <Button
            variant={destructive || tone === "danger" ? "danger" : "primary"}
            type={primaryAction.type ?? (onSubmit ? "submit" : "button")}
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled || pending}
            loading={primaryAction.loading || pending}
          >
            {tx(primaryAction.label)}
          </Button>
        )}
      </ButtonGroup>
    )
  );

  const panelInner = (
    <>
      <header className="nf-dialog__head">
        <h2 id={titleId} className="nf-dialog__title">{tx(title)}</h2>
        {showCloseButton && dismissible && (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={X}
            aria-label={t("common.close")}
            onClick={() => requestClose("closeButton")}
            disabled={pending}
          />
        )}
      </header>
      <div className="nf-dialog__body">{body}</div>
      {actions && <footer className="nf-dialog__foot">{actions}</footer>}
    </>
  );

  return createPortal(
    <div
      className="nf-dialog-overlay"
      data-nf-portal=""
      onMouseDown={(event) => { pointerDownTarget.current = event.target; }}
      onClick={(event) => {
        if (!dismissible) return;
        // Solo cierra si el gesto EMPIEZA y TERMINA en el velo.
        if (event.target === event.currentTarget && pointerDownTarget.current === event.currentTarget) {
          requestClose("overlay");
        }
      }}
    >
      <div
        ref={panelRef}
        /* El rol va en el PANEL, no en el velo: antes el fondo a pantalla
           completa era el diálogo y el panel real no tenía semántica. */
        role={destructive ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={cn(description && descId, error && errorId) || undefined}
        tabIndex={-1}
        className={cn("nf-dialog", `nf-dialog--${size}`, tone === "danger" && "nf-dialog--danger", className)}
        data-testid={testId}
      >
        {onSubmit ? (
          <form className="nf-dialog__form" onSubmit={onSubmit} noValidate={false}>
            {panelInner}
          </form>
        ) : (
          panelInner
        )}

        {confirmingDiscard && (
          <div className="nf-dialog__discard" role="alertdialog" aria-label={tx(dirtyMessage)}>
            <p>{tx(dirtyMessage)}</p>
            <ButtonGroup align="end">
              <Button variant="ghost" size="sm" onClick={() => setConfirmingDiscard(false)}>
                {tx("Seguir editando")}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => { setConfirmingDiscard(false); onClose("cancel"); }}
              >
                {tx("Descartar cambios")}
              </Button>
            </ButtonGroup>
          </div>
        )}
      </div>
    </div>,
    container,
  );
}
