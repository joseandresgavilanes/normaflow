"use client";

import { useMemo, useState } from "react";

type Correspondence = {
  id: string;
  sourceFamily: string;
  sourceCode: string;
  sourceTitle: string;
  targetFamily: string;
  targetCode: string;
  targetTitle: string;
  relationType: string;
  equivalencePercent: number | null;
};

/**
 * Matriz visual de correspondencias entre normas.
 *
 * Se dibuja SOLO con los pares que existen en `requirement_mappings`. Es una
 * decisión, no una limitación: el catálogo tiene 170 correspondencias, pero 69
 * están concentradas en el triángulo ISO 9001 / 14001 / 45001 y el resto son
 * radiales hacia 9001. Un diagrama que insinuara equivalencia entre, por
 * ejemplo, ISO 13485 y ISO 45001 estaría inventando una relación que nadie ha
 * declarado — y en un sistema de gestión certificable eso es un hallazgo.
 *
 * Las celdas sin datos dicen "sin correspondencia declarada", que es distinto
 * de "no hay correspondencia posible".
 */
export function CrosswalkMatrix({
  correspondence,
  onSelectPair,
}: {
  correspondence: Correspondence[];
  onSelectPair?: (source: string, target: string) => void;
}) {
  const [par, setPar] = useState<{ source: string; target: string } | null>(null);

  const { familias, celdas, total } = useMemo(() => {
    const set = new Set<string>();
    for (const c of correspondence) {
      set.add(c.sourceFamily);
      set.add(c.targetFamily);
    }
    const familias = [...set].sort();

    // La relación es simétrica para el lector: si 9001→14001 tiene 21 pares,
    // 14001→9001 describe lo mismo. Se cuenta en las dos direcciones para que
    // la matriz no parezca medio vacía por el orden en que se cargó el pack.
    const celdas = new Map<string, { n: number; media: number | null }>();
    const acumulado = new Map<string, { n: number; suma: number; conPorcentaje: number }>();
    for (const c of correspondence) {
      for (const clave of [`${c.sourceFamily}|${c.targetFamily}`, `${c.targetFamily}|${c.sourceFamily}`]) {
        const actual = acumulado.get(clave) ?? { n: 0, suma: 0, conPorcentaje: 0 };
        actual.n += 1;
        if (typeof c.equivalencePercent === "number") {
          actual.suma += c.equivalencePercent;
          actual.conPorcentaje += 1;
        }
        acumulado.set(clave, actual);
      }
    }
    for (const [clave, v] of acumulado) {
      celdas.set(clave, { n: v.n, media: v.conPorcentaje ? Math.round(v.suma / v.conPorcentaje) : null });
    }
    return { familias, celdas, total: correspondence.length };
  }, [correspondence]);

  const detalle = useMemo(() => {
    if (!par) return [];
    return correspondence.filter(
      (c) =>
        (c.sourceFamily === par.source && c.targetFamily === par.target) ||
        (c.sourceFamily === par.target && c.targetFamily === par.source),
    );
  }, [correspondence, par]);

  if (familias.length === 0) return null;

  return (
    <div className="nf-crosswalk">
      <div className="nf-crosswalk__intro">
        <p>
          <strong>{total}</strong> correspondencias declaradas entre {familias.length} familias de
          normas. Cada celda cuenta los requisitos emparejados; el porcentaje es la equivalencia
          media declarada en el pack.
        </p>
        <p className="nf-crosswalk__caveat">
          Las celdas vacías significan que no hay correspondencia declarada en el catálogo, no que
          las normas no se puedan relacionar.
        </p>
      </div>

      <div className="nf-crosswalk__scroll">
        <table className="nf-crosswalk__table">
          <caption className="nf-sr-only">
            Matriz de correspondencias entre familias de normas. Cada celda indica cuántos
            requisitos están emparejados y su equivalencia media.
          </caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="nf-sr-only">Norma de origen</span>
              </th>
              {familias.map((f) => (
                <th scope="col" key={f}>
                  {f}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {familias.map((fila) => (
              <tr key={fila}>
                <th scope="row">{fila}</th>
                {familias.map((columna) => {
                  if (fila === columna) {
                    return (
                      <td key={columna} className="nf-crosswalk__cell" data-self="">
                        <span aria-hidden="true">—</span>
                        <span className="nf-sr-only">la misma norma</span>
                      </td>
                    );
                  }
                  const celda = celdas.get(`${fila}|${columna}`);
                  if (!celda) {
                    return (
                      <td key={columna} className="nf-crosswalk__cell" data-empty="">
                        <span className="nf-sr-only">sin correspondencia declarada</span>
                      </td>
                    );
                  }
                  // La densidad se codifica también en el número, no solo en el
                  // tono: el color por sí solo no es un indicador válido.
                  const densidad = celda.n >= 20 ? "alta" : celda.n >= 8 ? "media" : "baja";
                  const activa = par?.source === fila && par?.target === columna;
                  return (
                    <td key={columna} className="nf-crosswalk__cell" data-density={densidad}>
                      <button
                        type="button"
                        className="nf-crosswalk__button"
                        aria-pressed={activa}
                        onClick={() => {
                          setPar(activa ? null : { source: fila, target: columna });
                          onSelectPair?.(fila, columna);
                        }}
                      >
                        <span className="nf-crosswalk__count nf-tabular">{celda.n}</span>
                        {celda.media !== null && (
                          <span className="nf-crosswalk__percent nf-tabular">{celda.media}%</span>
                        )}
                        <span className="nf-sr-only">
                          {celda.n} requisitos emparejados entre {fila} y {columna}
                          {celda.media !== null ? `, equivalencia media ${celda.media}%` : ""}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {par && (
        <section className="nf-crosswalk__detail" aria-live="polite">
          <h3>
            {par.source} ⇄ {par.target} · {detalle.length}{" "}
            {detalle.length === 1 ? "correspondencia" : "correspondencias"}
          </h3>
          <ul>
            {detalle.map((c) => (
              <li key={c.id}>
                <span className="nf-crosswalk__pair nf-tabular">
                  {c.sourceCode} ⇄ {c.targetCode}
                </span>
                <span className="nf-crosswalk__relation">{c.relationType}</span>
                {typeof c.equivalencePercent === "number" && (
                  <span className="nf-crosswalk__percent nf-tabular">{c.equivalencePercent}%</span>
                )}
                <span className="nf-crosswalk__titles">
                  {c.sourceTitle} / {c.targetTitle}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
