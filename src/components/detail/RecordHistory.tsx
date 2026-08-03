"use client";

import { useEffect, useState } from "react";
import { getRecordHistory } from "@/lib/actions/entity-history";
import { EntityTimeline, type TimelineEntry } from "@/components/detail/EntityTimeline";
import Skeleton from "@/components/ui/Skeleton";

/**
 * Historial de una entidad, cargado bajo demanda.
 *
 * Se pide al abrir la pestaña, no al abrir el detalle: la mayoría de las
 * veces el usuario mira los datos y se va sin llegar al historial, y esa
 * consulta recorre la tabla que más crece del sistema.
 *
 * En modo demo no hay rastro persistido, así que la acción devuelve una lista
 * vacía y se pinta el estado correspondiente en vez de un error.
 */
export function RecordHistory({
  permission,
  modules,
  recordId,
  emptyHint,
}: {
  permission: string;
  modules: string[];
  recordId: string;
  emptyHint?: string;
}) {
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null);

  useEffect(() => {
    let cancelado = false;
    setEntries(null);
    getRecordHistory({ permission, modules, recordId })
      .then((rows) => {
        if (!cancelado) setEntries(rows);
      })
      .catch(() => {
        // Sin permiso o sin rastro: se muestra vacío, no un error. El
        // historial es información secundaria del detalle.
        if (!cancelado) setEntries([]);
      });
    return () => {
      cancelado = true;
    };
  }, [permission, modules, recordId]);

  if (entries === null) {
    return (
      <div style={{ display: "grid", gap: 10 }} aria-busy="true">
        <Skeleton style={{ height: 44 }} />
        <Skeleton style={{ height: 44 }} />
        <Skeleton style={{ height: 44 }} />
      </div>
    );
  }

  return <EntityTimeline entries={entries} emptyHint={emptyHint} />;
}
