"use client";

import type { FormEvent, ReactNode } from "react";
import { Loader2, Plus } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Modal from "@/components/ui/Modal";
import { useI18n } from "@/context/I18nProvider";

export function OperationalHeader({ title, subtitle, canCreate, actionLabel, onCreate }: {
  title: string;
  subtitle: string;
  canCreate: boolean;
  actionLabel: string;
  onCreate: () => void;
}) {
  const { tx } = useI18n();
  return (
    <SectionTitle
      title={title}
      sub={subtitle}
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
  return (
    <Modal open={open} onClose={onClose} title={title} width={620}>
      <form onSubmit={onSubmit} className="nf-modal-form">
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

export function CardActions({ canUpdate, canDelete, onEdit, onDelete, pending }: {
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const { tx } = useI18n();
  if (!canUpdate && !canDelete) return null;
  return (
    <div onClick={(event) => event.stopPropagation()} style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--nf-line)" }}>
      {canUpdate && <button type="button" className="nf-app-btn-ghost nf-app-btn-sm" onClick={onEdit} disabled={pending}>{tx("Editar")}</button>}
      {canDelete && <button type="button" className="nf-app-btn-ghost nf-app-btn-sm nf-app-btn-ghost--danger" onClick={onDelete} disabled={pending}>{tx("Eliminar")}</button>}
    </div>
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
