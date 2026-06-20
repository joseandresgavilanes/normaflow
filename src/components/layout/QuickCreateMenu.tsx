"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { QUICK_CREATE_ACTIONS } from "@/lib/quick-actions";

export default function QuickCreateMenu() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

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

  return (
    <div className="nf-quick-create" ref={rootRef}>
      <button
        type="button"
        className="nf-app-btn-primary nf-quick-create-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        Crear
        <ChevronDown
          size={14}
          strokeWidth={2.5}
          aria-hidden
          className={open ? "nf-quick-create-chevron--open" : undefined}
        />
      </button>

      {open && (
        <div className="nf-quick-create-menu" role="menu" aria-label="Crear registro">
          {QUICK_CREATE_ACTIONS.map((action) => (
            <button
              key={action.href}
              type="button"
              role="menuitem"
              className="nf-quick-create-item"
              onClick={() => navigate(action.href)}
            >
              <span className="nf-quick-create-item-icon" aria-hidden>
                <action.Icon size={16} strokeWidth={2} />
              </span>
              <span className="nf-quick-create-item-copy">
                <span className="nf-quick-create-item-label">{action.label}</span>
                <span className="nf-quick-create-item-desc">{action.description}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
