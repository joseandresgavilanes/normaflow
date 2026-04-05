import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPTS: Record<string, string> = {
  gap: "Eres un experto consultor en sistemas de gestión ISO 9001 e ISO 27001. El usuario está realizando un GAP assessment. Proporciona un análisis claro, práctico y orientado a la acción. Responde en español, máximo 250 palabras, con 3 recomendaciones numeradas y priorizadas.",
  risk: "Eres un experto en gestión de riesgos ISO 27001 y ISO 9001. Analiza el riesgo descrito y sugiere el mejor tratamiento. Incluye controles específicos y referencias al Anexo A cuando aplique. Responde en español, máximo 200 palabras.",
  document: "Eres un redactor experto en documentación ISO. Genera un borrador profesional y completo del documento solicitado siguiendo las mejores prácticas. Responde en español, estructurado con secciones claras.",
  audit: "Eres un auditor experto ISO 9001 e ISO 27001. Resume los hallazgos de auditoría, identifica patrones y prioriza las acciones correctivas necesarias. Responde en español, máximo 250 palabras.",
  nc: "Eres un experto en CAPA (Corrective and Preventive Actions). Analiza la no conformidad, propón el análisis de causa raíz (usando los 5 porqués o diagrama de Ishikawa según convenga) y sugiere acciones correctivas eficaces. Responde en español, máximo 250 palabras.",
};

export async function POST(req: NextRequest) {
  try {
    const { message, context } = await req.json();
    if (!message) return NextResponse.json({ error: "Message required" }, { status: 400 });

    const systemPrompt = SYSTEM_PROMPTS[context] || SYSTEM_PROMPTS.gap;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: "user", content: message }],
    });

    const text = response.content.find(b => b.type === "text")?.text || "";
    return NextResponse.json({ text });
  } catch (error) {
    console.error("AI API error:", error);
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 });
  }
}
