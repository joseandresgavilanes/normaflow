"use client";

import { Check, AlertCircle } from "lucide-react";
import { useI18n } from "@/context/I18nProvider";
import { cn } from "@/lib/utils";
import type { AutosaveStatus } from "@/hooks/useAutosave";

export type StepStatus = "done" | "current" | "pending" | "error";

export type Step = {
  id: string;
  label: string;
  /** Resumen corto del paso: qué se pide aquí. */
  hint?: string;
  status: StepStatus;
};

/**
 * Indicador de progreso de un flujo por pasos.
 *
 * Es una lista ordenada de verdad (`<ol>`), no una fila de divs: un lector
 * de pantalla anuncia "paso 2 de 5" sin que haya que decírselo. El paso
 * activo lleva `aria-current="step"`.
 *
 * El estado nunca depende solo del color: completado lleva marca de
 * verificación, con error lleva icono de aviso y texto, y el número sigue
 * visible en los pendientes.
 */
export function FormStepper({
  steps,
  onStepClick,
  className,
  orientation = "horizontal",
}: {
  steps: Step[];
  /** Si se pasa, los pasos ya completados son navegables. */
  onStepClick?: (id: string, index: number) => void;
  className?: string;
  orientation?: "horizontal" | "vertical";
}) {
  const { tx, t } = useI18n();
  const total = steps.length;

  return (
    <nav aria-label={t("form.stepperLabel")} className={cn("nf-stepper", className)} data-orientation={orientation}>
      <ol className="nf-stepper__list">
        {steps.map((step, index) => {
          const clickable = Boolean(onStepClick) && (step.status === "done" || step.status === "error");
          const Marker = step.status === "done" ? Check : step.status === "error" ? AlertCircle : null;

          const content = (
            <>
              <span className="nf-stepper__marker" aria-hidden="true">
                {Marker ? <Marker size={14} strokeWidth={2.5} /> : index + 1}
              </span>
              <span className="nf-stepper__text">
                <span className="nf-stepper__label">
                  {tx(step.label)}
                  <span className="nf-sr-only">
                    {" "}
                    ({t("form.stepOf").replace("{n}", String(index + 1)).replace("{total}", String(total))}
                    {step.status === "done" ? `, ${t("form.stepDone")}` : ""}
                    {step.status === "error" ? `, ${t("form.stepError")}` : ""})
                  </span>
                </span>
                {step.hint && <span className="nf-stepper__hint">{tx(step.hint)}</span>}
              </span>
            </>
          );

          return (
            <li
              key={step.id}
              className="nf-stepper__step"
              data-status={step.status}
              aria-current={step.status === "current" ? "step" : undefined}
            >
              {clickable ? (
                <button type="button" className="nf-stepper__button" onClick={() => onStepClick?.(step.id, index)}>
                  {content}
                </button>
              ) : (
                <span className="nf-stepper__button" aria-disabled={step.status === "pending" ? true : undefined}>
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Estado del guardado automático.
 *
 * Va en una región educada: enterarse de que se ha guardado no debe
 * interrumpir lo que el usuario está escribiendo.
 */
export function AutosaveIndicator({
  status,
  lastSavedAt,
  error,
  className,
}: {
  status: AutosaveStatus;
  lastSavedAt?: Date | null;
  error?: string | null;
  className?: string;
}) {
  const { t } = useI18n();

  const text =
    status === "saving"
      ? t("form.autosaveSaving")
      : status === "pending"
        ? t("form.autosavePending")
        : status === "error"
          ? `${t("form.autosaveError")}${error ? `: ${error}` : ""}`
          : status === "saved" && lastSavedAt
            ? `${t("form.autosaveSaved")} ${lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : "";

  return (
    <p className={cn("nf-autosave", className)} data-status={status} aria-live="polite">
      {text}
    </p>
  );
}
