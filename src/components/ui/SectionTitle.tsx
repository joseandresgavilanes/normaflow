"use client";

import type { ReactNode } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useI18n } from "@/context/I18nProvider";

/**
 * Adaptador de compatibilidad.
 *
 * Conserva la firma que ya usan 49 rutas y delega en `PageHeader`, así que
 * todas pasan a declarar un `<h1>` real y a mostrar migas de pan sin tocar una
 * sola llamada. Antes pintaba un `<h2>`: la jerarquía del documento empezaba
 * en el nivel 2 y el barrido no encontró un solo `<h1>` en las 83 rutas.
 *
 * Es seguro porque ningún fichero lo usa más de una vez ni lo combina con un
 * `<h1>` propio: siempre es el título de la página, nunca el de una sección.
 * Para encabezar una sección dentro de la página está `SectionHeader`
 * (src/components/ui/Surface.tsx).
 *
 * El código nuevo debe usar `PageHeader` directamente: admite eyebrow, migas
 * explícitas, metadatos y varias acciones.
 */

interface SectionTitleProps {
  title: string;
  /** Explicación de la pantalla. Va detrás del icono de ayuda, no como párrafo. */
  sub?: string;
  /**
   * Dato que sí tiene que verse: un conteo, una media, la norma que aplica.
   * `sub` se puede esconder porque explica; esto no, porque informa.
   */
  meta?: ReactNode;
  action?: ReactNode;
  onAction?: () => void;
  /** Por defecto `nf-app-btn-ghost`; usa `nf-app-btn-primary` para CTAs destacadas. */
  actionButtonClass?: string;
  /** 2 cuando esto encabeza una sección de una página que ya tiene su `<h1>`. */
  headingLevel?: 1 | 2;
}

export default function SectionTitle({
  title,
  sub,
  meta,
  action,
  onAction,
  actionButtonClass,
  headingLevel,
}: SectionTitleProps) {
  const { tx } = useI18n();
  // Se conserva el comportamiento previo: una acción sin manejador se renderiza
  // deshabilitada en lugar de desaparecer.
  const dead = Boolean(action) && !onAction;
  const actionContent = typeof action === "string" ? tx(action) : action;

  return (
    <PageHeader
      title={title}
      subtitle={sub}
      meta={meta}
      headingLevel={headingLevel}
      actions={
        action ? (
          <button
            type="button"
            onClick={onAction}
            disabled={dead}
            title={dead ? tx("Acción no disponible en este contexto") : undefined}
            className={actionButtonClass ?? "nf-app-btn-ghost"}
          >
            {actionContent}
          </button>
        ) : undefined
      }
    />
  );
}
