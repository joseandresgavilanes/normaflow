import MarketingLayout from "@/components/layout/MarketingLayout";
import { Ic } from "@/components/marketing/nf/Icons";
import { createMarketingMetadata } from "@/lib/seo";

export const metadata = createMarketingMetadata({
  title: "ISO 37301:2021 — NormaFlow",
  description: "Implementa y mantén tu Sistema de Gestión de Compliance con NormaFlow: obligaciones, riesgos, canal de denuncias protegido y un informe agregado al órgano de gobierno.",
  path: "/iso37301",
});

const ITEMS: { icon: keyof typeof Ic; title: string; desc: string; clause: string }[] = [
  { icon: "doc",    title: "Registro de obligaciones",          desc: "Cada obligación legal, regulatoria o contractual con su jurisdicción, fuente, responsable y estado de cumplimiento, evaluada con periodicidad propia.", clause: "4.6, 9.1" },
  { icon: "risk",   title: "Riesgos y controles de compliance",  desc: "Riesgo inherente y residual por obligación, con eficacia de controles medida y revalorada automáticamente al probarlos.", clause: "6.1, 8.1" },
  { icon: "lock",   title: "Canal de denuncias protegido",       desc: "Identificada, confidencial o anónima. El acceso a un caso exige una autorización explícita — tener el permiso del módulo no basta.", clause: "8.3" },
  { icon: "action", title: "Investigación independiente",        desc: "Quien está señalado en una denuncia nunca la investiga, y un conflicto de interés detectado obliga a recusación y reasignación — reforzado en base de datos.", clause: "8.3, 9.1" },
  { icon: "warn",   title: "Incumplimientos y remediación",      desc: "Notificación a la autoridad con plazo, plan de remediación cuya eficacia verifica siempre una persona distinta de quien lo ejecutó.", clause: "10.1" },
  { icon: "kpi",    title: "Informe al órgano de gobierno",      desc: "Un digest periódico con obligaciones, riesgos, canal e incumplimientos — el canal entra solo agregado, nunca con identidades.", clause: "5.1, 9.3" },
];

export default function ISO37301Page() {
  return (
    <MarketingLayout>
      <section className="nf-hero" id="top">
        <div className="nf-container" style={{ textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
          <div className="nf-iso-badge" style={{ position: "relative", left: 0, top: 0, width: 84, height: 84, margin: "0 auto 22px" }}>
            <div>
              <div className="top">ISO</div>
              <div className="num" style={{ color: "var(--nf-accent)", fontSize: 15 }}>37301</div>
              <div className="yr">2021</div>
            </div>
          </div>
          <span className="nf-eyebrow"><span className="dot"/> ISO 37301:2021</span>
          <h1 className="nf-h-display" style={{ fontSize: "clamp(36px, 6vw, 64px)", marginTop: 22 }}>
            Gestión de<br/><span className="nf-grad-text">Compliance.</span>
          </h1>
          <p className="nf-lede" style={{ marginTop: 22, marginInline: "auto" }}>
            Del registro de obligaciones a un canal de denuncias donde el acceso a un caso exige
            autorización explícita, nunca solo el permiso del módulo: investigación independiente,
            protección frente a represalias, e incumplimientos que se cierran solo con eficacia
            de remediación verificada por un tercero.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}>
            <a className="nf-btn nf-btn--primary" href="/demo">Solicitar demo <Ic.arrow className="nf-arrow"/></a>
            <a className="nf-btn nf-btn--ghost" href="/signup">Crear cuenta · 14 días gratis</a>
          </div>
        </div>
      </section>

      <section className="nf-section nf-section--tight">
        <div className="nf-container">
          <div className="nf-grid-3">
            {ITEMS.map((it) => {
              const Icon = Ic[it.icon];
              return (
                <article key={it.title} className="nf-tile">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--nf-glass-2)", border: "1px solid var(--nf-line)", color: "var(--nf-accent)" }}>
                      <Icon/>
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 8px", borderRadius: 99, background: "var(--nf-accent-soft)", color: "var(--nf-accent)", border: "1px solid rgba(82, 102, 246, 0.25)", letterSpacing: "0.06em" }}>
                      Cláusula {it.clause}
                    </span>
                  </div>
                  <div className="nf-h-4">{it.title}</div>
                  <div style={{ marginTop: 8, color: "var(--nf-ink-2)", fontSize: 14, lineHeight: 1.6 }}>{it.desc}</div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="nf-section nf-section--tight">
        <div className="nf-container" style={{ maxWidth: 780, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--nf-ink-3)", lineHeight: 1.7 }}>
            No sustituye la certificación, no ofrece asesoría legal y no garantiza el anonimato de un
            informante más allá de lo que técnicamente puede garantizar el modo de denuncia elegido —
            es la plataforma que hace que el acceso a un caso exija siempre una autorización explícita,
            nunca solo un rol.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
