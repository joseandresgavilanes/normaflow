"use client";
import { useEffect } from "react";
import { X } from "lucide-react";

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
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="nf-modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(14,28,50,0.5)",
        zIndex: 1000,
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
          boxShadow: "0 24px 80px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="nf-modal-header">
          <h3 className="nf-modal-header-title">{title}</h3>
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
    </div>
  );
}
