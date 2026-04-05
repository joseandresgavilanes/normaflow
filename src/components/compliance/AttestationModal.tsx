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
      <p style={{ fontSize: 13, color: "#142033", lineHeight: 1.55, marginTop: 0 }}>{statement}</p>
      <div style={{ background: "#F7F9FC", border: "1px solid #E5EAF2", borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 12, color: "#5E6B7A" }}>
        Esta acción genera un registro de trazabilidad con sello de tiempo. En producción se vincularía a política de firma y conservación de evidencias.
      </div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#142033", marginBottom: 6 }}>Confirme su email corporativo</label>
      <input
        value={emailConfirm}
        onChange={e => setEmailConfirm(e.target.value)}
        placeholder={sessionEmail}
        autoComplete="off"
        style={{ width: "100%", padding: "10px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, marginBottom: 14, boxSizing: "border-box" }}
      />
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#142033", marginBottom: 6 }}>Motivo / comentario de la decisión</label>
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        rows={3}
        placeholder="Ej. Revisión documental completada; sin observaciones bloqueantes."
        style={{ width: "100%", padding: "10px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
      />
      {err && <p style={{ color: "#C93C37", fontSize: 13, margin: "8px 0 0" }}>{err}</p>}
      <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
        <button type="button" onClick={onClose} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #E5EAF2", background: "#fff", cursor: "pointer", fontSize: 13 }}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "#123C66", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
        >
          Confirmar y registrar
        </button>
      </div>
    </Modal>
  );
}
