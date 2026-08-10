"use client";

import type { FormEvent, ReactNode } from "react";
import { Field, FormActions, FormError } from "@/components/ui/Field";
import { useI18n } from "@/context/I18nProvider";
import { cn } from "@/lib/utils";

/**
 * Adaptador sobre el sistema de formularios.
 *
 * `ModalField` pintaba la etiqueta como un `<span>`: visible, pero sin
 * ninguna asociación con su control. Un lector de pantalla anunciaba el campo
 * sin nombre, y pulsar sobre el texto no enfocaba nada.
 *
 * Ahora delega en `Field`, que asocia con `htmlFor`, enlaza la ayuda con
 * `aria-describedby` y añade el hueco de error con `role="alert"`. Los diez
 * ficheros que ya importan estos componentes lo heredan sin tocarse.
 *
 * Para código nuevo, usar directamente `Field`/`TextField`/`SelectField`.
 */

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
  function submit(event: FormEvent<HTMLFormElement>) {
    if (!event.currentTarget.checkValidity()) {
      event.preventDefault();
      event.currentTarget.reportValidity();
      return;
    }
    onSubmit?.(event);
  }

  return (
    <form className={cn("nf-modal-form", className)} onSubmit={submit} style={style}>
      {children}
    </form>
  );
}

export function ModalField({
  label,
  children,
  hint,
  error,
  required,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className="nf-modal-field">
      {children}
    </Field>
  );
}

export function ModalActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <FormActions align="end" className={cn("nf-modal-actions", className)}>
      {children}
    </FormActions>
  );
}

export function ModalError({ children }: { children: ReactNode }) {
  return <FormError className="nf-modal-error">{children}</FormError>;
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
