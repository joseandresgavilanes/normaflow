"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/context/I18nProvider";

/**
 * Ayuda contextual detrás de un icono.
 *
 * El producto explicaba cada pantalla con un párrafo bajo el título y otro bajo
 * cada campo: 190 descripciones fijas que se leen una vez y estorban las mil
 * siguientes. Aquí ese texto sigue estando —no se ha borrado— pero solo ocupa
 * sitio cuando alguien lo pide.
 *
 * No es el patrón que se quitó en su día. Aquel tooltip era un `span` con
 * `:hover` en CSS: invisible para quien navega con teclado y para quien toca la
 * pantalla, y recortado por el primer contenedor con `overflow`. Este:
 *
 * - Es un `<button>` real: entra en el orden de tabulación y responde a Enter,
 *   espacio y toque, no solo al ratón.
 * - Mantiene la descripción SIEMPRE en el DOM, enlazada con `aria-describedby`,
 *   así que un lector de pantalla la anuncia esté abierta o cerrada. Cuando
 *   está cerrada se oculta con la técnica de recorte, no con `display:none`.
 * - Se posiciona en coordenadas de viewport (`position: fixed`), así que no lo
 *   recorta la tarjeta, la tabla ni el modal que lo contiene.
 * - Se cierra con Escape, al hacer clic fuera y al desplazar la página.
 *
 * Regla de uso: la ayuda va aquí; lo que el usuario NECESITA para decidir sin
 * abrir nada —un aviso, un estado, una consecuencia irreversible— sigue siendo
 * texto visible.
 */

const ANCHO = 300;
const MARGEN = 12;
const SEPARACION = 8;

export default function InfoTip({
  text,
  label,
  className,
  size = 14,
}: {
  /** La descripción que antes vivía como párrafo. */
  text: string;
  /** A qué acompaña; da nombre accesible al botón cuando hay varios en pantalla. */
  label?: string;
  className?: string;
  size?: number;
}) {
  const { tx } = useI18n();
  const id = useId();
  const botonRef = useRef<HTMLButtonElement>(null);
  const globoRef = useRef<HTMLSpanElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [fijado, setFijado] = useState(false);
  const [caja, setCaja] = useState<{ top: number; left: number } | null>(null);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setFijado(false);
  }, []);

  const situar = useCallback(() => {
    const ancla = botonRef.current?.getBoundingClientRect();
    if (!ancla) return;
    const ancho = Math.min(ANCHO, window.innerWidth - MARGEN * 2);
    const left = Math.min(
      Math.max(ancla.left + ancla.width / 2 - ancho / 2, MARGEN),
      window.innerWidth - ancho - MARGEN,
    );
    setCaja({ top: ancla.bottom + SEPARACION, left });
  }, []);

  // La altura del globo no se conoce hasta que se pinta: se sitúa debajo y, si
  // no cabe, se sube en la misma vuelta de layout (antes de que el navegador
  // pinte, así que no se ve saltar).
  useLayoutEffect(() => {
    if (!abierto || !caja) return;
    const globo = globoRef.current?.getBoundingClientRect();
    const ancla = botonRef.current?.getBoundingClientRect();
    if (!globo || !ancla) return;
    if (globo.bottom > window.innerHeight - MARGEN && ancla.top > globo.height + MARGEN) {
      const arriba = ancla.top - globo.height - SEPARACION;
      if (Math.abs(arriba - caja.top) > 1) setCaja({ top: arriba, left: caja.left });
    }
  }, [abierto, caja]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (evento: PointerEvent) => {
      const destino = evento.target as Node;
      if (botonRef.current?.contains(destino) || globoRef.current?.contains(destino)) return;
      cerrar();
    };
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        cerrar();
        botonRef.current?.focus();
      }
    };
    // El globo vive en coordenadas de viewport: si la página se mueve dejaría
    // de apuntar a nada. Se cierra en vez de perseguir el ancla.
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("resize", cerrar);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("resize", cerrar);
    };
  }, [abierto, cerrar]);

  function abrir() {
    situar();
    setAbierto(true);
  }

  const descripcion = tx(text);
  const nombre = label ? `${tx("Más información sobre")} ${tx(label)}` : tx("Más información");

  return (
    <span className={cn("nf-infotip", className)}>
      <button
        ref={botonRef}
        type="button"
        className="nf-infotip__trigger"
        aria-label={nombre}
        aria-describedby={id}
        aria-expanded={abierto}
        data-nf-no-action-icon
        onPointerEnter={(evento) => {
          if (evento.pointerType === "mouse") abrir();
        }}
        onPointerLeave={(evento) => {
          if (evento.pointerType === "mouse" && !fijado) setAbierto(false);
        }}
        onFocus={abrir}
        onBlur={() => {
          if (!fijado) setAbierto(false);
        }}
        onClick={() => {
          const siguiente = !fijado;
          setFijado(siguiente);
          if (siguiente) abrir();
          else setAbierto(false);
        }}
      >
        <Info size={size} strokeWidth={2.1} aria-hidden="true" />
      </button>
      <span
        ref={globoRef}
        id={id}
        role="tooltip"
        className="nf-infotip__bubble"
        data-open={abierto && caja ? "true" : undefined}
        style={abierto && caja ? { top: caja.top, left: caja.left } : undefined}
      >
        {descripcion}
      </span>
    </span>
  );
}
