import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import type { Plan, SubscriptionStatus } from "@prisma/client";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

function subscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (status === "trialing") return "TRIALING";
  if (status === "active") return "ACTIVE";
  if (status === "canceled") return "CANCELLED";
  if (status === "paused") return "PAUSED";
  return "PAST_DUE";
}

function subscriptionPlan(subscription: Stripe.Subscription): Plan {
  const metadataPlan = subscription.metadata.plan;
  if (metadataPlan === "STARTER" || metadataPlan === "GROWTH" || metadataPlan === "ENTERPRISE") return metadataPlan;
  const priceId = subscription.items.data[0]?.price.id;
  if (priceId && priceId === process.env.STRIPE_PRICE_GROWTH) return "GROWTH";
  if (priceId && priceId === process.env.STRIPE_PRICE_ENTERPRISE) return "ENTERPRISE";
  return "STARTER";
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const existing = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: subscription.id } });
  const organizationId = subscription.metadata.organizationId || existing?.organizationId;
  if (!organizationId) throw new Error(`Subscription ${subscription.id} has no organizationId metadata.`);
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
  if (!organization) throw new Error(`Organization ${organizationId} does not exist.`);
  const plan = subscriptionPlan(subscription);
  const data = {
    stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    stripeSubscriptionId: subscription.id,
    plan,
    status: subscriptionStatus(subscription.status),
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
  await prisma.$transaction([
    prisma.subscription.upsert({ where: { organizationId }, create: { organizationId, ...data }, update: data }),
    prisma.organization.update({ where: { id: organizationId }, data: { plan } }),
  ]);
}

async function syncInvoice(invoice: Stripe.Invoice) {
  const stripeSubscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
  if (!stripeSubscriptionId) return;
  const subscription = await prisma.subscription.findUnique({ where: { stripeSubscriptionId } });
  if (!subscription) return;
  await prisma.billingInvoice.upsert({
    where: { stripeInvoiceId: invoice.id },
    create: {
      organizationId: subscription.organizationId,
      subscriptionId: subscription.id,
      stripeInvoiceId: invoice.id,
      number: invoice.number,
      status: invoice.status ?? "draft",
      currency: invoice.currency,
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      periodStart: new Date(invoice.period_start * 1000),
      periodEnd: new Date(invoice.period_end * 1000),
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
    },
    update: {
      status: invoice.status ?? "draft",
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
      number: invoice.number,
    },
  });
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret || secret.includes("...")) return NextResponse.json({ error: "Stripe webhook is not configured" }, { status: 503 });
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Webhook signature invalid" }, { status: 400 });
  }

  try {
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") await syncSubscription(event.data.object);
    else if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      await prisma.subscription.updateMany({ where: { stripeSubscriptionId: subscription.id }, data: { status: "CANCELLED", cancelAtPeriodEnd: false } });
    } else if (["invoice.created", "invoice.finalized", "invoice.paid", "invoice.payment_failed"].includes(event.type)) {
      await syncInvoice(event.data.object as Stripe.Invoice);
    }
  } catch (error) {
    console.error("[stripe-webhook] sync failed:", error);
    return NextResponse.json({ error: "Webhook sync failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
