"use client";

import { useMemo, useState } from "react";
import { ModalField } from "@/components/ui/ModalForm";
import Picker from "@/components/ui/Picker";

export type PickerClause = { id: string; standardCode: string; code: string; title?: string | null };

/**
 * Cláusula aplicable, en dos pasos.
 *
 * Un solo desplegable con TODAS las cláusulas de todas las normas activas
 * llega a varios cientos de entradas —trece normas por unos cuarenta
 * requisitos cada una—, todas con la misma forma («ISO 9001 · 8.5.1 — …»).
 * Encontrar la tuya ahí es leer el listado entero.
 *
 * Primero se elige la norma y la segunda lista se reduce a sus cláusulas. En
 * los modales de CAPA y evidencias ya había un selector de norma al lado, pero
 * no filtraba nada: prometía acotar y no acotaba.
 */
export default function ClausePicker({
  clauses,
  defaultClauseId = "",
  clauseName = "clauseId",
  standardName,
  labelStandard = "Norma",
  labelClause = "Cláusula aplicable",
  inputClassName = "nf-app-input",
  inputStyle,
}: {
  clauses: readonly PickerClause[];
  defaultClauseId?: string;
  clauseName?: string;
  /** Si el formulario también espera el código de norma, su `name`. */
  standardName?: string;
  labelStandard?: string;
  labelClause?: string;
  inputClassName?: string;
  inputStyle?: React.CSSProperties;
}) {
  const standards = useMemo(() => {
    const codes = new Map<string, number>();
    clauses.forEach((clause) => codes.set(clause.standardCode, (codes.get(clause.standardCode) ?? 0) + 1));
    return [...codes.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [clauses]);

  // Al editar, la norma se deduce de la cláusula ya guardada: si no, el usuario
  // abriría el formulario con la segunda lista vacía y su cláusula "perdida".
  // Con una sola norma implantada no hay nada que preguntar: se da por elegida.
  const initialStandard =
    clauses.find((clause) => clause.id === defaultClauseId)?.standardCode
    ?? (standards.length === 1 ? standards[0][0] : "");
  const [standard, setStandard] = useState(initialStandard);
  const [clauseId, setClauseId] = useState(defaultClauseId);

  const visible = useMemo(
    () => (standard ? clauses.filter((clause) => clause.standardCode === standard) : []),
    [clauses, standard],
  );

  return (
    <>
      {standards.length > 1 ? (
        <ModalField label={labelStandard} hint="Acota la lista de cláusulas.">
          <Picker
            aria-label={labelStandard}
            searchPlaceholder="Buscar norma…"
            name={standardName}
            className={inputClassName}
            style={inputStyle}
            value={standard}
            onChange={(event) => {
              setStandard(event.target.value);
              // La cláusula anterior pertenece a otra norma: dejarla puesta
              // guardaría una referencia que no corresponde con lo elegido.
              setClauseId("");
            }}
          >
            <option value="">— Elegir norma —</option>
            {standards.map(([code, count]) => (
              <option key={code} value={code}>{code.replaceAll("_", " ")} ({count})</option>
            ))}
          </Picker>
        </ModalField>
      ) : (
        standardName && <input type="hidden" name={standardName} value={standard} />
      )}

      <ModalField label={labelClause}>
        <Picker
          aria-label={labelClause}
          searchPlaceholder="Buscar cláusula…"
          invalidMessage="Elige una cláusula."
          name={clauseName}
          className={inputClassName}
          style={inputStyle}
          value={clauseId}
          disabled={!standard}
          onChange={(event) => setClauseId(event.target.value)}
        >
          <option value="">
            {standards.length === 0 ? "Sin cláusulas disponibles" : standard ? "— Sin cláusula —" : "Elige primero una norma"}
          </option>
          {visible.map((clause) => (
            <option key={clause.id} value={clause.id}>
              {clause.code}{clause.title ? ` — ${clause.title}` : ""}
            </option>
          ))}
        </Picker>
      </ModalField>
    </>
  );
}
