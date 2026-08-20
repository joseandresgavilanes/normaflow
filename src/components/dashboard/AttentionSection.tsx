"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2 } from "lucide-react";
import { useI18n } from "@/context/I18nProvider";

/**
 * "Requiere tu atención".
 *
 * El dashboard informaba pero no accionaba: mostraba porcentajes y conteos
 * sueltos sin decir qué hacer ni en qué orden. Aquí solo aparecen los asuntos
 * con trabajo pendiente, ordenados por gravedad, y cada uno lleva al listado
 * ya filtrado.
 *
 * `detail` ya no se pinta bajo la etiqueta. Ocho fichas con dos líneas de
 * explicación cada una convertían la primera pantalla del producto en un
 * párrafo de ocho entradas, y las etiquetas ya se explican solas: «Formación
 * vencida» no necesita que debajo ponga «personas con capacitación caducada».
 * Sigue disponible como descripción de cada enlace —al pasar el ratón y para
 * los lectores de pantalla—, así que nadie pierde el matiz.
 */

export type AttentionTone = "danger" | "warning" | "info";

export type AttentionItem = {
  id: string;
  label: string;
  /** Qué implica y qué se espera del usuario. */
  detail: string;
  count: number;
  href: string;
  tone: AttentionTone;
  Icon: LucideIcon;
};

/** Primero lo urgente; a igual gravedad, lo más numeroso. */
const ORDEN: Record<AttentionTone, number> = { danger: 0, warning: 1, info: 2 };

export default function AttentionSection({ items }: { items: AttentionItem[] }) {
  const { tx } = useI18n();
  const pendientes = items
    .filter((item) => item.count > 0)
    .sort((a, b) => ORDEN[a.tone] - ORDEN[b.tone] || b.count - a.count);

  const total = pendientes.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className="nf-attention" aria-labelledby="nf-attention-title">
      <header className="nf-attention__head">
        <h2 id="nf-attention-title" className="nf-attention__title">
          {tx("Requiere tu atención")}
        </h2>
        {total > 0 && (
          <span className="nf-attention__total nf-tabular">
            {total} {tx(total === 1 ? "asunto" : "asuntos")}
          </span>
        )}
      </header>

      {pendientes.length === 0 ? (
        <p className="nf-attention__clear">
          <CheckCircle2 size={17} strokeWidth={2} aria-hidden />
          {tx("No hay asuntos vencidos ni críticos. El sistema está al día.")}
        </p>
      ) : (
        <ul className="nf-attention__list">
          {pendientes.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="nf-attention__item"
                data-tone={item.tone}
                title={tx(item.detail)}
              >
                <span className="nf-attention__icon" aria-hidden>
                  <item.Icon size={17} strokeWidth={1.9} />
                </span>
                <span className="nf-attention__body">
                  <span className="nf-attention__label">{tx(item.label)}</span>
                  <span className="nf-sr-only">{tx(item.detail)}</span>
                </span>
                {/* El número va con su etiqueta al lado: el tono nunca es el
                    único canal que comunica la gravedad. */}
                <span className="nf-attention__count nf-tabular">{item.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
