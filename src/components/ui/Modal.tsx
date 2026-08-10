"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useI18n } from "@/context/I18nProvider";
import { modalLayerDepth, popModalLayer, pushModalLayer } from "@/lib/modal-stack";
import { useDialogLayer } from "@/hooks/useDialogLayer";

/**
 * Modal heredado, usado en 162 puntos del producto.
 *
 * Se conservan intactos su API y su marcado —y por tanto su aspecto— y se le
 * inyecta la capa de accesibilidad de `useDialogLayer`. Así los 162 puntos de
 * uso reciben de una vez las correcciones sin ningún cambio visual:
 *
 *  · Trampa de foco. No existía: con un modal abierto el Tab recorría el
 *    sidebar, la cabecera y la tabla de fondo.
 *  · Foco inicial. No se enfocaba nada al abrir, así que el usuario de teclado
 *    y el lector de pantalla se quedaban en `<body>`.
 *  · Devolución del foco al disparador al cerrar.
 *  · Aislamiento del fondo con `inert`, que es lo que `aria-modal` promete.
 *  · `Escape` solo cierra la capa superior. Antes cada modal registraba su
 *    propio listener y una pulsación cerraba toda la pila.
 *  · `role`/`aria-modal`/`aria-labelledby` pasan del velo al PANEL. Estaban en
 *    el fondo a pantalla completa, de modo que el panel real no tenía
 *    semántica de diálogo.
 *  · Cerrar arrastrando. El velo cerraba con cualquier `click`, así que
 *    seleccionar texto dentro de un textarea y soltar fuera descartaba el
 *    formulario.
 *
 * El código nuevo debe usar `Dialog`, que además ofrece `alertdialog` para
 * confirmaciones destructivas, aviso de cambios sin guardar y tamaños por token.
 */

function getModalPortalRoot(): HTMLElement {
  return document.getElementById("nf-modal-root") ?? document.body;
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: number;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  width = 560,
}: ModalProps) {
  const titleId = useId();
  const { tx } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [zIndex, setZIndex] = useState(1);
  const panelRef = useRef<HTMLDivElement>(null);
  const pointerDownTarget = useRef<EventTarget | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // `modal-stack` sigue gobernando el apilado en z. El bloqueo de scroll pasa a
  // `useDialogLayer`, que lo cuenta con referencias compartidas: antes lo
  // escribían por su cuenta este componente, AppRoot y el cajón de marketing,
  // y al cerrar uno se desbloqueaba con otro aún abierto.
  useLayoutEffect(() => {
    if (!open) return undefined;
    setZIndex(pushModalLayer());
    return () => {
      popModalLayer();
      if (modalLayerDepth() === 0) document.body.style.overflow = "";
    };
  }, [open]);

  useDialogLayer({ open, panelRef, onEscape: onClose });

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="nf-modal-overlay"
      data-nf-portal=""
      style={{ zIndex }}
      onMouseDown={(event) => {
        pointerDownTarget.current = event.target;
      }}
      onClick={(event) => {
        // Solo cierra si el gesto empieza Y termina en el velo.
        if (event.target === event.currentTarget && pointerDownTarget.current === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        className="nf-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ maxWidth: `min(100%, ${width}px)` }}
      >
        <div className="nf-modal-header">
          <h3 id={titleId} className="nf-modal-header-title">
            {tx(title)}
          </h3>
          <button
            type="button"
            className="nf-modal-close"
            onClick={onClose}
            aria-label={tx("Cerrar")}
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="nf-modal-body">{children}</div>
      </div>
    </div>,
    getModalPortalRoot(),
  );
}
