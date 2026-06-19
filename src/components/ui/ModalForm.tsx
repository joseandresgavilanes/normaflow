import type { FormEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

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

/** Estilos de input alineados con Documentos — para casos controlados sin clase CSS. */
export const modalInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  border: "1px solid var(--nf-line, #b8c8d9)",
  borderRadius: 8,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
  background: "var(--nf-app-surface-1, rgba(18, 60, 102, 0.1))",
  color: "var(--nf-ink, #0f1b2d)",
  fontWeight: 500,
};
