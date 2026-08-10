"use client";

import { createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleArrowRight,
  Download,
  Eye,
  ExternalLink,
  Link2,
  Pencil,
  Play,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
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

  if (/(editar|edit|modificar)/.test(text)) return Pencil;
  if (/(ver detalle|detalle|detail)/.test(text)) return Eye;
  if (/(abrir|open)/.test(text)) return ExternalLink;
  if (/(eliminar|delete|borrar|quitar|remove)/.test(text)) return Trash2;
  if (/(cancelar|cerrar|close)/.test(text)) return X;
  if (/(rechazar|reject|devolver)/.test(text)) return X;
  if (/(guardar|save|actualizar|update)/.test(text)) return Save;
  if (/(aprobar|approve|confirmar|confirm|aceptar|accept|verificar|verify)/.test(text)) return Check;
  if (/(exportar|export|excel|pdf|descargar|download)/.test(text)) return Download;
  if (/(revisar|review|buscar|search)/.test(text)) return Search;
  if (/(enviar|send|notificar|notify)/.test(text)) return Send;
  if (/(activar|iniciar|start|ejecutar|run)/.test(text)) return Play;
  if (/(atrás|atras|back|anterior|previous)/.test(text)) return ArrowLeft;
  if (/(avanzar|continuar|siguiente|next)/.test(text)) return ArrowRight;
  if (/(vincular|link|relacionar)/.test(text)) return Link2;
  if (/(crear|nuevo|new|añadir|agregar|add|registrar|record|solicitar|request|reportar|declarar)/.test(text)) return Plus;
  if (className.includes("nf-app-btn-danger")) return Trash2;
  if (className.includes("nf-app-btn-success")) return Check;
  if (className.includes("nf-app-btn-primary")) return Plus;
  if (className.includes("nf-app-btn-outline")) return ExternalLink;
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
