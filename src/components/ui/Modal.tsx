"use client";

import { useEffect, useId, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { modalLayerDepth, popModalLayer, pushModalLayer } from "@/lib/modal-stack";

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
  const [mounted, setMounted] = useState(false);
  const [zIndex, setZIndex] = useState(1);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;

    const layer = pushModalLayer();
    setZIndex(layer);
    document.body.style.overflow = "hidden";

    return () => {
      popModalLayer();
      if (modalLayerDepth() === 0) {
        document.body.style.overflow = "";
      }
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="nf-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(14,28,50,0.5)",
        zIndex,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        className="nf-modal-panel"
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: "min(100%, " + width + "px)",
          maxHeight: "min(88vh, 88dvh)",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="nf-modal-header">
          <h3 id={titleId} className="nf-modal-header-title">
            {title}
          </h3>
          <button
            type="button"
            className="nf-modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="nf-modal-body">{children}</div>
      </div>
    </div>,
    getModalPortalRoot(),
  );
}
