import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAppContext } from "@/lib/app-context";
import { detectLocale, LOCALE_COOKIE, normalizeLocale, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/messages";
import { canUseAI } from "@/lib/plan-entitlements";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPTS: Record<Locale, Record<string, string>> = {
  es: {
    gap: "Eres un experto consultor en sistemas de gestión ISO 9001 e ISO 27001. El usuario está realizando un GAP assessment. Proporciona un análisis claro, práctico y orientado a la acción. Responde en español, máximo 250 palabras, con 3 recomendaciones numeradas y priorizadas.",
    risk: "Eres un experto en gestión de riesgos ISO 27001 y ISO 9001. Analiza el riesgo descrito y sugiere el mejor tratamiento. Incluye controles específicos y referencias al Anexo A cuando aplique. Responde en español, máximo 200 palabras.",
    document: "Eres un redactor experto en documentación ISO. Genera un borrador profesional y completo del documento solicitado siguiendo las mejores prácticas. Responde en español, estructurado con secciones claras.",
    audit: "Eres un auditor experto ISO 9001 e ISO 27001. Resume los hallazgos de auditoría, identifica patrones y prioriza las acciones correctivas necesarias. Responde en español, máximo 250 palabras.",
    nc: "Eres un experto en CAPA (Corrective and Preventive Actions). Analiza la no conformidad, propón el análisis de causa raíz (usando los 5 porqués o diagrama de Ishikawa según convenga) y sugiere acciones correctivas eficaces. Responde en español, máximo 250 palabras.",
  },
  en: {
    gap: "You are an expert consultant in ISO 9001 and ISO 27001 management systems. The user is conducting a GAP assessment. Provide clear, practical, action-oriented analysis. Answer in English, maximum 250 words, with 3 numbered and prioritized recommendations.",
    risk: "You are an expert in ISO 27001 and ISO 9001 risk management. Analyze the described risk and suggest the best treatment. Include specific controls and Annex A references when applicable. Answer in English, maximum 200 words.",
    document: "You are an expert ISO documentation writer. Generate a professional and complete draft of the requested document following best practices. Answer in English with clear sections.",
    audit: "You are an expert ISO 9001 and ISO 27001 auditor. Summarize the audit findings, identify patterns, and prioritize required corrective actions. Answer in English, maximum 250 words.",
    nc: "You are an expert in CAPA (Corrective and Preventive Actions). Analyze the nonconformity, propose root cause analysis (using 5 Whys or Ishikawa where appropriate), and suggest effective corrective actions. Answer in English, maximum 250 words.",
  },
  "pt-BR": {
    gap: "Você é um consultor especialista em sistemas de gestão ISO 9001 e ISO 27001. O usuário está realizando um GAP assessment. Forneça uma análise clara, prática e orientada à ação. Responda em português do Brasil, com no máximo 250 palavras, em 3 recomendações numeradas e priorizadas.",
    risk: "Você é especialista em gestão de riscos ISO 27001 e ISO 9001. Analise o risco descrito e sugira o melhor tratamento. Inclua controles específicos e referências ao Anexo A quando aplicável. Responda em português do Brasil, com no máximo 200 palavras.",
    document: "Você é um redator especialista em documentação ISO. Gere um rascunho profissional e completo do documento solicitado seguindo boas práticas. Responda em português do Brasil, estruturado com seções claras.",
    audit: "Você é um auditor especialista ISO 9001 e ISO 27001. Resuma os achados de auditoria, identifique padrões e priorize as ações corretivas necessárias. Responda em português do Brasil, com no máximo 250 palavras.",
    nc: "Você é especialista em CAPA (ações corretivas e preventivas). Analise a não conformidade, proponha a análise de causa raiz (usando 5 Porquês ou Ishikawa quando adequado) e sugira ações corretivas eficazes. Responda em português do Brasil, com no máximo 250 palavras.",
  },
};

const MAX_MESSAGE_CHARS = 4000;

// Ventana deslizante en memoria por usuario. Suficiente para una instancia;
// si se escala horizontalmente, mover a Redis/Upstash.
const RATE_LIMIT = { windowMs: 60_000, maxRequests: 10 };
const requestLog = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT.windowMs;
  const entries = (requestLog.get(key) ?? []).filter((t) => t > cutoff);
  if (entries.length >= RATE_LIMIT.maxRequests) {
    requestLog.set(key, entries);
    return true;
  }
  entries.push(now);
  requestLog.set(key, entries);
  if (requestLog.size > 5000) {
    for (const [k, v] of requestLog) {
      if (v.every((t) => t <= cutoff)) requestLog.delete(k);
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  const requestLocale = detectLocale(
    req.cookies.get(LOCALE_COOKIE)?.value,
    req.headers.get("accept-language"),
  );

  try {
    const ctx = await getAppContext();
    if (!ctx || ctx.mode === "needs_organization") {
      return NextResponse.json({ error: translate(requestLocale, "ai.api.unauthorized") }, { status: 401 });
    }

    // El asistente IA está incluido en Growth/Enterprise y durante el trial.
    if (ctx.mode === "live") {
      if (!canUseAI(ctx.organization)) {
        return NextResponse.json(
          { error: translate(requestLocale, "ai.api.plan") },
          { status: 402 }
        );
      }
    }

    if (isRateLimited(`${ctx.organization.id}:${ctx.user.id}`)) {
      return NextResponse.json(
        { error: translate(requestLocale, "ai.api.rateLimited") },
        { status: 429 }
      );
    }

    const { message, context, locale: rawLocale } = await req.json();
    const locale = normalizeLocale(rawLocale ?? requestLocale);
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: translate(locale, "ai.api.messageRequired") }, { status: 400 });
    }

    const systemPrompt = SYSTEM_PROMPTS[locale][context] || SYSTEM_PROMPTS[locale].gap;

    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: "user", content: message.slice(0, MAX_MESSAGE_CHARS) }],
    });

    const text = response.content.find(b => b.type === "text")?.text || "";
    return NextResponse.json({ text });
  } catch (error) {
    console.error("AI API error:", error);
    if (error instanceof Anthropic.APIError && error.status === 401) {
      return NextResponse.json(
        { error: translate(requestLocale, "ai.api.invalidKey") },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: translate(requestLocale, "ai.api.processingError") }, { status: 500 });
  }
}
