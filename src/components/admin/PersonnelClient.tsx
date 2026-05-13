"use client";

import { useMemo, useState, useTransition } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import DataTable, { type Column } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Avatar from "@/components/ui/Avatar";
import { formatDate } from "@/lib/utils";
import { useAdminMock, type PersonnelMockRow } from "@/context/AdminMockStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";

export default function PersonnelClient() {
  const admin = useAdminMock();
  const perm = useDemoPermission();
  const canEdit = perm.can("personnel:*");

  const rows = admin.state.personnel;
  const positions = useMemo(
    () => admin.state.positions.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name })),
    [admin.state.positions]
  );
  const positionNameById = useMemo(() => {
    const map = new Map<string, string>();
    admin.state.positions.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [admin.state.positions]);

  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<PersonnelMockRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<PersonnelMockRow | null>(null);
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!showInactive && !r.active) return false;
      if (!q) return true;
      const positionName = r.positionId ? positionNameById.get(r.positionId) ?? "" : "";
      return (
        r.firstName.toLowerCase().includes(q) ||
        r.lastName.toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.identification ?? "").toLowerCase().includes(q) ||
        positionName.toLowerCase().includes(q)
      );
    });
  }, [rows, search, showInactive, positionNameById]);

  const columns: Column<PersonnelMockRow>[] = [
    {
      key: "firstName",
      label: "Persona",
      render: (_, r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={`${r.firstName} ${r.lastName}`} size={28} />
          <div>
            <div style={{ fontWeight: 600, color: "var(--nf-ink)" }}>{r.firstName} {r.lastName}</div>
            {r.email && <div style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{r.email}</div>}
          </div>
        </div>
      ),
    },
    {
      key: "positionId",
      label: "Cargo",
      render: (_, r) => r.positionId ? positionNameById.get(r.positionId) ?? "—" : <span style={{ color: "var(--nf-ink-4)" }}>—</span>,
    },
    { key: "identification", label: "Identificación", render: (_, r) => r.identification ?? <span style={{ color: "var(--nf-ink-4)" }}>—</span> },
    { key: "hiredAt", label: "Alta", render: (_, r) => r.hiredAt ? <span style={{ fontSize: 12 }}>{formatDate(r.hiredAt)}</span> : <span style={{ color: "var(--nf-ink-4)" }}>—</span> },
    { key: "active", label: "Estado", render: (_, r) => <Badge status={r.active ? "ACTIVE" : "OBSOLETE"} label={r.active ? "Activo" : "Inactivo"} /> },
  ];
  if (canEdit) {
    columns.push({
      key: "actions",
      label: "",
      render: (_, r) => (
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <button type="button" onClick={(e) => { e.stopPropagation(); setEditing(r); setFormError(""); }} style={ghostBtn}>Editar</button>
          {r.active && <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmDeactivate(r); }} style={dangerBtn}>Desactivar</button>}
        </div>
      ),
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>, mode: "create" | "edit") {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      firstName: String(fd.get("firstName") || ""),
      lastName: String(fd.get("lastName") || ""),
      email: String(fd.get("email") || "") || undefined,
      identification: String(fd.get("identification") || "") || undefined,
      positionId: String(fd.get("positionId") || "") || undefined,
      hiredAt: String(fd.get("hiredAt") || "") || undefined,
    };
    setFormError("");
    startTransition(() => {
      try {
        if (mode === "create") {
          admin.createPersonnel(payload);
          setCreating(false);
        } else if (editing) {
          admin.updatePersonnel(editing.id, payload);
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
        title="Personal"
        sub="Personas que pertenecen a la organización, con o sin acceso al sistema (ISOTech § 11.3)."
        action={canEdit ? "+ Nueva persona" : undefined}
        onAction={canEdit ? () => { setCreating(true); setFormError(""); } : undefined}
      />

      <Card>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <input
            type="search"
            placeholder="Buscar nombre, email, cargo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 240, padding: "8px 12px", fontSize: 13, border: "1px solid var(--nf-line)", borderRadius: 8, outline: "none" }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--nf-ink-3)" }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Ver inactivos
          </label>
          <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{filtered.length} de {rows.length}</span>
        </div>

        <DataTable columns={columns} rows={filtered} emptyText="Sin personal registrado todavía." />
      </Card>

      <Modal
        open={creating || editing != null}
        onClose={() => { if (!isPending) { setCreating(false); setEditing(null); } }}
        title={creating ? "Nueva persona" : "Editar persona"}
        width={560}
      >
        <form onSubmit={(e) => handleSubmit(e, creating ? "create" : "edit")} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Nombre *">
              <input name="firstName" required defaultValue={editing?.firstName ?? ""} style={inputStyle} />
            </Field>
            <Field label="Apellido *">
              <input name="lastName" required defaultValue={editing?.lastName ?? ""} style={inputStyle} />
            </Field>
          </div>
          <Field label="Email">
            <input type="email" name="email" defaultValue={editing?.email ?? ""} style={inputStyle} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Identificación">
              <input name="identification" defaultValue={editing?.identification ?? ""} style={inputStyle} />
            </Field>
            <Field label="Fecha de alta">
              <input type="date" name="hiredAt" defaultValue={editing?.hiredAt?.slice(0, 10) ?? ""} style={inputStyle} />
            </Field>
          </div>
          <Field label="Cargo">
            <select name="positionId" defaultValue={editing?.positionId ?? ""} style={inputStyle}>
              <option value="">— Sin cargo —</option>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>

          {formError && (
            <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fff0f0", color: "#C93C37", fontSize: 13 }}>{formError}</div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
            <button type="button" onClick={() => { setCreating(false); setEditing(null); }} disabled={isPending} style={ghostBtn}>Cancelar</button>
            <button type="submit" disabled={isPending} style={primaryBtn}>{isPending ? "Guardando…" : "Guardar"}</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={confirmDeactivate != null}
        onClose={() => !isPending && setConfirmDeactivate(null)}
        title="Desactivar persona"
        width={420}
      >
        <p style={{ margin: "0 0 14px", color: "var(--nf-ink)" }}>¿Seguro que quieres marcar como inactivo a <strong>{confirmDeactivate?.firstName} {confirmDeactivate?.lastName}</strong>?</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={() => setConfirmDeactivate(null)} disabled={isPending} style={ghostBtn}>Cancelar</button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => {
              if (!confirmDeactivate) return;
              try { admin.deactivatePersonnel(confirmDeactivate.id); setConfirmDeactivate(null); }
              catch (err: unknown) { setFormError(err instanceof Error ? err.message : "Error."); }
            })}
            style={{ ...primaryBtn, background: "#C93C37" }}
          >
            {isPending ? "…" : "Desactivar"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid var(--nf-line)", borderRadius: 8, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { padding: "9px 18px", fontSize: 13, fontWeight: 600, color: "#fff", background: "#123C66", border: "none", borderRadius: 8, cursor: "pointer" };
const ghostBtn: React.CSSProperties = { padding: "9px 16px", fontSize: 13, fontWeight: 500, color: "var(--nf-ink-3)", background: "var(--nf-app-surface-1)", border: "1px solid var(--nf-line)", borderRadius: 8, cursor: "pointer" };
const dangerBtn: React.CSSProperties = { ...ghostBtn, color: "#C93C37", border: "1px solid #fde0e0" };
