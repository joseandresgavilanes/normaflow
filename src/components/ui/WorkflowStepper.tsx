"use client";

import { Check, X, Circle } from "lucide-react";
import { useI18n } from "@/context/I18nProvider";
import { cn } from "@/lib/utils";
import { stepStatuses, workflowFor, type WorkflowDefinition } from "@/lib/workflows";

/**
 * Riel de etapas de una entidad con ciclo de vida.
 *
 * Sustituye a tres implementaciones incompatibles: `ACPMClient` (clases CSS
 * en globals.css), `ACPMLiveClient` (bordes superiores con estilo en línea) y
 * `ChangeControlModule` (una línea de texto con flechas). Ninguna decía en
 * qué paso estabas de forma anunciable, y las dos primeras usaban solo el
 * color para marcar lo hecho.
 *
 * Aquí el estado se lee de tres formas a la vez: icono, texto oculto para el
 * lector de pantalla, y `aria-current="step"`. La lista es un `<ol>`, así que
 * "paso 3 de 7" lo dice el propio navegador.
 */
export function WorkflowStepper({
  workflow,
  current,
  className,
  compact = false,
}: {
  /** Clave del registro (`document`, `risk`, …) o la definición completa. */
  workflow: string | WorkflowDefinition;
  /** Valor actual del enum de Prisma. */
  current: string;
  className?: string;
  /** Sin descripciones: para cabeceras y filas de tabla. */
  compact?: boolean;
}) {
  const { tx, t } = useI18n();
  const definition = typeof workflow === "string" ? workflowFor(workflow) : workflow;
  if (!definition) return null;

  const pasos = stepStatuses(definition, current);
  const enCamino = pasos.filter((p) => p.status !== "error").length;

  return (
    <nav
      aria-label={`${t("workflow.stateOf")} ${definition.entity.toLowerCase()}`}
      className={cn("nf-workflow", className)}
      data-compact={compact ? "" : undefined}
    >
      <ol className="nf-workflow__list">
        {pasos.map((paso, index) => {
          const Icono =
            paso.status === "done" ? Check : paso.status === "error" ? X : paso.status === "current" ? Circle : null;
          return (
            <li
              key={paso.step.value}
              className="nf-workflow__step"
              data-status={paso.status}
              data-exit={index >= enCamino ? "" : undefined}
              aria-current={paso.status === "current" || paso.status === "error" ? "step" : undefined}
            >
              <span className="nf-workflow__marker" aria-hidden="true">
                {Icono ? <Icono size={11} strokeWidth={3} fill={paso.status === "current" ? "currentColor" : "none"} /> : index + 1}
              </span>
              <span className="nf-workflow__text">
                <span className="nf-workflow__label">
                  {tx(paso.step.label)}
                  <span className="nf-sr-only">
                    {paso.status === "done"
                      ? `, ${t("workflow.done")}`
                      : paso.status === "current"
                        ? `, ${t("workflow.current")}`
                        : paso.status === "error"
                          ? `, ${t("workflow.exit")}`
                          : `, ${t("workflow.pending")}`}
                  </span>
                </span>
                {!compact && paso.step.hint && (
                  <span className="nf-workflow__hint">{tx(paso.step.hint)}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Estado actual como texto, con la posición dentro del flujo.
 *
 * Va donde no cabe el riel entero: cabeceras de modal, celdas de tabla.
 */
export function WorkflowBadge({
  workflow,
  current,
  className,
}: {
  workflow: string | WorkflowDefinition;
  current: string;
  className?: string;
}) {
  const { tx, t } = useI18n();
  const definition = typeof workflow === "string" ? workflowFor(workflow) : workflow;
  if (!definition) return null;

  const pasos = stepStatuses(definition, current);
  const actual = pasos.find((p) => p.status === "current" || p.status === "error");
  if (!actual) return null;

  const posicion = definition.steps.findIndex((s) => s.value === current);
  const esSalida = actual.status === "error";

  return (
    <span className={cn("nf-workflow-badge", className)} data-status={actual.status}>
      <span className="nf-workflow-badge__dot" aria-hidden="true" />
      {tx(actual.step.label)}
      {!esSalida && posicion >= 0 && (
        <span className="nf-workflow-badge__position">
          {posicion + 1}/{definition.steps.length}
          <span className="nf-sr-only">
            {" "}
            {t("form.stepOf")
              .replace("{n}", String(posicion + 1))
              .replace("{total}", String(definition.steps.length))}
          </span>
        </span>
      )}
    </span>
  );
}
