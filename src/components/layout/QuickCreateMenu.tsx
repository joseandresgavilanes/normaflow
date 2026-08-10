"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";
import { QUICK_CREATE_ACTIONS } from "@/lib/quick-actions";
import { useI18n } from "@/context/I18nProvider";
import type { MessageKey } from "@/lib/i18n/messages";

const ACTION_TRANSLATION_KEYS: Record<string, { label: MessageKey; description: MessageKey }> = {
  "/app/actions": { label: "quick.actions.label", description: "quick.actions.desc" },
  "/app/nonconformities": { label: "quick.nonconformities.label", description: "quick.nonconformities.desc" },
  "/app/audits": { label: "quick.audits.label", description: "quick.audits.desc" },
  "/app/changes": { label: "quick.changes.label", description: "quick.changes.desc" },
  "/app/documents": { label: "quick.documents.label", description: "quick.documents.desc" },
  "/app/evidence": { label: "quick.evidence.label", description: "quick.evidence.desc" },
  "/app/training": { label: "quick.training.label", description: "quick.training.desc" },
};

export default function QuickCreateMenu() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function navigate(href: string) {
    setOpen(false);
    router.push(`${href}?create=1`);
  }

  function prefetchAction(href: string) {
    router.prefetch(`${href}?create=1`);
  }

  return (
    <div className="nf-quick-create" ref={rootRef}>
      <button
        type="button"
        className="nf-app-btn-primary nf-quick-create-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("quick.create")}
        onClick={() => setOpen((value) => !value)}
      >
        <Plus size={15} strokeWidth={2.5} aria-hidden />
        {/* En móvil solo queda el icono: la etiqueta desbordaba la píldora. El
            nombre accesible lo aporta `aria-label`, así que no se pierde. */}
        <span className="nf-quick-create-label">{t("quick.create")}</span>
        <ChevronDown
          size={14}
          strokeWidth={2.5}
          aria-hidden
          className={open ? "nf-quick-create-chevron--open" : undefined}
        />
      </button>

      {open && (
        <div className="nf-quick-create-menu" role="menu" aria-label={t("quick.menuLabel")}>
          {QUICK_CREATE_ACTIONS.map((action) => {
            const keys = ACTION_TRANSLATION_KEYS[action.href];
            return (
              <button
                key={action.href}
                type="button"
                role="menuitem"
                className="nf-quick-create-item"
                onMouseEnter={() => prefetchAction(action.href)}
                onFocus={() => prefetchAction(action.href)}
                onTouchStart={() => prefetchAction(action.href)}
                onClick={() => navigate(action.href)}
              >
                <span className="nf-quick-create-item-icon" aria-hidden>
                  <action.Icon size={16} strokeWidth={2} />
                </span>
                <span className="nf-quick-create-item-copy">
                  <span className="nf-quick-create-item-label">{keys ? t(keys.label) : action.label}</span>
                  <span className="nf-quick-create-item-desc">{keys ? t(keys.description) : action.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
