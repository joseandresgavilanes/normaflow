"use client";

import Card from "@/components/ui/Card";
import { useDemoPermission } from "@/hooks/useDemoPermission";

/**
 * Client-side UX mirror for admin / info / catalog pages. It only controls
 * presentation; live data and mutations are independently authorized on the
 * server before Prisma is called.
 */
export function AdminGate({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const perm = useDemoPermission();
  if (!perm.can(permission)) return <NoPermissionNotice />;
  return <>{children}</>;
}

function NoPermissionNotice() {
  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#C93C37", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Acceso restringido
        </span>
        <h2 style={{ margin: 0, fontSize: 18, color: "var(--nf-ink)" }}>
          No tienes permisos para ver esta sección
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: "var(--nf-ink-3)", lineHeight: 1.6 }}>
          Pídele al administrador de tu organización que te asigne un rol con acceso al módulo
          correspondiente.
        </p>
      </div>
    </Card>
  );
}
