import type { FormEvent, ReactNode } from "react";
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
  return (
    <div className="nf-modal-field">
      <span className="nf-modal-field-label">{label}</span>
      {children}
      {hint ? <span className="nf-modal-field-hint">{hint}</span> : null}
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
  return (
    <button type={type} className="nf-app-btn-ghost" onClick={onClick} disabled={disabled}>
      {children}
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
  return (
    <button
      type="submit"
      className={variant === "danger" ? "nf-app-btn-danger" : "nf-app-btn-primary"}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

/** Solo ancho completo; el aspecto visual lo define `.nf-app-input`. */
export const modalInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
};
