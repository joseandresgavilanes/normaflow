"use client";

import { useCallback, useMemo, useRef, useState } from "react";

/**
 * Estado y validación de formularios.
 *
 * Dos decisiones de comportamiento, que son las que hacen que un formulario
 * se sienta bien o mal:
 *
 *  1. **Se valida al salir del campo, no al teclear.** Marcar en rojo la
 *     tercera letra de un correo que el usuario aún está escribiendo es
 *     ruido; el error llega cuando termina.
 *  2. **Una vez que un campo ya falló, sí se revalida al teclear.** Así el
 *     error desaparece en cuanto se corrige, en vez de esperar a otro blur.
 *
 * Al enviar se marcan todos los campos, se lleva el foco al primero inválido
 * y se anuncia el recuento. El foco es lo importante: sin él, en un
 * formulario largo el usuario no encuentra qué falla.
 */

export type Validator<T> = (value: unknown, values: T) => string | undefined;

export type FieldConfig<T> = {
  /** Etiqueta usada en el resumen de errores. */
  label?: string;
  validate?: Validator<T> | Validator<T>[];
};

type Errors<T> = Partial<Record<keyof T & string, string>>;
type Touched<T> = Partial<Record<keyof T & string, boolean>>;

export function useForm<T extends Record<string, unknown>>({
  initial,
  fields,
  onAnnounce,
}: {
  initial: T;
  fields?: Partial<Record<keyof T & string, FieldConfig<T>>>;
  /** Normalmente `useAnnounce()` de LiveRegion. */
  onAnnounce?: (message: string) => void;
}) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Errors<T>>({});
  const [touched, setTouched] = useState<Touched<T>>({});
  const [submitted, setSubmitted] = useState(false);
  const idsRef = useRef<Partial<Record<string, string>>>({});

  const runValidators = useCallback(
    (name: keyof T & string, value: unknown, all: T): string | undefined => {
      const config = fields?.[name];
      if (!config?.validate) return undefined;
      const list = Array.isArray(config.validate) ? config.validate : [config.validate];
      for (const validate of list) {
        const message = validate(value, all);
        if (message) return message;
      }
      return undefined;
    },
    [fields],
  );

  const validateAll = useCallback(
    (all: T): Errors<T> => {
      const next: Errors<T> = {};
      for (const name of Object.keys(all) as (keyof T & string)[]) {
        const message = runValidators(name, all[name], all);
        if (message) next[name] = message;
      }
      return next;
    },
    [runValidators],
  );

  const setValue = useCallback(
    <K extends keyof T & string>(name: K, value: T[K]) => {
      setValues((previous) => {
        const next = { ...previous, [name]: value };
        // Revalidar en caliente solo si el campo ya se marcó: ver cabecera.
        setErrors((currentErrors) => {
          if (!touched[name] && !submitted) return currentErrors;
          const message = runValidators(name, value, next);
          const copy = { ...currentErrors };
          if (message) copy[name] = message;
          else delete copy[name];
          return copy;
        });
        return next;
      });
    },
    [runValidators, submitted, touched],
  );

  const blur = useCallback(
    (name: keyof T & string) => {
      setTouched((previous) => ({ ...previous, [name]: true }));
      setErrors((previous) => {
        const message = runValidators(name, values[name], values);
        const copy = { ...previous };
        if (message) copy[name] = message;
        else delete copy[name];
        return copy;
      });
    },
    [runValidators, values],
  );

  /** Props listas para `TextField`/`SelectField`/`TextareaField`. */
  const field = useCallback(
    <K extends keyof T & string>(name: K) => ({
      name,
      value: (values[name] ?? "") as string | number,
      error: touched[name] || submitted ? errors[name] : undefined,
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
      ) => {
        const target = event.target;
        const next =
          target instanceof HTMLInputElement && target.type === "number"
            ? (target.value === "" ? "" : Number(target.value))
            : target.value;
        setValue(name, next as T[K]);
      },
      onBlur: () => blur(name),
      ref: (node: HTMLElement | null) => {
        if (node?.id) idsRef.current[name] = node.id;
      },
    }),
    [blur, errors, setValue, submitted, touched, values],
  );

  const handleSubmit = useCallback(
    (submit: (values: T) => void | Promise<unknown>) =>
      async (event?: React.FormEvent) => {
        event?.preventDefault();
        setSubmitted(true);
        const nextErrors = validateAll(values);
        setErrors(nextErrors);
        setTouched(
          Object.fromEntries(Object.keys(values).map((key) => [key, true])) as Touched<T>,
        );

        const failing = Object.keys(nextErrors) as (keyof T & string)[];
        if (failing.length > 0) {
          onAnnounce?.(
            failing.length === 1
              ? "Un campo necesita corrección."
              : `${failing.length} campos necesitan corrección.`,
          );
          const first = failing[0];
          const id = idsRef.current[first];
          if (id && typeof document !== "undefined") {
            document.getElementById(id)?.focus();
          }
          return;
        }
        await submit(values);
      },
    [onAnnounce, validateAll, values],
  );

  const summary = useMemo(
    () =>
      (Object.keys(errors) as (keyof T & string)[])
        .filter((name) => touched[name] || submitted)
        .map((name) => ({
          id: idsRef.current[name] ?? name,
          label: fields?.[name]?.label ?? name,
          message: errors[name] as string,
        })),
    [errors, fields, submitted, touched],
  );

  const reset = useCallback(
    (next?: T) => {
      setValues(next ?? initial);
      setErrors({});
      setTouched({});
      setSubmitted(false);
    },
    [initial],
  );

  return {
    values,
    errors,
    touched,
    submitted,
    setValue,
    setValues,
    field,
    blur,
    handleSubmit,
    reset,
    summary,
    isValid: Object.keys(errors).length === 0,
  };
}

