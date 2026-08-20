"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireLiveContext } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { deleteAvatarFile, uploadAvatarFile } from "@/lib/storage";

export async function updateCurrentProfile(input: { name: string }): Promise<{ name: string }> {
  const ctx = await requireLiveContext();
  const name = input.name.trim();
  if (name.length < 2) throw new Error("El nombre debe tener al menos 2 caracteres.");
  if (name.length > 120) throw new Error("El nombre no puede superar 120 caracteres.");

  const updated = await prisma.user.update({
    where: { id: ctx.user.id },
    data: { name },
    select: { name: true },
  });
  await logAuditEvent({
    ctx,
    action: "update",
    module: "account",
    recordId: ctx.user.id,
    before: { name: ctx.user.name },
    after: { name: updated.name },
  });
  revalidatePath("/app/settings");
  revalidatePath("/app", "layout");
  return updated;
}


/**
 * Foto de perfil.
 *
 * El fichero llega como `FormData` porque una server action no acepta un
 * `File` suelto en un objeto plano. Se valida en `storage.ts` —tipo y tamaño—
 * antes de que ningún byte llegue al bucket.
 */
export async function updateProfilePhoto(formData: FormData): Promise<{ avatarUrl: string }> {
  const ctx = await requireLiveContext();
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) throw new Error("Elige una imagen.");

  const previous = ctx.user.avatarUrl;
  const { path } = await uploadAvatarFile({
    organizationId: ctx.organization.id,
    userId: ctx.user.id,
    file,
  });

  await prisma.user.update({ where: { id: ctx.user.id }, data: { avatarUrl: path } });
  /* La anterior se borra DESPUÉS de guardar la nueva referencia: al revés, un
     fallo al escribir dejaría al usuario sin foto y sin fichero. Con distinta
     extensión el `upsert` no la sustituye, así que hay que retirarla. */
  if (previous && previous !== path) {
    await deleteAvatarFile(previous, ctx.organization.id);
  }

  await logAuditEvent({
    ctx, action: "update", module: "account", recordId: ctx.user.id,
    before: { avatarUrl: previous }, after: { avatarUrl: path },
  });
  revalidatePath("/app/settings");
  revalidatePath("/app", "layout");
  return { avatarUrl: path };
}

/** Vuelve a las iniciales. */
export async function removeProfilePhoto(): Promise<void> {
  const ctx = await requireLiveContext();
  const previous = ctx.user.avatarUrl;
  if (!previous) return;
  await prisma.user.update({ where: { id: ctx.user.id }, data: { avatarUrl: null } });
  await deleteAvatarFile(previous, ctx.organization.id);
  await logAuditEvent({
    ctx, action: "update", module: "account", recordId: ctx.user.id,
    before: { avatarUrl: previous }, after: { avatarUrl: null },
  });
  revalidatePath("/app/settings");
  revalidatePath("/app", "layout");
}
