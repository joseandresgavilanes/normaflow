"use client";

import { useMemo, useState, useTransition } from "react";
import { Ban, CircleCheck, Send, Trash2 } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import DataTable, { type Column } from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import { NF_INPUT_CLASS, modalInputStyle } from "@/components/ui/ModalForm";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import { useAdminMock, type OrgMemberMockRow } from "@/context/AdminMockStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import { PLAN_LIMITS, type PlanKey } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { Field as UiField } from "@/components/ui/Field";
import Picker from "@/components/ui/Picker";
import { RowAction } from "@/components/ui/RowActions";

type Role = OrgMemberMockRow["role"];

const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  SUPER_ADMIN: "Super Admin",
  ORG_ADMIN: "Admin de Organización",
  COMPLIANCE_MANAGER: "Compliance Manager",
  AUDITOR: "Auditor",
  CONTRIBUTOR: "Contribuidor",
  VIEWER: "Visor",
};

const ASSIGNABLE_ROLES: Role[] = ["OWNER", "ADMIN", "MANAGER", "AUDITOR", "VIEWER", "ORG_ADMIN", "COMPLIANCE_MANAGER", "CONTRIBUTOR"];

export default function MembersClient() {
  const admin = useAdminMock();
  const perm = useDemoPermission();
  const canEdit = perm.can("members:*");
  const rows = admin.state.members;

  const plan = admin.state.organization.plan as PlanKey;
  const planInfo = PLAN_LIMITS[plan];
  const maxUsers = planInfo?.maxUsers ?? null;
  const usedUsers = rows.filter((row) => row.active !== false).length;
  const atLimit = maxUsers !== null && usedUsers >= maxUsers;
  const nearLimit = maxUsers !== null && !atLimit && usedUsers / maxUsers >= 0.8;

  const [search, setSearch] = useState("");
  const [inviting, setInviting] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<OrgMemberMockRow | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const isDemoMode = admin.mode === "demo";
  const orgName = admin.state.organization.name;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      (r.email ?? "").toLowerCase().includes(q) ||
      ROLE_LABELS[r.role].toLowerCase().includes(q)
    );
  }, [rows, search]);

  function changeRole(row: OrgMemberMockRow, newRole: Role) {
    if (newRole === row.role) return;
    setError("");
    startTransition(async () => {
      try {
        await admin.updateMemberRole(row.membershipId, newRole);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error.");
      }
    });
  }

  function changeScope(row: OrgMemberMockRow, scoped: boolean) {
    setError("");
    startTransition(async () => {
      try {
        await admin.setMemberScope?.(row.membershipId, scoped);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error.");
      }
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
      key: "active",
      label: "Estado",
      render: (_, r) => <Badge status={r.active === false ? "OBSOLETE" : "ACTIVE"} label={r.active === false ? "Inactivo" : "Activo"} />,
    },
    {
      key: "scoped",
      label: "Alcance",
      render: (_, r) => {
        // El rol dice qué puede hacer; esto, sobre cuánto. Se pueden combinar:
        // un gestor acotado a sus procesos, o un contribuidor con visión total.
        const acotado = r.scoped === true;
        const etiqueta = acotado ? "Solo lo asignado" : "Toda la organización";
        return canEdit && !r.isSelf && admin.setMemberScope ? (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, cursor: isPending ? "default" : "pointer" }}>
            <input
              type="checkbox"
              checked={acotado}
              disabled={isPending}
              onChange={(event) => changeScope(r, event.target.checked)}
              aria-label={`Acotar a ${r.name} a lo que tiene asignado`}
            />
            {etiqueta}
          </label>
        ) : (
          <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{etiqueta}</span>
        );
      },
    },
    {
      key: "role",
      label: "Rol",
      render: (_, r) => (
        canEdit && !r.isSelf ? (
          <Picker aria-label="Rol"
            value={r.role}
            disabled={isPending}
            onChange={(e) => changeRole(r, e.target.value as Role)}
            style={{ padding: "6px 8px", fontSize: 12, border: "1px solid var(--nf-input-border)", borderRadius: 6, background: "var(--nf-app-surface-1)" }}
          >
            {ASSIGNABLE_ROLES.map((rl) => <option key={rl} value={rl}>{ROLE_LABELS[rl]}</option>)}
          </Picker>
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
          <div className="nf-row-actions">
            {admin.resendMemberInvite && (
              <RowAction icon={Send} label="Reenviar" disabled={isPending} onClick={() => startTransition(async () => {
                try {
                  const outcome = await admin.resendMemberInvite?.(r.membershipId);
                  setSuccess(outcome == null || outcome.emailSent !== false
                    ? "Invitación reenviada."
                    : "Esta persona ya tiene cuenta en NormaFlow, así que no hay correo de invitación que reenviar: se le avisó desde la campana. Si no recuerda la contraseña, que use «¿Olvidaste tu contraseña?» en el acceso.");
                } catch (err: unknown) {
                  setError(err instanceof Error ? err.message : "No se pudo reenviar la invitación.");
                }
              })} />
            )}
            {admin.setMemberActive && (
              <RowAction
                icon={r.active === false ? CircleCheck : Ban}
                label={r.active === false ? "Activar" : "Desactivar"}
                tone={r.active === false ? "success" : "danger"}
                disabled={isPending}
                onClick={() => startTransition(async () => {
                  try {
                    await admin.setMemberActive?.(r.membershipId, r.active === false);
                    setSuccess(r.active === false ? "Usuario activado." : "Usuario desactivado.");
                  } catch (err: unknown) {
                    setError(err instanceof Error ? err.message : "No se pudo actualizar el estado.");
                  }
                })}
              />
            )}
            <RowAction icon={Trash2} label="Quitar" tone="danger" onClick={() => setConfirmRemove(r)} />
          </div>
        ),
    });
  }

  function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError("");
    setSuccess("");
    startTransition(async () => {
      try {
        const outcome = await admin.inviteMember({
          email: String(fd.get("email") || ""),
          name: String(fd.get("name") || ""),
          role: String(fd.get("role") || "CONTRIBUTOR") as Role,
        });
        setInviting(false);
        /* Si la cuenta ya existía en Supabase no sale ningún correo de alta:
           decirlo evita que el admin espere un mensaje que nunca llega. */
        const emailSent = outcome == null || outcome.emailSent !== false;
        setSuccess(
          isDemoMode
            ? "Invitación simulada: la persona se añadió al listado (sin correo real)."
            : emailSent
              ? "Invitación enviada. La persona recibirá un correo para establecer su contraseña."
              : "Persona añadida. Ya tenía cuenta en NormaFlow, así que no se envía correo para establecer contraseña: entra con la suya y la avisamos desde la campana."
        );
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
        action={canEdit ? (atLimit ? "Límite alcanzado" : "Invitar persona") : undefined}
        onAction={canEdit && !atLimit ? () => { setInviting(true); setError(""); setSuccess(""); } : undefined}
      />

      {/* Plan / usage banner */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "12px 16px", marginBottom: 14,
        borderRadius: 10,
        background: atLimit ? "rgba(201, 60, 55, 0.06)" : nearLimit ? "rgba(214, 138, 26, 0.06)" : "var(--nf-app-surface-2)",
        border: `1px solid ${atLimit ? "rgba(201, 60, 55, 0.35)" : nearLimit ? "rgba(214, 138, 26, 0.35)" : "var(--nf-line)"}`,
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--nf-ink-3)", letterSpacing: "-0.01em", textTransform: "none" }}>
            Plan
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)" }}>
            {planInfo?.label ?? plan}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--nf-ink-3)" }}>
            <span>Usuarios</span>
            <span style={{ fontFamily: "ui-monospace, monospace", color: atLimit ? "var(--nf-danger-text)" : nearLimit ? "var(--nf-warning-text)" : "var(--nf-ink-2)", fontWeight: 700 }}>
              {usedUsers} / {maxUsers === null ? "∞" : maxUsers}
            </span>
          </div>
          {maxUsers !== null && (
            <div style={{ height: 4, background: "var(--nf-line)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.min(100, (usedUsers / maxUsers) * 100)}%`,
                background: atLimit ? "var(--nf-danger)" : nearLimit ? "var(--nf-warning)" : "var(--nf-accent)",
                transition: "width 0.2s",
              }} />
            </div>
          )}
        </div>
        {(atLimit || nearLimit) && (
          <div style={{ fontSize: 12, color: atLimit ? "var(--nf-danger-text)" : "var(--nf-warning-text)", fontWeight: 600 }}>
            {atLimit
              ? "Has alcanzado el límite del plan. "
              : `Te quedan ${maxUsers! - usedUsers} usuarios. `}
            <a href="/pricing" style={{ color: "inherit", textDecoration: "underline" }}>Actualizar plan →</a>
          </div>
        )}
      </div>

      <Card>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <input aria-label="Buscar por nombre, email o rol"
            type="search"
            placeholder="Buscar por nombre, email o rol…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="nf-app-input nf-app-input--toolbar" style={{ flex: 1, minWidth: 240 }}
          />
          <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{filtered.length} de {rows.length}</span>
        </div>
        {success && (
          <div className="nf-alert nf-alert--success" style={{ marginBottom: 12 }}>{success}</div>
        )}
        {error && (
          <div className="nf-alert nf-alert--error" style={{ marginBottom: 12 }}>{error}</div>
        )}
        <DataTable columns={columns} rows={filtered} emptyText="Sin miembros." />
      </Card>

      <Modal open={inviting} onClose={() => !isPending && setInviting(false)} title="Invitar persona" width={480}>
        <form onSubmit={handleInvite} className="nf-modal-form">
          <Field label="Nombre *">
            <input aria-label="María Torres" name="name" required className={NF_INPUT_CLASS} style={modalInputStyle} placeholder="María Torres" />
          </Field>
          <Field label="Email *">
            <input aria-label="maria@empresa.com" name="email" type="email" required className={NF_INPUT_CLASS} style={modalInputStyle} placeholder="maria@empresa.com" />
          </Field>
          <Field label="Rol">
            <Picker aria-label="Rol" name="role" defaultValue="CONTRIBUTOR" className={NF_INPUT_CLASS} style={modalInputStyle}>
              {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Picker>
          </Field>
          <p style={{ margin: 0, fontSize: 12, color: "var(--nf-ink-4)" }}>
            {isDemoMode
              ? "Modo demo: se añade al listado sin enviar correo real."
              : `Se enviará un correo de un correo para establecer contraseña y acceder a ${orgName}.`}
          </p>
          <div className="nf-modal-actions">
            <button type="button" onClick={() => setInviting(false)} disabled={isPending} className="nf-app-btn-ghost">Cancelar</button>
            <button type="submit" disabled={isPending} className="nf-app-btn-primary">{isPending ? "Invitando…" : "Invitar"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={confirmRemove != null} onClose={() => !isPending && setConfirmRemove(null)} title="Quitar miembro" width={420}>
        <p style={{ margin: "0 0 14px", color: "var(--nf-ink)" }}>
          ¿Quitar a <strong>{confirmRemove?.name}</strong> de la organización? Perderá el acceso pero la cuenta se mantiene.
        </p>
        <div className="nf-modal-actions">
          <button type="button" onClick={() => setConfirmRemove(null)} disabled={isPending} className="nf-app-btn-ghost">Cancelar</button>
          <button
            type="button"
            disabled={isPending}
            className="nf-app-btn-danger"
            onClick={() => startTransition(async () => {
              if (!confirmRemove) return;
              try {
                await admin.removeMember(confirmRemove.membershipId);
                setConfirmRemove(null);
              } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Error.");
              }
            })}
          >
            {isPending ? "…" : "Quitar"}
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
