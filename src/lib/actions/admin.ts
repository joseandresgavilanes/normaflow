"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuthorization, requirePermission } from "@/lib/permissions/server";
import { GROUP_PERMISSION_ALLOWLIST } from "@/lib/permissions/matrix";
import { logAuditEvent } from "@/lib/audit-log";
import { notifyUser } from "@/lib/notify";
import { planMaxUsers } from "@/lib/constants";
import { isSupabaseInviteConfigured, sendSupabaseMemberInvite } from "@/lib/auth/invite-member";
import { adoptStandardForOrganization, ensureStandardCatalog } from "@/lib/standards-adoption";
import { defaultScopedFor } from "@/lib/permissions/scope";
import { getStandardSpec } from "@/lib/standards-catalog";
import {
  groupAssociationSchema,
  groupSchema,
  inviteMemberSchema,
  memberRoleSchema,
  organizationSettingsSchema,
  parseActionInput,
  standardCodeSchema,
} from "@/lib/validation/admin";
import { parseId } from "@/lib/validation/common";

// ─── Organization settings ──────────────────────────────────────────

export async function updateOrganizationSettings(input: {
  name?: string;
  industry?: string;
  country?: string;
  logoUrl?: string;
  size?: string;
  contactName?: string;
  contactEmail?: string | null;
  contactPhone?: string;
  website?: string | null;
  address?: string;
  standards?: ("ISO_9001" | "ISO_27001")[];
}) {
  const ctx = await requirePermission("org:*");
  const parsed = parseActionInput(organizationSettingsSchema, input);
  const patch: Record<string, unknown> = {};
  if (parsed.name !== undefined) patch.name = parsed.name;
  if (parsed.industry !== undefined) patch.industry = parsed.industry || null;
  if (parsed.country !== undefined) patch.country = parsed.country.toUpperCase();
  if (parsed.logoUrl !== undefined) patch.logoUrl = parsed.logoUrl || null;
  if (parsed.size !== undefined) patch.size = parsed.size || null;
  if (parsed.contactName !== undefined) patch.contactName = parsed.contactName || null;
  if (parsed.contactEmail !== undefined) patch.contactEmail = parsed.contactEmail || null;
  if (parsed.contactPhone !== undefined) patch.contactPhone = parsed.contactPhone || null;
  if (parsed.website !== undefined) patch.website = parsed.website || null;
  if (parsed.address !== undefined) patch.address = parsed.address || null;

  const before = {
    name: ctx.organization.name,
    industry: ctx.organization.industry,
    country: ctx.organization.country,
    size: ctx.organization.size,
    contactName: ctx.organization.contactName,
    contactEmail: ctx.organization.contactEmail,
    contactPhone: ctx.organization.contactPhone,
    website: ctx.organization.website,
    address: ctx.organization.address,
  };
  await prisma.organization.update({ where: { id: ctx.organization.id }, data: patch });
  await logAuditEvent({ ctx, action: "update", module: "org", recordId: ctx.organization.id, before, after: patch });

  if (parsed.standards) {
    const wanted = new Set(parsed.standards);
    const current = await prisma.organizationStandard.findMany({
      where: { organizationId: ctx.organization.id },
      include: { standard: { select: { id: true, code: true } } },
    });
    const currentCodes = new Set(current.map((item) => item.standard.code));
    for (const rawCode of wanted) {
      const code = standardCodeSchema.parse(rawCode);
      if (currentCodes.has(code)) continue;
      const spec = getStandardSpec(code);
      if (!spec) throw new Error("Norma no soportada.");
      const standard = await ensureStandardCatalog(spec);
      const adoption = await adoptStandardForOrganization({
        organizationId: ctx.organization.id,
        standardCode: code,
        standardId: standard.id,
        assessorId: ctx.user.id,
      });
      await logAuditEvent({
        ctx,
        action: "enable",
        module: "standard",
        recordId: adoption.adoptionId,
        after: { standard: code },
      });
    }
    for (const item of current) {
      const itemCode = standardCodeSchema.safeParse(item.standard.code);
      if (itemCode.success && wanted.has(itemCode.data)) continue;
      await prisma.organizationStandard.delete({ where: { id: item.id } });
      await logAuditEvent({
        ctx,
        action: "disable",
        module: "standard",
        recordId: item.id,
        before: { standard: item.standard.code },
      });
    }
  }
  revalidatePath("/app/settings/organization");
}

