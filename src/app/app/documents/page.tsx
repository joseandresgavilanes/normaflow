import { getAppContext } from "@/lib/app-context";
import { getDocumentsPayload } from "@/lib/server-queries";
import DocumentsModule from "@/components/modules/DocumentsModule";
import DocumentsLiveClient from "@/components/documents/DocumentsLiveClient";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import AccessDenied from "@/components/app/AccessDenied";
import { isAuthorizationError } from "@/lib/permissions/server";

export const metadata = { title: "Control de Documentos" };
export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const ctx = await getAppContext();

  if (ctx?.mode === "live") {
    try {
      const payload = await getDocumentsPayload();
      return (
        <DocumentsLiveClient
          initial={payload}
          canCreate={payload.access.canCreate}
          canApprove={payload.access.canApprove}
          currentUserId={ctx.user.id}
        />
      );
    } catch (err) {
      if (isAuthorizationError(err)) return <AccessDenied />;
      console.error("[documents] live payload failed:", err);
      return <LiveDataUnavailable section="Control de Documentos" />;
    }
  }

  // El módulo basado en WorkspaceStore queda reservado al modo demo.
  return <DocumentsModule />;
}
