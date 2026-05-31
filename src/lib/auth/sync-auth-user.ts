import { prisma } from "@/lib/prisma";

export async function syncAuthUser(authUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const email = authUser.email;
  if (!email) return;
  const name =
    (typeof authUser.user_metadata?.full_name === "string" && authUser.user_metadata.full_name) ||
    email.split("@")[0];
  await prisma.user.upsert({
    where: { email },
    create: { email, name, authUserId: authUser.id },
    update: { authUserId: authUser.id, name },
  });
}
