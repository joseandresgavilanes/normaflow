"use client";
import { useEffect } from "react";
interface ModalProps { open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: number; }
export default function Modal({ open, onClose, title, children, width = 560 }: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="nf-modal-overlay"
      style={{ position: "fixed", inset: 0, background: "rgba(14,28,50,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={onClose}
    >
      <div
        className="nf-modal-panel"
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: "min(100%, " + width + "px)", maxHeight: "min(88vh, 88dvh)", overflow: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.2)" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: "1px solid #E5EAF2" }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#142033" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#5E6B7A", cursor: "pointer", lineHeight: 1, padding: 4 }}>×</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}
