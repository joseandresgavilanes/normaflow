"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useI18n } from "@/context/I18nProvider";
import { NAV_GROUPS, NAV_INDEX } from "@/lib/navigation";

export type Crumb = { label: string; href?: string };

/**
 * Migas de pan derivadas de la ruta y del modelo de navegación.
 * La app no tenía ninguna: `/app/energy` no indicaba en qué parte del sistema
 * estaba el usuario.
 *
 * Se puede sobreescribir con `items` cuando la página conoce mejor su
 * contexto (por ejemplo un detalle: Documentos → SGSI-MAN-002).
 */
export default function Breadcrumb({ items }: { items?: Crumb[] }) {
  const pathname = usePathname();
  const { t } = useI18n();

  const crumbs = items ?? derive(pathname, t);
  if (crumbs.length === 0) return null;

  return (
    <nav className="nf-breadcrumb" aria-label={t("breadcrumb.label")}>
      <ol className="nf-breadcrumb__list">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="nf-breadcrumb__item">
              {crumb.href && !last ? (
                <Link href={crumb.href} className="nf-breadcrumb__link">{crumb.label}</Link>
              ) : (
                <span className="nf-breadcrumb__current" aria-current={last ? "page" : undefined}>
                  {crumb.label}
                </span>
              )}
              {!last && <ChevronRight className="nf-breadcrumb__sep" size={13} aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function derive(pathname: string, t: (key: never) => string): Crumb[] {
  const translate = t as unknown as (key: string) => string;
  const home: Crumb = { label: translate("breadcrumb.home"), href: "/app/dashboard" };
  if (pathname === "/app/dashboard") return [];

  const entry = NAV_INDEX.get(pathname);
  if (entry) {
    return [home, { label: translate(entry.group.labelKey) }, { label: translate(entry.item.labelKey ?? "") || entry.item.label || "" }];
  }

  // Rutas más profundas que el modelo de navegación (detalles, subsecciones):
  // se ancla al ascendente conocido más largo.
  const ancestor = [...NAV_INDEX.keys()]
    .filter((href) => pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  if (ancestor) {
    const parent = NAV_INDEX.get(ancestor)!;
    return [
      home,
      { label: translate(parent.group.labelKey) },
      {
        label: translate(parent.item.labelKey ?? "") || parent.item.label || "",
        href: ancestor,
      },
    ];
  }

  const group = NAV_GROUPS.find((candidate) =>
    candidate.items.some((item) => pathname.startsWith(item.href)),
  );
  return group ? [home, { label: translate(group.labelKey) }] : [home];
}
