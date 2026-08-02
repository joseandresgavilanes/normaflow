"use client";

import { useEffect } from "react";
import { useI18n } from "@/context/I18nProvider";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE"]);

/**
 * Marca de exclusión para contenido que NO es interfaz.
 *
 * El puente recorre el DOM y traduce cada nodo de texto, así que los datos del
 * cliente —títulos de documento, nombres de proveedor, descripciones de
 * riesgo— entraban al traductor igual que una etiqueta de botón. Cualquier
 * contenedor con `data-i18n="off"` queda fuera, él y su subárbol.
 */
const OPT_OUT_SELECTOR = '[data-i18n="off"]';
const TRANSLATABLE_ATTRIBUTES = ["aria-label", "title", "placeholder", "alt"] as const;
const TRANSLATABLE_META = [
  'meta[name="description"]',
  'meta[property="og:title"]',
  'meta[property="og:description"]',
  'meta[name="twitter:title"]',
  'meta[name="twitter:description"]',
];

function withOriginalSpacing(original: string, translated: string) {
  const start = original.match(/^\s*/)?.[0] ?? "";
  const end = original.match(/\s*$/)?.[0] ?? "";
  return `${start}${translated}${end}`;
}

export default function I18nDomBridge() {
  const { locale, tx } = useI18n();

  useEffect(() => {
    /**
     * El observador también ve las escrituras del propio puente. Sin este
     * registro, cada mutación disparaba una nueva traducción sobre el texto ya
     * traducido y la sustitución por fragmentos —que no es idempotente— iba
     * acumulando duplicados.
     */
    const written = new WeakMap<Text, string>();

    function isOptedOut(node: Node | null): boolean {
      const element = node?.nodeType === Node.ELEMENT_NODE
        ? (node as Element)
        : node?.parentElement ?? null;
      return Boolean(element?.closest(OPT_OUT_SELECTOR));
    }

    function translateTextNode(node: Text) {
      const raw = node.nodeValue ?? "";
      const clean = raw.trim();
      if (!clean) return;
      if (written.get(node) === raw) return; // lo escribimos nosotros
      if (isOptedOut(node)) return;
      const translated = tx(clean);
      if (translated !== clean) {
        const next = withOriginalSpacing(raw, translated);
        written.set(node, next);
        node.nodeValue = next;
      } else {
        written.set(node, raw);
      }
    }

    function translateElement(element: Element) {
      if (SKIP_TAGS.has(element.tagName)) return;
      if (element.closest(OPT_OUT_SELECTOR)) return;

      for (const attribute of TRANSLATABLE_ATTRIBUTES) {
        const value = element.getAttribute(attribute);
        if (!value) continue;
        const translated = tx(value);
        if (translated !== value) element.setAttribute(attribute, translated);
      }

      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });

      const nodes: Text[] = [];
      while (walker.nextNode()) nodes.push(walker.currentNode as Text);
      nodes.forEach(translateTextNode);
    }

    function translateHead() {
      const translatedTitle = tx(document.title);
      if (translatedTitle !== document.title) document.title = translatedTitle;
      document.head.querySelectorAll<HTMLMetaElement>(TRANSLATABLE_META.join(",")).forEach((meta) => {
        const value = meta.getAttribute("content");
        if (!value) return;
        const translated = tx(value);
        if (translated !== value) meta.setAttribute("content", translated);
      });
    }

    translateElement(document.body);
    translateHead();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData" && mutation.target.nodeType === Node.TEXT_NODE) {
          translateTextNode(mutation.target as Text);
          continue;
        }
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            translateTextNode(node as Text);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            translateElement(node as Element);
          }
        });
        if (mutation.type === "attributes" && mutation.target.nodeType === Node.ELEMENT_NODE) {
          translateElement(mutation.target as Element);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
    });

    const headObserver = new MutationObserver(translateHead);
    headObserver.observe(document.head, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["content"] });

    return () => {
      observer.disconnect();
      headObserver.disconnect();
    };
  }, [locale, tx]);

  return null;
}
