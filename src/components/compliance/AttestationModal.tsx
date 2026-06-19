"use client";
import { useState } from "react";
import Modal from "@/components/ui/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  statement: string;
  sessionEmail: string;
  onConfirm: (payload: { reason: string; attestationAt: string }) => void;
};

/** Reconfirmación de identidad + motivo — listo para sustituir por firma legal real */
export default function AttestationModal({ open, onClose, title, statement, sessionEmail, onConfirm }: Props) {
  const [emailConfirm, setEmailConfirm] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  function submit() {
    setErr("");
    if (emailConfirm.trim().toLowerCase() !== sessionEmail.trim().toLowerCase()) {
      setErr("El email no coincide con la sesión actual. Esta acción quedará registrada.");
      return;
    }
    if (reason.trim().length < 8) {
      setErr("Describa el motivo o contexto de la decisión (mín. 8 caracteres).");
      return;
    }
    const attestationAt = new Date().toISOString();
    onConfirm({ reason: reason.trim(), attestationAt });
    setEmailConfirm("");
    setReason("");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={title} width={520}>
      <p style={{ fontSize: 15, fontWeight: 600, color: "var(--nf-ink)", lineHeight: 1.55, marginTop: 0 }}>{statement}</p>
      <div className="nf-app-help" style={{ background: "var(--nf-app-surface-2)", border: "1px solid var(--nf-line)", borderRadius: 10, padding: 14, marginBottom: 18, fontWeight: 500 }}>
        Esta acción genera un registro de trazabilidad con sello de tiempo. En producción se vincularía a política de firma y conservación de evidencias.
      </div>
      <label className="nf-filter-label" style={{ display: "block", marginBottom: 8 }}>
        Confirme su email corporativo
      </label>
      <input
        value={emailConfirm}
        onChange={e => setEmailConfirm(e.target.value)}
        placeholder={sessionEmail}
        autoComplete="off"
        className="nf-app-input"
        style={{ width: "100%", marginBottom: 16, boxSizing: "border-box" }}
      />
      <label className="nf-filter-label" style={{ display: "block", marginBottom: 8 }}>
        Motivo / comentario de la decisión
      </label>
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        rows={3}
        placeholder="Ej. Revisión documental completada; sin observaciones bloqueantes."
        className="nf-app-input"
        style={{ width: "100%", resize: "vertical", boxSizing: "border-box", marginBottom: 4 }}
      />
      {err && <div className="nf-modal-error">{err}</div>}
      <div className="nf-modal-actions">
        <button type="button" className="nf-app-btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="nf-app-btn-primary" onClick={submit}>
          Confirmar y registrar
        </button>
      </div>
    </Modal>
  );
}
