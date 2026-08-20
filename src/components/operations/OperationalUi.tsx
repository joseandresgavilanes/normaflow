"use client";

import type { FormEvent, ReactNode } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import Card from "@/components/ui/Card";
import { RowAction } from "@/components/ui/RowActions";
import SectionTitle from "@/components/ui/SectionTitle";
import Modal from "@/components/ui/Modal";
import { useI18n } from "@/context/I18nProvider";

export function OperationalHeader({ title, subtitle, meta, canCreate, actionLabel, onCreate, headingLevel }: {
  title: string;
  subtitle: string;
  /** Dato que debe verse sin abrir nada: conteo, promedio, norma aplicable. */
  meta?: ReactNode;
  canCreate: boolean;
  actionLabel: string;
  onCreate: () => void;
  /**
   * 2 cuando la pantalla ya tiene su `<h1>` y esto encabeza el contenido de una
   * pestaña. En las pantallas donde esta cabecera ES la de la página se omite.
   */
  headingLevel?: 1 | 2;
}) {
  const { tx } = useI18n();
  return (
    <SectionTitle
      title={title}
      sub={subtitle}
      meta={meta}
      headingLevel={headingLevel}
      action={canCreate ? <span style={{ display: "inline-flex", gap: 7, alignItems: "center" }}><Plus size={17} />{tx(actionLabel)}</span> : undefined}
      onAction={canCreate ? onCreate : undefined}
    />
  );
}

export function OperationalMessages({ error, success }: { error: string; success: string }) {
  const { tx } = useI18n();
  if (!error && !success) return null;
  return (
    <div className={`nf-alert${error ? " nf-alert--error" : " nf-alert--success"}`}>
      {tx(error || success)}
    </div>
  );
}

export function EmptyOperational({ children }: { children: ReactNode }) {
  return <Card style={{ padding: 42, textAlign: "center", color: "var(--nf-ink-3)", fontSize: 14 }}>{children}</Card>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  const { tx } = useI18n();
  return (
    <label className="nf-field">
      <span className="nf-field-label">{tx(label)}</span>
      {children}
    </label>
  );
}

export const inputStyle = { width: "100%", boxSizing: "border-box" as const };

export function FormModal({ open, title, pending, error, onClose, onSubmit, children, submitLabel = "Guardar" }: {
  open: boolean;
  title: string;
  pending: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  submitLabel?: string;
}) {
  const { tx } = useI18n();
  function submit(event: FormEvent<HTMLFormElement>) {
    if (!event.currentTarget.checkValidity()) {
      event.preventDefault();
      event.currentTarget.reportValidity();
      return;
    }
    onSubmit(event);
  }
  return (
    <Modal open={open} onClose={onClose} title={title} width={620}>
      <form onSubmit={submit} className="nf-modal-form">
        {children}
        {error && <div className="nf-modal-error">{error}</div>}
        <div className="nf-modal-actions">
          <button type="button" className="nf-app-btn-ghost" onClick={onClose} disabled={pending}>{tx("Cancelar")}</button>
          <button type="submit" className="nf-app-btn-primary" disabled={pending}>
            {pending ? <Loader2 size={16} className="nf-icon-spin" /> : tx(submitLabel)}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Acciones dentro de una fila de tabla. Son las mismas que `CardActions`, sin
 * el borde superior ni el margen que solo tenían sentido dentro de la tarjeta.
 */
/**
 * Editar y eliminar de una fila. Es el par que llevan los 81 listados
 * operativos, así que su aspecto se decide aquí una vez.
 */
export function RowActions({ canUpdate, canDelete, onEdit, onDelete, pending, extra }: {
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  pending: boolean;
  extra?: ReactNode;
}) {
  return (
    <>
      {extra}
      {canUpdate && <RowAction icon={Pencil} label="Editar" onClick={onEdit} disabled={pending} />}
      {canDelete && <RowAction icon={Trash2} label="Eliminar" tone="danger" onClick={onDelete} disabled={pending} />}
    </>
  );
}

/** Cifra de una columna de recuento. El cero va atenuado: es ausencia de dato
 *  y no debe pesar lo mismo que un valor real. */
export function CountCell({ value }: { value: number }) {
  return <span className={value ? "nf-tabular" : "nf-tabular nf-dt__zero"}>{value}</span>;
}

/** Nivel de riesgo: el número manda, y el color lo clasifica de un vistazo sin
 *  ser la única señal —la cifra sigue ahí para quien no distingue el color. */
export function ScoreCell({ value }: { value: number }) {
  const tono = value >= 15 ? "danger" : value >= 8 ? "warning" : "success";
  return <span className="nf-cell-score nf-tabular" data-tone={tono}>{value}</span>;
}

/** Avance dentro de una celda: barra estrecha y el número al lado, porque en
 *  una tabla el porcentaje se compara mejor leyéndolo que mirándolo. */
export function ProgressCell({ value }: { value: number }) {
  return (
    <span className="nf-cell-progress">
      <span className="nf-cell-progress__track" aria-hidden>
        <span className="nf-cell-progress__fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </span>
      <span className="nf-tabular">{value}%</span>
    </span>
  );
}

/** Celda principal: título y, debajo, el dato que lo sitúa (código, norma…). */
export function CellTitle({ title, meta }: { title: ReactNode; meta?: ReactNode }) {
  return (
    <span className="nf-cell-title">
      <span className="nf-cell-title__main">{title}</span>
      {meta && <span className="nf-cell-title__meta">{meta}</span>}
    </span>
  );
}

export function Meta({ label, value }: { label: string; value: ReactNode }) {
  const { tx } = useI18n();
  return (
    <div className="nf-meta">
      <div className="nf-meta-label">{tx(label)}</div>
      <div className="nf-meta-value">{value || "—"}</div>
    </div>
  );
}
