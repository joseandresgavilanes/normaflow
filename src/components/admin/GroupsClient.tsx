"use client";

import { useMemo, useState, useTransition } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { useAdminMock, type GroupMockRow } from "@/context/AdminMockStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";

const PERMISSION_GROUPS: { label: string; permissions: { key: string; label: string }[] }[] = [
  {
    label: "Administración",
    permissions: [
      { key: "members:*", label: "Gestionar usuarios y roles" },
      { key: "groups:*",  label: "Gestionar grupos y permisos" },
      { key: "org:*",     label: "Editar la organización" },
    ],
  },
  {
    label: "Información general",
    permissions: [
      { key: "positions:*", label: "Gestionar cargos" },
      { key: "personnel:*", label: "Gestionar personal" },
    ],
  },
  {
    label: "Catálogos",
    permissions: [
      { key: "locations:*", label: "Gestionar lugares" },
      { key: "catalogs:*",  label: "Gestionar catálogos (retención / disposición / archivo / tipo)" },
    ],
  },
  {
    label: "Documentos y registros",
    permissions: [
      { key: "documents:read",   label: "Ver documentos" },
      { key: "documents:create", label: "Crear documentos" },
      { key: "documents:*",      label: "Gestionar documentos (incluye aprobar)" },
      { key: "records:read",     label: "Ver registros" },
      { key: "records:create",   label: "Crear registros" },
      { key: "records:*",        label: "Gestionar registros" },
    ],
  },
  {
    label: "Calidad y cumplimiento",
    permissions: [
      { key: "audits:*",        label: "Auditorías" },
      { key: "audit-program:*", label: "Programa de auditoría" },
      { key: "nc:*",            label: "No conformidades" },
      { key: "actions:*",       label: "Acciones (ACPM)" },
      { key: "risks:*",         label: "Riesgos" },
      { key: "indicators:*",    label: "Indicadores" },
      { key: "gap:*",           label: "GAP Assessment" },
      { key: "mgmt-review:*",   label: "Revisión por la dirección" },
    ],
  },
  {
    label: "Otros",
    permissions: [
      { key: "training:*",    label: "Capacitación" },
      { key: "changes:*",     label: "Gestión del cambio" },
      { key: "suppliers:*",   label: "Proveedores" },
      { key: "reporting:*",   label: "Informes" },
      { key: "activity:read", label: "Ver actividad / audit trail" },
    ],
  },
];

