import { NextRequest, NextResponse } from "next/server";

type Bucket = { hits: number[] };
const buckets = new Map<string, Bucket>();

/** In-memory fallback. Deployments with multiple instances should set RATE_LIMIT_REDIS_URL and replace this adapter. */
export function takeRateLimit(key: string, { limit, windowMs }: { limit: number; windowMs: number }) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((time) => time > cutoff);
  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.hits[0] + windowMs - now) / 1000)) };
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  if (buckets.size > 10_000) for (const [candidate, value] of buckets) if (!value.hits.length || value.hits.at(-1)! < cutoff) buckets.delete(candidate);
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clientAddress(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export function rateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json({ error: "Demasiadas solicitudes. Inténtalo de nuevo en unos minutos." }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } });
}
