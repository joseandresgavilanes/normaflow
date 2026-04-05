import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: "Webhook signature invalid" }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as any;
      await prisma.subscription.upsert({
        where: { stripeSubscriptionId: sub.id },
        create: {
          stripeSubscriptionId: sub.id,
          stripeCustomerId: sub.customer,
          status: sub.status.toUpperCase(),
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          organizationId: sub.metadata.organizationId,
        },
        update: {
          status: sub.status.toUpperCase(),
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
      });
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as any;
      await prisma.subscription.update({
        where: { stripeSubscriptionId: sub.id },
        data: { status: "CANCELLED" },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
