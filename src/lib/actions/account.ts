"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireLiveContext } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";

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