export default function GroupsClient() {
  const admin = useAdminMock();
  const perm = useDemoPermission();
  const canEdit = perm.can("groups:*");
  const groups = admin.state.groups;
  const orgMembers = useMemo(
    () => admin.state.members.map((m) => ({ id: m.userId, name: m.name, email: m.email })),
    [admin.state.members]
  );

  const [selected, setSelected] = useState<string | null>(groups[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<GroupMockRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GroupMockRow | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const current = useMemo(() => groups.find((g) => g.id === selected) ?? null, [groups, selected]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>, mode: "create" | "edit") {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = { name: String(fd.get("name") || ""), description: String(fd.get("description") || "") };
    setError("");
    startTransition(() => {
      try {
        if (mode === "create") { admin.createGroup(data); setCreating(false); }
        else if (editing) { admin.updateGroup(editing.id, data); setEditing(null); }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error.");
      }
    });
  }

  return (
    <div>
      <SectionTitle
        title="Grupos y permisos"
        sub="Concede permisos extra a un conjunto de usuarios sin tener que subir su rol global (ISOTech § 10)."
        action={canEdit ? "+ Nuevo grupo" : undefined}
        onAction={canEdit ? () => { setCreating(true); setError(""); } : undefined}
      />

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" }}>
        <Card>
          <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, color: "#5E6B7A", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
            Grupos ({groups.length})
          </div>
          {groups.length === 0 ? (
            <p style={{ fontSize: 13, color: "#9aa5b1", margin: 0 }}>Aún no hay grupos creados.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelected(g.id)}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "1px solid",
                    borderColor: selected === g.id ? "#123C66" : "#E5EAF2",
                    background: selected === g.id ? "#f0f4ff" : "#fff",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontWeight: 600, color: "#142033" }}>{g.name}</div>
                  <div style={{ fontSize: 11, color: "#5E6B7A", marginTop: 2 }}>
                    {g.memberIds.length} miembros · {g.permissions.length} permisos
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {current ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, color: "#142033" }}>{current.name}</h3>
                  {current.description && <p style={{ margin: "4px 0 0", fontSize: 13, color: "#5E6B7A" }}>{current.description}</p>}
                </div>
                {canEdit && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => { setEditing(current); setError(""); }} style={ghostBtn}>Editar</button>
                    <button type="button" onClick={() => setConfirmDelete(current)} style={dangerBtn}>Eliminar grupo</button>
                  </div>
                )}
              </div>
              {error && (
                <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 6, background: "#fff0f0", color: "#C93C37", fontSize: 13 }}>{error}</div>
              )}
            </Card>

            <Card>
              <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "#142033" }}>Miembros</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflow: "auto" }}>
                {orgMembers.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#9aa5b1", margin: 0 }}>Aún no hay personas en la organización.</p>
                ) : (
                  orgMembers.map((u) => {
                    const checked = current.memberIds.includes(u.id);
                    return (
                      <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: checked ? "#f0f4ff" : "transparent", cursor: canEdit ? "pointer" : "default" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!canEdit || isPending}
                          onChange={() => startTransition(() => admin.toggleGroupMember(current.id, u.id))}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#142033" }}>{u.name}</div>
                          <div style={{ fontSize: 12, color: "#5E6B7A" }}>{u.email}</div>
                        </div>
                        {checked && <Badge status="ACTIVE" label="En grupo" />}
                      </label>
                    );
                  })
                )}
              </div>
            </Card>

            <Card>
              <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "#142033" }}>Permisos del grupo</h4>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "#5E6B7A" }}>
                Los permisos se suman a los del rol de cada miembro. Los permisos con <code>*</code> conceden acceso total al recurso.
              </p>
              {PERMISSION_GROUPS.map((bucket) => (
                <div key={bucket.label} style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, color: "#5E6B7A", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                    {bucket.label}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 6 }}>
                    {bucket.permissions.map((p) => {
                      const granted = current.permissions.includes(p.key);
                      return (
                        <label
                          key={p.key}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 10px",
                            border: "1px solid",
                            borderColor: granted ? "#123C6660" : "#E5EAF2",
                            borderRadius: 8,
                            background: granted ? "#f0f4ff" : "#fff",
                            cursor: canEdit ? "pointer" : "default",
                            fontSize: 13,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={granted}
                            disabled={!canEdit || isPending}
                            onChange={() => startTransition(() => admin.toggleGroupPermission(current.id, p.key))}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ color: "#142033", fontWeight: 500 }}>{p.label}</div>
                            <code style={{ fontSize: 10, color: "#9aa5b1" }}>{p.key}</code>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </Card>
          </div>
        ) : (
          <Card>
            <p style={{ margin: 0, fontSize: 14, color: "#5E6B7A" }}>
              {groups.length === 0
                ? "Crea un primer grupo para empezar a delegar permisos."
                : "Selecciona un grupo en la lista."}
            </p>
          </Card>
        )}
      </div>

      <Modal open={creating || editing != null} onClose={() => { if (!isPending) { setCreating(false); setEditing(null); } }} title={creating ? "Nuevo grupo" : "Editar grupo"} width={480}>
        <form onSubmit={(e) => handleSubmit(e, creating ? "create" : "edit")} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Nombre *">
            <input name="name" required defaultValue={editing?.name ?? ""} style={inputStyle} placeholder="p.ej. Auditores internos" />
          </Field>
          <Field label="Descripción">
            <textarea name="description" rows={3} defaultValue={editing?.description ?? ""} style={inputStyle} />
          </Field>
          {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fff0f0", color: "#C93C37", fontSize: 13 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => { setCreating(false); setEditing(null); }} disabled={isPending} style={ghostBtn}>Cancelar</button>
            <button type="submit" disabled={isPending} style={primaryBtn}>{isPending ? "Guardando…" : "Guardar"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={confirmDelete != null} onClose={() => !isPending && setConfirmDelete(null)} title="Eliminar grupo" width={440}>
        <p style={{ margin: "0 0 14px", color: "#142033" }}>
          ¿Eliminar el grupo <strong>{confirmDelete?.name}</strong>? Sus miembros conservarán los permisos de su rol.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={() => setConfirmDelete(null)} disabled={isPending} style={ghostBtn}>Cancelar</button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => {
              if (!confirmDelete) return;
              try {
                admin.deleteGroup(confirmDelete.id);
                if (selected === confirmDelete.id) setSelected(null);
                setConfirmDelete(null);
              } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Error.");
              }
            })}
            style={{ ...primaryBtn, background: "#C93C37" }}
          >
            {isPending ? "…" : "Eliminar"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5E6B7A", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid #E5EAF2", borderRadius: 8, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { padding: "9px 18px", fontSize: 13, fontWeight: 600, color: "#fff", background: "#123C66", border: "none", borderRadius: 8, cursor: "pointer" };
const ghostBtn: React.CSSProperties = { padding: "9px 16px", fontSize: 13, fontWeight: 500, color: "#5E6B7A", background: "#fff", border: "1px solid #E5EAF2", borderRadius: 8, cursor: "pointer" };
const dangerBtn: React.CSSProperties = { ...ghostBtn, color: "#C93C37", border: "1px solid #fde0e0" };
