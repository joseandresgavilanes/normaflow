import { prisma } from "@/lib/prisma";

export async function syncAuthUser(authUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const email = authUser.email;
  if (!email) return;
  /* El nombre es del perfil, no de Supabase. Antes se reescribía en cada
     login con `full_name` o con el trozo anterior a la arroba, así que quien
     se renombraba en Ajustes —o a quien un admin invitó con nombre y apellido—
     volvía a "jperez" al siguiente acceso. Solo se rellena al crear. */
  const name =
    (typeof authUser.user_metadata?.full_name === "string" && authUser.user_metadata.full_name.trim()) ||
    email.split("@")[0];
  await prisma.user.upsert({
    where: { email },
    create: { email, name, authUserId: authUser.id },
    update: { authUserId: authUser.id },
  });
}