/* ---------------------------------------------------------------------------
 * Validadores
 *
 * Devuelven el mensaje de error o `undefined`. El mensaje se escribe en
 * segunda persona y dice qué hacer, no qué está mal: "Indica un nombre" en
 * vez de "Campo inválido".
 * ------------------------------------------------------------------------ */

const isEmpty = (value: unknown) =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "");

export const required =
  (message = "Este campo es obligatorio."): Validator<Record<string, unknown>> =>
  (value) =>
    isEmpty(value) ? message : undefined;

export const maxLength =
  (max: number, message?: string): Validator<Record<string, unknown>> =>
  (value) =>
    typeof value === "string" && value.length > max
      ? (message ?? `No puede superar los ${max} caracteres.`)
      : undefined;

export const minLength =
  (min: number, message?: string): Validator<Record<string, unknown>> =>
  (value) =>
    typeof value === "string" && value.trim().length > 0 && value.trim().length < min
      ? (message ?? `Necesita al menos ${min} caracteres.`)
      : undefined;

export const range =
  (min: number, max: number, message?: string): Validator<Record<string, unknown>> =>
  (value) => {
    if (isEmpty(value)) return undefined;
    const n = Number(value);
    if (Number.isNaN(n)) return "Debe ser un número.";
    return n < min || n > max ? (message ?? `Debe estar entre ${min} y ${max}.`) : undefined;
  };

export const email =
  (message = "Revisa la dirección de correo."): Validator<Record<string, unknown>> =>
  (value) =>
    typeof value === "string" && value.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
      ? message
      : undefined;

/** La fecha no puede ser anterior a hoy (vencimientos, planificación). */
export const notPast =
  (message = "La fecha no puede ser anterior a hoy."): Validator<Record<string, unknown>> =>
  (value) => {
    if (isEmpty(value) || typeof value !== "string") return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Fecha no válida.";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today ? message : undefined;
  };

/** Una fecha tiene que ir después de otra: fin después de inicio, cierre después de apertura. */
export const afterField =
  (other: string, message?: string): Validator<Record<string, unknown>> =>
  (value, values) => {
    const start = values[other];
    if (isEmpty(value) || isEmpty(start)) return undefined;
    return new Date(String(value)) < new Date(String(start))
      ? (message ?? "Debe ser posterior a la fecha de inicio.")
      : undefined;
  };
