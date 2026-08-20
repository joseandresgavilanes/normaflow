"use client";

import { useMemo } from "react";
import Avatar from "@/components/ui/Avatar";
import Picker, { type PickerOption } from "@/components/ui/Picker";
import { ROLES } from "@/lib/constants";

/**
 * Selector de personas.
 *
 * Es el [Picker] general con lo que distingue a una persona de una opción
 * cualquiera: la cara, el rol y el área bajo el nombre —dos «García» no se
 * distinguen solo por el nombre— y fichas para acotar por rol antes de buscar.
 */

export type PickerPerson = {
  /** Uno de los dos basta: los miembros del tenant no siempre traen `id`, y
   *  varios formularios los referencian por `userId`. */
  id?: string | null;
  userId?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  role?: string | null;
  position?: string | null;
  department?: string | null;
  avatarUrl?: string | null;
};

/** Con un solo grupo las fichas no acotan nada; con pocas personas la búsqueda
 *  ya basta y las fichas solo añaden ruido. */
const MINIMO_PARA_FICHAS = 8;

function roleLabel(role?: string | null) {
  if (!role) return "";
  return (ROLES as Record<string, string>)[role] ?? role.replaceAll("_", " ");
}

function personName(person: PickerPerson) {
  const full = person.name ?? [person.firstName, person.lastName].filter(Boolean).join(" ");
  return full?.trim() || "Sin nombre";
}

type PersonOption = PickerOption & { avatarUrl?: string | null; detail: string };

export default function PersonPicker({
  name,
  people,
  value,
  defaultValue,
  valueField = "id",
  multiple = false,
  required = false,
  disabled = false,
  placeholder = "Sin asignar",
  emptyValue = "",
  searchPlaceholder = "Buscar persona…",
  ariaLabel,
  className,
  style,
  onChange,
  onValueChange,
}: {
  /** Clave del FormData. Sin ella el control es solo de estado (`value`). */
  name?: string;
  people: readonly PickerPerson[];
  /** Modo controlado: el valor lo manda quien lo usa. */
  value?: string | readonly string[] | null;
  defaultValue?: string | readonly string[] | null;
  valueField?: "id" | "userId";
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Valor de la fila «nadie». En un formulario es "", pero un filtro suele
   *  tener su propio centinela ("ALL") para decir «no filtres por esto». */
  emptyValue?: string;
  searchPlaceholder?: string;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  onChange?: (values: string[]) => void;
  /** Atajo para el caso de uno solo: devuelve el id, o "" si se vació. */
  onValueChange?: (value: string) => void;
}) {
  const options = useMemo<PersonOption[]>(() => {
    const rows = people
      .map((person) => {
        const id = String((valueField === "userId" ? person.userId ?? person.id : person.id ?? person.userId) ?? "");
        const label = personName(person);
        const group = roleLabel(person.role) || person.department || "";
        const detail = [person.position, person.department, person.email]
          .filter((part): part is string => Boolean(part) && part !== group)
          .join(" · ");
        return { value: id, label, group, detail, avatarUrl: person.avatarUrl, searchText: `${group} ${detail}` };
      })
      .filter((row) => row.value);
    // La fila de vaciado va primero y siempre: es la que representa «nadie», y
    // sin ella un campo obligatorio no tendría forma de estar vacío.
    return multiple ? rows : [{ value: emptyValue, label: placeholder, group: "", detail: "" }, ...rows];
  }, [people, valueField, multiple, placeholder, emptyValue]);

  const chips = useMemo(() => {
    const names = new Set(options.map((option) => option.group).filter((group): group is string => Boolean(group)));
    return names.size > 1 && options.length >= MINIMO_PARA_FICHAS ? [...names].sort((a, b) => a.localeCompare(b)) : undefined;
  }, [options]);

  return (
    <Picker
      options={options}
      name={name}
      value={value}
      defaultValue={defaultValue}
      multiple={multiple}
      required={required}
      disabled={disabled}
      className={className}
      style={style}
      aria-label={ariaLabel}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      chips={chips}
      invalidMessage="Elige una persona."
      onChange={(event) => {
        onChange?.(event.target.values);
        onValueChange?.(event.target.value);
      }}
      renderRow={(option) => {
        const person = option as PersonOption;
        return (
          <>
            {person.value !== emptyValue ? <Avatar name={person.label} size={26} src={person.avatarUrl} /> : <span className="nf-picker__option-blank" aria-hidden />}
            <span className="nf-picker__option-text">
              <span className="nf-picker__option-name">{person.label}</span>
              {(person.group || person.detail) && (
                <span className="nf-picker__option-detail">{[person.group, person.detail].filter(Boolean).join(" · ")}</span>
              )}
            </span>
          </>
        );
      }}
      renderValue={(chosen) => {
        if (chosen.length === 0) return <span className="nf-picker__placeholder">{placeholder}</span>;
        if (multiple) {
          return (
            <span className="nf-picker__chips">
              {chosen.slice(0, 2).map((option) => (
                <span key={option.value} className="nf-picker__chip">
                  <Avatar name={option.label} size={18} src={(option as PersonOption).avatarUrl} />
                  {option.label}
                </span>
              ))}
              {chosen.length > 2 && <span className="nf-picker__chip nf-picker__chip--count">+{chosen.length - 2}</span>}
            </span>
          );
        }
        const person = chosen[0] as PersonOption;
        if (person.value === emptyValue) return <span className="nf-picker__placeholder">{placeholder}</span>;
        return (
          <span className="nf-picker__value-text">
            <Avatar name={person.label} size={22} src={person.avatarUrl} />
            <span className="nf-picker__value-name">{person.label}</span>
            {person.group && <span className="nf-picker__value-group">{person.group}</span>}
          </span>
        );
      }}
    />
  );
}
