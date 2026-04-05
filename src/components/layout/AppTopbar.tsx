"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import { useWorkspaceOptional } from "@/context/WorkspaceStore";

const BREADCRUMBS: Record<string, string[]> = {
  "/app/dashboard": ["Dashboard"],
  "/app/gap": ["GAP Assessment"],
  "/app/documents": ["Control de Documentos"],
  "/app/processes": ["Mapa de procesos"],
  "/app/risks": ["Gestión de Riesgos"],
  "/app/audits": ["Auditorías"],
  "/app/nonconformities": ["No Conformidades", "CAPA"],
  "/app/actions": ["Plan de Acción"],
  "/app/indicators": ["Indicadores y KPIs"],
  "/app/evidence": ["Repositorio de evidencias"],
  "/app/notifications": ["Notificaciones"],
  "/app/billing": ["Billing"],
  "/app/settings": ["Cuenta"],
};

export default function AppTopbar({ userName, roleLabel }: { userName: string; roleLabel: string }) {
  const pathname = usePathname();
  const ws = useWorkspaceOptional();
  const displayName = ws?.state.session.name ?? userName;
  const displayRole = ws?.state.session.roleLabel ?? roleLabel;
  const crumbs = BREADCRUMBS[pathname] ?? ["Aplicación"];
  return (
    <header style={{ height: 58, background: "#fff", borderBottom: "1px solid #E5EAF2", display: "flex", alignItems: "center", padding: "0 28px", gap: 12, position: "sticky", top: 0, zIndex: 50 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
        <Link href="/app/dashboard" style={{ fontSize: 13, color: "#5E6B7A", textDecoration: "none" }}>
          NormaFlow
        </Link>
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#5E6B7A", fontSize: 12 }}>/</span>
            <span style={{ fontSize: 13, color: i === crumbs.length - 1 ? "#142033" : "#5E6B7A", fontWeight: i === crumbs.length - 1 ? 600 : 400 }}>{c}</span>
          </span>
        ))}
      </div>
      <Link href="/app/notifications" style={{ background: "#F7F9FC", border: "1px solid #E5EAF2", borderRadius: 8, padding: "5px 12px", fontSize: 13, color: "#5E6B7A", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
        🔔 <span style={{ background: "#123C66", color: "#fff", borderRadius: 99, fontSize: 10, padding: "1px 5px", fontWeight: 700 }}>•</span>
      </Link>
      <Link href="/app/settings" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }} title="Cuenta y perfil">
        <Avatar name={displayName} size={30} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#142033", lineHeight: 1.2 }}>{displayName}</div>
          <div style={{ fontSize: 11, color: "#5E6B7A" }}>{displayRole}</div>
        </div>
      </Link>
    </header>
  );
}
