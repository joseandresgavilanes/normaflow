"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, CircleHelp, Clock3, Gauge, LockKeyhole, Rocket, ShieldCheck, Target, Users } from "lucide-react";
import { createCheckoutSession } from "@/lib/actions/billing";
import { completeOnboarding, saveOnboardingSetup, skipOnboarding } from "@/lib/actions/onboarding";
import type { OnboardingPayload } from "@/lib/server-queries";
import { FormStepper } from "@/components/ui/FormStepper";
import Picker from "@/components/ui/Picker";

type Props = { initial: OnboardingPayload | null; userName: string; needsOrganization: boolean };
type Goal = "CERTIFY" | "MAINTAIN_CERTIFICATION" | "AUDIT_PREPARATION" | "ORGANIZE_DOCUMENTS_EVIDENCE";

const standards = [
  { code: "ISO_9001", name: "ISO 9001", version: "2015", label: "Calidad", description: "Procesos, cliente, mejora continua y desempeño." },
  { code: "ISO_27001", name: "ISO 27001", version: "2022", label: "Seguridad de la información", description: "Riesgos, controles, activos y resiliencia." },
] as const;

const goals: { value: Goal; title: string; description: string }[] = [
  { value: "CERTIFY", title: "Quiero certificarme", description: "Construir una línea base y cerrar brechas con método." },
  { value: "MAINTAIN_CERTIFICATION", title: "Quiero mantener mi certificación", description: "Controlar vencimientos, auditorías y acciones recurrentes." },
  { value: "AUDIT_PREPARATION", title: "Quiero prepararme para una auditoría", description: "Ordenar evidencias y llegar con trazabilidad." },
  { value: "ORGANIZE_DOCUMENTS_EVIDENCE", title: "Quiero ordenar documentos y evidencias", description: "Centralizar el sistema de gestión en un solo lugar." },
];

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "var(--nf-surface)", border: "1px solid var(--nf-border)", borderRadius: 18, boxShadow: "0 14px 40px rgba(20,32,51,.06)", ...style }}>{children}</div>;
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} style={{ textAlign: "left", border: `1px solid ${selected ? "var(--nf-primary)" : "var(--nf-border)"}`, background: selected ? "var(--nf-primary-subtle)" : "var(--nf-surface)", borderRadius: 14, padding: 16, cursor: "pointer", color: "var(--nf-text-primary)", boxShadow: selected ? "0 0 0 3px rgba(82,102,246,.10)" : "none" }}>{children}</button>;
}

const PASOS = [
  { id: "organizacion", label: "Organización", hint: "Datos básicos" },
  { id: "normas", label: "Normas", hint: "Qué vas a gestionar" },
  { id: "objetivo", label: "Objetivo", hint: "Por dónde empezar" },
  { id: "listo", label: "Activación", hint: "Tu checklist" },
];

