"use client";

import { useEffect } from "react";
import { useI18n } from "@/context/I18nProvider";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE"]);
const TRANSLATABLE_ATTRIBUTES = ["aria-label", "title", "placeholder"] as const;

function withOriginalSpacing(original: string, translated: string) {
  const start = original.match(/^\s*/)?.[0] ?? "";
  const end = original.match(/\s*$/)?.[0] ?? "";
  return `${start}${translated}${end}`;
}

export default function I18nDomBridge() {
  const { locale, tx } = useI18n();

  useEffect(() => {
    function translateTextNode(node: Text) {
      const raw = node.nodeValue ?? "";
      const clean = raw.trim();
      if (!clean) return;
      const translated = tx(clean);
      if (translated !== clean) {
        node.nodeValue = withOriginalSpacing(raw, translated);
      }
    }

    function translateElement(element: Element) {
      if (SKIP_TAGS.has(element.tagName)) return;

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

    translateElement(document.body);

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

    return () => observer.disconnect();
  }, [locale, tx]);

  return null;
}
