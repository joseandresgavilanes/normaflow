import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import ACPMClient from "@/components/admin/ACPMClient";
import { getAppContext } from "@/lib/app-context";
import { getCAPAPayload } from "@/lib/server-queries";
import { ACPMLiveClient } from "@/components/acpm/ACPMLiveClient";

export const metadata = { title: "ACPM — Plan de Acción" };

// El cliente lee `?detail=` con useSearchParams para que el detalle de una
// CAPA sea enlazable. En render estático eso exige una frontera de Suspense;
// la página ya es dinámica porque resuelve la organización desde la cookie,
// pero se declara para no depender de un efecto secundario.
export const dynamic = "force-dynamic";

export default async function ActionsPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    const payload = await getCAPAPayload();
    return <ServerPermissionGate permission="actions:read"><ACPMLiveClient initial={payload} /></ServerPermissionGate>;
  }
  return <ServerPermissionGate permission="actions:read"><ACPMClient /></ServerPermissionGate>;
}
