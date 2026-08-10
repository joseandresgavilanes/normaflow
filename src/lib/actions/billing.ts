"use server";

import { headers } from "next/headers";
import { requireAuthorization } from "@/lib/permissions/server";
import { prisma } from "@/lib/prisma";
import { getStripe, isPlanCheckoutConfigured, PLANS, stripePriceIdForPlan } from "@/lib/stripe";
import { logAuditEvent } from "@/lib/audit-log";
import { parseInput } from "@/lib/validation/common";
import { billingPlanSchema } from "@/lib/validation/p1";
import { syncCommercialPackEntitlements } from "@/lib/standard-packs";

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
  plan = parseInput(billingPlanSchema, { plan }).plan as CheckoutPlan;
  const { ctx } = await requireAuthorization("billing:*");
  const priceId = stripePriceIdForPlan(plan);
  if (!isPlanCheckoutConfigured(plan) || !priceId) throw new Error(`Stripe Checkout no está configurado para ${PLANS[plan].name}.`);
  const current = await prisma.subscription.findUnique({ where: { organizationId: ctx.organization.id } });
  const origin = await appOrigin();
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: current?.stripeCustomerId ?? undefined,
    customer_email: current?.stripeCustomerId ? undefined : ctx.user.email,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    payment_method_collection: current?.status === "TRIALING" ? "if_required" : "always",
    billing_address_collection: "auto",
    metadata: { organizationId: ctx.organization.id, plan },
    subscription_data: { metadata: { organizationId: ctx.organization.id, plan }, ...(ctx.organization.trialEndsAt && ctx.organization.trialEndsAt > new Date() ? { trial_end: Math.floor(ctx.organization.trialEndsAt.getTime() / 1000) } : {}) },
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

/**
 * Changes an existing Stripe subscription in-place. If the organization is
 * still on the local trial, the caller receives a Checkout URL instead.
 * This avoids accidentally creating two subscriptions during an upgrade or
 * downgrade.
 */
export async function changePlan(plan: CheckoutPlan) {
  plan = parseInput(billingPlanSchema, { plan }).plan as CheckoutPlan;
  const { ctx } = await requireAuthorization("billing:*");
  const priceId = stripePriceIdForPlan(plan);
  if (!isPlanCheckoutConfigured(plan) || !priceId) throw new Error(`Stripe Checkout no está configurado para ${PLANS[plan].name}.`);
  const current = await prisma.subscription.findUnique({ where: { organizationId: ctx.organization.id } });
  if (!current?.stripeSubscriptionId) return createCheckoutSession(plan);

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(current.stripeSubscriptionId);
  const item = subscription.items.data[0];
  if (!item) throw new Error("La suscripción de Stripe no contiene una línea de precio.");
  await stripe.subscriptions.update(subscription.id, {
    items: [{ id: item.id, price: priceId }],
    proration_behavior: "create_prorations",
    metadata: { organizationId: ctx.organization.id, plan },
  });
  await prisma.$transaction([
    prisma.subscription.update({ where: { organizationId: ctx.organization.id }, data: { plan } }),
    prisma.organization.update({ where: { id: ctx.organization.id }, data: { plan } }),
  ]);
  const entitlementSync = await syncCommercialPackEntitlements({
    organizationId: ctx.organization.id,
    plan,
    trialEndsAt: ctx.organization.trialEndsAt,
    grantedById: ctx.user.id,
  });
  await logAuditEvent({ ctx, action: "plan_change", module: "billing", recordId: current.stripeSubscriptionId, before: { plan: current.plan }, after: { plan, packEntitlements: entitlementSync.enabledCodes } });
  return { updated: true, plan };
}

export async function cancelSubscription() {
  const { ctx } = await requireAuthorization("billing:*");
  const current = await prisma.subscription.findUnique({ where: { organizationId: ctx.organization.id } });
  if (!current?.stripeSubscriptionId) throw new Error("No existe una suscripción activa.");
  await getStripe().subscriptions.update(current.stripeSubscriptionId, { cancel_at_period_end: true });
  await prisma.subscription.update({ where: { organizationId: ctx.organization.id }, data: { cancelAtPeriodEnd: true } });
  await logAuditEvent({ ctx, action: "cancel_scheduled", module: "billing", recordId: current.id, before: { cancelAtPeriodEnd: current.cancelAtPeriodEnd }, after: { cancelAtPeriodEnd: true } });
  return { cancelAtPeriodEnd: true };
}

export async function resumeSubscription() {
  const { ctx } = await requireAuthorization("billing:*");
  const current = await prisma.subscription.findUnique({ where: { organizationId: ctx.organization.id } });
  if (!current?.stripeSubscriptionId) throw new Error("No existe una suscripción vinculada.");
  await getStripe().subscriptions.update(current.stripeSubscriptionId, { cancel_at_period_end: false });
  await prisma.subscription.update({ where: { organizationId: ctx.organization.id }, data: { cancelAtPeriodEnd: false } });
  await logAuditEvent({ ctx, action: "cancel_reversed", module: "billing", recordId: current.id, before: { cancelAtPeriodEnd: current.cancelAtPeriodEnd }, after: { cancelAtPeriodEnd: false } });
  return { cancelAtPeriodEnd: false };
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
