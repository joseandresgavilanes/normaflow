import { RiskStatus, RiskTreatment } from "@prisma/client";

/**
 * Lo que cada tratamiento exige antes de dar el riesgo por resuelto.
 *
 * Elegir «Mitigar», «Aceptar», «Transferir» o «Evitar» no cambiaba nada: se
 * guardaba la palabra, salía en la tabla y ahí moría. Un riesgo podía pasar a
 * «Mitigado» sin un solo control, y a «Aceptado» sin que nadie dijera por qué
 * ni firmara la decisión, que es justo lo que un auditor pide ver.
 *
 * Mitigar se cierra con hechos —al menos un control o una acción, y el riesgo
 * residual valorado—; las otras tres se cierran con una decisión firmada, que
 * es lo único que las distingue de no hacer nada.
 *
 * Vive fuera de `actions/operations.ts` porque un módulo `"use server"` solo
 * puede exportar funciones async, y esto lo necesitan las dos partes: el
 * servidor para impedir el cambio y la pantalla para decir qué falta antes de
 * que alguien pulse.
 */

export const TREATMENT_LABELS: Record<RiskTreatment, string> = {
  MITIGATE: "Mitigar",
  ACCEPT: "Aceptar",
  TRANSFER: "Transferir",
  AVOID: "Evitar",
};

export type RiskTreatmentDecision = {
  treatment: RiskTreatment;
  residualScore: number | null;
  treatmentJustification: string | null;
};

export function riskTreatmentGaps(
  risk: RiskTreatmentDecision,
  target: RiskStatus,
  counts: { controls: number; actions: number },
): string[] {
  const gaps: string[] = [];

  if (target === RiskStatus.MITIGATED) {
    if (risk.treatment !== RiskTreatment.MITIGATE) {
      return [`el tratamiento elegido es «${TREATMENT_LABELS[risk.treatment]}»: solo un riesgo que se mitiga puede darse por mitigado`];
    }
    if (!counts.controls && !counts.actions) gaps.push("registra al menos un control o una acción que lo mitigue");
    if (risk.residualScore == null) gaps.push("valora el riesgo residual que queda tras el tratamiento");
  }

  if (target === RiskStatus.ACCEPTED) {
    if (risk.treatment === RiskTreatment.MITIGATE) {
      return ["cambia el tratamiento a Aceptar, Transferir o Evitar antes de aceptarlo"];
    }
    if (!risk.treatmentJustification?.trim()) {
      gaps.push(`justifica la decisión de ${TREATMENT_LABELS[risk.treatment].toLowerCase()} este riesgo`);
    }
  }

  return gaps;
}
