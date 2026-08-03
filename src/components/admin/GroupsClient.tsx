"use client";

import { useMemo, useState, useTransition } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Shield,
  Users,
  FolderTree,
  FileText,
  ClipboardCheck,
  Layers,
  KeyRound,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import SectionTitle from "@/components/ui/SectionTitle";
import Modal from "@/components/ui/Modal";
import { NF_INPUT_CLASS, modalInputStyle } from "@/components/ui/ModalForm";
import Badge from "@/components/ui/Badge";
import { useAdminMock, type GroupMockRow } from "@/context/AdminMockStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import { Field as UiField } from "@/components/ui/Field";

const PERMISSION_GROUPS: { label: string; permissions: { key: string; label: string }[] }[] = [
  {
    label: "Administración",
    permissions: [
      { key: "members:*", label: "Gestionar usuarios y roles" },
      { key: "groups:*", label: "Gestionar grupos y permisos" },
      { key: "org:*", label: "Editar la organización" },
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
      { key: "catalogs:*", label: "Gestionar catálogos (retención / disposición / archivo / tipo)" },
    ],
  },
  {
    label: "Documentos y registros",
    permissions: [
      { key: "documents:read", label: "Ver documentos" },
      { key: "documents:create", label: "Crear documentos" },
      { key: "documents:*", label: "Gestionar documentos (incluye aprobar)" },
      { key: "records:read", label: "Ver registros" },
      { key: "records:create", label: "Crear registros" },
      { key: "records:*", label: "Gestionar registros" },
    ],
  },
  {
    label: "Calidad y cumplimiento",
    permissions: [
      { key: "audits:*", label: "Auditorías" },
      { key: "audit-program:*", label: "Programa de auditoría" },
      { key: "nc:*", label: "No conformidades" },
      { key: "actions:*", label: "Acciones (ACPM)" },
      { key: "risks:*", label: "Riesgos" },
      { key: "indicators:*", label: "Indicadores" },
      { key: "gap:*", label: "GAP Assessment" },
      { key: "mgmt-review:*", label: "Revisión por la dirección" },
    ],
  },
  {
    label: "Otros",
    permissions: [
      { key: "training:*", label: "Capacitación" },
      { key: "changes:*", label: "Gestión del cambio" },
      { key: "suppliers:*", label: "Proveedores" },
      { key: "reporting:*", label: "Informes" },
      { key: "activity:read", label: "Ver actividad / audit trail" },
    ],
  },
];

