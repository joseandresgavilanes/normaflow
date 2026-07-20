"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import { useI18n } from "@/context/I18nProvider";

export function ConfirmActionModal({
  open,
  title,
  children,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  pending = false,
  danger = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { tx } = useI18n();
  return (
    <Modal open={open} onClose={() => !pending && onCancel()} title={title} width={460}>
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ color: "var(--nf-ink-2)", fontSize: 14, lineHeight: 1.6 }}>
          {children}
        </div>
        <div className="nf-modal-actions">
          <button type="button" className="nf-app-btn-ghost" disabled={pending} onClick={onCancel}>
            {tx(cancelLabel)}
          </button>
          <button
            type="button"
            className={danger ? "nf-app-btn-danger" : "nf-app-btn-primary"}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? tx("Procesando...") : tx(confirmLabel)}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function PromptActionModal({
  open,
  title,
  message,
  label,
  initialValue = "",
  placeholder,
  confirmLabel = "Guardar",
  cancelLabel = "Cancelar",
  pending = false,
  danger = false,
  multiline = true,
  required = true,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  label: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  danger?: boolean;
  multiline?: boolean;
  required?: boolean;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const { tx } = useI18n();
  const [value, setValue] = useState(initialValue);
  const disabled = pending || (required && !value.trim());

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [initialValue, open]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    onConfirm(value.trim());
  }

  return (
    <Modal open={open} onClose={() => !pending && onCancel()} title={title} width={500}>
      <form className="nf-modal-form" onSubmit={submit}>
        {message && <div style={{ color: "var(--nf-ink-2)", fontSize: 14, lineHeight: 1.6 }}>{message}</div>}
        <label className="nf-modal-field">
          <span className="nf-modal-field-label">{tx(label)}</span>
          {multiline ? (
            <textarea
              className="nf-app-input"
              rows={4}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={placeholder ? tx(placeholder) : undefined}
              disabled={pending}
              autoFocus
            />
          ) : (
            <input
              className="nf-app-input"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={placeholder ? tx(placeholder) : undefined}
              disabled={pending}
              autoFocus
            />
          )}
        </label>
        <div className="nf-modal-actions">
          <button type="button" className="nf-app-btn-ghost" disabled={pending} onClick={onCancel}>
            {tx(cancelLabel)}
          </button>
          <button type="submit" className={danger ? "nf-app-btn-danger" : "nf-app-btn-primary"} disabled={disabled}>
            {pending ? tx("Procesando...") : tx(confirmLabel)}
          </button>
        </div>
      </form>
    </Modal>
  );
}
