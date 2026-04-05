import MarketingLayout from "@/components/layout/MarketingLayout";

export const metadata = {
  title: "Seguridad — NormaFlow",
  description: "Prácticas de seguridad de la plataforma NormaFlow.",
};

export default function SecurityPage() {
  return (
    <MarketingLayout>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "56px 24px 80px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#142033", marginBottom: 12 }}>Seguridad</h1>
        <p style={{ color: "#5E6B7A", marginBottom: 28 }}>Resumen para equipos de compliance e IT</p>
        <div style={{ fontSize: 16, color: "#142033", lineHeight: 1.75 }}>
          <p>Cifrado en tránsito (TLS). Datos en reposo en bases gestionadas con controles de acceso por rol y aislamiento por organización.</p>
          <p>Autenticación mediante proveedor estándar (Supabase Auth). Posibilidad de políticas de contraseña y MFA según configuración del proyecto.</p>
          <p>Registro de actividad (audit logs) para acciones relevantes en la aplicación. Copias de seguridad gestionadas por el proveedor de base de datos.</p>
          <p>Para informes de vulnerabilidad o preguntas de debida diligencia: security@normaflow.io</p>
        </div>
      </div>
    </MarketingLayout>
  );
}
