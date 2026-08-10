"use client";

import type { ReactNode } from "react";
import Breadcrumb, { type Crumb } from "@/components/layout/Breadcrumb";
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
 */
export default function PageHeader({
  title,
  subtitle,
  eyebrow,
  breadcrumb,
  hideBreadcrumb = false,
  meta,
  actions,
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
}) {
  const { tx } = useI18n();

  return (
    <header className="nf-page-header">
      {/* Las migas las pinta el shell (AppRoot). Aquí solo se sobreescriben
          cuando la página aporta una ruta propia, como un detalle. */}
      {breadcrumb && !hideBreadcrumb && <Breadcrumb items={breadcrumb} />}
      <div className="nf-page-header__bar">
        <div className="nf-page-header__text">
          {eyebrow && <span className="nf-page-header__eyebrow">{tx(eyebrow)}</span>}
          <h1 className="nf-page-header__title">{tx(title)}</h1>
          {subtitle && <p className="nf-page-header__subtitle">{tx(subtitle)}</p>}
          {meta && <div className="nf-page-header__meta">{meta}</div>}
        </div>
        {actions && <div className="nf-page-header__actions">{actions}</div>}
      </div>
    </header>
  );
}
