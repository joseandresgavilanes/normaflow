import type Stripe from "stripe";
import type { Plan, SubscriptionStatus } from "@prisma/client";
import { PLANS } from "@/lib/stripe";

export function subscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (status === "trialing") return "TRIALING";
  if (status === "active") return "ACTIVE";
  if (status === "canceled") return "CANCELLED";
  if (status === "paused") return "PAUSED";
  return "PAST_DUE";
}

export function subscriptionPlan(subscription: Pick<Stripe.Subscription, "metadata" | "items">): Plan {
  const metadataPlan = subscription.metadata.plan;
  if (metadataPlan === "STARTER" || metadataPlan === "GROWTH" || metadataPlan === "ENTERPRISE") return metadataPlan;
  const priceId = subscription.items.data[0]?.price.id;
  if (priceId && priceId === PLANS.GROWTH.priceId) return "GROWTH";
  if (priceId && priceId === PLANS.ENTERPRISE.priceId) return "ENTERPRISE";
  return "STARTER";
}
