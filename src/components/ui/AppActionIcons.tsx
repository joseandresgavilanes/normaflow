"use client";

import { createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Ban,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleArrowRight,
  Download,
  Eye,
  ExternalLink,
  Flag,
  FlaskConical,
  Gauge,
  Link2,
  Pencil,
  Play,
  Plus,
  Replace,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRoundCog,
  X,
  type LucideIcon,
} from "lucide-react";

const ACTION_BUTTON_SELECTOR = [
  "button:not([role='tab']):not(.nf-modal-close):not(.nf-iso-table-search-clear):not(.nf-continuity-filter-clear):not([data-nf-no-action-icon])",
  "a.nf-app-btn-primary",
  "a.nf-app-btn-ghost",
  "a.nf-app-btn-outline",
  "a.nf-app-btn-success",
  "a.nf-app-btn-danger",
  "a.nf-app-btn-soft-success",
].join(",");

function iconForButton(button: HTMLElement): LucideIcon | null {
  const text = (button.textContent ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
  const className = button.className.toLocaleLowerCase();
  if (!text || button.dataset.nfNoActionIcon === "true") return null;
  if (button.querySelector("svg, [data-nf-action-icon]")) return null;

  // El ORDEN es el contrato de esta función: lo específico antes que lo
  // genérico, porque unos verbos contienen a otros. «Desactivar» contiene
  // «activar» y durante un tiempo dar de baja un registro se anunció con el
  // triángulo de reproducir.
  if (/(desactivar|deshabilitar|dar de baja|disable|deactivate)/.test(text)) return Ban;
  if (/(reactivar|reabrir|reopen|restaurar|restore|revertir)/.test(text)) return RotateCcw;
  if (/(revocar|revoke|retirar|anular|withdraw)/.test(text)) return Ban;
  if (/(inadmitir|descartar|discard|dismiss)/.test(text)) return X;

  if (/(editar|edit|modificar)/.test(text)) return Pencil;
  if (/(ver detalle|detalle|detail)/.test(text)) return Eye;
  // «Ocultar» y «Mostrar» son el mismo control en dos estados: el icono tiene
  // que decir en cuál está, no cuál es el botón.
  if (/(ocultar|hide|contraer|collapse)/.test(text)) return ChevronUp;
  if (/(mostrar|ver más|expandir|expand)/.test(text)) return ChevronDown;
  if (/(gestionar|manage|configurar|configure|ajustar)/.test(text)) return SlidersHorizontal;
  if (/(abrir|open)/.test(text)) return ExternalLink;
  if (/(eliminar|delete|borrar|quitar|remove)/.test(text)) return Trash2;
  if (/(cancelar|cerrar|close)/.test(text)) return X;
  if (/(rechazar|reject|devolver)/.test(text)) return X;
  if (/(guardar|save|actualizar|update)/.test(text)) return Save;
  if (/(aprobar|approve|confirmar|confirm|aceptar|accept|verificar|verify|autorizar|authorize|admitir|validar)/.test(text)) return Check;
  if (/(exportar|export|excel|pdf|descargar|download|csv)/.test(text)) return Download;
  if (/(evaluar|evaluación|assess|valorar|calificar|puntuar|medir|measure)/.test(text)) return Gauge;
  if (/(probar|test|ensayar|simular|simulate)/.test(text)) return FlaskConical;
  if (/(revisar|review|buscar|search|triage|analizar)/.test(text)) return Search;
  if (/(enviar|send|notificar|notify|comunicar|responder|reply)/.test(text)) return Send;
  if (/(sustituir|reemplazar|replace|superseder)/.test(text)) return Replace;
  if (/(reasignar|asignar|assign|delegar|derivar)/.test(text)) return UserRoundCog;
  if (/(mitigar|mitigate|tratar|remediar|corregir|subsanar)/.test(text)) return ShieldCheck;
  if (/(promover|promote|publicar|publish|liberar|release)/.test(text)) return ArrowUpRight;
  if (/(marcar|mark|señalar|flag)/.test(text)) return Flag;
  if (/(activar|iniciar|start|ejecutar|run)/.test(text)) return Play;
  if (/(atrás|atras|back|anterior|previous)/.test(text)) return ArrowLeft;
  if (/(avanzar|continuar|siguiente|next)/.test(text)) return ArrowRight;
  if (/(vincular|link|relacionar)/.test(text)) return Link2;
  if (/(archivar|archive|obsolet)/.test(text)) return Archive;
  // Raíces, no palabras exactas: «crear», «creación rápida» y «nueva auditoría»
  // son el mismo gesto y antes solo la primera se reconocía — las otras dos
  // recibían el «+» de rebote, por ser el botón primario de su fila.
  if (/(crea|nuev[oa]s?|new|añadir|agregar|add|registrar|record|solicitar|request|reportar|declarar|planificar)/.test(text)) return Plus;
  if (className.includes("nf-app-btn-danger")) return Trash2;
  if (className.includes("nf-app-btn-success")) return Check;

  // Última red, y SOLO para las acciones de fila: en una tabla la columna es
  // una rejilla de botones y el que sale pelado se lee como texto suelto, no
  // como algo pulsable. El resto del producto sigue sin icono cuando no hay
  // verbo reconocido: deducirlo de la clase convertía cualquier botón primario
  // en un «+» —«GAP Assessment» prometía crear algo solo por ser el destacado
  // de su fila—. El icono describe lo que el botón hace, y eso lo dice su texto.
  if (className.includes("nf-row-action")) return ChevronRight;
  return className.includes("nf-text-action") ? CircleArrowRight : null;
}

export default function AppActionIcons() {
  useEffect(() => {
    const mountedRoots = new Map<HTMLSpanElement, Root>();
    let frame: number | null = null;
    let disposed = false;

    function cleanupDisconnected() {
      mountedRoots.forEach((root, host) => {
        if (!host.isConnected) {
          root.unmount();
          mountedRoots.delete(host);
        }
      });
    }

    function enhanceButton(button: HTMLElement) {
      // El marcador permite ignorar botones ya procesados sin volver a buscar
      // todos los SVG de la página en cada mutación.
      if (button.querySelector("[data-nf-action-icon]")) return;
      const Icon = iconForButton(button);
      if (!Icon) return;

      const iconHost = document.createElement("span");
      iconHost.dataset.nfActionIcon = "true";
      iconHost.setAttribute("aria-hidden", "true");
      iconHost.style.display = "inline-flex";
      iconHost.style.alignItems = "center";
      iconHost.style.flex = "0 0 auto";
      iconHost.style.pointerEvents = "none";
      button.prepend(iconHost);
      const root = createRoot(iconHost);
      mountedRoots.set(iconHost, root);
      root.render(createElement(Icon, { size: 13, strokeWidth: 2, "aria-hidden": true }));
    }

    function scan(root: ParentNode) {
      if (disposed) return;
      cleanupDisconnected();
      if (root instanceof HTMLElement && root.matches(ACTION_BUTTON_SELECTOR)) {
        enhanceButton(root);
      }
      root.querySelectorAll<HTMLElement>(ACTION_BUTTON_SELECTOR).forEach(enhanceButton);
    }

    function scheduleScan(nodes?: Node[]) {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        if (!nodes?.length) {
          scan(document);
          return;
        }
        const roots = new Set<ParentNode>();
        nodes.forEach((node) => {
          if (node instanceof HTMLElement) roots.add(node);
          if (node.parentElement) roots.add(node.parentElement);
        });
        roots.forEach(scan);
      });
    }

    scheduleScan();
    const observer = new MutationObserver((mutations) => {
      scheduleScan(mutations.flatMap((mutation) => [mutation.target, ...Array.from(mutation.addedNodes)]));
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      disposed = true;
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
      mountedRoots.forEach((root, host) => {
        root.unmount();
        host.remove();
      });
    };
  }, []);

  return null;
}
