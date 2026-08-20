"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { useI18n } from "@/context/I18nProvider";
import { cn } from "@/lib/utils";
import Picker, { type PickerProps } from "@/components/ui/Picker";

/**
 * Campo de formulario del producto.
 *
 * El barrido midió 1.210 campos sin nombre accesible en 46 ficheros: 555
 * usaban el placeholder como etiqueta y 652 no tenían nada. Un placeholder
 * desaparece en cuanto el usuario escribe, así que quien vuelve a un
 * formulario a medio rellenar no sabe qué contenía cada casilla; y para un
 * lector de pantalla ese campo simplemente no tiene nombre (WCAG 4.1.2, A).
 *
 * Este componente hace imposible ese estado: `label` es obligatorio en
 * TypeScript y siempre se pinta. La asociación es explícita con `htmlFor`,
 * no por anidamiento, para que funcione también cuando el control vive
 * dentro de una rejilla.
 *
 * El error se anuncia con un `role="alert"` que está SIEMPRE en el DOM y solo
 * cambia de texto. Un nodo insertado en el momento del error se lo pierden
 * varios lectores de pantalla.
 */

type FieldOwnProps = {
  /** Etiqueta visible. Obligatoria a propósito: es el fallo que este componente corrige. */
  label: string;
  /** Ayuda permanente bajo la etiqueta. Se enlaza con aria-describedby. */
  hint?: string;
  /** Mensaje de error. Al llegar marca el control con aria-invalid. */
  error?: string;
  required?: boolean;
  /** Marca explícita de opcional cuando la mayoría del formulario es obligatorio. */
  optional?: boolean;
  /** Oculta la etiqueta visualmente sin quitarla del árbol de accesibilidad. */
  labelHidden?: boolean;
  className?: string;
  /** Ocupa varias columnas de `FormGrid`. */
  span?: 1 | 2 | 3 | "full";
};

export type FieldProps = FieldOwnProps & { children: ReactNode };

/** Atributos que `Field` inyecta en su control. */
export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
};

export function Field({
  label,
  hint,
  error,
  required,
  optional,
  labelHidden,
  className,
  span,
  children,
}: FieldProps) {
  const { tx } = useI18n();
  const uid = useId();
  const controlId = `${uid}-control`;
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;

  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  // Se clona el único hijo para inyectar la asociación.
  //
  // Cuando llegan varios hijos no hay a cuál apuntar. En ese caso se omite
  // `htmlFor`: una etiqueta que apunta a un id inexistente es peor que una
  // sin destino, porque las herramientas la dan por asociada. El consumidor
  // que necesite asociar en ese caso pone él mismo el `id`.
  const only = Children.count(children) === 1 ? Children.only(children) : null;
  const clonable = only !== null && isValidElement(only);
  const control = clonable
    ? cloneElement(only as ReactElement<Record<string, unknown>>, {
        id: (only.props as { id?: string }).id ?? controlId,
        "aria-describedby": describedBy || undefined,
        "aria-invalid": error ? true : undefined,
        "aria-required": required ? true : undefined,
      })
    : children;

  const forId = clonable ? ((only.props as { id?: string }).id ?? controlId) : undefined;

  return (
    <div
      className={cn("nf-field", className)}
      data-invalid={error ? "" : undefined}
      data-span={span ?? undefined}
    >
      <label className={cn("nf-field__label", labelHidden && "nf-sr-only")} htmlFor={forId}>
        {tx(label)}
        {required && (
          <span className="nf-field__required" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="nf-sr-only"> ({tx("form.required")})</span>}
        {optional && !required && <span className="nf-field__optional">{tx("form.optional")}</span>}
      </label>
      {hint && (
        <p className="nf-field__hint" id={hintId}>
          {tx(hint)}
        </p>
      )}
      {control}
      {/* Permanente: un role="alert" montado junto al mensaje no se anuncia. */}
      <p className="nf-field__error" id={errorId} role="alert">
        {error ? tx(error) : ""}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Controles concretos
 *
 * Comparten `.nf-input` para que la geometría sea única. Antes cada módulo
 * repetía el mismo objeto de estilo en línea (`padding: "8px 10px"…`),
 * copiado literalmente en seis ficheros.
 * ------------------------------------------------------------------------ */

type BaseControl = Omit<FieldOwnProps, "children">;

export function TextField({
  label,
  hint,
  error,
  required,
  optional,
  labelHidden,
  className,
  span,
  ...input
}: BaseControl & Omit<InputHTMLAttributes<HTMLInputElement>, "className">) {
  const { tx } = useI18n();
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      optional={optional}
      labelHidden={labelHidden}
      className={className}
      span={span}
    >
      <input
        {...input}
        required={required}
        placeholder={input.placeholder ? tx(input.placeholder) : undefined}
        className="nf-input"
      />
    </Field>
  );
}

export function TextareaField({
  label,
  hint,
  error,
  required,
  optional,
  labelHidden,
  className,
  span,
  ...textarea
}: BaseControl & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className">) {
  const { tx } = useI18n();
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      optional={optional}
      labelHidden={labelHidden}
      className={className}
      span={span ?? "full"}
    >
      <textarea
        rows={3}
        {...textarea}
        required={required}
        placeholder={textarea.placeholder ? tx(textarea.placeholder) : undefined}
        className="nf-input nf-input--area"
      />
    </Field>
  );
}

export function SelectField({
  label,
  hint,
  error,
  required,
  optional,
  labelHidden,
  className,
  span,
  children,
  ...select
}: BaseControl &
  Omit<PickerProps, "className"> & { children: ReactNode }) {
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      optional={optional}
      labelHidden={labelHidden}
      className={className}
      span={span}
    >
      <Picker {...select} required={required} aria-label={select["aria-label"] ?? label} className="nf-input nf-input--select">
        {children}
      </Picker>
    </Field>
  );
}

