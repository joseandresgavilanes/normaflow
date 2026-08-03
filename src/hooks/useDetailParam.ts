"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Detalle de una fila, direccionable por URL.
 *
 * El detalle de una entidad vive hoy en 154 modales gobernados por un
 * `useState` local. Eso significa que no se puede enviar a nadie el enlace de
 * una no conformidad, que el botón de atrás del navegador sale del módulo en
 * vez de cerrar la capa, y que las 52 notificaciones del producto enlazan a
 * la lista: «se te ha asignado el incidente X» deja al usuario buscándolo.
 *
 * Guardar el identificador en la URL lo arregla sin crear rutas nuevas —y sin
 * abrir la puerta a que un id de otra organización llegue a una consulta,
 * porque el dato ya está cargado en la página y no se pide por id.
 */
export function useDetailParam(param = "detail") {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(param);

  const open = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (id) next.set(param, id);
      else next.delete(param);
      const query = next.toString();
      // `scroll: false` mantiene la posición de la lista: al cerrar el detalle
      // el usuario vuelve a la fila desde la que entró, no al principio.
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [param, pathname, router, searchParams],
  );

  const close = useCallback(() => open(null), [open]);

  /** Enlace para `rowHref` de DataTable: navegable, copiable y con clic central. */
  const hrefFor = useCallback(
    (id: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set(param, id);
      return `${pathname}?${next.toString()}`;
    },
    [param, pathname, searchParams],
  );

  return { value, open, close, hrefFor };
}
