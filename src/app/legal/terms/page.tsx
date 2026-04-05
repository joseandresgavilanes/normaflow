import MarketingLayout from "@/components/layout/MarketingLayout";

export const metadata = {
  title: "Términos de uso — NormaFlow",
  description: "Condiciones de uso del servicio NormaFlow.",
};

export default function TermsPage() {
  return (
    <MarketingLayout>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "56px 24px 80px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#142033", marginBottom: 12 }}>Términos de uso</h1>
        <p style={{ color: "#5E6B7A", marginBottom: 28 }}>Última actualización: abril de 2026</p>
        <div style={{ fontSize: 16, color: "#142033", lineHeight: 1.75 }}>
          <p>El uso de NormaFlow implica la aceptación de estos términos. El servicio se ofrece en modalidad SaaS según el plan contratado.</p>
          <p>Eres responsable de la veracidad de los datos que introduces y del cumplimiento normativo aplicable a tu organización. NormaFlow es una herramienta de apoyo, no sustituye asesoramiento legal o de certificación.</p>
          <p>La suspensión del servicio por impago o incumplimiento grave puede producirse previa notificación cuando sea razonable.</p>
          <p>Las sugerencias generadas por el asistente de IA requieren validación humana antes de adoptarse formalmente en tu sistema de gestión.</p>
        </div>
      </div>
    </MarketingLayout>
  );
}