/**
 * La casilla lleva su etiqueta al lado, no encima: envolverla en `Field`
 * produciría una etiqueta huérfana sobre un cuadrado de 16 px.
 */
export function CheckboxField({
  label,
  hint,
  error,
  className,
  ...input
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type">) {
  const { tx } = useI18n();
  const uid = useId();
  const id = input.id ?? `${uid}-check`;
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className={cn("nf-field nf-field--check", className)} data-invalid={error ? "" : undefined}>
      <div className="nf-check">
        <input
          {...input}
          id={id}
          type="checkbox"
          className="nf-check__box"
          aria-describedby={describedBy || undefined}
          aria-invalid={error ? true : undefined}
        />
        <label className="nf-check__label" htmlFor={id}>
          {tx(label)}
        </label>
      </div>
      {hint && (
        <p className="nf-field__hint" id={hintId}>
          {tx(hint)}
        </p>
      )}
      <p className="nf-field__error" id={errorId} role="alert">
        {error ? tx(error) : ""}
      </p>
    </div>
  );
}

/**
 * Grupo de radios. Necesita `fieldset`/`legend`: sin ellos cada radio se
 * anuncia suelto y no se oye la pregunta que responde.
 */
export function RadioGroup({
  label,
  hint,
  error,
  required,
  name,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; hint?: string }[];
  className?: string;
}) {
  const { tx } = useI18n();
  const uid = useId();
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <fieldset
      className={cn("nf-field nf-fieldset", className)}
      data-invalid={error ? "" : undefined}
      aria-describedby={describedBy || undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="nf-field__label">
        {tx(label)}
        {required && (
          <span className="nf-field__required" aria-hidden="true">
            *
          </span>
        )}
      </legend>
      {hint && (
        <p className="nf-field__hint" id={hintId}>
          {tx(hint)}
        </p>
      )}
      <div className="nf-radio-group">
        {options.map((option) => {
          const id = `${uid}-${option.value}`;
          return (
            <div className="nf-check" key={option.value}>
              <input
                className="nf-check__box"
                type="radio"
                id={id}
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
              />
              <label className="nf-check__label" htmlFor={id}>
                {tx(option.label)}
                {option.hint && <span className="nf-check__hint">{tx(option.hint)}</span>}
              </label>
            </div>
          );
        })}
      </div>
      <p className="nf-field__error" id={errorId} role="alert">
        {error ? tx(error) : ""}
      </p>
    </fieldset>
  );
}

/* ---------------------------------------------------------------------------
 * Composición
 * ------------------------------------------------------------------------ */

/** Rejilla de campos. En móvil siempre una columna. */
export function FormGrid({
  columns = 2,
  children,
  className,
}: {
  columns?: 1 | 2 | 3;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("nf-form-grid", className)} data-columns={columns}>
      {children}
    </div>
  );
}

/** Agrupa campos relacionados bajo un título accesible. */
export function Fieldset({
  legend,
  description,
  children,
  className,
}: {
  legend: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  const { tx } = useI18n();
  return (
    <fieldset className={cn("nf-fieldset nf-fieldset--group", className)}>
      <legend className="nf-fieldset__legend">{tx(legend)}</legend>
      {description && <p className="nf-fieldset__description">{tx(description)}</p>}
      {children}
    </fieldset>
  );
}

/** Pie de formulario. La acción primaria va a la derecha; lo destructivo se separa. */
export function FormActions({
  children,
  align = "end",
  className,
}: {
  children: ReactNode;
  align?: "start" | "end" | "between";
  className?: string;
}) {
  return (
    <div className={cn("nf-form-actions", className)} data-align={align}>
      {children}
    </div>
  );
}

/**
 * Resumen de errores del formulario. Se pinta al intentar enviar con campos
 * inválidos y enlaza a cada uno: en un formulario largo, saber que "hay 3
 * errores" sin poder llegar a ellos no sirve de nada.
 */
export function FormErrorSummary({
  errors,
  title = "form.errorSummary",
  className,
}: {
  errors: { id: string; label: string; message: string }[];
  title?: string;
  className?: string;
}) {
  const { tx } = useI18n();
  if (errors.length === 0) return null;
  return (
    <div className={cn("nf-form-summary", className)} role="alert" tabIndex={-1}>
      <p className="nf-form-summary__title">{tx(title)}</p>
      <ul className="nf-form-summary__list">
        {errors.map((error) => (
          <li key={error.id}>
            <a
              href={`#${error.id}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(error.id)?.focus();
              }}
            >
              {tx(error.label)}
            </a>
            : {tx(error.message)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Error de servidor de la operación completa, no de un campo concreto. */
export function FormError({ children, className }: { children: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p className={cn("nf-form-error", className)} role="alert">
      {children}
    </p>
  );
}
