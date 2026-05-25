"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { planMaxUsers } from "@/lib/constants";
import { isSupabaseInviteConfigured, sendSupabaseMemberInvite } from "@/lib/auth/invite-member";
import { sendWelcomeEmail } from "@/lib/resend";

// ─── Organization settings ──────────────────────────────────────────

export async function updateOrganizationSettings(input: {
  name?: string;
  industry?: string;
  country?: string;
  logoUrl?: string;
}) {
  const ctx = await requirePermission("org:*");
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("El nombre de la organización es obligatorio.");
    patch.name = name;
  }
  if (input.industry !== undefined) patch.industry = input.industry.trim() || null;
  if (input.country !== undefined) patch.country = input.country.trim() || "ES";
  if (input.logoUrl !== undefined) patch.logoUrl = input.logoUrl.trim() || null;

  const before = { name: ctx.organization.name, industry: ctx.organization.industry, country: ctx.organization.country };
  await prisma.organization.update({ where: { id: ctx.organization.id }, data: patch });
  await logAuditEvent({ ctx, action: "update", module: "org", recordId: ctx.organization.id, before, after: patch });
  revalidatePath("/app/settings/organization");
}

// ─── Members (users in the org) ─────────────────────────────────────

const ROLES_VALUES: Role[] = ["SUPER_ADMIN", "ORG_ADMIN", "COMPLIANCE_MANAGER", "AUDITOR", "CONTRIBUTOR", "VIEWER"];

export async function inviteMember(input: { email: string; name: string; role: Role }) {
  const ctx = await requirePermission("members:*");
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email) throw new Error("El email es obligatorio.");
  if (!name) throw new Error("El nombre es obligatorio.");
  if (!ROLES_VALUES.includes(input.role)) throw new Error("Rol no válido.");

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
    update: { name },
    create: { email, name },
  });

  const existingMembership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: ctx.organization.id } },
  });
  if (existingMembership) {
    throw new Error("Esta persona ya pertenece a la organización.");
  }

  const membership = await prisma.membership.create({
    data: { userId: user.id, organizationId: ctx.organization.id, role: input.role },
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

  await logAuditEvent({
    ctx,
    action: "invite",
    module: "member",
    recordId: user.id,
    after: {
      email,
      name,
      role: input.role,
      inviteMethod: inviteResult.method,
    },
  });

  void sendWelcomeEmail(email, name, ctx.organization.name).catch(() => {});

  revalidatePath("/app/settings/users");
}

export async function updateMemberRole(membershipId: string, role: Role) {
  const ctx = await requirePermission("members:*");
  const existing = await prisma.membership.findUnique({ where: { id: membershipId } });
  if (!existing || existing.organizationId !== ctx.organization.id) throw new Error("Miembro no encontrado.");
  if (!ROLES_VALUES.includes(role)) throw new Error("Rol no válido.");

  // Prevent demoting the last ORG_ADMIN — otherwise the org becomes orphan.
  if (existing.role === "ORG_ADMIN" && role !== "ORG_ADMIN") {
    const remainingAdmins = await prisma.membership.count({
      where: { organizationId: ctx.organization.id, role: "ORG_ADMIN", id: { not: membershipId } },
    });
    if (remainingAdmins === 0) throw new Error("No puedes dejar la organización sin Admin.");
  }

  await prisma.membership.update({ where: { id: membershipId }, data: { role } });
  await logAuditEvent({
    ctx,
    action: "update",
    module: "member",
    recordId: existing.userId,
    before: { role: existing.role },
    after: { role },
  });
  revalidatePath("/app/settings/users");
}

export async function removeMember(membershipId: string) {
  const ctx = await requirePermission("members:*");
  const existing = await prisma.membership.findUnique({ where: { id: membershipId } });
  if (!existing || existing.organizationId !== ctx.organization.id) throw new Error("Miembro no encontrado.");
  if (existing.userId === ctx.user.id) throw new Error("No puedes eliminarte a ti mismo.");
  if (existing.role === "ORG_ADMIN") {
    const remainingAdmins = await prisma.membership.count({
      where: { organizationId: ctx.organization.id, role: "ORG_ADMIN", id: { not: membershipId } },
    });
    if (remainingAdmins === 0) throw new Error("No puedes eliminar al último Admin.");
  }
  await prisma.membership.delete({ where: { id: membershipId } });
  await logAuditEvent({ ctx, action: "delete", module: "member", recordId: existing.userId, before: { role: existing.role } });
  revalidatePath("/app/settings/users");
}

// ─── Groups + permissions ───────────────────────────────────────────

export async function createGroup(input: { name: string; description?: string }) {
  const ctx = await requirePermission("groups:*");
  const name = input.name.trim();
  if (!name) throw new Error("El nombre del grupo es obligatorio.");
  const created = await prisma.group.create({
    data: { organizationId: ctx.organization.id, name, description: input.description?.trim() || null },
  });
  await logAuditEvent({ ctx, action: "create", module: "group", recordId: created.id, after: { name } });
  revalidatePath("/app/settings/groups");
}

export async function updateGroup(id: string, input: { name?: string; description?: string }) {
  const ctx = await requirePermission("groups:*");
  const existing = await prisma.group.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== ctx.organization.id) throw new Error("Grupo no encontrado.");
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description.trim() || null;
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
  const existing = await prisma.group.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== ctx.organization.id) throw new Error("Grupo no encontrado.");
  await prisma.group.delete({ where: { id } });
  await logAuditEvent({ ctx, action: "delete", module: "group", recordId: id, before: { name: existing.name } });
  revalidatePath("/app/settings/groups");
}

export async function setGroupPermissions(groupId: string, permissions: string[]) {
  const ctx = await requirePermission("groups:*");
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.organizationId !== ctx.organization.id) throw new Error("Grupo no encontrado.");

  const before = await prisma.groupPermission.findMany({ where: { groupId } });
  const beforeSet = new Set(before.map((p) => p.permission));
  const afterSet = new Set(permissions);

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
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.organizationId !== ctx.organization.id) throw new Error("Grupo no encontrado.");

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
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.organizationId !== ctx.organization.id) throw new Error("Grupo no encontrado.");
  await prisma.groupMembership.deleteMany({ where: { groupId, userId } });
  await logAuditEvent({ ctx, action: "remove_member", module: "group", recordId: groupId, before: { userId } });
  revalidatePath("/app/settings/groups");
}
