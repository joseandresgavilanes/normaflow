"use client";

import { createContext, useContext, useEffect, useState } from "react";
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
  onDismiss,
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
  onDismiss?: () => void;
}) {
  const { tx } = useI18n();
  return (
    <Modal open={open} onClose={() => !pending && (onDismiss ?? onCancel)()} title={title} width={460}>
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

type PromptRequest = {
  title: string;
  message?: React.ReactNode;
  label: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  multiline?: boolean;
  required?: boolean;
  danger?: boolean;
  onConfirm: (value: string) => void;
};

type ChoiceRequest = {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

type NoticeRequest = {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
};

type ActionDialogsContextValue = {
  requestPrompt: (request: PromptRequest) => void;
  requestChoice: (request: ChoiceRequest) => void;
  requestNotice: (request: NoticeRequest) => void;
};

const ActionDialogsContext = createContext<ActionDialogsContextValue | null>(null);

export function ActionDialogsProvider({ children }: { children: React.ReactNode }) {
  const [prompt, setPrompt] = useState<PromptRequest | null>(null);
  const [choice, setChoice] = useState<ChoiceRequest | null>(null);
  const [notice, setNotice] = useState<NoticeRequest | null>(null);

  const clear = () => {
    setPrompt(null);
    setChoice(null);
    setNotice(null);
  };

  const value: ActionDialogsContextValue = {
    requestPrompt: (request) => { setChoice(null); setNotice(null); setPrompt(request); },
    requestChoice: (request) => { setPrompt(null); setNotice(null); setChoice(request); },
    requestNotice: (request) => { setPrompt(null); setChoice(null); setNotice(request); },
  };

  return (
    <ActionDialogsContext.Provider value={value}>
      {children}
      {prompt && (
        <PromptActionModal
          open
          title={prompt.title}
          message={prompt.message}
          label={prompt.label}
          initialValue={prompt.initialValue}
          placeholder={prompt.placeholder}
          confirmLabel={prompt.confirmLabel}
          cancelLabel={prompt.cancelLabel}
          multiline={prompt.multiline}
          required={prompt.required}
          danger={prompt.danger}
          onCancel={clear}
          onConfirm={(value) => { const action = prompt.onConfirm; clear(); action(value); }}
        />
      )}
      {choice && (
        <ConfirmActionModal
          open
          title={choice.title}
          confirmLabel={choice.confirmLabel}
          cancelLabel={choice.cancelLabel}
          danger={choice.danger}
          onDismiss={clear}
          onCancel={() => { const action = choice.onCancel; clear(); action(); }}
          onConfirm={() => { const action = choice.onConfirm; clear(); action(); }}
        >
          {choice.message}
        </ConfirmActionModal>
      )}
      {notice && (
        <Modal open onClose={clear} title={notice.title} width={500}>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ color: "var(--nf-ink-2)", fontSize: 14, lineHeight: 1.6 }}>{notice.message}</div>
            <div className="nf-modal-actions">
              <button type="button" className="nf-app-btn-primary" onClick={clear}>{notice.confirmLabel ?? "Entendido"}</button>
            </div>
          </div>
        </Modal>
      )}
    </ActionDialogsContext.Provider>
  );
}

export function usePromptAction() {
  const context = useContext(ActionDialogsContext);
  if (!context) throw new Error("usePromptAction debe usarse dentro de ActionDialogsProvider");
  return context.requestPrompt;
}

export function useChoiceAction() {
  const context = useContext(ActionDialogsContext);
  if (!context) throw new Error("useChoiceAction debe usarse dentro de ActionDialogsProvider");
  return context.requestChoice;
}

export function useNoticeAction() {
  const context = useContext(ActionDialogsContext);
  if (!context) throw new Error("useNoticeAction debe usarse dentro de ActionDialogsProvider");
  return context.requestNotice;
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
              maxLength={4000}
              required={required}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={placeholder ? tx(placeholder) : undefined}
              disabled={pending}
              autoFocus
            />
          ) : (
            <input
              className="nf-app-input"
              maxLength={4000}
              required={required}
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
