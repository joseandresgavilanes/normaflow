"use client";

import type { FormEvent, ReactNode } from "react";
import { useI18n } from "@/context/I18nProvider";
import { cn } from "@/lib/utils";

export const NF_INPUT_CLASS = "nf-app-input";

export function ModalForm({
  children,
  className,
  onSubmit,
  style,
}: {
  children: ReactNode;
  className?: string;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  style?: React.CSSProperties;
}) {
  return (
    <form className={cn("nf-modal-form", className)} onSubmit={onSubmit} style={style}>
      {children}
    </form>
  );
}

export function ModalField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const { tx } = useI18n();
  return (
    <div className="nf-modal-field">
      <span className="nf-modal-field-label">{tx(label)}</span>
      {children}
      {hint ? <span className="nf-modal-field-hint">{tx(hint)}</span> : null}
    </div>
  );
}

export function ModalActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("nf-modal-actions", className)}>{children}</div>;
}

export function ModalError({ children }: { children: ReactNode }) {
  return <div className="nf-modal-error">{children}</div>;
}

export function ModalCancelButton({
  onClick,
  disabled,
  children = "Cancelar",
  type = "button",
}: {
  onClick?: () => void;
  disabled?: boolean;
  children?: ReactNode;
  type?: "button" | "reset";
}) {
  const { tx } = useI18n();
  return (
    <button type={type} className="nf-app-btn-ghost" onClick={onClick} disabled={disabled}>
      {typeof children === "string" ? tx(children) : children}
    </button>
  );
}

export function ModalSubmitButton({
  disabled,
  children,
  variant = "primary",
}: {
  disabled?: boolean;
  children: ReactNode;
  variant?: "primary" | "danger";
}) {
  const { tx } = useI18n();
  return (
    <button
      type="submit"
      className={variant === "danger" ? "nf-app-btn-danger" : "nf-app-btn-primary"}
      disabled={disabled}
    >
      {typeof children === "string" ? tx(children) : children}
    </button>
  );
}

/** Solo ancho completo; el aspecto visual lo define `.nf-app-input`. */
export const modalInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
};