// ─── Members (users in the org) ─────────────────────────────────────

const ROLES_VALUES: Role[] = ["OWNER", "ADMIN", "MANAGER", "AUDITOR", "VIEWER", "SUPER_ADMIN", "ORG_ADMIN", "COMPLIANCE_MANAGER", "CONTRIBUTOR"];

export type InviteMemberOutcome = {
  /** `false` cuando Supabase no manda correo porque el email ya estaba registrado. */
  emailSent: boolean;
};

export async function inviteMember(input: { email: string; name: string; role: Role }): Promise<InviteMemberOutcome> {
  const ctx = await requirePermission("members:*");
  const parsed = parseActionInput(inviteMemberSchema, input);
  const email = parsed.email.toLowerCase();
  const name = parsed.name;
  const role = parsed.role as Role;
  if ((role === "SUPER_ADMIN" || role === "OWNER") && !["SUPER_ADMIN", "OWNER"].includes(ctx.role)) {
    throw new Error("Solo un Owner puede asignar ese rol.");
  }

  if (!isSupabaseInviteConfigured()) {
    throw new Error(
      "Configura SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_APP_URL para enviar invitaciones por correo."
    );
  }

  const maxUsers = planMaxUsers(ctx.organization.plan);
  if (maxUsers !== null) {
    const memberCount = await prisma.membership.count({
      where: { organizationId: ctx.organization.id },
    });
    if (memberCount >= maxUsers) {
      throw new Error(
        `Has alcanzado el límite de ${maxUsers} usuarios del plan ${ctx.organization.plan}. Actualiza tu plan para añadir más personas.`
      );
    }
  }

  // Find-or-create the user, then attach a membership for this org.
  const user = await prisma.user.upsert({
    where: { email },
    // Never let an administrator from one tenant overwrite the global profile
    // of an account that may already belong to another tenant.
    update: {},
    create: { email, name },
  });

  const existingMembership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: ctx.organization.id } },
  });
  if (existingMembership) {
    throw new Error("Esta persona ya pertenece a la organización.");
  }

  const membership = await prisma.membership.create({
    data: { userId: user.id, organizationId: ctx.organization.id, role, scoped: defaultScopedFor(role) },
  });

  const inviteResult = await sendSupabaseMemberInvite({
    email,
    name,
    organizationName: ctx.organization.name,
  });

  if (!inviteResult.ok) {
    await prisma.membership.delete({ where: { id: membership.id } });
    throw new Error(`No se pudo enviar la invitación por correo: ${inviteResult.error}`);
  }

  const now = new Date();
  await prisma.memberInvite.create({
    data: {
      organizationId: ctx.organization.id,
      email,
      role,
      token: randomUUID(),
      invitedById: ctx.user.id,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      lastSentAt: now,
    },
  });

  /* Supabase no reenvía el correo de invitación a una cuenta que ya existe:
     devuelve "already registered" y `sendSupabaseMemberInvite` lo da por bueno.
     Sin esto, quien ya se había registrado alguna vez —o a quien quitaste y
     vuelves a añadir— entraba en la organización sin enterarse. */
  if (inviteResult.method === "existing_auth_user") {
    await notifyUser({
      organizationId: ctx.organization.id,
      userId: user.id,
      title: `Te han añadido a ${ctx.organization.name}`,
      body: `Ya puedes entrar en ${ctx.organization.name} en NormaFlow con tu cuenta de siempre (${email}). Tu rol es ${role.replaceAll("_", " ")}.`,
      type: "INFO",
      link: "/app/dashboard",
      idempotencyKey: `member-added:${membership.id}`,
    }).catch((e) => console.error("[invite] notifyUser", e));
  }

  await logAuditEvent({
    ctx,
    action: "invite",
    module: "member",
    recordId: user.id,
    after: {
      email,
      name,
      role,
      inviteMethod: inviteResult.method,
    },
  });

  revalidatePath("/app/settings/users");
  return { emailSent: inviteResult.method === "invite" };
}

