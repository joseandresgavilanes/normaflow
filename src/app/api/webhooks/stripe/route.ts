import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { subscriptionPlan, subscriptionStatus } from "@/lib/stripe-webhook";

async function syncSubscription(subscription: Stripe.Subscription) {
  const existing = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: subscription.id } });
  const organizationId = subscription.metadata.organizationId || existing?.organizationId;
  if (!organizationId) throw new Error(`Subscription ${subscription.id} has no organizationId metadata.`);
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
  if (!organization) throw new Error(`Organization ${organizationId} does not exist.`);
  const plan = subscriptionPlan(subscription);
  const rawStatus = subscriptionStatus(subscription.status);
  const mappedStatus = rawStatus === "PAST_DUE" ? "GRACE_PERIOD" : rawStatus;
  const gracePeriodEndsAt = mappedStatus === "GRACE_PERIOD" ? existing?.gracePeriodEndsAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null;
  const data = {
    stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    stripeSubscriptionId: subscription.id,
    plan,
    status: mappedStatus,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    gracePeriodEndsAt,
    suspendedAt: mappedStatus === "SUSPENDED" ? existing?.suspendedAt ?? new Date() : null,
    lastPaymentFailedAt: existing?.lastPaymentFailedAt ?? null,
  };
  await prisma.$transaction(async (tx) => {
    await tx.subscription.upsert({ where: { organizationId }, create: { organizationId, ...data }, update: data });
    await tx.organization.update({ where: { id: organizationId }, data: { plan } });
    await tx.auditLog.create({ data: { organizationId, action: "subscription_sync", module: "billing", recordId: subscription.id, metadata: { before: { status: existing?.status ?? null, plan: existing?.plan ?? null }, after: { status: mappedStatus, plan, cancelAtPeriodEnd: subscription.cancel_at_period_end } } } });
  });
}

async function syncCheckoutSession(session: Stripe.Checkout.Session) {
  const organizationId = session.metadata?.organizationId;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!organizationId || !subscriptionId) return;
  await prisma.subscription.updateMany({
    where: { organizationId },
    data: { stripeCustomerId: customerId ?? undefined, stripeSubscriptionId: subscriptionId },
  });
}

async function syncInvoice(invoice: Stripe.Invoice, eventType: string) {
  const stripeSubscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
  if (!stripeSubscriptionId) return;
  const subscription = await prisma.subscription.findUnique({ where: { stripeSubscriptionId } });
  if (!subscription) return;
  await prisma.$transaction(async (tx) => {
    const paymentFailed = eventType === "invoice.payment_failed";
    const paid = eventType === "invoice.paid";
    await tx.billingInvoice.upsert({
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
    if (paymentFailed) {
      await tx.subscription.update({ where: { id: subscription.id }, data: { status: "GRACE_PERIOD", gracePeriodEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), lastPaymentFailedAt: new Date() } });
      await tx.auditLog.create({ data: { organizationId: subscription.organizationId, action: "payment_failed", module: "billing", recordId: subscription.id, metadata: { before: { status: subscription.status }, after: { status: "GRACE_PERIOD" }, invoiceId: invoice.id } } });
    } else if (paid) {
      await tx.subscription.update({ where: { id: subscription.id }, data: { status: "ACTIVE", gracePeriodEndsAt: null, suspendedAt: null, lastPaymentFailedAt: null } });
      await tx.organization.update({ where: { id: subscription.organizationId }, data: { plan: subscription.plan } });
      await tx.auditLog.create({ data: { organizationId: subscription.organizationId, action: "payment_succeeded", module: "billing", recordId: subscription.id, metadata: { before: { status: subscription.status }, after: { status: "ACTIVE" }, invoiceId: invoice.id } } });
    }
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

  let inbox = await prisma.stripeWebhookEvent.findUnique({ where: { eventId: event.id } });
  if (inbox?.processedAt) return NextResponse.json({ received: true, duplicate: true });
  if (!inbox) {
    try {
      inbox = await prisma.stripeWebhookEvent.create({
        data: { eventId: event.id, type: event.type, payload: event.data.object as unknown as Prisma.InputJsonValue },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      inbox = await prisma.stripeWebhookEvent.findUnique({ where: { eventId: event.id } });
      if (inbox?.processedAt) return NextResponse.json({ received: true, duplicate: true });
    }
  } else {
    await prisma.stripeWebhookEvent.update({ where: { id: inbox.id }, data: { attempts: { increment: 1 }, lastError: null } });
  }

  try {
    if (event.type === "checkout.session.completed") await syncCheckoutSession(event.data.object);
    else if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") await syncSubscription(event.data.object);
    else if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const existing = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: subscription.id }, select: { organizationId: true } });
      await prisma.$transaction([
        prisma.subscription.updateMany({ where: { stripeSubscriptionId: subscription.id }, data: { status: "CANCELLED", cancelAtPeriodEnd: false, stripeSubscriptionId: null } }),
        ...(existing ? [prisma.organization.update({ where: { id: existing.organizationId }, data: { plan: "STARTER" } })] : []),
      ]);
    } else if (["invoice.created", "invoice.finalized", "invoice.paid", "invoice.payment_failed"].includes(event.type)) {
      await syncInvoice(event.data.object as Stripe.Invoice, event.type);
    }
    await prisma.stripeWebhookEvent.update({ where: { id: inbox!.id }, data: { processedAt: new Date(), lastError: null } });
  } catch (error) {
    console.error("[stripe-webhook] sync failed:", error);
    await prisma.stripeWebhookEvent.update({ where: { id: inbox!.id }, data: { lastError: error instanceof Error ? error.message : "Webhook sync failed" } }).catch(() => undefined);
    return NextResponse.json({ error: "Webhook sync failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
