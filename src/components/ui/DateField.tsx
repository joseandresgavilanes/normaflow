"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useI18n } from "@/context/I18nProvider";
import { readDateFormat, type DateFormatStyle } from "@/lib/format/datetime";

/**
 * Campo de fecha del producto.
 *
 * Sustituye a `<input type="date">` por las mismas razones por las que `Picker`
 * sustituyó al `<select>`:
 *
 * - El calendario lo pinta el navegador. Ignora los tokens, ignora el tema
 *   oscuro y sale en el idioma del sistema operativo, no en el de la interfaz:
 *   una organización con Windows en inglés veía «August» dentro de una app en
 *   español.
 * - Firefox no trae calendario en escritorio: el mismo campo es un desplegable
 *   en Chrome y tres casillas numéricas en Firefox.
 * - El formato de lectura era el del sistema operativo, así que la preferencia
 *   «formato de fecha» de la cuenta —dd/mm, mm/dd o ISO— no llegaba al único
 *   sitio donde el usuario escribe fechas.
 *
 * Es compatible con lo que sustituye: mismo `name`/`value`/`defaultValue`/
 * `onChange` —el evento trae `target.value` en `YYYY-MM-DD`, igual que el
 * nativo—, mismos `min`/`max` y misma participación en el envío del formulario.
 * Migrar un campo es cambiar la etiqueta, no reescribir el formulario.
 *
 * Toda la aritmética va en UTC. Con fechas locales, `new Date("2026-08-14")` es
 * medianoche UTC y en cualquier zona al oeste de Greenwich se lee como el día
 * 13: el error clásico de los calendarios, que resta un día a media plantilla.
 */

export type DateChangeEvent = {
  target: { name?: string; value: string };
  currentTarget: { name?: string; value: string };
};

export type DateFieldProps = {
  name?: string;
  /** `YYYY-MM-DD`. Cadena vacía = sin fecha. */
  value?: string;
  defaultValue?: string;
  onChange?: (event: DateChangeEvent) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
  /** Botón para vaciar. Por omisión, en todo campo no obligatorio. */
  clearable?: boolean;
  invalidMessage?: string;
};

/* -------------------------------------------------------------------------- */
/* Aritmética de calendario — todo en UTC                                      */
/* -------------------------------------------------------------------------- */

