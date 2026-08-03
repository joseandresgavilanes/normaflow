import { Resend } from "resend";

export const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/** Never interpolate tenant/user content into email HTML without escaping. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]!);
}

function safeAppUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!base) return "https://app.normaflow.io";
  const origin = new URL(base).origin;
  const target = new URL(path, `${base}/`);
  return target.origin === origin && ["http:", "https:"].includes(target.protocol) ? target.toString() : base;
}

export async function sendWelcomeEmail(to: string, name: string, orgName: string) {
  if (!resend || !process.env.RESEND_FROM_EMAIL) return { error: "Resend no configurado" };
  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: `Bienvenido a NormaFlow, ${name}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: var(--nf-primary-active); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">NormaFlow</h1>
        </div>
        <div style="background: var(--nf-surface); padding: 32px; border: 1px solid var(--nf-border); border-radius: 0 0 12px 12px;">
          <h2 style="color: var(--nf-text-primary);">Bienvenido, ${escapeHtml(name)}</h2>
          <p style="color: var(--nf-text-secondary); line-height: 1.6;">
            Tu cuenta para <strong>${escapeHtml(orgName)}</strong> está lista.
            Puedes acceder a tu panel de cumplimiento en cualquier momento.
          </p>
          <a href="${safeAppUrl("/app/onboarding")}"
             style="display: inline-block; background: var(--nf-primary-active); color: white; 
                    padding: 12px 24px; border-radius: 8px; text-decoration: none; 
                    font-weight: 600; margin-top: 16px;">
            Ir a mi panel →
          </a>
          <p style="color: var(--nf-text-secondary); font-size: 13px; margin-top: 24px;">
            Si tienes dudas, responde a este correo o escríbenos a soporte@normaflow.io
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendOnboardingReminder(to: string, name: string, orgName: string, daysRemaining: number) {
  if (!resend || !process.env.RESEND_FROM_EMAIL) return { error: "Resend no configurado" };
  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: `${daysRemaining} días para activar ${orgName} en NormaFlow`,
    html: `<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:24px"><h2 style="color: var(--nf-text-primary)">Tu workspace está listo para avanzar</h2><p style="color: var(--nf-text-secondary);line-height:1.6">Hola ${escapeHtml(name)}, todavía tienes ${daysRemaining} días de trial. Completa el checklist inicial: perfil, proceso, documento, GAP, riesgo y acción.</p><a href="${safeAppUrl("/app/onboarding")}" style="display:inline-block;background:var(--nf-primary);color:white;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Continuar onboarding →</a></div>`,
  });
}

export async function sendNotificationEmail(
  to: string, name: string, title: string, body: string, link?: string, idempotencyKey?: string
) {
  if (!resend || !process.env.RESEND_FROM_EMAIL) return { error: "Resend no configurado" };
  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: title.replace(/[\r\n]/g, " ").slice(0, 200),
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <p style="color: var(--nf-text-primary); font-weight: 600;">${escapeHtml(title)}</p>
        <p style="color: var(--nf-text-secondary); line-height: 1.6;">${escapeHtml(body)}</p>
        ${link ? `<a href="${escapeHtml(safeAppUrl(link))}" style="color: var(--nf-primary-active); font-weight: 600;">Ver detalles →</a>` : ""}
      </div>
    `,
  });
}
