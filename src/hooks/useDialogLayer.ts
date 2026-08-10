"use client";

import { useEffect, useRef } from "react";

/**
 * Gestión de capas superpuestas: pila, bloqueo de scroll, aislamiento del
 * fondo y trampa de foco.
 *
 * Corrige cuatro defectos medidos en el código actual:
 *
 *  1. **Escape en cascada.** Cada modal registraba su propio listener en
 *     `document`, así que una sola pulsación cerraba TODA la pila. Aquí hay una
 *     pila compartida y `Escape` solo llega a la capa superior.
 *  2. **Bloqueo de scroll por triplicado.** `AppRoot`, el cajón de marketing y
 *     `Modal` escribían `document.body.style.overflow` por su cuenta; al cerrar
 *     uno se desbloqueaba con otro aún abierto. Aquí se cuenta con referencias.
 *  3. **`aria-modal` sin aislamiento.** Se declaraba `aria-modal="true"` pero el
 *     fondo seguía en el árbol de accesibilidad y tabulable. Aquí se aplica
 *     `inert` a los hermanos.
 *  4. **Sin trampa de foco.** No existía en ningún diálogo del repositorio.
 */

const stack: string[] = [];
let scrollLocks = 0;
let savedOverflow = "";
let savedPaddingRight = "";

function lockScroll() {
  if (scrollLocks === 0) {
    const { body } = document;
    savedOverflow = body.style.overflow;
    savedPaddingRight = body.style.paddingRight;
    // Compensar la barra de scroll evita que el contenido salte al bloquear.
    const gap = window.innerWidth - document.documentElement.clientWidth;
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    body.style.overflow = "hidden";
  }
  scrollLocks += 1;
}

function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) {
    document.body.style.overflow = savedOverflow;
    document.body.style.paddingRight = savedPaddingRight;
  }
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

export type DialogLayerOptions = {
  open: boolean;
  panelRef: React.RefObject<HTMLElement | null>;
  onEscape?: () => void;
  closeOnEscape?: boolean;
  trapFocus?: boolean;
  lockScroll?: boolean;
  /** Oculta el resto de la app del árbol de accesibilidad. */
  isolateBackground?: boolean;
  /** Dónde poner el foco al abrir. */
  initialFocus?: "firstField" | "panel";
};

export function useDialogLayer({
  open,
  panelRef,
  onEscape,
  closeOnEscape = true,
  trapFocus = true,
  lockScroll: shouldLockScroll = true,
  isolateBackground = true,
  initialFocus = "firstField",
}: DialogLayerOptions) {
  const layerId = useRef<string>(`nf-layer-${Math.random().toString(36).slice(2)}`);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  useEffect(() => {
    if (!open) return undefined;
    const id = layerId.current;
    const panel = panelRef.current;

    // Guardar el disparador ANTES de mover el foco: al cerrar hay que
    // devolverlo ahí, no al principio del documento.
    returnFocusTo.current = (document.activeElement as HTMLElement) ?? null;

    stack.push(id);
    if (shouldLockScroll) lockScroll();

    // Aislar el fondo solo cuando esta es la primera capa.
    //
    // Se recorre desde el panel hacia arriba marcando `inert` en los HERMANOS
    // de cada nivel. No basta con mirar los hijos de <body>: el portal
    // (#nf-modal-root) se monta DENTRO de .nf-app-shell, así que el shell es
    // ancestro del diálogo y excluirlo dejaba sin aislar el sidebar, la
    // cabecera y el contenido.
    const isolated: HTMLElement[] = [];
    if (isolateBackground && stack.length === 1 && panel) {
      let node: HTMLElement | null = panel;
      while (node && node !== document.body) {
        const parent: HTMLElement | null = node.parentElement;
        if (!parent) break;
        for (const child of Array.from(parent.children)) {
          const el = child as HTMLElement;
          if (el === node || el.hasAttribute("inert")) continue;
          el.setAttribute("inert", "");
          isolated.push(el);
        }
        node = parent;
      }
    }

    // Foco inicial. Sin esto el usuario de teclado se queda en <body> y el
    // lector de pantalla no anuncia que se ha abierto nada.
    if (panel) {
      const target = initialFocus === "firstField" ? focusableWithin(panel)[0] ?? panel : panel;
      // En el siguiente frame: el panel puede no estar aún en el layout.
      requestAnimationFrame(() => target?.focus({ preventScroll: true }));
    }

    function onKeyDown(event: KeyboardEvent) {
      // Solo la capa superior reacciona.
      if (stack[stack.length - 1] !== id) return;

      if (event.key === "Escape" && closeOnEscape) {
        event.stopPropagation();
        escapeRef.current?.();
        return;
      }

      if (event.key !== "Tab" || !trapFocus || !panelRef.current) return;
      const items = focusableWithin(panelRef.current);
      if (items.length === 0) {
        event.preventDefault();
        panelRef.current.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const index = stack.indexOf(id);
      if (index >= 0) stack.splice(index, 1);
      if (shouldLockScroll) unlockScroll();
      for (const el of isolated) el.removeAttribute("inert");
      returnFocusTo.current?.focus?.({ preventScroll: true });
    };
  }, [
    open,
    panelRef,
    closeOnEscape,
    trapFocus,
    shouldLockScroll,
    isolateBackground,
    initialFocus,
  ]);
}
