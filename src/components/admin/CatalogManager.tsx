"use client";

import { useMemo, useState, useTransition } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import DataTable, { type Column } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { NF_INPUT_CLASS, modalInputStyle } from "@/components/ui/ModalForm";
import { formatDate } from "@/lib/utils";

export type CatalogRow = {
  id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  months?: number | null;
  active: boolean;
  createdAt: string;
};

export type CatalogField = {
  key: "name" | "code" | "description" | "months";
  label: string;
  type: "text" | "textarea" | "number";
  required?: boolean;
  helper?: string;
};

export default function CatalogManager({
  title,
  subtitle,
  rows,
  fields,
  canEdit,
  emptyText,
  onCreate,
  onUpdate,
  onDelete,
}: {
  title: string;
  subtitle?: string;
  rows: CatalogRow[];
  fields: CatalogField[];
  canEdit: boolean;
  emptyText?: string;
  onCreate: (form: { name: string; code?: string; description?: string; months?: number }) => Promise<void>;
  onUpdate: (id: string, form: { name?: string; code?: string; description?: string; months?: number; active?: boolean }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<CatalogRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CatalogRow | null>(null);
  const [formError, setFormError] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!showInactive && !r.active) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, showInactive]);

  const columns: Column<CatalogRow>[] = [
    {
      key: "name",
      label: "Nombre",
      render: (_, r) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontWeight: 600, color: "var(--nf-ink)" }}>{r.name}</span>
          {r.description && (
            <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{r.description}</span>
          )}
        </div>
      ),
    },
  ];
  if (fields.some((f) => f.key === "code")) {
    columns.unshift({ key: "code", label: "Código", render: (_, r) => <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--nf-primary-active)", fontWeight: 700 }}>{r.code ?? "—"}</span> });
  }
  if (fields.some((f) => f.key === "months")) {
    columns.push({
      key: "months",
      label: "Meses",
      render: (_, r) => <span style={{ fontFamily: "monospace", fontSize: 13 }}>{r.months ?? "—"}</span>,
    });
  }
  columns.push(
    {
      key: "active",
      label: "Estado",
      render: (_, r) => <Badge status={r.active ? "ACTIVE" : "OBSOLETE"} label={r.active ? "Activo" : "Inactivo"} />,
    },
    {
      key: "createdAt",
      label: "Creado",
      render: (_, r) => <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{formatDate(r.createdAt)}</span>,
    }
  );
  if (canEdit) {
    columns.push({
      key: "actions",
      label: "",
      render: (_, r) => (
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(r);
              setFormError("");
            }}
            className="nf-app-btn-ghost nf-app-btn-sm"
          >
            Editar
          </button>
          {r.active && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDelete(r);
              }}
              className="nf-app-btn-ghost nf-app-btn-sm nf-app-btn-ghost--danger"
            >
              Desactivar
            </button>
          )}
        </div>
      ),
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>, mode: "create" | "edit") {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: { name: string; code?: string; description?: string; months?: number } = {
      name: String(fd.get("name") || ""),
    };
    if (fields.some((f) => f.key === "code")) payload.code = String(fd.get("code") || "");
    if (fields.some((f) => f.key === "description")) {
      payload.description = String(fd.get("description") || "");
    }
    if (fields.some((f) => f.key === "months")) {
      payload.months = Number(fd.get("months") || 0);
    }
    setFormError("");
    startTransition(async () => {
      try {
        if (mode === "create") {
          await onCreate(payload);
          setCreating(false);
        } else if (editing) {
          await onUpdate(editing.id, payload);
          setEditing(null);
        }
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "No se pudo guardar.");
      }
    });
  }

  return (
    <div>
      <SectionTitle
        title={title}
        sub={subtitle}
        action={canEdit ? "+ Nuevo" : undefined}
        onAction={canEdit ? () => { setCreating(true); setFormError(""); } : undefined}
      />

      <Card>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <input aria-label="Buscar"
            type="search"
            placeholder="Buscar…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              minWidth: 200,
              padding: "8px 12px",
              fontSize: 13,
              border: "1px solid var(--nf-line)",
              borderRadius: 8,
              outline: "none",
            }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--nf-ink-3)" }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Ver inactivos
          </label>
          <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{filtered.length} de {rows.length}</span>
        </div>

        <DataTable columns={columns} rows={filtered} emptyText={emptyText ?? "Sin registros"} />
      </Card>

      {/* Create / Edit modal */}
      <Modal
        open={creating || editing != null}
        onClose={() => {
          if (isPending) return;
          setCreating(false);
          setEditing(null);
        }}
        title={creating ? `Nuevo ${title.toLowerCase()}` : `Editar ${title.toLowerCase()}`}
        width={520}
      >
        <form onSubmit={(e) => handleSubmit(e, creating ? "create" : "edit")} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {fields.map((f) => (
            <div key={f.key}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginBottom: 6, textTransform: "none", letterSpacing: "-0.01em" }}>
                {f.label}{f.required ? " *" : ""}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  name={f.key}
                  required={f.required}
                  defaultValue={editing ? (f.key === "description" ? editing.description ?? "" : "") : ""}
                  rows={3}
                  className={NF_INPUT_CLASS} style={modalInputStyle}
                />
              ) : f.type === "number" ? (
                <input
                  type="number"
                  name={f.key}
                  required={f.required}
                  min={0}
                  defaultValue={editing ? (editing.months ?? "") : ""}
                  className={NF_INPUT_CLASS} style={modalInputStyle}
                />
              ) : (
                <input
                  type="text"
                  name={f.key}
                  required={f.required}
                  defaultValue={editing ? (f.key === "name" ? editing.name : f.key === "code" ? editing.code ?? "" : f.key === "description" ? editing.description ?? "" : "") : ""}
                  className={NF_INPUT_CLASS} style={modalInputStyle}
                />
              )}
              {f.helper && <div style={{ fontSize: 11, color: "var(--nf-ink-4)", marginTop: 4 }}>{f.helper}</div>}
            </div>
          ))}
          {formError && (
            <div className="nf-modal-error">
              {formError}
            </div>
          )}
          <div className="nf-modal-actions">
            <button
              type="button"
              onClick={() => {
                if (isPending) return;
                setCreating(false);
                setEditing(null);
              }}
              disabled={isPending}
              className="nf-app-btn-ghost"
            >
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="nf-app-btn-primary">
              {isPending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm deactivate */}
      <Modal
        open={confirmDelete != null}
        onClose={() => !isPending && setConfirmDelete(null)}
        title="Desactivar registro"
        width={440}
      >
        <p style={{ margin: "0 0 16px", color: "var(--nf-ink)" }}>
          ¿Seguro que quieres desactivar <strong>{confirmDelete?.name}</strong>?
          Los registros relacionados se conservan; el catálogo dejará de aparecer en nuevos formularios.
        </p>
        <div className="nf-modal-actions">
          <button
            type="button"
            onClick={() => setConfirmDelete(null)}
            disabled={isPending}
            className="nf-app-btn-ghost"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                if (!confirmDelete) return;
                try {
                  await onDelete(confirmDelete.id);
                  setConfirmDelete(null);
                } catch (err: unknown) {
                  setFormError(err instanceof Error ? err.message : "Error.");
                }
              })
            }
            className="nf-app-btn-danger"
          >
            {isPending ? "Desactivando…" : "Desactivar"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