function iconForBucket(label: string): LucideIcon {
  switch (label) {
    case "Administración":
      return Shield;
    case "Información general":
      return Users;
    case "Catálogos":
      return FolderTree;
    case "Documentos y registros":
      return FileText;
    case "Calidad y cumplimiento":
      return ClipboardCheck;
    case "Otros":
      return Layers;
    default:
      return KeyRound;
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const railAside: React.CSSProperties = {
  position: "sticky",
  top: 72,
  alignSelf: "start",
  borderRadius: 16,
  border: "1px solid rgba(82, 102, 246, 0.1)",
  background: "linear-gradient(165deg, #f8fafc 0%, #eef3f9 52%, #e6ecf4 100%)",
  padding: 14,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85)",
};

const mainShell: React.CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(82, 102, 246, 0.12)",
  background: "linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)",
  boxShadow: "none",
  overflow: "hidden",
  minWidth: 0,
};

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

  function toggleAssociation(kind: "process" | "module", value: string) {
    if (!current || !admin.setGroupAssociations) return;
    const processIds = [...(current.processIds ?? [])];
    const modules = [...(current.modules ?? [])];
    const target = kind === "process" ? processIds : modules;
    const index = target.indexOf(value);
    if (index >= 0) target.splice(index, 1);
    else target.push(value);
    startTransition(async () => {
      try {
        await admin.setGroupAssociations?.(current.id, processIds, modules);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "No se pudo guardar la asociación.");
      }
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>, mode: "create" | "edit") {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = { name: String(fd.get("name") || ""), description: String(fd.get("description") || "") };
    setError("");
    startTransition(async () => {
      try {
        if (mode === "create") {
          await admin.createGroup(data);
          setCreating(false);
        } else if (editing) {
          await admin.updateGroup(editing.id, data);
          setEditing(null);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error.");
      }
    });
  }

  return (
    <div>
      <SectionTitle
        title="Grupos y permisos"
        sub="Delega permisos extra por equipo sin subir el rol global de cada persona (ISOTech 10)."
        action={
          canEdit ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <Plus size={17} strokeWidth={2.25} aria-hidden />
              Nuevo grupo
            </span>
          ) : undefined
        }
        onAction={canEdit ? () => { setCreating(true); setError(""); } : undefined}
      />

      <div className="nf-groups-admin">
        <aside style={railAside}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
              padding: "0 2px",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "none",
                color: "var(--nf-ink-3)",
              }}
            >
              Grupos
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--nf-primary)",
                background: "rgba(255,255,255,0.75)",
                padding: "3px 9px",
                borderRadius: 99,
                border: "1px solid rgba(82, 102, 246,0.12)",
              }}
            >
              {groups.length}
            </span>
          </div>

          {groups.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--nf-ink-3)", margin: 0, lineHeight: 1.5 }}>
              Aún no hay grupos. Crea el primero para empezar a delegar.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {groups.map((g) => {
                const active = selected === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelected(g.id)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      textAlign: "left",
                      padding: "11px 12px",
                      borderRadius: 12,
                      border: active ? "1px solid rgba(82, 102, 246, 0.32)" : "1px solid rgba(255, 255, 255, 0.55)",
                      background: active ? "#fff" : "rgba(255, 255, 255, 0.42)",
                      boxShadow: active ? "0 12px 32px -14px rgba(82, 102, 246, 0.35)" : "none",
                      cursor: "pointer",
                      transition: "box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease, transform 0.18s ease",
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 11,
                        flexShrink: 0,
                        background: "linear-gradient(135deg, var(--nf-primary) 0%, #1a5080 55%, #2563a8 100%)",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        letterSpacing: "-0.03em",
                      }}
                    >
                      {initials(g.name)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          color: "var(--nf-ink)",
                          fontSize: 13,
                          letterSpacing: "-0.02em",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {g.name}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--nf-ink-3)", marginTop: 3 }}>
                        {g.memberIds.length} miembros · {g.permissions.length} permisos
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {current ? (
          <div style={mainShell}>
            <div
              style={{
                padding: "22px 22px 18px",
                borderBottom: "1px solid rgba(82, 102, 246, 0.08)",
                background:
                  "linear-gradient(105deg, rgba(82, 102, 246, 0.07) 0%, rgba(46, 139, 87, 0.06) 42%, transparent 72%)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 22,
                      fontWeight: 600,
                      color: "var(--nf-ink)",
                      letterSpacing: "-0.04em",
                      fontFamily: "var(--font-inter, Inter), system-ui, sans-serif",
                    }}
                  >
                    {current.name}
                  </h3>
                  {current.description ? (
                    <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--nf-ink-3)", lineHeight: 1.55, maxWidth: 560 }}>
                      {current.description}
                    </p>
                  ) : (
                    <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--nf-ink-4)", fontStyle: "italic" }}>
                      Sin descripción
                    </p>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        borderRadius: 99,
                        fontSize: 12,
                        fontWeight: 600,
                        background: "rgba(82, 102, 246, 0.09)",
                        color: "var(--nf-ink-2)",
                        border: "1px solid rgba(82, 102, 246, 0.1)",
                      }}
                    >
                      <Users size={14} strokeWidth={2.25} aria-hidden />
                      {current.memberIds.length} miembros
                    </span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        borderRadius: 99,
                        fontSize: 12,
                        fontWeight: 600,
                        background: "rgba(46, 139, 87, 0.1)",
                        color: "#1f5f3f",
                        border: "1px solid rgba(46, 139, 87, 0.2)",
                      }}
                    >
                      <KeyRound size={14} strokeWidth={2.25} aria-hidden />
                      {current.permissions.length} permisos activos
                    </span>
                  </div>
                </div>
                {canEdit && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(current);
                        setError("");
                      }}
                      className="nf-app-btn-outline"
                    >
                      <Pencil size={15} strokeWidth={2.25} aria-hidden />
                      Editar
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(current)} className="nf-app-btn-ghost nf-app-btn-sm nf-app-btn-ghost--danger">
                      <Trash2 size={15} strokeWidth={2.25} aria-hidden />
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
              {error && (
                <div
                  style={{
                    marginTop: 14,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "#fff0f0",
                    color: "var(--nf-danger)",
                    fontSize: 13,
                    border: "1px solid #ffd6d6",
                  }}
                >
                  {error}
                </div>
              )}
            </div>

            <div className="nf-groups-detail-split" style={{ padding: 20 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Users size={18} strokeWidth={2.25} color="#5266F6" aria-hidden />
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--nf-ink)", letterSpacing: "-0.02em" }}>Miembros</h4>
                </div>
                <div
                  style={{
                    maxHeight: 380,
                    overflowY: "auto",
                    borderRadius: 14,
                    background: "#f3f6fa",
                    border: "1px solid rgba(82, 102, 246, 0.07)",
                    padding: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {orgMembers.length === 0 ? (
                    <p style={{ fontSize: 13, color: "var(--nf-ink-3)", margin: "12px 10px", lineHeight: 1.5 }}>
                      Aún no hay personas en la organización.
                    </p>
                  ) : (
                    orgMembers.map((u) => {
                      const checked = current.memberIds.includes(u.id);
                      return (
                        <label
                          key={u.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "9px 10px",
                            borderRadius: 11,
                            background: checked ? "#fff" : "transparent",
                            border: checked ? "1px solid rgba(82, 102, 246, 0.16)" : "1px solid transparent",
                            boxShadow: checked ? "0 6px 18px -10px rgba(82, 102, 246, 0.28)" : "none",
                            cursor: canEdit ? "pointer" : "default",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!canEdit || isPending}
                            onChange={() =>
                              startTransition(async () => {
                                try {
                                  await admin.toggleGroupMember(current.id, u.id);
                                } catch {
                                  /* toggles are best-effort in UI */
                                }
                              })
                            }
                          />
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 9,
                              flexShrink: 0,
                              background: "linear-gradient(145deg, #e2e8f0 0%, #cbd5e1 100%)",
                              color: "#334155",
                              fontSize: 11,
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {initials(u.name)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>{u.name}</div>
                            <div style={{ fontSize: 12, color: "var(--nf-ink-3)", overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</div>
                          </div>
                          {checked && <Badge status="ACTIVE" label="En grupo" />}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-5 border-t border-gray-200 pt-5 lg:grid-cols-2">
                <div>
                  <h4 className="mb-1 text-sm font-semibold text-gray-900">Procesos asociados</h4>
                  <p className="mb-3 text-xs text-gray-500">Limita el contexto operativo que este equipo gestiona.</p>
                  <div className="grid gap-2">
                    {admin.state.processes.length === 0 ? <p className="text-xs text-gray-500">No hay procesos disponibles.</p> : admin.state.processes.map((process) => (
                      <label key={process.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">
                        <input type="checkbox" checked={(current.processIds ?? []).includes(process.id)} disabled={!canEdit || isPending || !admin.setGroupAssociations} onChange={() => toggleAssociation("process", process.id)} className="accent-indigo-600" />
                        <span>{process.code ? `${process.code} · ` : ""}{process.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="mb-1 text-sm font-semibold text-gray-900">Módulos asociados</h4>
                  <p className="mb-3 text-xs text-gray-500">Define qué áreas aparecen como contexto del grupo.</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {["documents", "processes", "risks", "audits", "actions", "reporting"].map((module) => (
                      <label key={module} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">
                        <input type="checkbox" checked={(current.modules ?? []).includes(module)} disabled={!canEdit || isPending || !admin.setGroupAssociations} onChange={() => toggleAssociation("module", module)} className="accent-indigo-600" />
                        <span className="capitalize">{module}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <KeyRound size={18} strokeWidth={2.25} color="#5266F6" aria-hidden />
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--nf-ink)", letterSpacing: "-0.02em" }}>Permisos</h4>
                </div>
                <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--nf-ink-3)", lineHeight: 1.55 }}>
                  Se suman al rol de cada miembro. La clave con <code style={{ fontSize: 12, fontFamily: "var(--font-mono, monospace)" }}>*</code> implica acceso total a ese recurso.
                </p>
                {PERMISSION_GROUPS.map((bucket) => {
                  const Icon = iconForBucket(bucket.label);
                  return (
                    <div
                      key={bucket.label}
                      style={{
                        marginBottom: 16,
                        borderRadius: 14,
                        background: "var(--nf-app-surface-2)",
                        padding: "12px 14px 14px",
                        border: "1px solid rgba(82, 102, 246, 0.07)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 11,
                            background: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 4px 14px -8px rgba(82, 102, 246, 0.35)",
                            color: "var(--nf-primary)",
                          }}
                        >
                          <Icon size={18} strokeWidth={2.25} aria-hidden />
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--nf-ink)", letterSpacing: "-0.02em" }}>{bucket.label}</div>
                          <div style={{ fontSize: 11, color: "var(--nf-ink-3)", marginTop: 2 }}>{bucket.permissions.length} permisos en este bloque</div>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                        {bucket.permissions.map((p) => {
                          const granted = current.permissions.includes(p.key);
                          return (
                            <label
                              key={p.key}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 10,
                                padding: "10px 11px",
                                borderRadius: 12,
                                border: granted ? "1px solid rgba(82, 102, 246, 0.22)" : "1px solid rgba(82, 102, 246, 0.08)",
                                background: granted ? "#fff" : "rgba(255,255,255,0.65)",
                                boxShadow: granted ? "0 6px 18px -12px rgba(82, 102, 246, 0.22)" : "none",
                                cursor: canEdit ? "pointer" : "default",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={granted}
                                disabled={!canEdit || isPending}
                                onChange={() =>
                                  startTransition(async () => {
                                    try {
                                      await admin.toggleGroupPermission(current.id, p.key);
                                    } catch {
                                      /* toggles are best-effort in UI */
                                    }
                                  })
                                }
                                style={{ marginTop: 3 }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ color: "var(--nf-ink)", fontWeight: 600, fontSize: 13, lineHeight: 1.35 }}>{p.label}</div>
                                <code
                                  style={{
                                    display: "inline-block",
                                    marginTop: 6,
                                    padding: "3px 7px",
                                    borderRadius: 6,
                                    background: "rgba(82, 102, 246, 0.07)",
                                    fontSize: 10,
                                    fontFamily: "var(--font-mono, monospace)",
                                    color: "var(--nf-ink-3)",
                                  }}
                                >
                                  {p.key}
                                </code>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              ...mainShell,
              padding: 44,
              textAlign: "center",
              color: "var(--nf-ink-3)",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                margin: "0 auto 16px",
                borderRadius: 16,
                background: "var(--nf-app-surface-2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--nf-primary)",
              }}
            >
              <KeyRound size={26} strokeWidth={2} aria-hidden />
            </div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--nf-ink)" }}>
              {groups.length === 0 ? "Crea un primer grupo" : "Selecciona un grupo"}
            </p>
            <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.55, maxWidth: 360, marginLeft: "auto", marginRight: "auto" }}>
              {groups.length === 0
                ? "Así podrás delegar permisos sin cambiar el rol global de cada usuario."
                : "Elige uno en la columna izquierda para ver miembros y permisos."}
            </p>
          </div>
        )}
      </div>

      <Modal open={creating || editing != null} onClose={() => { if (!isPending) { setCreating(false); setEditing(null); } }} title={creating ? "Nuevo grupo" : "Editar grupo"} width={480}>
        <form onSubmit={(e) => handleSubmit(e, creating ? "create" : "edit")} className="nf-modal-form">
          <Field label="Nombre *">
            <input aria-label="Nombre" name="name" required defaultValue={editing?.name ?? ""} className={NF_INPUT_CLASS} style={modalInputStyle} placeholder="p.ej. Auditores internos" />
          </Field>
          <Field label="Descripción">
            <textarea aria-label="Descripción" name="description" rows={3} defaultValue={editing?.description ?? ""} className={NF_INPUT_CLASS} style={modalInputStyle} />
          </Field>
          {error && <div className="nf-modal-error">{error}</div>}
          <div className="nf-modal-actions">
            <button type="button" onClick={() => { setCreating(false); setEditing(null); }} disabled={isPending} className="nf-app-btn-ghost">
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="nf-app-btn-primary">
              {isPending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={confirmDelete != null} onClose={() => !isPending && setConfirmDelete(null)} title="Eliminar grupo" width={440}>
        <p style={{ margin: "0 0 14px", color: "var(--nf-ink)" }}>
          ¿Eliminar el grupo <strong>{confirmDelete?.name}</strong>? Sus miembros conservarán los permisos de su rol.
        </p>
        <div className="nf-modal-actions">
          <button type="button" onClick={() => setConfirmDelete(null)} disabled={isPending} className="nf-app-btn-ghost">
            Cancelar
          </button>
          <button
            type="button"
            disabled={isPending}
            className="nf-app-btn-danger"
            onClick={() => startTransition(async () => {
              if (!confirmDelete) return;
              try {
                await admin.deleteGroup(confirmDelete.id);
                if (selected === confirmDelete.id) setSelected(null);
                setConfirmDelete(null);
              } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Error.");
              }
            })}
          >
            {isPending ? "…" : "Eliminar"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  // Delegado en el Field del sistema: asocia con htmlFor, enlaza la ayuda y
  // añade el hueco de error. Antes era un <span>, que no asocia nada.
  return <UiField label={label}>{children}</UiField>;
}
