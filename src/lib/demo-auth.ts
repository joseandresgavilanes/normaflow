import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "nf_demo";

export function signDemoSession(email: string, secret: string): string {
  const exp = Date.now() + 7 * 24 * 3600 * 1000;
  const payload = Buffer.from(JSON.stringify({ email, exp })).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyDemoSession(token: string, secret: string): string | null {
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: string; exp?: number };
    if (!data.email || typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data.email;
  } catch {
    return null;
  }
}

export const demoCookieName = COOKIE_NAME;
