"use client";

import { Children, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { statusLabel } from "@/lib/status-labels";

/**
 * Desplegable de la aplicación.
 *
 * Sustituye al `<select>` nativo en todo el producto por tres motivos que el
 * nativo no resuelve: las listas largas —cláusulas, procesos, personas,
 * documentos— no se pueden filtrar y hay que recorrerlas enteras; la opción
 * nativa solo admite texto plano, así que no cabe un dato secundario que
 * distinga dos entradas homónimas; y su lista la pinta el sistema operativo,
 * de modo que ignora el tema oscuro y los tokens del producto.
 *
 * Es deliberadamente compatible con lo que sustituye: acepta los mismos
 * `<option>` como hijos, el mismo `name`/`value`/`defaultValue`/`onChange`
 * —el evento trae `target.value`—, y respeta la regla del nativo de enviar la
 * primera opción cuando no se ha elegido ninguna. Migrar un campo es cambiar
 * la etiqueta, no reescribir el formulario.
 *
 * El buscador aparece solo cuando la lista lo justifica: con cuatro estados no
 * hay nada que buscar y sería un trámite de más.
 */

export type PickerOption = {
  value: string;
  /** Texto para buscar y para el disparador. */
  label: string;
  /** Contenido enriquecido de la fila; si falta, se pinta `label`. */
  node?: ReactNode;
  disabled?: boolean;
  group?: string;
  /** Texto extra que también entra en la búsqueda (rol, correo, área…). */
  searchText?: string;
};

export type PickerChangeEvent = {
  target: { name?: string; value: string; values: string[] };
  currentTarget: { name?: string; value: string; values: string[] };
};

/** A partir de aquí una lista deja de leerse de un vistazo. */
const UMBRAL_BUSQUEDA = 8;

/** «García» y «Garcia» deben encontrarse igual; nadie escribe tildes al buscar. */
export function fold(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Momento del último foco por validación. El navegador dispara `invalid` en
 * TODOS los campos vacíos del formulario a la vez; sin esta marca, el último
 * en responder se llevaría el foco en vez del primero, que es el que el
 * usuario espera ver.
 */
let ultimoFocoInvalido = 0;

function textOf(node: ReactNode): string {
  if (node == null || node === false || node === true) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

/**
 * Un `<option>` cuyo texto es su propio valor en MAYÚSCULAS_CON_GUIONES no es
 * una etiqueta: es el enum de la base de datos asomando por la interfaz.
 *
 * Pasa en 103 desplegables del producto, escritos como
 * `{Object.values(Estado).map((v) => <option key={v}>{v}</option>)}`. El
 * usuario elige entre «ON_TRACK», «AT_RISK» y «OFF_TRACK» en un formulario que
 * por lo demás está en su idioma.
 *
 * Se resuelve aquí y no en los 103 sitios porque aquí es donde se sabe que el
 * texto y el valor son el mismo dato. `statusLabel` conoce el catálogo del
 * producto y, para lo que no conoce, al menos lo humaniza: «FOO_BAR» sale
 * «Foo bar» y no a gritos. Quien escriba su propia etiqueta manda: esta regla
 * solo entra cuando no hay ninguna.
 */
const ENUM_CRUDO = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

function etiquetaLegible(label: string, value: string) {
  if (label !== value || !ENUM_CRUDO.test(label)) return label;
  return statusLabel(label);
}

/** Recoge los `<option>` y `<optgroup>` tal cual los escribía el `<select>`. */
function collect(children: ReactNode, group?: string, out: PickerOption[] = []): PickerOption[] {
  Children.toArray(children).forEach((child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { value?: unknown; children?: ReactNode; disabled?: boolean; label?: string };
    if (child.type === "optgroup") {
      collect(props.children, props.label ?? group, out);
      return;
    }
    if (child.type === "option") {
      const crudo = textOf(props.children);
      // Regla del nativo: sin `value`, el valor es el propio texto.
      const value = props.value == null ? crudo : String(props.value);
      const label = etiquetaLegible(crudo, value);
      // `node` solo se conserva cuando aporta algo que el texto no dice —un
      // avatar, una insignia—. Si era el enum crudo se descarta: si no, la
      // fila del panel seguiría pintando «ON_TRACK» aunque el disparador ya
      // dijera «En objetivo».
      const node = label === crudo ? props.children : undefined;
      out.push({ value, label, node, disabled: props.disabled, group });
      return;
    }
    collect(props.children, group, out);
  });
  return out;
}

type PickerValue = string | number | readonly string[] | null;

function toList(source: PickerValue | undefined) {
  return (source == null ? [] : Array.isArray(source) ? [...source] : [String(source)]).filter((v) => v !== "" && v != null);
}

export type PickerProps = {
  children?: ReactNode;
  /** Alternativa a los hijos, para quien ya tiene los datos. */
  options?: readonly PickerOption[];
  name?: string;
  value?: PickerValue;
  defaultValue?: PickerValue;
  onChange?: (event: PickerChangeEvent) => void;
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** `Field` los inyecta al clonar su hijo: hay que llevarlos al disparador o
   *  se pierden la pista y el mensaje de error del campo. */
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
  id?: string;
  /** Texto del disparador cuando no hay nada elegido y no hay opción vacía. */
  placeholder?: string;
  searchPlaceholder?: string;
  /** Fuerza (o apaga) el buscador; por defecto depende del tamaño de la lista. */
  searchable?: boolean;
  /** Fichas para acotar por grupo antes de buscar. */
  chips?: readonly string[];
  /** Fila a medida: avatar, insignia de estado… */
  renderRow?: (option: PickerOption, selected: boolean) => ReactNode;
  /** Contenido del disparador a medida. */
  renderValue?: (options: PickerOption[]) => ReactNode;
  invalidMessage?: string;
  /** Para los campos que sirven de acción («Vincular evidencia…»): tras elegir,
   *  el campo vuelve a su marcador en vez de quedarse con lo ya ejecutado. */
  resetOnSelect?: boolean;
};

export default function Picker({
  children,
  options: optionsProp,
  name,
  value,
  defaultValue,
  onChange,
  multiple = false,
  required = false,
  disabled = false,
  className,
  style,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
  id,
  placeholder,
  searchPlaceholder = "Buscar…",
  searchable,
  chips,
  renderRow,
  renderValue,
  invalidMessage = "Elige una opción.",
  resetOnSelect = false,
}: PickerProps) {
  const options = useMemo(() => (optionsProp ? [...optionsProp] : collect(children)), [optionsProp, children]);
  const byValue = useMemo(() => new Map(options.map((option) => [option.value, option])), [options]);

  const [inner, setInner] = useState<string[]>(() => toList(defaultValue));
  const controlled = value !== undefined;
  const selected = controlled ? toList(value) : inner;

  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [active, setActive] = useState(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const focusPending = useRef(false);
  const listId = useId();

  const showSearch = searchable ?? options.length >= UMBRAL_BUSQUEDA;

  const visible = useMemo(() => {
    const needle = fold(query.trim());
    return options.filter(
      (option) => (!group || option.group === group) && (!needle || fold(`${option.label} ${option.searchText ?? ""}`).includes(needle)),
    );
  }, [options, query, group]);

  const commit = useCallback(
    (values: string[]) => {
      if (!controlled) setInner(resetOnSelect ? [] : values);
      if (values.length) setInvalid(false);
      const detail = { name, value: values[0] ?? "", values };
      onChange?.({ target: detail, currentTarget: detail });
    },
    [controlled, name, onChange, resetOnSelect],
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setGroup("");
    triggerRef.current?.focus();
  }, []);

  function openPanel() {
    if (disabled) return;
    focusPending.current = true;
    setOpen(true);
    // Abrir sobre la opción vigente y no sobre la primera: en una lista larga,
    // ver dónde estás es la mitad de la orientación.
    const index = visible.findIndex((option) => selected.includes(option.value));
    setActive(index >= 0 ? index : 0);
  }

  function choose(option: PickerOption) {
    if (option.disabled) return;
    if (multiple) {
      commit(selected.includes(option.value) ? selected.filter((v) => v !== option.value) : [...selected, option.value]);
      return;
    }
    commit(option.value ? [option.value] : []);
    close();
  }

  // ── Posición ──────────────────────────────────────────────────────────────
  // El panel va en un portal fijo al `body` porque `.nf-modal-body` recorta su
  // contenido (`overflow-y: auto`): dentro del modal, un desplegable anclado al
  // campo se cortaría por abajo justo en los campos del final del formulario.
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);

  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const flip = below < 240 && above > below;
    setPos({
      left: rect.left,
      width: rect.width,
      top: flip ? undefined : rect.bottom + 6,
      bottom: flip ? window.innerHeight - rect.top + 6 : undefined,
      maxHeight: Math.max(180, Math.min(360, flip ? above : below)),
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  // El foco no puede pedirse al abrir: el panel todavía no está en el DOM
  // —espera a que `pos` esté calculado—, así que se pide cuando ya existe, una
  // sola vez por apertura para no robar el cursor al recolocar por scroll.
  useEffect(() => {
    if (open && pos && focusPending.current) {
      focusPending.current = false;
      (showSearch ? searchRef.current : panelRef.current)?.focus();
    }
  }, [open, pos, showSearch]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => place();
    // `capture` para enterarse también del scroll del cuerpo del modal.
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, place]);

  // `form.reset()` devolvía el `<select>` a su valor inicial; varios modales lo
  // usan para vaciar el formulario tras guardar. El estado vive aquí, así que
  // hay que escuchar el evento para no quedarse con lo último elegido.
  useEffect(() => {
    if (controlled) return;
    const form = triggerRef.current?.closest("form");
    if (!form) return;
    const onReset = () => setInner(toList(defaultValue));
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [controlled, defaultValue]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
      setQuery("");
      setGroup("");
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Al filtrar cambia la lista: la fila activa debe volver arriba o quedaría
  // señalando una posición que ya no existe.
  useEffect(() => setActive(0), [query, group]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function onListKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => Math.min(index + 1, visible.length - 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
    else if (event.key === "Home") { event.preventDefault(); setActive(0); }
    else if (event.key === "End") { event.preventDefault(); setActive(visible.length - 1); }
    else if (event.key === "Enter") { event.preventDefault(); const option = visible[active]; if (option) choose(option); }
    else if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (event.key === "Tab") { setOpen(false); setQuery(""); setGroup(""); }
  }

  function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPanel();
    } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      // Escribir con el control cerrado abre y arranca la búsqueda con esa letra,
      // como hace el `<select>` nativo al teclear.
      openPanel();
      if (showSearch) setQuery(event.key);
    }
  }

  const chosen = selected.map((v) => byValue.get(v)).filter((o): o is PickerOption => Boolean(o));
  // El nativo envía la primera opción cuando no se ha tocado el campo; el valor
  // que viaja al formulario tiene que ser el mismo para no cambiar lo guardado.
  const primera = options.find((option) => !option.disabled);
  // Lo que se ve y lo que se envía tienen que ser lo mismo: si nadie ha elegido
  // y la lista no tiene opción vacía, el nativo da por elegida la primera, así
  // que el campo debe mostrarla en vez de un «Seleccionar…» que engaña.
  const mostrados = chosen.length || multiple ? chosen : primera ? [primera] : [];
  const efectivo = multiple ? selected : mostrados.map((option) => option.value);
  const vacio = mostrados.length === 0 || mostrados[0].value === "";
  const etiquetaVacia = placeholder ?? (options[0]?.value === "" ? options[0].label : "");

  return (
    <div className="nf-picker" ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        id={id}
        className={`nf-app-input nf-picker__trigger${className && className !== "nf-app-input" ? ` ${className}` : ""}`}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-invalid={invalid || ariaInvalid || undefined}
        aria-required={ariaRequired || undefined}
        aria-describedby={[invalid ? `${listId}-error` : null, ariaDescribedBy].filter(Boolean).join(" ") || undefined}
        disabled={disabled}
        style={style}
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={onTriggerKeyDown}
      >
        {renderValue ? (
          renderValue(mostrados)
        ) : vacio ? (
          <span className="nf-picker__placeholder">{etiquetaVacia || "Seleccionar…"}</span>
        ) : multiple ? (
          <span className="nf-picker__chips">
            {chosen.slice(0, 2).map((option) => (
              <span key={option.value} className="nf-picker__chip nf-picker__chip--plain">{option.label}</span>
            ))}
            {chosen.length > 2 && <span className="nf-picker__chip nf-picker__chip--count">+{chosen.length - 2}</span>}
          </span>
        ) : (
          <span className="nf-picker__value-name">{mostrados[0].label}</span>
        )}
        <ChevronDown size={15} aria-hidden className="nf-picker__chevron" />
      </button>

      {/* El valor real del formulario. Invisible pero presente en el DOM: así el
          navegador puede anclar la validación cuando el campo es obligatorio,
          cosa que no hace con un input oculto. */}
      {multiple ? (
        name && efectivo.map((v) => <input key={v} type="hidden" name={name} value={v} />)
      ) : (
        <input
          className="nf-picker__native"
          name={name}
          value={efectivo[0] ?? ""}
          required={required}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          onChange={() => {}}
          onInvalid={(event) => {
            // El globo nativo se anclaría a un input invisible de un píxel:
            // se descarta y el aviso se pinta bajo el campo, donde se lee.
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
      )}

      {invalid && (
        <span className="nf-picker__error" id={`${listId}-error`} role="alert">{invalidMessage}</span>
      )}

      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          tabIndex={-1}
          className="nf-picker__panel"
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
          onKeyDown={showSearch ? undefined : onListKeyDown}
        >
          {showSearch && (
            <div className="nf-picker__search">
              <Search size={14} aria-hidden />
              <input
                ref={searchRef}
                type="text"
                className="nf-picker__search-input"
                placeholder={searchPlaceholder}
                value={query}
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={visible[active] ? `${listId}-${active}` : undefined}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onListKeyDown}
              />
              {query && (
                <button type="button" data-nf-no-action-icon className="nf-picker__clear" aria-label="Borrar búsqueda" onClick={() => { setQuery(""); searchRef.current?.focus(); }}>
                  <X size={13} aria-hidden />
                </button>
              )}
            </div>
          )}

          {chips && chips.length > 1 && (
            <div className="nf-picker__groups" role="group" aria-label="Filtrar la lista">
              <button type="button" data-nf-no-action-icon className={`nf-chip${group ? "" : " nf-chip--on"}`} onClick={() => setGroup("")}>Todos</button>
              {chips.map((item) => (
                <button
                  key={item}
                  type="button"
                  data-nf-no-action-icon
                  className={`nf-chip${group === item ? " nf-chip--on" : ""}`}
                  onClick={() => setGroup(group === item ? "" : item)}
                >
                  {item}
                </button>
              ))}
            </div>
          )}

          <ul className="nf-picker__list" id={listId} role="listbox" aria-multiselectable={multiple} ref={listRef}>
            {visible.map((option, index) => {
              const isSelected = option.value ? selected.includes(option.value) : selected.length === 0;
              const previo = index > 0 ? visible[index - 1].group : undefined;
              return (
                <li key={`${option.value}-${index}`} role="presentation" className="nf-picker__row">
                  {option.group && option.group !== previo && <span className="nf-picker__group-label">{option.group}</span>}
                  <div
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled || undefined}
                    data-active={index === active}
                    className={`nf-picker__option${index === active ? " nf-picker__option--active" : ""}${option.disabled ? " nf-picker__option--off" : ""}`}
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(option)}
                  >
                    {renderRow ? renderRow(option, isSelected) : (
                      <span className="nf-picker__option-text">
                        <span className="nf-picker__option-name">{option.node ?? option.label}</span>
                      </span>
                    )}
                    {isSelected && <Check size={15} aria-hidden className="nf-picker__option-check" />}
                  </div>
                </li>
              );
            })}
            {visible.length === 0 && (
              <li className="nf-picker__empty">{query ? `Nada coincide con «${query}»` : "No hay opciones"}</li>
            )}
          </ul>

          {multiple && (
            <div className="nf-picker__footer">
              <span>{selected.length} seleccionad{selected.length === 1 ? "a" : "as"}</span>
              <div className="nf-picker__footer-actions">
                {selected.length > 0 && <button type="button" data-nf-no-action-icon className="nf-picker__link" onClick={() => commit([])}>Limpiar</button>}
                <button type="button" data-nf-no-action-icon className="nf-picker__link" onClick={close}>Hecho</button>
              </div>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
