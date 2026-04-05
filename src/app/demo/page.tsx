"use client";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import MarketingLayout from "@/components/layout/MarketingLayout";

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
    formState: { errors, isSubmitSuccessful },
    reset,
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { employees: "50-250" } });

  function onSubmit(_data: FormValues) {
    reset();
  }

  return (
    <MarketingLayout>
      <section style={{ padding: "clamp(40px, 8vw, 64px) 0 clamp(48px, 10vw, 80px)", background: "#F7F9FC" }}>
        <div className="nf-mkt-container" style={{ maxWidth: 560 }}>
          <h1 style={{ fontSize: "clamp(26px, 6vw, 34px)", fontWeight: 800, color: "#142033", margin: "0 0 10px", lineHeight: 1.15 }}>Demo y contacto</h1>
          <p style={{ color: "#5E6B7A", marginBottom: 28, lineHeight: 1.6 }}>Te respondemos en menos de un día laborable. Sin compromiso.</p>
          <div style={{ background: "#fff", border: "1px solid #E5EAF2", borderRadius: 16, padding: "clamp(18px, 4vw, 28px)" }}>
            {isSubmitSuccessful ? (
              <p style={{ color: "#2E8B57", fontWeight: 600, margin: 0 }}>Mensaje enviado. Gracias por contactar con NormaFlow.</p>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#142033" }}>Nombre</label>
                  <input {...register("name")} style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 8, border: "1px solid #E5EAF2", boxSizing: "border-box" }} />
                  {errors.name && <span style={{ color: "#C93C37", fontSize: 12 }}>{errors.name.message}</span>}
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#142033" }}>Email</label>
                  <input type="email" {...register("email")} style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 8, border: "1px solid #E5EAF2", boxSizing: "border-box" }} />
                  {errors.email && <span style={{ color: "#C93C37", fontSize: 12 }}>{errors.email.message}</span>}
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#142033" }}>Empresa</label>
                  <input {...register("company")} style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 8, border: "1px solid #E5EAF2", boxSizing: "border-box" }} />
                  {errors.company && <span style={{ color: "#C93C37", fontSize: 12 }}>{errors.company.message}</span>}
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#142033" }}>Teléfono (opcional)</label>
                  <input {...register("phone")} style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 8, border: "1px solid #E5EAF2", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#142033" }}>Tamaño aproximado</label>
                  <select {...register("employees")} style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 8, border: "1px solid #E5EAF2" }}>
                    <option value="1-49">1 – 49</option>
                    <option value="50-250">50 – 250</option>
                    <option value="250+">Más de 250</option>
                  </select>
                  {errors.employees && <span style={{ color: "#C93C37", fontSize: 12 }}>{errors.employees.message}</span>}
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#142033" }}>Mensaje</label>
                  <textarea {...register("message")} rows={4} style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 8, border: "1px solid #E5EAF2", boxSizing: "border-box", resize: "vertical" }} />
                  {errors.message && <span style={{ color: "#C93C37", fontSize: 12 }}>{errors.message.message}</span>}
                </div>
                <button type="submit" style={{ background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontWeight: 700, cursor: "pointer" }}>
                  Enviar
                </button>
              </form>
            )}
          </div>
          <p style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: "#5E6B7A" }}>
            ¿Prefieres probar solo? <Link href="/signup" style={{ color: "#123C66", fontWeight: 600 }}>Crear cuenta</Link>
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
