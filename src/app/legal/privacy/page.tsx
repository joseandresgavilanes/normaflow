import MarketingLayout from "@/components/layout/MarketingLayout";

export const metadata = {
  title: "Política de privacidad — NormaFlow",
  description: "Cómo tratamos los datos personales en NormaFlow.",
};

export default function PrivacyPage() {
  return (
    <MarketingLayout>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "56px 24px 80px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#142033", marginBottom: 12 }}>Política de privacidad</h1>
        <p style={{ color: "#5E6B7A", marginBottom: 28 }}>Última actualización: abril de 2026</p>
        <div style={{ fontSize: 16, color: "#142033", lineHeight: 1.75 }}>
          <p>NormaFlow trata los datos de contacto y cuenta de clientes B2B para prestar el servicio SaaS, facturación y soporte.</p>
          <p>Los datos de tu organización (documentos, auditorías, riesgos, etc.) se almacenan de forma aislada por tenant. No utilizamos tu contenido para entrenar modelos de terceros.</p>
          <p>Puedes ejercer derechos de acceso, rectificación, supresión y oposición escribiendo a privacidad@normaflow.io.</p>
          <p>Utilizamos proveedores de infraestructura (hosting, base de datos, email transaccional) con acuerdos de tratamiento conforme al RGPD.</p>
        </div>
      </div>
    </MarketingLayout>
  );
}