type Ymd = { y: number; m: number; d: number };

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIso(value: string | undefined | null): Ymd | null {
  const match = ISO.exec((value ?? "").trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

function toIso({ y, m, d }: Ymd) {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 0 = domingo … 6 = sábado, del día 1 del mes. */
function firstWeekday(y: number, m: number) {
  return new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
}

function shift({ y, m, d }: Ymd, days: number): Ymd {
  const base = new Date(Date.UTC(y, m - 1, d + days));
  return { y: base.getUTCFullYear(), m: base.getUTCMonth() + 1, d: base.getUTCDate() };
}

function shiftMonth({ y, m, d }: Ymd, months: number): Ymd {
  const total = (y * 12) + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  // El 31 de marzo menos un mes no es el 31 de febrero: se recorta al último
  // día real, que es lo que hacen todos los calendarios.
  return { y: ny, m: nm, d: Math.min(d, daysInMonth(ny, nm)) };
}

function compare(a: Ymd, b: Ymd) {
  return a.y - b.y || a.m - b.m || a.d - b.d;
}

function todayYmd(): Ymd {
  const now = new Date();
  // Aquí sí se leen los getters locales: «hoy» es hoy donde está la persona.
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

/** El formato de lectura sale de la preferencia de la cuenta, no del sistema. */
function display(ymd: Ymd, style: DateFormatStyle) {
  const dd = String(ymd.d).padStart(2, "0");
  const mm = String(ymd.m).padStart(2, "0");
  if (style === "iso") return `${ymd.y}-${mm}-${dd}`;
  if (style === "mdy") return `${mm}/${dd}/${ymd.y}`;
  return `${dd}/${mm}/${ymd.y}`;
}

const INTL: Record<string, string> = { es: "es-ES", en: "en-US", "pt-BR": "pt-BR" };

/** Momento del último foco por validación, compartido como en `Picker`. */
let ultimoFocoInvalido = 0;

/* -------------------------------------------------------------------------- */

export default function DateField({
  name,
  value,
  defaultValue,
  onChange,
  min,
  max,
  required = false,
  disabled = false,
  id,
  className,
  style,
  placeholder,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
  clearable,
  invalidMessage = "Elige una fecha.",
}: DateFieldProps) {
  const { locale, tx } = useI18n();
  const uid = useId();

  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue ?? "");
  const raw = controlled ? value ?? "" : inner;
  const selected = parseIso(raw);

  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  // Mes a la vista y día con el foco del teclado. Se separan del valor: se
  // navega el calendario sin elegir nada hasta pulsar.
  const [cursor, setCursor] = useState<Ymd>(() => selected ?? todayYmd());

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const focoPendiente = useRef(false);

  /* El formato se lee del DOM DESPUÉS de montar, no durante el render.
     El servidor no tiene `document` y pintaría siempre «dd/mm/aaaa»: quien
     tuviera elegido el formato americano vería el primer render en un formato y
     el segundo en otro, que es exactamente el aviso de hidratación que este
     producto ya persigue con el tema. */
  const [formato, setFormato] = useState<DateFormatStyle>("dmy");
  useEffect(() => {
    setFormato(readDateFormat(document.documentElement.dataset.datefmt));
  }, []);

  const intl = INTL[locale] ?? "es-ES";

  const limiteMin = parseIso(min);
  const limiteMax = parseIso(max);

  /* En español y portugués la semana empieza en lunes; en inglés, en domingo.
     `Intl.Locale.weekInfo` lo sabría, pero Firefox aún no lo implementa. */
  const primerDia = locale === "en" ? 0 : 1;

  const nombresDia = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(intl, { weekday: "short", timeZone: "UTC" });
    // 2024-01-07 fue domingo: sirve de ancla para recorrer la semana.
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(Date.UTC(2024, 0, 7 + ((i + primerDia) % 7)))).replace(".", ""),
    );
  }, [intl, primerDia]);

  const nombreMes = useMemo(
    () => new Intl.DateTimeFormat(intl, { month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(cursor.y, cursor.m - 1, 1))),
    [intl, cursor.y, cursor.m],
  );

  const hoy = todayYmd();

  const fueraDeRango = useCallback(
    (day: Ymd) => Boolean((limiteMin && compare(day, limiteMin) < 0) || (limiteMax && compare(day, limiteMax) > 0)),
    [limiteMin, limiteMax],
  );

  const commit = useCallback(
    (next: string) => {
      if (!controlled) setInner(next);
      if (next) setInvalid(false);
      const detail = { name, value: next };
      onChange?.({ target: detail, currentTarget: detail });
    },
    [controlled, name, onChange],
  );

  const close = useCallback((devolverFoco = true) => {
    setOpen(false);
    if (devolverFoco) triggerRef.current?.focus();
  }, []);

  function abrir() {
    if (disabled) return;
    focoPendiente.current = true;
    setCursor(selected ?? hoy);
    setOpen(true);
  }

  function elegir(day: Ymd) {
    if (fueraDeRango(day)) return;
    commit(toIso(day));
    close();
  }

  /* ── Posición ─────────────────────────────────────────────────────────────
     Igual que `Picker`: el panel va en un portal al `body` porque el cuerpo del
     modal recorta su contenido y un calendario anclado al campo se cortaría en
     los campos del final del formulario. */
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const ANCHO = 292;

  const situar = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const alto = 330;
    const debajo = window.innerHeight - rect.bottom - 12;
    const encima = rect.top - 12;
    const voltear = debajo < alto && encima > debajo;
    setPos({
      left: Math.min(Math.max(rect.left, 12), Math.max(12, window.innerWidth - ANCHO - 12)),
      top: voltear ? undefined : rect.bottom + 6,
      bottom: voltear ? window.innerHeight - rect.top + 6 : undefined,
    });
  }, []);

  useLayoutEffect(() => {
    if (open) situar();
  }, [open, situar]);

  useEffect(() => {
    if (open && pos && focoPendiente.current) {
      focoPendiente.current = false;
      panelRef.current?.focus();
    }
  }, [open, pos]);

  useEffect(() => {
    if (!open) return;
    const recolocar = () => situar();
    const fuera = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", recolocar, true);
    window.addEventListener("resize", recolocar);
    document.addEventListener("mousedown", fuera);
    return () => {
      window.removeEventListener("scroll", recolocar, true);
      window.removeEventListener("resize", recolocar);
      document.removeEventListener("mousedown", fuera);
    };
  }, [open, situar]);

  // `form.reset()` vacía el formulario tras guardar en varios modales; el
  // estado vive aquí, así que hay que escucharlo o se queda lo último elegido.
  useEffect(() => {
    if (controlled) return;
    const form = triggerRef.current?.closest("form");
    if (!form) return;
    const onReset = () => setInner(defaultValue ?? "");
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [controlled, defaultValue]);

  // El día con foco se mantiene al alcance del teclado dentro de la rejilla.
  useEffect(() => {
    if (!open) return;
    gridRef.current?.querySelector<HTMLElement>('[data-cursor="true"]')?.focus();
  }, [open, cursor]);

  function onPanelKeyDown(event: React.KeyboardEvent) {
    const salto: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in salto) {
      event.preventDefault();
      setCursor((actual) => shift(actual, salto[event.key]));
    } else if (event.key === "PageUp") {
      event.preventDefault();
      setCursor((actual) => shiftMonth(actual, event.shiftKey ? -12 : -1));
    } else if (event.key === "PageDown") {
      event.preventDefault();
      setCursor((actual) => shiftMonth(actual, event.shiftKey ? 12 : 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setCursor((actual) => shift(actual, -(((new Date(Date.UTC(actual.y, actual.m - 1, actual.d)).getUTCDay() - primerDia) + 7) % 7)));
    } else if (event.key === "End") {
      event.preventDefault();
      setCursor((actual) => shift(actual, 6 - (((new Date(Date.UTC(actual.y, actual.m - 1, actual.d)).getUTCDay() - primerDia) + 7) % 7)));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      elegir(cursor);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      abrir();
    }
  }

  const hueco = (firstWeekday(cursor.y, cursor.m) - primerDia + 7) % 7;
  const total = daysInMonth(cursor.y, cursor.m);
  const celdas: (Ymd | null)[] = [
    ...Array.from({ length: hueco }, () => null),
    ...Array.from({ length: total }, (_, i) => ({ y: cursor.y, m: cursor.m, d: i + 1 })),
  ];

  const puedeBorrar = clearable ?? !required;
  const etiqueta = selected ? display(selected, formato) : "";

  return (
    <div className="nf-datefield" ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        id={id}
        className={`nf-app-input nf-datefield__trigger${className && className !== "nf-app-input" ? ` ${className}` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-invalid={invalid || ariaInvalid || undefined}
        aria-required={ariaRequired || required || undefined}
        aria-describedby={[invalid ? `${uid}-error` : null, ariaDescribedBy].filter(Boolean).join(" ") || undefined}
        disabled={disabled}
        style={style}
        onClick={() => (open ? close() : abrir())}
        onKeyDown={onTriggerKeyDown}
      >
        <CalendarDays size={15} strokeWidth={2} aria-hidden className="nf-datefield__icon" />
        {etiqueta
          ? <span className="nf-datefield__value nf-tabular">{etiqueta}</span>
          : <span className="nf-datefield__placeholder">{tx(placeholder ?? "Sin fecha")}</span>}
      </button>

      {puedeBorrar && etiqueta && !disabled && (
        <button
          type="button"
          data-nf-no-action-icon
          className="nf-datefield__clear"
          aria-label={`${tx("Borrar")} ${ariaLabel ?? tx("fecha")}`}
          onClick={() => commit("")}
        >
          <X size={13} strokeWidth={2.4} aria-hidden />
        </button>
      )}

      {/* El valor real del formulario. Recortado en vez de `type="hidden"`
          porque un input oculto queda fuera de la validación del navegador y
          este campo puede ser obligatorio. `aria-hidden` lo saca del árbol de
          accesibilidad: quien lo anuncia es el disparador. */}
      <input
        className="nf-datefield__native"
        type="text"
        name={name}
        value={raw}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        /* Nada de `readOnly`: el HTML deja fuera de la validación a los campos
           de solo lectura, así que un campo de fecha obligatorio dejaría pasar
           el formulario vacío. El valor lo gobierna React; el `onChange` vacío
           está solo para que el input controlado no avise. */
        onChange={() => {}}
        onInvalid={(event) => {
          event.preventDefault();
          setInvalid(true);
          const ahora = typeof performance !== "undefined" ? performance.now() : Date.now();
          if (ahora - ultimoFocoInvalido > 100) {
            ultimoFocoInvalido = ahora;
            triggerRef.current?.focus();
            triggerRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
          }
        }}
      />

      {invalid && <span className="nf-datefield__error" id={`${uid}-error`} role="alert">{tx(invalidMessage)}</span>}

      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label={ariaLabel ? `${tx("Calendario")}: ${ariaLabel}` : tx("Calendario")}
          tabIndex={-1}
          className="nf-datefield__panel"
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: ANCHO }}
          onKeyDown={onPanelKeyDown}
        >
          <div className="nf-datefield__head">
            <button
              type="button"
              data-nf-no-action-icon
              className="nf-datefield__nav"
              aria-label={tx("Mes anterior")}
              onClick={() => setCursor((actual) => shiftMonth(actual, -1))}
            >
              <ChevronLeft size={16} aria-hidden />
            </button>
            {/* `aria-live` para que al cambiar de mes con el teclado se anuncie
                a qué mes se ha llegado; sin esto solo se oye el número del día. */}
            <span className="nf-datefield__month" aria-live="polite">{nombreMes}</span>
            <button
              type="button"
              data-nf-no-action-icon
              className="nf-datefield__nav"
              aria-label={tx("Mes siguiente")}
              onClick={() => setCursor((actual) => shiftMonth(actual, 1))}
            >
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>

          <div className="nf-datefield__weekdays" aria-hidden>
            {nombresDia.map((dia) => <span key={dia}>{dia}</span>)}
          </div>

          <div className="nf-datefield__grid" ref={gridRef} role="grid">
            {celdas.map((celda, index) => {
              if (!celda) return <span key={`hueco-${index}`} className="nf-datefield__empty" />;
              const esHoy = compare(celda, hoy) === 0;
              const esElegido = Boolean(selected && compare(celda, selected) === 0);
              const bloqueado = fueraDeRango(celda);
              return (
                <button
                  key={celda.d}
                  type="button"
                  data-nf-no-action-icon
                  className="nf-datefield__day"
                  data-today={esHoy || undefined}
                  data-selected={esElegido || undefined}
                  data-cursor={celda.d === cursor.d ? "true" : undefined}
                  // Un solo día entra en el orden de tabulación: dentro de la
                  // rejilla se navega con flechas, no con 31 tabulaciones.
                  tabIndex={celda.d === cursor.d ? 0 : -1}
                  aria-current={esHoy ? "date" : undefined}
                  aria-pressed={esElegido}
                  disabled={bloqueado}
                  onClick={() => elegir(celda)}
                >
                  {celda.d}
                </button>
              );
            })}
          </div>

          <div className="nf-datefield__foot">
            <button
              type="button"
              data-nf-no-action-icon
              className="nf-datefield__action"
              disabled={fueraDeRango(hoy)}
              onClick={() => elegir(hoy)}
            >
              {tx("Hoy")}
            </button>
            {puedeBorrar && (
              <button
                type="button"
                data-nf-no-action-icon
                className="nf-datefield__action"
                onClick={() => { commit(""); close(); }}
              >
                {tx("Borrar")}
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
