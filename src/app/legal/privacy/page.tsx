import MarketingLayout from "@/components/layout/MarketingLayout";

export const metadata = {
  title: "Política de privacidad — NormaFlow",
  description: "Cómo tratamos los datos personales en NormaFlow.",
};

export default function PrivacyPage() {
  return (
    <MarketingLayout>
      <section className="nf-section">
        <div className="nf-container" style={{ maxWidth: 820 }}>
          <span className="nf-eyebrow"><span className="dot"/> Legal</span>
          <h1 className="nf-h-section" style={{ marginTop: 22 }}>Política de privacidad</h1>
          <p style={{ color: "var(--nf-ink-3)", fontFamily: "var(--font-mono)", fontSize: 12, marginTop: 14, marginBottom: 36 }}>
            Última actualización: abril de 2026
          </p>
          <div className="nf-prose">
            <p>NormaFlow trata los datos de contacto y cuenta de clientes B2B para prestar el servicio SaaS, facturación y soporte.</p>
            <p>Los datos de tu organización (documentos, auditorías, riesgos, etc.) se almacenan de forma aislada por tenant. <strong>No utilizamos tu contenido para entrenar modelos de terceros.</strong></p>
            <p>Puedes ejercer derechos de acceso, rectificación, supresión y oposición escribiendo a <a href="mailto:privacidad@normaflow.io">privacidad@normaflow.io</a>.</p>
            <p>Utilizamos proveedores de infraestructura (hosting, base de datos, email transaccional) con acuerdos de tratamiento conforme al RGPD.</p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
