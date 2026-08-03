"use client";

import {
  ArrowRightLeft,
  Check,
  FilePlus2,
  PencilLine,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/context/I18nProvider";
import { cn } from "@/lib/utils";
import EmptyState from "@/components/ui/EmptyState";

/**
 * Historial de una entidad, leído del rastro de auditoría real.
 *
 * El producto ya escribía cada mutación en `AuditLog` dentro de la misma
 * transacción, con instantánea de antes y después — pero solo se veía
 * agregado en /app/activity. Desde el detalle de una no conformidad no había
 * forma de saber quién cambió el responsable ni cuándo.
 *
 * Lo que se muestra es el diff real guardado en `metadata`, no una frase
 * genérica: "cambió Estado: En análisis → Verificación" en vez de
 * "actualizado".
 */

export type TimelineEntry = {
  id: string;
  action: string;
  module: string;
  at: string;
  by: string;
  changes: { field: string; from: unknown; to: unknown }[];
};

const ICONO: Record<string, LucideIcon> = {
  create: FilePlus2,
  update: PencilLine,
  delete: Trash2,
  status_change: ArrowRightLeft,
  approve: Check,
  reject: X,
  submit_review: ArrowRightLeft,
  publish: Check,
  obsolete: X,
  archive: X,
  attach_file: Upload,
  upload: Upload,
  assign_owner: PencilLine,
};

const VERBO: Record<string, string> = {
  create: "creó",
  update: "actualizó",
  delete: "eliminó",
  status_change: "cambió el estado de",
  approve: "aprobó",
  reject: "rechazó",
  submit_review: "envió a revisión",
  publish: "publicó",
  obsolete: "marcó como obsoleto",
  archive: "archivó",
  restore: "restauró",
  attach_file: "adjuntó un archivo a",
  download: "descargó",
  export: "exportó",
  assign_owner: "asignó responsable de",
};

/** Nombres de campo que aparecen en los diffs, en lenguaje de usuario. */
const CAMPO: Record<string, string> = {
  status: "Estado",
  stage: "Etapa",
  title: "Título",
  ownerId: "Responsable",
  dueDate: "Fecha de vencimiento",
  progress: "Progreso",
  severity: "Severidad",
  priority: "Prioridad",
  description: "Descripción",
  rootCause: "Causa raíz",
  version: "Versión",
  criticality: "Criticidad",
  score: "Puntuación",
};

function valorLegible(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    return new Date(v).toLocaleDateString();
  }
  return String(v).slice(0, 80);
}

export function EntityTimeline({
  entries,
  className,
  emptyHint,
}: {
  entries: TimelineEntry[];
  className?: string;
  emptyHint?: string;
}) {
  const { t, tx } = useI18n();

  if (entries.length === 0) {
    return (
      <EmptyState
        kind="empty"
        title={t("detail.noHistory")}
        description={emptyHint}
      />
    );
  }

  return (
    <ol className={cn("nf-timeline", className)}>
      {entries.map((entry) => {
        const Icono = ICONO[entry.action] ?? PencilLine;
        const fecha = new Date(entry.at);
        return (
          <li className="nf-timeline__item" key={entry.id}>
            <span className="nf-timeline__marker" data-action={entry.action} aria-hidden="true">
              <Icono size={12} strokeWidth={2.5} />
            </span>
            <div className="nf-timeline__body">
              <p className="nf-timeline__head">
                <strong>{entry.by}</strong> {VERBO[entry.action] ?? entry.action.replace(/_/g, " ")}
                <time className="nf-timeline__time" dateTime={entry.at}>
                  {fecha.toLocaleDateString()} · {fecha.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </time>
              </p>
              {entry.changes.length > 0 && (
                <ul className="nf-timeline__changes">
                  {entry.changes.slice(0, 6).map((change) => (
                    <li key={change.field}>
                      <span className="nf-timeline__field">{tx(CAMPO[change.field] ?? change.field)}</span>
                      <span className="nf-timeline__from">{valorLegible(change.from)}</span>
                      <span aria-hidden="true">→</span>
                      <span className="nf-sr-only">{t("detail.changed")}</span>
                      <span className="nf-timeline__to">{valorLegible(change.to)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
