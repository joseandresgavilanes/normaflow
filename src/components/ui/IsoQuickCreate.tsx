"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { createRequestKey } from "@/hooks/useCreateRequest";

export type IsoQuickCreateItem = {
  label: string;
  description: string;
  section: string;
  Icon: LucideIcon;
  createKey?: string;
};

export default function IsoQuickCreate({ modulePath, items }: { modulePath: string; items: IsoQuickCreateItem[] }) {
  const [open, setOpen] = useState(false);

  function navigate(item: IsoQuickCreateItem) {
    const url = new URL(window.location.href);
    url.pathname = modulePath;
    url.searchParams.set("section", item.section);
    url.searchParams.set("create", item.createKey ?? createRequestKey(item.label));
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
    setOpen(false);
  }

  return (
    <div className="nf-quick-create" style={{ marginLeft: "auto" }}>
      <button type="button" className="nf-app-btn-primary nf-quick-create-trigger" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}>
        <Plus size={14} /> Creación rápida
        <ChevronDown size={14} className={open ? "nf-quick-create-chevron--open" : undefined} aria-hidden />
      </button>
      {open && (
        <div className="nf-quick-create-menu" role="menu" aria-label="Creación rápida del módulo">
          {items.map((item) => (
            <button key={`${item.section}-${item.createKey ?? item.label}`} type="button" role="menuitem" className="nf-quick-create-item" onClick={() => navigate(item)}>
              <span className="nf-quick-create-item-icon" aria-hidden><item.Icon size={16} strokeWidth={2} /></span>
              <span className="nf-quick-create-item-copy"><span className="nf-quick-create-item-label">{item.label}</span><span className="nf-quick-create-item-desc">{item.description}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
