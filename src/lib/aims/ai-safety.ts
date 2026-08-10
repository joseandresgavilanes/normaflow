/**
 * Salvaguardas de seguridad sobre las entradas/salidas del asistente de IA
 * (ISO/IEC 42001 — riesgos de sesgo, privacidad y seguridad de sistemas de IA).
 *
 * Puro y testable — sin acceso a base de datos. Tres capas independientes:
 *   1. `detectPII`/`redactPII` — datos personales (email, teléfono, tarjeta,
 *      documento de identidad) que no deberían persistirse ni registrarse en
 *      claro fuera del propio registro de gobierno de la salida de IA.
 *   2. `detectSecrets`/`redactSecrets` — credenciales que un usuario pudo
 *      pegar por error en un prompt (claves de API, tokens, claves privadas).
 *   3. `detectPromptInjection` — heurística de intentos de anular el system
 *      prompt o extraer instrucciones; no bloquea la llamada (falsos positivos
 *      son comunes), pero marca la salida para revisión humana reforzada.
 *
 * Ninguna de estas funciones decide si una llamada procede: eso lo hace la
 * ruta que las invoca (rate limit, presupuesto, plan). Aquí solo se clasifica
 * y se redacta texto.
 */

export type PIICategory = "EMAIL" | "PHONE" | "CREDIT_CARD" | "NATIONAL_ID" | "IP_ADDRESS";
export type SecretCategory = "API_KEY" | "AWS_KEY" | "PRIVATE_KEY" | "JWT" | "GENERIC_TOKEN";

const PII_PATTERNS: Record<PIICategory, RegExp> = {
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  PHONE: /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g,
  CREDIT_CARD: /\b(?:\d[ -]?){13,19}\b/g,
  NATIONAL_ID: /\b[A-Z]{1,3}[- ]?\d{6,9}[A-Z]?\b/g,
  IP_ADDRESS: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
};

const SECRET_PATTERNS: Record<SecretCategory, RegExp> = {
  API_KEY: /\b(sk|pk|rk)-[A-Za-z0-9]{20,}\b/g,
  AWS_KEY: /\bAKIA[0-9A-Z]{16}\b/g,
  PRIVATE_KEY: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END \1PRIVATE KEY-----/g,
  JWT: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  GENERIC_TOKEN: /\b(ghp|gho|ghu|ghs|github_pat|xox[baprs])-?[A-Za-z0-9_-]{16,}\b/g,
};

/** Reduces a Luhn-invalid 13-19 digit run of false positives for CREDIT_CARD. */
function luhnValid(digits: string): boolean {
  const clean = digits.replace(/[ -]/g, "");
  if (clean.length < 13 || clean.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let n = Number(clean[i]);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export type PIIDetection = { found: boolean; categories: PIICategory[] };

export function detectPII(text: string): PIIDetection {
  const categories: PIICategory[] = [];
  for (const [category, pattern] of Object.entries(PII_PATTERNS) as [PIICategory, RegExp][]) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (!matches) continue;
    if (category === "CREDIT_CARD" && !matches.some(luhnValid)) continue;
    categories.push(category);
  }
  return { found: categories.length > 0, categories };
}

/** Replaces detected PII with a category placeholder; never mutates in place. */
export function redactPII(text: string): string {
  let out = text;
  for (const [category, pattern] of Object.entries(PII_PATTERNS) as [PIICategory, RegExp][]) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, (match) => (category === "CREDIT_CARD" && !luhnValid(match) ? match : `[REDACTED:${category}]`));
  }
  return out;
}

export type SecretDetection = { found: boolean; categories: SecretCategory[] };

export function detectSecrets(text: string): SecretDetection {
  const categories: SecretCategory[] = [];
  for (const [category, pattern] of Object.entries(SECRET_PATTERNS) as [SecretCategory, RegExp][]) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) categories.push(category);
  }
  return { found: categories.length > 0, categories };
}

export function redactSecrets(text: string): string {
  let out = text;
  for (const [category, pattern] of Object.entries(SECRET_PATTERNS) as [SecretCategory, RegExp][]) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, `[REDACTED:${category}]`);
  }
  return out;
}

/** Convenience: apply both PII and secret redaction, e.g. before structured logging. */
export function redactSensitive(text: string): string {
  return redactSecrets(redactPII(text));
}

const INJECTION_PHRASES = [
  /ignore (all |any )?(previous|prior|above) (instructions|prompts?)/i,
  /disregard (the |your )?(system prompt|instructions|rules)/i,
  /you are now/i,
  /act as (if you are|a|an)/i,
  /reveal (your|the) (system prompt|instructions)/i,
  /repeat (the|your) (system prompt|instructions) (verbatim|exactly)/i,
  /pretend (you are|to be)/i,
  /jailbreak/i,
  /ignora(r)? (las )?(instrucciones|reglas) (anteriores|previas|del sistema)/i,
  /olvida (las )?instrucciones/i,
  /actúa como si/i,
  /revela (tu|el) (system prompt|las instrucciones)/i,
  /finge (ser|que eres)/i,
] as const;

export type PromptInjectionCheck = { suspicious: boolean; reasons: string[] };

/**
 * Heuristic only — flags a prompt for reinforced human review, never blocks
 * the call outright (false positives on legitimate "act as a consultant"
 * requests are common in this product). Paired with the fixed, non-interpolated
 * system prompts in `/api/ai/route.ts` as the first line of defense.
 */
export function detectPromptInjection(text: string): PromptInjectionCheck {
  const reasons: string[] = [];
  for (const pattern of INJECTION_PHRASES) {
    if (pattern.test(text)) reasons.push(pattern.source);
  }
  return { suspicious: reasons.length > 0, reasons };
}
