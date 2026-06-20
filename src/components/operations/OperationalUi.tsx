"use client";

import type { FormEvent, ReactNode } from "react";
import { Loader2, Plus } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Modal from "@/components/ui/Modal";

export function OperationalHeader({ title, subtitle, canCreate, actionLabel, onCreate }: {
  title: string;
  subtitle: string;
  canCreate: boolean;
  actionLabel: string;
  onCreate: () => void;
}) {
  return (
    <SectionTitle
      title={title}
      sub={subtitle}
      action={canCreate ? <span style={{ display: "inline-flex", gap: 7, alignItems: "center" }}><Plus size={17} />{actionLabel}</span> : undefined}
      onAction={canCreate ? onCreate : undefined}
    />
  );
}

export function OperationalMessages({ error, success }: { error: string; success: string }) {
  if (!error && !success) return null;
  return (
    <div className={`nf-alert${error ? " nf-alert--error" : " nf-alert--success"}`}>
      {error || success}
    </div>
  );
}

export function OperationalGrid({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 330px), 1fr))", gap: 14 }}>{children}</div>;
}

export function OperationalCard({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <Card onClick={onClick} style={{ padding: 18, cursor: onClick ? "pointer" : undefined, minWidth: 0 }} className="nf-operational-card">
      {children}
    </Card>
  );
}

export function EmptyOperational({ children }: { children: ReactNode }) {
  return <Card style={{ padding: 42, textAlign: "center", color: "var(--nf-ink-3)", fontSize: 14 }}>{children}</Card>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="nf-field">
      <span className="nf-field-label">{label}</span>
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
  return (
    <Modal open={open} onClose={onClose} title={title} width={620}>
      <form onSubmit={onSubmit} className="nf-modal-form">
        {children}
        {error && <div className="nf-modal-error">{error}</div>}
        <div className="nf-modal-actions">
          <button type="button" className="nf-app-btn-ghost" onClick={onClose} disabled={pending}>Cancelar</button>
          <button type="submit" className="nf-app-btn-primary" disabled={pending}>
            {pending ? <Loader2 size={16} className="nf-icon-spin" /> : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function CardActions({ canUpdate, canDelete, onEdit, onDelete, pending }: {
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  if (!canUpdate && !canDelete) return null;
  return (
    <div onClick={(event) => event.stopPropagation()} style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--nf-line)" }}>
      {canUpdate && <button type="button" className="nf-app-btn-ghost nf-app-btn-sm" onClick={onEdit} disabled={pending}>Editar</button>}
      {canDelete && <button type="button" className="nf-app-btn-ghost nf-app-btn-sm nf-app-btn-ghost--danger" onClick={onDelete} disabled={pending}>Eliminar</button>}
    </div>
  );
}

export function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="nf-meta">
      <div className="nf-meta-label">{label}</div>
      <div className="nf-meta-value">{value || "—"}</div>
    </div>
  );
}