export default function OnboardingWizard({ initial, userName, needsOrganization }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(initial?.organization.status === "IN_PROGRESS" ? 1 : 1);
  const [orgName, setOrgName] = useState(initial?.organization.name ?? "");
  const [industry, setIndustry] = useState(initial?.organization.industry ?? "");
  const [country, setCountry] = useState(initial?.organization.country ?? "ES");
  const [size, setSize] = useState(initial?.organization.size ?? "");
  const [selectedStandards, setSelectedStandards] = useState<string[]>(initial?.organization.standards.map((item) => item.code) ?? ["ISO_9001"]);
  const [goal, setGoal] = useState<Goal>((initial?.organization.goal as Goal | null) ?? "CERTIFY");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(Boolean(initial && initial.organization.step >= 4));
  const [pending, startTransition] = useTransition();

  const checklist = initial?.items ?? [];
  const progress = initial?.progressPct ?? (saved ? 17 : 0);
  const days = initial?.trialDaysRemaining ?? 14;
  
  function run(action: () => Promise<unknown>, after?: () => void) {
    setError("");
    startTransition(async () => {
      try { await action(); after?.(); router.refresh(); }
      catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar la configuración."); }
    });
  }

  function nextFromCompany() {
    if (orgName.trim().length < 2) { setError("Indica el nombre de tu organización."); return; }
    setError(""); setStep(2);
  }

  function nextFromStandards() {
    if (!selectedStandards.length) { setError("Selecciona ISO 9001, ISO 27001 o ambas."); return; }
    setError(""); setStep(3);
  }

  function saveSetup() {
    if (needsOrganization) {
      run(async () => {
        const response = await fetch("/api/auth/bootstrap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationName: orgName.trim(), standards: selectedStandards, industry, country, size, goal }) });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "No se pudo crear el workspace.");
      }, () => { setSaved(true); setStep(4); });
      return;
    }
    run(() => saveOnboardingSetup({ organizationName: orgName, industry, country, size, standards: selectedStandards, goal }), () => { setSaved(true); setStep(4); });
  }

  function enterWorkspace() {
    run(() => completeOnboarding(), () => router.push("/app/dashboard"));
  }

  function skip() {
    run(() => skipOnboarding(), () => router.push("/app/dashboard"));
  }

  return <main style={{ minHeight: "100vh", background: "linear-gradient(135deg, var(--nf-background) 0%, var(--nf-primary-subtle) 100%)", padding: "32px 20px 56px", color: "var(--nf-text-primary)" }}>
    <div style={{ maxWidth: 1040, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <Link href="/home" style={{ display: "inline-flex", alignItems: "center", gap: 9, textDecoration: "none", color: "var(--nf-text-primary)", fontSize: 20, fontWeight: 750 }}><span style={{ width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: 10, background: "var(--nf-primary)", color: "var(--nf-text-on-primary)", fontWeight: 900 }}>N</span> NormaFlow</Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--nf-text-secondary)", fontSize: 13 }}><Clock3 size={15} /> Trial de 14 días · sin tarjeta</div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 280px", gap: 22, alignItems: "start" }}>
        <Card style={{ padding: "30px clamp(20px,5vw,52px) 34px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start", marginBottom: 30 }}>
            <div><div style={{ fontSize: 12, fontWeight: 800, color: "var(--nf-primary-active)", textTransform: "uppercase", letterSpacing: ".09em" }}>Configuración inicial</div><h1 style={{ fontSize: "clamp(26px,4vw,38px)", lineHeight: 1.08, letterSpacing: "-.035em", margin: "8px 0 10px" }}>{userName ? `Hola, ${userName.split(" ")[0]}` : "Llega a valor en minutos"}</h1><p style={{ color: "var(--nf-text-secondary)", margin: 0, lineHeight: 1.55, maxWidth: 560 }}>Configura tu sistema de gestión y empieza con una base usable en menos de 10 minutos.</p></div>
          </div>
          {/* Antes: cuatro barras de color y un "1 / 4". El color era el único
              indicador de progreso y ningún paso decía su nombre, así que no
              se sabía qué venía después ni a cuál se podía volver. */}
          <FormStepper
            className="nf-onboarding-stepper"
            steps={PASOS.map((paso, index) => ({
              id: paso.id,
              label: paso.label,
              hint: paso.hint,
              status: index + 1 < step ? "done" : index + 1 === step ? "current" : "pending",
            }))}
            onStepClick={(_, index) => setStep(index + 1)}
          />

          {step === 1 && <section><h2 style={{ fontSize: 22, margin: "0 0 6px" }}>Cuéntanos sobre tu organización</h2><p style={{ color: "var(--nf-text-secondary)", fontSize: 14, margin: "0 0 22px" }}>Usaremos estos datos para personalizar tu workspace y tus reportes.</p><div style={{ display: "grid", gap: 15 }}><label style={{ fontSize: 13, fontWeight: 700 }}>Nombre de la organización<input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Ej. Acme Components" style={inputStyle} /></label><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}><label style={{ fontSize: 13, fontWeight: 700 }}>Sector<input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Ej. Tecnología, manufactura…" style={inputStyle} /></label><label style={{ fontSize: 13, fontWeight: 700 }}>País<input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="ES" style={inputStyle} /></label></div><label style={{ fontSize: 13, fontWeight: 700 }}>Tamaño<Picker aria-label="Tamaño" value={size} onChange={(e) => setSize(e.target.value)} style={inputStyle}><option value="">Selecciona una opción</option><option value="1-10">1–10 personas</option><option value="11-50">11–50 personas</option><option value="51-250">51–250 personas</option><option value="251+">Más de 250 personas</option></Picker></label></div><Footer onNext={nextFromCompany} next="Continuar" /></section>}

          {step === 2 && <section><button type="button" onClick={() => setStep(1)} style={backStyle}><ChevronLeft size={15} /> Atrás</button><h2 style={{ fontSize: 22, margin: "15px 0 6px" }}>¿Qué normas quieres gestionar?</h2><p style={{ color: "var(--nf-text-secondary)", fontSize: 14, margin: "0 0 20px" }}>Puedes activar una o las dos. NormaFlow generará el GAP y las cláusulas base automáticamente.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 14 }}>{standards.map((item) => { const selected = selectedStandards.includes(item.code); return <Choice key={item.code} selected={selected} onClick={() => setSelectedStandards((current) => selected ? current.filter((code) => code !== item.code) : [...current, item.code])}><div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}><span style={{ width: 24, height: 24, borderRadius: 8, background: selected ? "var(--nf-primary)" : "var(--nf-surface-muted)", color: selected ? "#fff" : "#8390a1", display: "grid", placeItems: "center", flexShrink: 0 }}>{selected ? <Check size={15} /> : <ShieldCheck size={15} />}</span><span><strong style={{ display: "block", fontSize: 17 }}>{item.name}:{item.version}</strong><span style={{ color: "var(--nf-primary-active)", fontSize: 12, fontWeight: 700 }}>{item.label}</span><span style={{ display: "block", color: "var(--nf-text-secondary)", fontSize: 13, lineHeight: 1.45, marginTop: 7 }}>{item.description}</span></span></div></Choice>; })}</div><div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "var(--nf-surface-muted)", color: "var(--nf-text-secondary)", fontSize: 12 }}><LockKeyhole size={14} style={{ verticalAlign: "-3px", marginRight: 5 }} /> Tus datos quedan aislados por organización y las cláusulas se cargan desde el catálogo ISO.</div><Footer onNext={nextFromStandards} next="Elegir objetivo" /></section>}

          {step === 3 && <section><button type="button" onClick={() => setStep(2)} style={backStyle}><ChevronLeft size={15} /> Atrás</button><h2 style={{ fontSize: 22, margin: "15px 0 6px" }}>¿Qué quieres conseguir primero?</h2><p style={{ color: "var(--nf-text-secondary)", fontSize: 14, margin: "0 0 20px" }}>Esto ordena tus primeros pasos. Podrás cambiarlo más adelante.</p><div style={{ display: "grid", gap: 10 }}>{goals.map((item) => <Choice key={item.value} selected={goal === item.value} onClick={() => setGoal(item.value)}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: goal === item.value ? "var(--nf-primary)" : "var(--nf-surface-muted)", color: goal === item.value ? "#fff" : "var(--nf-primary-active)" }}><Target size={17} /></span><span><strong style={{ display: "block", fontSize: 14 }}>{item.title}</strong><span style={{ display: "block", color: "var(--nf-text-secondary)", fontSize: 12, marginTop: 3 }}>{item.description}</span></span></div></Choice>)}</div><Footer onNext={saveSetup} next={pending ? "Preparando workspace…" : "Crear mi workspace"} disabled={pending} /></section>}

          {step === 4 && <section><div style={{ display: "flex", gap: 13, alignItems: "flex-start", padding: 16, background: "var(--nf-success-subtle)", border: "1px solid var(--nf-success-border)", borderRadius: 14, marginBottom: 22 }}><span style={{ width: 34, height: 34, background: "var(--nf-success)", color: "var(--nf-text-on-primary)", borderRadius: 10, display: "grid", placeItems: "center" }}><Rocket size={18} /></span><span><strong style={{ display: "block", color: "var(--nf-success-text)" }}>Tu workspace está listo</strong><span style={{ color: "var(--nf-success-text)", fontSize: 13 }}>Normas, cláusulas GAP, procesos base y plantillas iniciales preparados.</span></span></div><h2 style={{ fontSize: 22, margin: "0 0 6px" }}>Tu checklist de activación</h2><p style={{ color: "var(--nf-text-secondary)", fontSize: 14, margin: "0 0 16px" }}>Completa estos pasos para obtener valor real del trial. El progreso se actualiza solo al trabajar en cada módulo.</p>{initial ? <><div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 15 }}><div style={{ flex: 1, height: 8, borderRadius: 8, background: "var(--nf-surface-selected)", overflow: "hidden" }}><div style={{ height: "100%", width: `${progress}%`, background: progress >= 70 ? "var(--nf-success)" : "var(--nf-primary)", borderRadius: 8 }} /></div><strong style={{ fontSize: 13, color: "var(--nf-primary-active)" }}>{progress}%</strong></div><div style={{ display: "grid", gap: 8 }}>{checklist.map((item) => <Link key={item.id} href={item.href} style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 11, padding: "12px 13px", border: "1px solid var(--nf-border)", borderRadius: 12, background: item.done ? "var(--nf-success-subtle)" : "var(--nf-surface)" }}><span style={{ width: 22, height: 22, borderRadius: 7, display: "grid", placeItems: "center", background: item.done ? "var(--nf-success)" : "var(--nf-surface-muted)", color: item.done ? "var(--nf-text-on-primary)" : "var(--nf-text-secondary)" }}>{item.done ? <Check size={14} /> : <ArrowRight size={14} />}</span><span style={{ flex: 1 }}><strong style={{ display: "block", fontSize: 13 }}>{item.title}</strong><span style={{ color: "var(--nf-text-secondary)", fontSize: 12 }}>{item.description}</span></span><ArrowRight size={15} color="var(--nf-text-subtle)" /></Link>)}</div></> : <div style={{ padding: 16, background: "var(--nf-surface-muted)", borderRadius: 12, color: "var(--nf-text-secondary)", fontSize: 13 }}>Actualiza la pantalla para cargar tu checklist.</div>}<div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}><button type="button" onClick={enterWorkspace} disabled={pending} style={primaryButton}>{pending ? "Guardando…" : "Entrar al workspace"}<ArrowRight size={16} /></button><button type="button" onClick={skip} disabled={pending} style={secondaryButton}>Continuar después</button></div></section>}
          {error && <div role="alert" style={{ marginTop: 18, padding: 11, borderRadius: 10, color: "var(--nf-danger-text)", background: "var(--nf-danger-subtle)", border: "1px solid #f2c4c4", fontSize: 13 }}>{error}</div>}
        </Card>

        <aside style={{ display: "grid", gap: 14 }}><Card style={{ padding: 18, background: "#142033", color: "var(--nf-text-on-primary)", border: "none" }}><div style={{ display: "flex", gap: 9, alignItems: "center", color: "#aebaff", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}><Gauge size={15} /> Tu trial</div><div style={{ fontSize: 34, fontWeight: 850, margin: "12px 0 2px" }}>{days} <span style={{ fontSize: 14, fontWeight: 600 }}>días</span></div><p style={{ fontSize: 12, lineHeight: 1.5, color: "#c5cfdf", margin: 0 }}>Explora el sistema completo durante 14 días. No te pedimos tarjeta para empezar.</p></Card><Card style={{ padding: 18 }}><strong style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}><Users size={16} color="var(--nf-primary-active)" /> Diseñado para tu equipo</strong><p style={{ color: "var(--nf-text-secondary)", fontSize: 12, lineHeight: 1.5, margin: "9px 0 0" }}>Invita responsables, auditores y revisores cuando tu base esté lista.</p></Card><Card style={{ padding: 18 }}><strong style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}><CircleHelp size={16} color="var(--nf-primary-active)" /> ¿Necesitas ayuda?</strong><p style={{ color: "var(--nf-text-secondary)", fontSize: 12, lineHeight: 1.5, margin: "9px 0 0" }}>Empieza por el GAP y luego trabaja la evidencia de las brechas prioritarias.</p></Card></aside>
      </div>

      {saved && step === 4 && <UpgradePanel initial={initial} pending={pending} />}
    </div>
  </main>;
}

