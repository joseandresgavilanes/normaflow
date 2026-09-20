/**
 * Da de alta en Personal a los miembros que entraron antes de que la
 * invitación creara su ficha.
 *
 * Solo añade. No modifica ni desactiva ninguna ficha existente, y empareja por
 * correo sin distinguir mayúsculas, así que se puede repetir sin duplicar.
 *
 *   npx tsx scripts/backfill-personnel-from-members.ts            # simulación
 *   npx tsx scripts/backfill-personnel-from-members.ts --apply    # escribe
 *   npx tsx scripts/backfill-personnel-from-members.ts --apply --org <id>
 */

import { PrismaClient } from "@prisma/client";
import { splitFullName } from "../src/lib/personnel-name";

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  const orgFlag = process.argv.indexOf("--org");
  const onlyOrg = orgFlag >= 0 ? process.argv[orgFlag + 1] : null;

  const memberships = await prisma.membership.findMany({
    where: { active: true, ...(onlyOrg ? { organizationId: onlyOrg } : {}) },
    include: {
      user: { select: { email: true, name: true } },
      organization: { select: { id: true, name: true } },
    },
    orderBy: [{ organizationId: "asc" }, { createdAt: "asc" }],
  });

  let created = 0;
  let skipped = 0;

  for (const membership of memberships) {
    const email = membership.user.email.trim().toLowerCase();
    const organizationId = membership.organization.id;
    const existing = await prisma.personnel.findFirst({
      where: { organizationId, email: { equals: email, mode: "insensitive" } },
      select: { id: true, active: true },
    });
    if (existing) {
      skipped += 1;
      // Una ficha dada de baja sigue sin salir en los selectores: se avisa para
      // que alguien decida, pero no se reactiva por la espalda.
      if (!existing.active) console.log(`  ~ ${email} — ya tiene ficha, pero está inactiva (${membership.organization.name})`);
      continue;
    }
    const { firstName, lastName } = splitFullName(membership.user.name);
    console.log(`  ${apply ? "+" : "·"} ${firstName} ${lastName} <${email}> → ${membership.organization.name}`);
    if (apply) {
      await prisma.personnel.create({ data: { organizationId, firstName, lastName, email } });
    }
    created += 1;
  }

  console.log(`\n${apply ? "Creadas" : "Se crearían"} ${created} fichas; ${skipped} miembros ya tenían.`);
  if (!apply && created > 0) console.log("Vuelve a ejecutarlo con --apply para escribirlas.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
