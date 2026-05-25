import { getAppContext } from "@/lib/app-context";
import { roleCan } from "@/lib/permissions/matrix";
import { isSupabaseConfigured } from "@/lib/env";
import { getDocumentsPayload } from "@/lib/server-queries";
import DocumentsModule from "@/components/modules/DocumentsModule";
import DocumentsLiveClient from "@/components/documents/DocumentsLiveClient";

export const metadata = { title: "Control de Documentos" };
export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const ctx = await getAppContext();

  // Cuando hay una organización real conectada y Supabase está configurado,
  // se usa el cliente "live" con persistencia Prisma + Supabase Storage.
  if (ctx?.mode === "live" && isSupabaseConfigured()) {
    try {
      const payload = await getDocumentsPayload(ctx.organization.id);
      return (
        <DocumentsLiveClient
          initial={payload}
          canCreate={roleCan(ctx.role, "documents:create")}
          canApprove={roleCan(ctx.role, "documents:*")}
          currentUserId={ctx.user.id}
        />
      );
    } catch (err) {
      // Si Prisma falla (DB no migrada, env mal configurada, etc.) caemos al módulo demo.
      console.warn("[documents] live payload failed, falling back to mock:", err);
    }
  }

  // Modo demo / sin Supabase: módulo existente con WorkspaceStore en memoria.
  return <DocumentsModule />;
}