function Footer({ onNext, next, disabled }: { onNext: () => void; next: string; disabled?: boolean }) { return <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 26 }}><button type="button" onClick={onNext} disabled={disabled} style={{ ...primaryButton, opacity: disabled ? .65 : 1 }}>{next}<ArrowRight size={16} /></button></div>; }

function UpgradePanel({ initial, pending }: { initial: OnboardingPayload | null; pending: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function upgrade(plan: "STARTER" | "GROWTH") { setBusy(true); setError(""); createCheckoutSession(plan).then(({ url }) => window.location.assign(url)).catch((e) => setError(e instanceof Error ? e.message : "Checkout no disponible.")).finally(() => setBusy(false)); }
  if (!initial) return null;
  return <Card style={{ marginTop: 22, padding: 22 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}><div><div style={{ color: "var(--nf-primary-active)", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>Cuando estés listo</div><h2 style={{ fontSize: 21, margin: "7px 0 5px" }}>Conserva tu progreso después del trial</h2><p style={{ color: "var(--nf-text-secondary)", fontSize: 13, margin: 0 }}>Elige el plan que encaje con tu equipo. Puedes ampliar después.</p></div><Link href="/app/billing" style={{ color: "var(--nf-primary-active)", fontWeight: 700, fontSize: 13 }}>Ver facturación →</Link></div><div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10, marginTop: 16 }}>{initial.billing.plans.map((plan) => <div key={plan.key} style={{ border: "1px solid var(--nf-border)", borderRadius: 12, padding: 13 }}><strong style={{ fontSize: 14 }}>{plan.name}</strong><div style={{ color: "var(--nf-primary-active)", fontSize: 20, fontWeight: 850, margin: "7px 0" }}>{plan.price == null ? "A medida" : `$${plan.price}`}<small style={{ color: "var(--nf-text-secondary)", fontSize: 11 }}>{plan.price == null ? "" : " USD/mes"}</small></div><button type="button" disabled={busy || pending || !initial.billing.canManage || !initial.billing.stripeConfigured || (plan.key !== "ENTERPRISE" && !initial.billing.checkoutConfigured[plan.key as "STARTER" | "GROWTH"])} onClick={() => plan.key !== "ENTERPRISE" && upgrade(plan.key as "STARTER" | "GROWTH")} style={plan.key === "GROWTH" ? primaryButton : secondaryButton}>{plan.key === "ENTERPRISE" ? "Hablar con ventas" : initial.billing.stripeConfigured ? "Elegir plan" : "Configura Stripe"}</button></div>)}</div>{error && <p role="alert" style={{ color: "var(--nf-danger-text)", fontSize: 12, marginBottom: 0 }}>{error}</p>}</Card>;
}

const inputStyle: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", marginTop: 7, border: "1px solid var(--nf-border)", borderRadius: 10, padding: "11px 12px", fontSize: 14, color: "var(--nf-text-primary)", background: "var(--nf-surface)", outline: "none" };
const primaryButton: React.CSSProperties = { border: "none", borderRadius: 10, background: "var(--nf-primary)", color: "var(--nf-text-on-primary)", padding: "11px 16px", fontSize: 13, fontWeight: 750, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { border: "1px solid var(--nf-border)", borderRadius: 10, background: "var(--nf-surface)", color: "var(--nf-primary-active)", padding: "10px 14px", fontSize: 13, fontWeight: 750, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" };
const backStyle: React.CSSProperties = { border: "none", background: "transparent", color: "var(--nf-primary-active)", padding: 0, fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3, cursor: "pointer" };
