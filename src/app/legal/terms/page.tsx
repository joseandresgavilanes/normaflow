import MarketingLayout from "@/components/layout/MarketingLayout";
import { createMarketingMetadata } from "@/lib/seo";

export const metadata = createMarketingMetadata({
  title: "Términos de uso | NormaFlow",
  description: "Condiciones de uso del servicio NormaFlow.",
  path: "/legal/terms",
});

export default function TermsPage() {
  return (
    <MarketingLayout>
      <section className="nf-section">
        <div className="nf-container" style={{ maxWidth: 820 }}>
          <span className="nf-eyebrow"><span className="dot"/> Legal</span>
          <h1 className="nf-h-section" style={{ marginTop: 22 }}>Términos de uso</h1>
          <p style={{ color: "var(--nf-ink-3)", fontFamily: "var(--font-mono)", fontSize: 12, marginTop: 14, marginBottom: 36 }}>
            Última actualización: abril de 2026
          </p>
          <div className="nf-prose">
            <p>El uso de NormaFlow implica la aceptación de estos términos. El servicio se ofrece en modalidad SaaS según el plan contratado.</p>
            <p>Eres responsable de la veracidad de los datos que introduces y del cumplimiento normativo aplicable a tu organización. <strong>NormaFlow es una herramienta de apoyo, no sustituye asesoramiento legal o de certificación.</strong></p>
            <p>La suspensión del servicio por impago o incumplimiento grave puede producirse previa notificación cuando sea razonable.</p>
            <p>Las sugerencias generadas por el asistente de IA requieren validación humana antes de adoptarse formalmente en tu sistema de gestión.</p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
