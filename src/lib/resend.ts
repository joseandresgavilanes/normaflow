import { Resend } from "resend";

export const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendWelcomeEmail(to: string, name: string, orgName: string) {
  if (!resend || !process.env.RESEND_FROM_EMAIL) return { error: "Resend no configurado" };
  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: `Bienvenido a NormaFlow, ${name}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: #123C66; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">NormaFlow</h1>
        </div>
        <div style="background: #fff; padding: 32px; border: 1px solid #E5EAF2; border-radius: 0 0 12px 12px;">
          <h2 style="color: #142033;">Bienvenido, ${name}</h2>
          <p style="color: #5E6B7A; line-height: 1.6;">
            Tu cuenta para <strong>${orgName}</strong> está lista. 
            Puedes acceder a tu panel de cumplimiento en cualquier momento.
          </p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/app/dashboard" 
             style="display: inline-block; background: #123C66; color: white; 
                    padding: 12px 24px; border-radius: 8px; text-decoration: none; 
                    font-weight: 600; margin-top: 16px;">
            Ir a mi panel →
          </a>
          <p style="color: #5E6B7A; font-size: 13px; margin-top: 24px;">
            Si tienes dudas, responde a este correo o escríbenos a soporte@normaflow.io
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendNotificationEmail(
  to: string, name: string, title: string, body: string, link?: string
) {
  if (!resend || !process.env.RESEND_FROM_EMAIL) return { error: "Resend no configurado" };
  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: title,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <p style="color: #142033; font-weight: 600;">${title}</p>
        <p style="color: #5E6B7A; line-height: 1.6;">${body}</p>
        ${link ? `<a href="${link}" style="color: #123C66; font-weight: 600;">Ver detalles →</a>` : ""}
      </div>
    `,
  });
}
