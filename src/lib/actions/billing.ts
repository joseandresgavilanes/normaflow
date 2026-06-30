"use server";

import { headers } from "next/headers";
import { requireAuthorization } from "@/lib/permissions/server";
import { prisma } from "@/lib/prisma";
import { getStripe, isPlanCheckoutConfigured, PLANS } from "@/lib/stripe";
import { logAuditEvent } from "@/lib/audit-log";

type CheckoutPlan = "STARTER" | "GROWTH";

async function appOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? "https";
  if (!host) throw new Error("No se pudo determinar la URL de la aplicación.");
  return `${protocol}://${host}`;
}

export async function createCheckoutSession(plan: CheckoutPlan) {
  const { ctx } = await requireAuthorization("billing:*");
  if (!isPlanCheckoutConfigured(plan)) throw new Error(`Stripe Checkout no está configurado para ${PLANS[plan].name}.`);
  const current = await prisma.subscription.findUnique({ where: { organizationId: ctx.organization.id } });
  const origin = await appOrigin();
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: current?.stripeCustomerId ?? undefined,
    customer_email: current?.stripeCustomerId ? undefined : ctx.user.email,
    line_items: [{ price: PLANS[plan].priceId, quantity: 1 }],
    metadata: { organizationId: ctx.organization.id, plan },
    subscription_data: { metadata: { organizationId: ctx.organization.id, plan } },
    success_url: `${origin}/app/billing?checkout=success`,
    cancel_url: `${origin}/app/billing?checkout=cancelled`,
  });
  if (!session.url) throw new Error("Stripe no devolvió una URL de Checkout.");

  await logAuditEvent({
    ctx,
    action: "checkout_session",
    module: "billing",
    recordId: session.id,
    after: { plan, planName: PLANS[plan].name, hasCustomer: Boolean(current?.stripeCustomerId) },
  });

  return { url: session.url };
}

export async function createBillingPortalSession() {
  const { ctx } = await requireAuthorization("billing:*");
  const subscription = await prisma.subscription.findUnique({ where: { organizationId: ctx.organization.id } });
  if (!subscription?.stripeCustomerId) throw new Error("La organización todavía no tiene un cliente de Stripe vinculado.");
  const session = await getStripe().billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${await appOrigin()}/app/billing`,
  });

  await logAuditEvent({
    ctx,
    action: "billing_portal",
    module: "billing",
    after: { stripeCustomerId: subscription.stripeCustomerId },
  });

  return { url: session.url };
}
