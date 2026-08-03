"use client";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import MarketingLayout from "@/components/layout/MarketingLayout";
import { Ic } from "@/components/marketing/nf/Icons";

const schema = z.object({
  name: z.string().min(2, "Indica tu nombre"),
  email: z.string().email("Email no válido"),
  company: z.string().min(2, "Indica la empresa"),
  phone: z.string().optional(),
  message: z.string().min(10, "Cuéntanos brevemente qué necesitas (mín. 10 caracteres)"),
  employees: z.string().min(1, "Selecciona un rango"),
});

type FormValues = z.infer<typeof schema>;

export default function DemoPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitSuccessful, isSubmitting },
    reset,
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { employees: "50-250" } });

  function onSubmit(_data: FormValues) {
    reset();
  }

  return (
    <MarketingLayout>
      <section className="nf-section">
        <div className="nf-container" style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 56, alignItems: "start", maxWidth: 1100, margin: "0 auto" }}>
          <div>
            <span className="nf-eyebrow"><span className="dot"/> Demo · 30 min</span>
            <h1 className="nf-h-section" style={{ marginTop: 22 }}>
              Vemos tu sistema. <span className="nf-grad-text">Te enseñamos el nuestro.</span>
            </h1>
            <p className="nf-lede" style={{ marginTop: 18 }}>
              Una llamada con un especialista en cumplimiento. Sin guion comercial — analizamos cómo gestionas tu SGC hoy y te mostramos en qué cambia con NormaFlow.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "28px 0 0", display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                "Te respondemos en menos de un día laborable.",
                "Sin compromiso, sin tarjeta.",
                "Adaptamos la demo a tu sector y norma.",
              ].map((t) => (
                <li key={t} style={{ display: "flex", gap: 12, alignItems: "flex-start", color: "var(--nf-ink-2)", fontSize: 15 }}>
                  <span style={{ color: "var(--nf-accent)", marginTop: 4 }}><Ic.check/></span>{t}
                </li>
              ))}
            </ul>
            <p style={{ marginTop: 32, fontSize: 14, color: "var(--nf-ink-3)" }}>
              ¿Prefieres probar solo? <Link href="/signup" style={{ color: "var(--nf-accent)" }}>Crear cuenta · 14 días gratis</Link>
            </p>
          </div>

          <div className="nfm-card" style={{ padding: "clamp(24px, 3.5vw, 36px)" }}>
            {isSubmitSuccessful ? (
              <div style={{ padding: 20, borderRadius: 12, background: "var(--nf-accent-soft)", border: "1px solid rgba(82, 102, 246, 0.25)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--nf-accent)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>● Mensaje enviado</div>
                <p style={{ color: "var(--nf-ink)", margin: 0, fontSize: 15 }}>Gracias por contactar con NormaFlow. Te respondemos en breve.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label className="nf-label">Nombre</label>
                  <input aria-label="María Torres" {...register("name")} className="nfm-input" placeholder="María Torres" />
                  {errors.name && <span style={{ color: "var(--nf-danger-text)", fontSize: 12, marginTop: 4, display: "block" }}>{errors.name.message}</span>}
                </div>
                <div>
                  <label className="nf-label">Email corporativo</label>
                  <input aria-label="maria@empresa.com" type="email" {...register("email")} className="nfm-input" placeholder="maria@empresa.com" />
                  {errors.email && <span style={{ color: "var(--nf-danger-text)", fontSize: 12, marginTop: 4, display: "block" }}>{errors.email.message}</span>}
                </div>
                <div>
                  <label className="nf-label">Empresa</label>
                  <input aria-label="Tecnoserv Industrial" {...register("company")} className="nfm-input" placeholder="Tecnoserv Industrial" />
                  {errors.company && <span style={{ color: "var(--nf-danger-text)", fontSize: 12, marginTop: 4, display: "block" }}>{errors.company.message}</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="nf-label">Teléfono (opcional)</label>
                    <input aria-label="Teléfono" {...register("phone")} className="nfm-input" placeholder="+34 600 000 000" />
                  </div>
                  <div>
                    <label className="nf-label">Tamaño</label>
                    <select aria-label="Empleados" {...register("employees")} className="nfm-select">
                      <option value="1-49">1 – 49</option>
                      <option value="50-250">50 – 250</option>
                      <option value="250+">Más de 250</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="nf-label">Mensaje</label>
                  <textarea aria-label="¿Qué normas gestionas? ¿Cuándo es tu próxima auditoría?" {...register("message")} rows={4} className="nfm-textarea" placeholder="¿Qué normas gestionas? ¿Cuándo es tu próxima auditoría?" />
                  {errors.message && <span style={{ color: "var(--nf-danger-text)", fontSize: 12, marginTop: 4, display: "block" }}>{errors.message.message}</span>}
                </div>
                <button type="submit" disabled={isSubmitting} className="nf-btn nf-btn--primary" style={{ justifyContent: "center", marginTop: 4 }}>
                  Enviar solicitud <Ic.arrow className="nf-arrow"/>
                </button>
                <p style={{ fontSize: 11, color: "var(--nf-ink-3)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em", textAlign: "center", marginTop: 4 }}>
                  Tus datos solo se usan para contactarte. <Link href="/legal/privacy" style={{ color: "var(--nf-ink-2)", textDecoration: "underline" }}>Política de privacidad</Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
