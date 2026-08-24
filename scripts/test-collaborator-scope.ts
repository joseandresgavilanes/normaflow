/**
 * Prueba del alcance del colaborador: un proceso asignado por grupo tiene que
 * entrar en el alcance igual que uno del que la persona es dueña.
 *
 *   DATABASE_URL=<local> DIRECT_URL=<local> tsx scripts/test-collaborator-scope.ts
 *
 * Escribe y borra sus propios datos, así que NO apuntar a producción: aborta si
 * la conexión no es local.
 */
import Module from "node:module";
import { PrismaClient } from "@prisma/client";

// `server-only` lo resuelve Next en tiempo de build; fuera de Next no existe.
// Mismo apaño que scripts/test-sig.ts: se sustituye por un módulo inocuo para
// poder importar el código de servidor sin relajar la protección real.
type Loader = (request: string, ...args: unknown[]) => unknown;
const moduleInternals = Module as unknown as { _load: Loader };
const originalLoad = moduleInternals._load;
moduleInternals._load = function (this: unknown, request: string, ...args: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
} as Loader;

const url = process.env.DATABASE_URL ?? "";
if (/supabase|pooler|amazonaws/i.test(url) || !/localhost|127\.0\.0\.1/.test(url)) {
  console.error("\n❌ Esta prueba crea y borra datos: apunta DATABASE_URL a una base local.\n");
  process.exit(1);
}

// `require` y no `import`: tiene que resolverse después del stub de arriba,
// y un import estático se hoistea por delante de él.
const { getCollaboratorScope } = require("../src/lib/permissions/scope") as typeof import("../src/lib/permissions/scope");
type LiveAppContext = import("../src/lib/app-context").LiveAppContext;

const prisma = new PrismaClient();

const SUFFIX = process.env.TEST_SUFFIX ?? "scope-test";
let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

/** Deja la base como estaba antes de la prueba (y limpia restos de una corrida
 *  interrumpida, para que el script se pueda relanzar sin tocar nada a mano). */
async function limpiar() {
  await prisma.organization.deleteMany({ where: { slug: `scope-${SUFFIX}` } });
  await prisma.user.deleteMany({ where: { email: `colab-${SUFFIX}@example.com` } });
}

async function main() {
  await limpiar();
  const org = await prisma.organization.create({
    data: { name: `Scope ${SUFFIX}`, slug: `scope-${SUFFIX}`, plan: "STARTER" },
  });
  const user = await prisma.user.create({ data: { email: `colab-${SUFFIX}@example.com`, name: "Colaborador" } });
  const membership = await prisma.membership.create({ data: { organizationId: org.id, userId: user.id, role: "CONTRIBUTOR", scoped: true } });

  // Dos procesos: uno asignado por grupo, otro de nadie (el control negativo).
  const viaGroup = await prisma.process.create({ data: { organizationId: org.id, name: "Producción", code: "P-01" } });
  const ajeno = await prisma.process.create({ data: { organizationId: org.id, name: "Compras", code: "P-02" } });

  const group = await prisma.group.create({ data: { organizationId: org.id, name: `Operaciones ${SUFFIX}` } });
  await prisma.groupMembership.create({ data: { groupId: group.id, userId: user.id } });
  await prisma.groupProcess.create({ data: { groupId: group.id, processId: viaGroup.id } });

  // Un riesgo en cada proceso, para comprobar que el alcance arrastra lo de dentro.
  const riesgoDentro = await prisma.risk.create({ data: { organizationId: org.id, processId: viaGroup.id, title: "Parada de línea", category: "OPERATIONAL", probability: 3, impact: 4, score: 12 } });
  const riesgoFuera = await prisma.risk.create({ data: { organizationId: org.id, processId: ajeno.id, title: "Proveedor único", category: "OPERATIONAL", probability: 2, impact: 5, score: 10 } });

  const contextoPara = (overrides: { role?: string; scoped?: boolean } = {}) => ({
    mode: "live",
    role: overrides.role ?? "CONTRIBUTOR",
    scoped: overrides.scoped ?? true,
    organization: { id: org.id },
    user: { id: user.id, email: user.email },
  }) as unknown as LiveAppContext;
  const ctx = contextoPara();

  const scope = await getCollaboratorScope(ctx);

  check("el proceso asignado por grupo entra en el alcance", scope.processIds.includes(viaGroup.id), `processIds=${scope.processIds.length}`);
  check("el proceso ajeno sigue fuera", !scope.processIds.includes(ajeno.id));
  check("el riesgo del proceso asignado entra", scope.riskIds.includes(riesgoDentro.id));
  check("el riesgo del proceso ajeno sigue fuera", !scope.riskIds.includes(riesgoFuera.id));
  check("el colaborador sigue acotado", scope.isScoped);

  // Sin el grupo, el mismo usuario no debe ver nada: así se distingue el arreglo
  // de un alcance que estuviera abriéndose por otra vía.
  // El alcance es propiedad de la membresía, no del nombre del rol: un gestor
  // acotado ve lo suyo, y un contribuidor sin acotar lo ve todo.
  const gestorAcotado = await getCollaboratorScope(contextoPara({ role: "MANAGER", scoped: true }));
  check("un MANAGER acotado también queda dentro del alcance", gestorAcotado.isScoped && gestorAcotado.processIds.includes(viaGroup.id), `processIds=${gestorAcotado.processIds.length}`);

  const contribuidorSinAcotar = await getCollaboratorScope(contextoPara({ role: "CONTRIBUTOR", scoped: false }));
  check("un CONTRIBUTOR sin acotar deja de estarlo", !contribuidorSinAcotar.isScoped);

  await prisma.membership.update({ where: { id: membership.id }, data: { scoped: false } });
  check("la propiedad vive en la membresía", (await prisma.membership.findUniqueOrThrow({ where: { id: membership.id } })).scoped === false);
  await prisma.membership.update({ where: { id: membership.id }, data: { scoped: true } });

  await prisma.groupMembership.deleteMany({ where: { groupId: group.id, userId: user.id } });
  const sinGrupo = await getCollaboratorScope(ctx);
  check("al salir del grupo pierde el proceso", !sinGrupo.processIds.includes(viaGroup.id), `processIds=${sinGrupo.processIds.length}`);

  await limpiar();

  console.log(failures === 0 ? "\nTODO CORRECTO\n" : `\n${failures} comprobación(es) fallidas\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
