"use client";

import type { ReactNode } from "react";
import Breadcrumb, { type Crumb } from "@/components/layout/Breadcrumb";
import InfoTip from "@/components/ui/InfoTip";
import { useI18n } from "@/context/I18nProvider";

/**
 * Cabecera de página única para todo el workspace.
 *
 * Resuelve tres huecos que el barrido encontró en las 83 rutas: ninguna
 * declaraba un `<h1>`, ninguna tenía migas de pan y el título vivía dentro de
 * cada módulo cuando existía. La jerarquía del documento empezaba en `<h2>`.
 *
 * `title` se renderiza siempre como `<h1>`: solo debe haber una cabecera de
 * página por ruta.
 *
 * `subtitle` NO se pinta como párrafo: va detrás del icono de ayuda que sigue
 * al título. Eran 49 rutas abriendo con dos o tres líneas que describen lo que
 * la pantalla ya enseña —«Inventario de riesgos con probabilidad, impacto,
 * tratamiento y responsable (cláusula 6.1)» sobre una tabla de riesgos—. El
 * texto no se pierde: se pide. Cuando la frase sí hace falta a la vista porque
 * cambia lo que el usuario va a hacer, va en `meta` como chip, no en el
 * subtítulo.
 */
export default function PageHeader({
  title,
  subtitle,
  eyebrow,
  breadcrumb,
  hideBreadcrumb = false,
  meta,
  actions,
  headingLevel = 1,
}: {
  title: string;
  subtitle?: string;
  /** Etiqueta corta de contexto sobre el título (norma, proceso, estado). */
  eyebrow?: string;
  /** Migas explícitas; si se omite se derivan de la ruta. */
  breadcrumb?: Crumb[];
  hideBreadcrumb?: boolean;
  /** Chips de estado, contadores, selector de periodo… */
  meta?: ReactNode;
  /** Acción primaria a la derecha; las secundarias a su izquierda. */
  actions?: ReactNode;
  /**
   * Nivel del encabezado. 1 por defecto, que es el caso normal: una cabecera
   * por ruta.
   *
   * Se pasa a 2 cuando la pantalla ya tiene su `<h1>` y esto encabeza una
   * SECCIÓN dentro de ella —el contenido de una pestaña, por ejemplo—. Sin
   * esto, «Contexto de la organización» y «Partes interesadas» salían las dos
   * como `<h1>` y del mismo tamaño: la página parecía tener dos títulos y para
   * un lector de pantalla tenía, literalmente, dos.
   */
  headingLevel?: 1 | 2;
}) {
  const { tx } = useI18n();
  const Heading = `h${headingLevel}` as "h1" | "h2";

  return (
    <header className="nf-page-header" data-level={headingLevel}>
      {/* Las migas las pinta el shell (AppRoot). Aquí solo se sobreescriben
          cuando la página aporta una ruta propia, como un detalle. */}
      {breadcrumb && !hideBreadcrumb && <Breadcrumb items={breadcrumb} />}
      <div className="nf-page-header__bar">
        <div className="nf-page-header__text">
          {eyebrow && <span className="nf-page-header__eyebrow">{tx(eyebrow)}</span>}
          <div className="nf-heading-row">
            <Heading className="nf-page-header__title">{tx(title)}</Heading>
            {subtitle && <InfoTip text={subtitle} label={title} size={15} />}
          </div>
          {meta && <div className="nf-page-header__meta">{meta}</div>}
        </div>
        {actions && <div className="nf-page-header__actions">{actions}</div>}
      </div>
    </header>
  );
}
