"use client";

import { useMemo, useState, useTransition } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import DataTable, { type Column } from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import { useAdminMock, type OrgMemberMockRow } from "@/context/AdminMockStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import { formatDate } from "@/lib/utils";

type Role = OrgMemberMockRow["role"];

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ORG_ADMIN: "Admin de Organización",
  COMPLIANCE_MANAGER: "Compliance Manager",
  AUDITOR: "Auditor",
  CONTRIBUTOR: "Contribuidor",
  VIEWER: "Visor",
};

const ASSIGNABLE_ROLES: Role[] = ["ORG_ADMIN", "COMPLIANCE_MANAGER", "AUDITOR", "CONTRIBUTOR", "VIEWER"];

export default function MembersClient() {
  const admin = useAdminMock();
  const perm = useDemoPermission();
  const canEdit = perm.can("members:*");
  const rows = admin.state.members;

  const [search, setSearch] = useState("");
  const [inviting, setInviting] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<OrgMemberMockRow | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      ROLE_LABELS[r.role].toLowerCase().includes(q)
    );
  }, [rows, search]);

  function changeRole(row: OrgMemberMockRow, newRole: Role) {
    if (newRole === row.role) return;
    setError("");
    startTransition(() => {
      try { admin.updateMemberRole(row.membershipId, newRole); }
      catch (err: unknown) { setError(err instanceof Error ? err.message : "Error."); }
    });
  }

  const columns: Column<OrgMemberMockRow>[] = [
    {
      key: "name",
      label: "Usuario",
      render: (_, r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={r.name} size={32} />
          <div>
            <div style={{ fontWeight: 600, color: "var(--nf-ink)" }}>
              {r.name}
              {r.isSelf && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--nf-ink-4)" }}>(tú)</span>}
            </div>
            <div style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{r.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Rol",
      render: (_, r) => (
        canEdit && !r.isSelf ? (
          <select
            value={r.role}
            disabled={isPending}
            onChange={(e) => changeRole(r, e.target.value as Role)}
            style={{ padding: "6px 8px", fontSize: 12, border: "1px solid var(--nf-line)", borderRadius: 6, background: "var(--nf-app-surface-1)" }}
          >
            {ASSIGNABLE_ROLES.map((rl) => <option key={rl} value={rl}>{ROLE_LABELS[rl]}</option>)}
          </select>
        ) : (
          <Badge status="ACTIVE" label={ROLE_LABELS[r.role]} />
        )
      ),
    },
    { key: "createdAt", label: "Miembro desde", render: (_, r) => <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{formatDate(r.createdAt)}</span> },
  ];
  if (canEdit) {
    columns.push({
      key: "actions",
      label: "",
      render: (_, r) =>
        r.isSelf ? null : (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setConfirmRemove(r)} style={dangerBtn}>Quitar</button>
          </div>
        ),
    });
  }

  function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError("");
    startTransition(() => {
      try {
        admin.inviteMember({
          email: String(fd.get("email") || ""),
          name: String(fd.get("name") || ""),
          role: String(fd.get("role") || "CONTRIBUTOR") as Role,
        });
        setInviting(false);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "No se pudo invitar.");
      }
    });
  }

  return (
    <div>
      <SectionTitle
        title="Usuarios y roles"
        sub="Personas con acceso a esta organización en NormaFlow."
        action={canEdit ? "+ Invitar persona" : undefined}
        onAction={canEdit ? () => { setInviting(true); setError(""); } : undefined}
      />

      <Card>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <input
            type="search"
            placeholder="Buscar por nombre, email o rol…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 240, padding: "8px 12px", fontSize: 13, border: "1px solid var(--nf-line)", borderRadius: 8, outline: "none" }}
          />
          <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{filtered.length} de {rows.length}</span>
        </div>
        {error && (
          <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fff0f0", color: "#C93C37", fontSize: 13, marginBottom: 12 }}>{error}</div>
        )}
        <DataTable columns={columns} rows={filtered} emptyText="Sin miembros." />
      </Card>

      <Modal open={inviting} onClose={() => !isPending && setInviting(false)} title="Invitar persona" width={480}>
        <form onSubmit={handleInvite} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Nombre *">
            <input name="name" required style={inputStyle} placeholder="María Torres" />
          </Field>
          <Field label="Email *">
            <input name="email" type="email" required style={inputStyle} placeholder="maria@empresa.com" />
          </Field>
          <Field label="Rol">
            <select name="role" defaultValue="CONTRIBUTOR" style={inputStyle}>
              {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </Field>
          <p style={{ margin: 0, fontSize: 12, color: "var(--nf-ink-4)" }}>
            En esta versión demo la invitación es inmediata. El envío de email se conectará al integrar Resend.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setInviting(false)} disabled={isPending} style={ghostBtn}>Cancelar</button>
            <button type="submit" disabled={isPending} style={primaryBtn}>{isPending ? "Invitando…" : "Invitar"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={confirmRemove != null} onClose={() => !isPending && setConfirmRemove(null)} title="Quitar miembro" width={420}>
        <p style={{ margin: "0 0 14px", color: "var(--nf-ink)" }}>
          ¿Quitar a <strong>{confirmRemove?.name}</strong> de la organización? Perderá el acceso pero la cuenta se mantiene.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={() => setConfirmRemove(null)} disabled={isPending} style={ghostBtn}>Cancelar</button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => {
              if (!confirmRemove) return;
              try { admin.removeMember(confirmRemove.membershipId); setConfirmRemove(null); }
              catch (err: unknown) { setError(err instanceof Error ? err.message : "Error."); }
            })}
            style={{ ...primaryBtn, background: "#C93C37" }}
          >
            {isPending ? "…" : "Quitar"}
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
