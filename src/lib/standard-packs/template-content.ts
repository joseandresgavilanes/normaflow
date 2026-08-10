import type { TemplateType } from "@prisma/client";

type PackTemplateContentInput = {
  familyCode: string;
  requirementCode?: string;
  templateType: TemplateType;
  name: string;
  content?: string;
};

const header = (input: PackTemplateContentInput) => `# ${input.name.replace(/\s*\(plantilla\)\s*$/i, "")}

**Organización:** {{ORGANIZATION_NAME}} · **Código:** {{DOCUMENT_CODE}} · **Versión:** {{VERSION}}
**Norma:** ${input.familyCode.replaceAll("_", " ")} · **Requisito:** ${input.requirementCode ?? "[Definir]"}
**Alcance:** {{SYSTEM_SCOPE}} · **Responsable:** {{OWNER_NAME}} · **Aprobador:** {{APPROVER_NAME}}
`;

const policyBody = (input: PackTemplateContentInput) => {
  const aimsCommitments = input.familyCode === "ISO_42001"
    ? `
- Usar los sistemas de IA de forma lícita, responsable y coherente con los requisitos aplicables.
- Limitar cada sistema de IA a propósitos beneficiosos, definidos y documentados.
- Mantener supervisión humana efectiva, con autoridad para detener, corregir o rechazar resultados.
- Mejorar continuamente el sistema de gestión de IA, sus controles y su desempeño.`
    : "";
  return `## Declaración

La dirección establece esta política para el alcance indicado y asegura su disponibilidad, comunicación y revisión periódica.

## Compromisos

- Cumplir los requisitos legales, reglamentarios, contractuales y organizacionales aplicables.
- Gestionar riesgos y oportunidades con criterios aprobados y evidencia trazable.
- Asignar responsabilidades, competencias y recursos suficientes.
- Medir el desempeño, tratar desviaciones y mejorar continuamente.${aimsCommitments}

## Gobierno y seguimiento

Los objetivos, indicadores, responsables, excepciones y acciones derivadas se registran en NormaFlow. La dirección revisa la vigencia de esta política al menos anualmente y ante cambios significativos.
`;
};

const procedureBody = `## Objetivo y alcance

Definir el propósito, las entradas, las salidas, los límites y las exclusiones justificadas de este procedimiento.

## Roles y segregación de funciones

| Rol | Responsabilidad | Autoridad de aprobación |
|---|---|---|
| Responsable | Ejecutar y conservar registros | No, salvo autorización expresa |
| Revisor | Verificar integridad y criterios | Recomienda |
| Aprobador | Aceptar, rechazar o solicitar cambios | Sí |

## Flujo operativo

1. Registrar la solicitud, evento o necesidad con fecha, origen y alcance.
2. Validar datos, requisitos aplicables y conflictos de interés.
3. Evaluar riesgos, controles, recursos y criterios de aceptación.
4. Ejecutar las actividades y adjuntar evidencia objetiva.
5. Revisar y aprobar con identidad, fecha y justificación.
6. Comunicar el resultado, dar seguimiento y cerrar solo con evidencia suficiente.

## Controles y registros

Conservar responsables, fechas, decisiones, versiones, evidencias, excepciones, acciones y verificación de eficacia. Escalar incumplimientos, incidentes o vencimientos según el workflow aplicable.
`;

const recordBody = `## Identificación

| Campo | Valor |
|---|---|
| Fecha y periodo | [Completar] |
| Proceso / activo / producto | [Completar] |
| Responsable | {{OWNER_NAME}} |
| Estado | Borrador |

## Datos y evaluación

| Ítem | Criterio o requisito | Resultado | Evidencia | Responsable | Fecha |
|---|---|---|---|---|---|
| 1 | [Completar] | [Completar] | [Enlace o ID] | [Completar] | [Completar] |

## Decisión y seguimiento

Documentar conclusión, riesgo residual, desviaciones, acciones, responsable, fecha objetivo y criterio de cierre. Toda aprobación o rechazo debe incluir identidad, fecha y justificación.
`;

const checklistBody = `## Instrucciones

Evaluar cada punto con evidencia objetiva. Marcar **Conforme**, **Parcial**, **No conforme** o **No aplicable**; justificar toda no aplicabilidad.

| # | Pregunta / criterio | Estado | Evidencia | Hallazgo / acción | Responsable |
|---:|---|---|---|---|---|
| 1 | [Completar] | [Completar] | [Enlace o ID] | [Completar] | [Completar] |

## Cierre

Registrar alcance, participantes, conclusiones, hallazgos, acciones y aprobación final.
`;

/** Materializes NormaFlow-owned, editable starter content without reproducing protected standard text. */
export function materializePackTemplateContent(input: PackTemplateContentInput): string {
  const authored = input.content?.trim();
  if (authored && authored.length >= 300) return authored;
  const body = input.templateType === "POLICY"
    ? policyBody(input)
    : input.templateType === "PROCEDURE"
      ? procedureBody
      : input.templateType === "CHECKLIST" || input.templateType === "GAP"
        ? checklistBody
        : recordBody;
  const packSpecificGuidance = authored ? `## Instrucción específica del pack\n\n${authored}\n\n` : "";
  return `${header(input)}\n${packSpecificGuidance}${body}\n**Fecha de vigencia:** {{EFFECTIVE_DATE}}\n`;
}

export function packTemplateDocumentType(type: TemplateType): "POLICY" | "PROCEDURE" | "RECORD" | "FORM" {
  if (type === "POLICY" || type === "PROCEDURE" || type === "RECORD") return type;
  return "FORM" as const;
}
