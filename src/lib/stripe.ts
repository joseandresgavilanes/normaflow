import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
  typescript: true,
});

export const PLANS = {
  STARTER: {
    name: "Starter",
    price: 99,
    priceId: process.env.STRIPE_PRICE_STARTER!,
    features: ["5 usuarios", "Módulos básicos", "5 GB", "Soporte email"],
    limits: { users: 5, storage: 5 },
  },
  GROWTH: {
    name: "Growth",
    price: 299,
    priceId: process.env.STRIPE_PRICE_GROWTH!,
    features: ["50 usuarios", "Todos los módulos", "IA incluida", "25 GB", "Soporte prioritario"],
    limits: { users: 50, storage: 25 },
  },
  ENTERPRISE: {
    name: "Enterprise",
    price: null,
    priceId: process.env.STRIPE_PRICE_ENTERPRISE!,
    features: ["Usuarios ilimitados", "Multi-org", "100 GB", "SLA 99.9%", "Soporte dedicado"],
    limits: { users: -1, storage: 100 },
  },
} as const;
