"use client";

/**
 * Subnavegación dentro de la página.
 *
 * Solo para módulos que NO son normas. Las normas ISO recorren sus secciones
 * desde el sidebar y no repiten esa lista aquí; el resto de módulos —cuenta,
 * contexto, requisitos operativos— no cuelga del sidebar y necesita su propia
 * navegación interna.
 *
 * Sigue alimentando `?section=`, así que cada pestaña tiene URL propia y se
 * puede compartir o recargar.
 */
export type PageTab<T extends string> = { id: T; label: string };

export default function PageTabs<T extends string>({ tabs, active, onChange, label }: {
  tabs: readonly PageTab<T>[];
  active: T;
  onChange: (id: T) => void;
  /** Nombre accesible de la barra: «Secciones de la cuenta». */
  label: string;
}) {
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((tab) => tab.id === active);
    if (index < 0) return;
    // Flechas para moverse entre pestañas: es lo que un lector de pantalla
    // anuncia que puede hacerse en un `tablist`, y sin esto no funcionaba.
    const next = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : null;
    if (next == null) return;
    event.preventDefault();
    onChange(tabs[(next + tabs.length) % tabs.length].id);
  }

  return (
    <div className="nf-page-tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className="nf-page-tab"
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
