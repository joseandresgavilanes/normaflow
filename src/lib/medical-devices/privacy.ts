/**
 * Controles de privacidad para QMS de dispositivos médicos.
 * No almacenar información clínica personal innecesaria.
 */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const LONG_DIGIT_RE = /\b\d{8,}\b/;
const SENSITIVE_KEYWORDS = [
  /historia\s*cl[ií]nica/i,
  /\bssn\b/i,
  /\bdni\b/i,
  /\bpasaporte\b/i,
  /n[uú]mero\s*de\s*seguro/i,
  /fecha\s*de\s*nacimiento/i,
  /\bMRN\b/,
];

export function assertNoUnnecessaryPersonalData(input: {
  description?: string | null;
  investigationSummary?: string | null;
  findings?: string | null;
  anonymizedSubjectRef?: string | null;
  fieldLabel?: string;
}): void {
  const chunks = [
    input.description,
    input.investigationSummary,
    input.findings,
    input.anonymizedSubjectRef,
  ].filter(Boolean) as string[];

  for (const text of chunks) {
    if (EMAIL_RE.test(text)) {
      throw new Error(
        "No se permite almacenar correos electrónicos en registros de vigilancia/quejas. Use una referencia opaca.",
      );
    }
    if (LONG_DIGIT_RE.test(text)) {
      throw new Error(
        "No se permiten secuencias numéricas largas (posibles identificadores personales) en estos campos.",
      );
    }
    for (const re of SENSITIVE_KEYWORDS) {
      if (re.test(text)) {
        throw new Error(
          "El texto parece contener datos clínicos o de identificación personal. No almacene información clínica personal innecesaria.",
        );
      }
    }
  }

  if (input.anonymizedSubjectRef) {
    const ref = input.anonymizedSubjectRef.trim();
    if (ref.includes(" ") && ref.length > 40) {
      throw new Error("anonymizedSubjectRef debe ser una referencia opaca corta (p. ej. CASE-0001).");
    }
  }
}

export function assertOpaqueSubjectRef(ref: string | null | undefined): void {
  if (!ref) return;
  assertNoUnnecessaryPersonalData({ anonymizedSubjectRef: ref });
}