export async function resendMemberInvite(membershipId: string): Promise<InviteMemberOutcome> {
  membershipId = parseId(membershipId);
  const ctx = await requirePermission("members:*");
  if (!isSupabaseInviteConfigured()) {
    throw new Error("Configura Supabase y NEXT_PUBLIC_APP_URL para reenviar invitaciones.");
  }
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId: ctx.organization.id },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!membership) throw new Error("Miembro no encontrado.");
  const result = await sendSupabaseMemberInvite({
    email: membership.user.email,
    name: membership.user.name,
    organizationName: ctx.organization.name,
  });
  if (!result.ok) throw new Error(`No se pudo reenviar la invitación: ${result.error}`);
  const now = new Date();
  const latest = await prisma.memberInvite.findFirst({
    where: { organizationId: ctx.organization.id, email: membership.user.email, acceptedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (latest) {
    await prisma.memberInvite.update({
      where: { id: latest.id },
      data: { lastSentAt: now, expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
    });
  } else {
    await prisma.memberInvite.create({
      data: {
        organizationId: ctx.organization.id,
        email: membership.user.email,
        role: membership.role,
        token: randomUUID(),
        invitedById: ctx.user.id,
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        lastSentAt: now,
      },
    });
  }
  /* Igual que en el alta: si la cuenta ya existe en Supabase, "reenviar" no
     manda ningún correo. Se avisa por la campana, que sí llega. */
  if (result.method === "existing_auth_user") {
    await notifyUser({
      organizationId: ctx.organization.id,
      userId: membership.user.id,
      title: `Te esperan en ${ctx.organization.name}`,
      body: `Tienes acceso a ${ctx.organization.name} en NormaFlow con tu cuenta de siempre (${membership.user.email}). Tu rol es ${membership.role.replaceAll("_", " ")}.`,
      type: "INFO",
      link: "/app/dashboard",
    }).catch((e) => console.error("[resend-invite] notifyUser", e));
  }

  await logAuditEvent({ ctx, action: "resend_invite", module: "member", recordId: membership.user.id, after: { email: membership.user.email, inviteMethod: result.method } });
  revalidatePath("/app/settings/users");
  return { emailSent: result.method === "invite" };
}

export async function setMemberActive(membershipId: string, active: boolean) {
  membershipId = parseId(membershipId);
  if (typeof active !== "boolean") throw new Error("El estado del miembro no es válido.");
  const ctx = await requirePermission("members:*");
  const membership = await prisma.membership.findFirst({ where: { id: membershipId, organizationId: ctx.organization.id } });
  if (!membership) throw new Error("Miembro no encontrado.");
  if (membership.userId === ctx.user.id && !active) throw new Error("No puedes desactivarte a ti mismo.");
  if (!active && ["ORG_ADMIN", "ADMIN", "OWNER"].includes(membership.role)) {
    const remainingAdmins = await prisma.membership.count({
      where: { organizationId: ctx.organization.id, active: true, role: { in: ["ORG_ADMIN", "ADMIN", "OWNER"] }, id: { not: membershipId } },
    });
    if (remainingAdmins === 0) throw new Error("No puedes dejar la organización sin un Admin activo.");
  }
  await prisma.membership.update({
    where: { id: membershipId },
    data: { active, deactivatedAt: active ? null : new Date() },
  });
  await logAuditEvent({ ctx, action: active ? "activate" : "deactivate", module: "member", recordId: membership.userId, before: { active: membership.active }, after: { active } });
  revalidatePath("/app/settings/users");
}

/**
 * Acota (o desacota) a una persona sin tocar su rol.
 *
 * Es lo que el modelo anterior no permitía decir: un gestor que solo opera sus
 * procesos, o un contribuidor de confianza con visión completa.
 */
export async function setMemberScope(membershipId: string, scoped: boolean) {
  membershipId = parseId(membershipId);
  const ctx = await requirePermission("members:*");
  const existing = await prisma.membership.findFirst({ where: { id: membershipId, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Miembro no encontrado.");

  await prisma.membership.update({ where: { id: membershipId }, data: { scoped } });
  await logAuditEvent({
    ctx,
    action: "update",
    module: "member",
    recordId: existing.userId,
    before: { scoped: existing.scoped },
    after: { scoped },
  });
  revalidatePath("/app/settings");
}

export async function updateMemberRole(membershipId: string, role: Role) {
  membershipId = parseId(membershipId);
  const ctx = await requirePermission("members:*");
  role = parseActionInput(memberRoleSchema, { role }).role as Role;
  const existing = await prisma.membership.findFirst({ where: { id: membershipId, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Miembro no encontrado.");
  if (!ROLES_VALUES.includes(role)) throw new Error("Rol no válido.");
  if ((existing.role === "SUPER_ADMIN" || existing.role === "OWNER" || role === "SUPER_ADMIN" || role === "OWNER") && !["SUPER_ADMIN", "OWNER"].includes(ctx.role)) {
    throw new Error("Solo un Owner puede modificar ese rol.");
  }

  // Prevent demoting the last ORG_ADMIN — otherwise the org becomes orphan.
  if (["ORG_ADMIN", "ADMIN", "OWNER"].includes(existing.role) && !["ORG_ADMIN", "ADMIN", "OWNER"].includes(role)) {
    const remainingAdmins = await prisma.membership.count({
      where: { organizationId: ctx.organization.id, role: { in: ["ORG_ADMIN", "ADMIN", "OWNER"] }, id: { not: membershipId } },
    });
    if (remainingAdmins === 0) throw new Error("No puedes dejar la organización sin Admin.");
  }

  await prisma.membership.update({ where: { id: membershipId }, data: { role, scoped: defaultScopedFor(role) } });
  await logAuditEvent({
    ctx,
    action: "update",
    module: "member",
    recordId: existing.userId,
    before: { role: existing.role },
    after: { role },
  });
  if (existing.userId !== ctx.user.id) {
    await notifyUser({
      organizationId: ctx.organization.id,
      userId: existing.userId,
      title: "Tu rol en la organización cambió",
      body: `Tu rol ahora es ${role.replaceAll("_", " ")}. Tus permisos de acceso se actualizaron en consecuencia.`,
      type: "INFO",
      link: "/app/dashboard",
    });
  }
  revalidatePath("/app/settings/users");
}

export async function removeMember(membershipId: string) {
  membershipId = parseId(membershipId);
  const ctx = await requirePermission("members:*");
  const existing = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId: ctx.organization.id },
    include: { user: { select: { email: true } } },
  });
  if (!existing) throw new Error("Miembro no encontrado.");
  if ((existing.role === "SUPER_ADMIN" || existing.role === "OWNER") && !["SUPER_ADMIN", "OWNER"].includes(ctx.role)) {
    throw new Error("Solo un Owner puede eliminar a otro Owner.");
  }
  if (existing.userId === ctx.user.id) throw new Error("No puedes eliminarte a ti mismo.");
  if (["ORG_ADMIN", "ADMIN", "OWNER"].includes(existing.role)) {
    const remainingAdmins = await prisma.membership.count({
      where: { organizationId: ctx.organization.id, role: { in: ["ORG_ADMIN", "ADMIN", "OWNER"] }, id: { not: membershipId } },
    });
    if (remainingAdmins === 0) throw new Error("No puedes eliminar al último Admin.");
  }
  /* Quitar a alguien es quitarle todo lo que le daba acceso, no solo la
     membresía. `GroupMembership` no cuelga de `User` ni tiene borrado en
     cascada, así que sus permisos de grupo sobrevivían a la baja y volvían
     enteros —sin que nadie los concediera— en cuanto se le reinvitaba. */
  await prisma.$transaction([
    prisma.membership.delete({ where: { id: membershipId } }),
    prisma.groupMembership.deleteMany({
      where: { userId: existing.userId, group: { organizationId: ctx.organization.id } },
    }),
    prisma.memberInvite.deleteMany({
      where: { organizationId: ctx.organization.id, email: existing.user.email, acceptedAt: null },
    }),
  ]);
  await logAuditEvent({ ctx, action: "delete", module: "member", recordId: existing.userId, before: { role: existing.role } });
  revalidatePath("/app/settings/users");
}

// ─── Groups + permissions ───────────────────────────────────────────

export async function createGroup(input: { name: string; description?: string }) {
  const ctx = await requirePermission("groups:*");
  const parsed = parseActionInput(groupSchema, input);
  const name = parsed.name;
  const created = await prisma.group.create({
    data: { organizationId: ctx.organization.id, name, description: parsed.description || null },
  });
  await logAuditEvent({ ctx, action: "create", module: "group", recordId: created.id, after: { name } });
  revalidatePath("/app/settings/groups");
}

export async function updateGroup(id: string, input: { name?: string; description?: string }) {
  const ctx = await requirePermission("groups:*");
  const existing = await prisma.group.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Grupo no encontrado.");
  const parsed = parseActionInput(groupSchema.partial(), input);
  const patch: Record<string, unknown> = {};
  if (parsed.name !== undefined) patch.name = parsed.name;
  if (parsed.description !== undefined) patch.description = parsed.description || null;
  await prisma.group.update({ where: { id }, data: patch });
  await logAuditEvent({
    ctx,
    action: "update",
    module: "group",
    recordId: id,
    before: { name: existing.name, description: existing.description },
    after: patch,
  });
  revalidatePath("/app/settings/groups");
}

export async function deleteGroup(id: string) {
  const ctx = await requirePermission("groups:*");
  const existing = await prisma.group.findFirst({ where: { id, organizationId: ctx.organization.id } });
  if (!existing) throw new Error("Grupo no encontrado.");
  await prisma.group.delete({ where: { id } });
  await logAuditEvent({ ctx, action: "delete", module: "group", recordId: id, before: { name: existing.name } });
  revalidatePath("/app/settings/groups");
}

export async function setGroupPermissions(groupId: string, permissions: string[]) {
  const authorization = await requireAuthorization("groups:*");
  const { ctx, can } = authorization;
  const normalizedPermissions = [...new Set(permissions)];
  if (normalizedPermissions.some((permission) => !GROUP_PERMISSION_ALLOWLIST.has(permission) || !can(permission))) {
    throw new Error("No puedes conceder uno o más de los permisos solicitados.");
  }
  const group = await prisma.group.findFirst({ where: { id: groupId, organizationId: ctx.organization.id } });
  if (!group) throw new Error("Grupo no encontrado.");

  const before = await prisma.groupPermission.findMany({ where: { groupId } });
  const beforeSet = new Set(before.map((p) => p.permission));
  const afterSet = new Set(normalizedPermissions);

  const toAdd = [...afterSet].filter((p) => !beforeSet.has(p));
  const toRemove = [...beforeSet].filter((p) => !afterSet.has(p));

  await prisma.$transaction([
    ...(toRemove.length
      ? [prisma.groupPermission.deleteMany({ where: { groupId, permission: { in: toRemove } } })]
      : []),
    ...(toAdd.length
      ? [prisma.groupPermission.createMany({ data: toAdd.map((permission) => ({ groupId, permission })) })]
      : []),
  ]);

  await logAuditEvent({
    ctx,
    action: "update",
    module: "group_permission",
    recordId: groupId,
    before: { permissions: [...beforeSet] },
    after: { permissions: [...afterSet] },
  });
  revalidatePath("/app/settings/groups");
}

export async function addGroupMember(groupId: string, userId: string) {
  const ctx = await requirePermission("groups:*");
  const group = await prisma.group.findFirst({ where: { id: groupId, organizationId: ctx.organization.id } });
  if (!group) throw new Error("Grupo no encontrado.");

  // user must be a member of the org first
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId: ctx.organization.id } },
  });
  if (!membership) throw new Error("El usuario no pertenece a la organización.");

  await prisma.groupMembership.upsert({
    where: { groupId_userId: { groupId, userId } },
    update: {},
    create: { groupId, userId },
  });

  await logAuditEvent({ ctx, action: "add_member", module: "group", recordId: groupId, after: { userId } });
  revalidatePath("/app/settings/groups");
}

export async function removeGroupMember(groupId: string, userId: string) {
  const ctx = await requirePermission("groups:*");
  const group = await prisma.group.findFirst({ where: { id: groupId, organizationId: ctx.organization.id } });
  if (!group) throw new Error("Grupo no encontrado.");
  await prisma.groupMembership.deleteMany({ where: { groupId, userId } });
  await logAuditEvent({ ctx, action: "remove_member", module: "group", recordId: groupId, before: { userId } });
  revalidatePath("/app/settings/groups");
}

const GROUP_MODULES = [
  "dashboard",
  "documents",
  "processes",
  "risks",
  "audits",
  "nonconformities",
  "actions",
  "indicators",
  "evidence",
  "training",
  "reporting",
] as const;

export async function setGroupAssociations(input: {
  groupId: string;
  processIds: string[];
  modules: string[];
}) {
  const ctx = await requirePermission("groups:*");
  const parsed = parseActionInput(groupAssociationSchema, input);
  const modules = [...new Set(parsed.modules)].filter((module): module is (typeof GROUP_MODULES)[number] =>
    (GROUP_MODULES as readonly string[]).includes(module),
  );
  const group = await prisma.group.findFirst({ where: { id: parsed.groupId, organizationId: ctx.organization.id } });
  if (!group) throw new Error("Grupo no encontrado.");
  const processes = await prisma.process.findMany({
    where: { id: { in: [...new Set(parsed.processIds)] }, organizationId: ctx.organization.id },
    select: { id: true },
  });
  if (processes.length !== new Set(parsed.processIds).size) throw new Error("Uno o más procesos no pertenecen a la organización.");

  const before = await prisma.$transaction([
    prisma.groupProcess.findMany({ where: { groupId: group.id }, select: { processId: true } }),
    prisma.groupModule.findMany({ where: { groupId: group.id }, select: { module: true } }),
  ]);
  await prisma.$transaction([
    prisma.groupProcess.deleteMany({ where: { groupId: group.id } }),
    prisma.groupModule.deleteMany({ where: { groupId: group.id } }),
    ...(processes.length ? [prisma.groupProcess.createMany({ data: processes.map((process) => ({ groupId: group.id, processId: process.id })) })] : []),
    ...(modules.length ? [prisma.groupModule.createMany({ data: modules.map((module) => ({ groupId: group.id, module })) })] : []),
  ]);
  await logAuditEvent({
    ctx,
    action: "update",
    module: "group_association",
    recordId: group.id,
    before: { processIds: before[0].map((item) => item.processId), modules: before[1].map((item) => item.module) },
    after: { processIds: processes.map((process) => process.id), modules },
  });
  revalidatePath("/app/settings/groups");
}
