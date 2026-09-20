/**
 * Parte un nombre completo en nombre y apellidos.
 *
 * La primera palabra es el nombre y el resto los apellidos, que es lo que
 * acierta en la mayoría de los casos en español: «José Andrés Gavilanes» sale
 * como «José» + «Andrés Gavilanes». No hay heurística que acierte siempre, y la
 * ficha queda editable en Personal, así que se prefiere la simple.
 *
 * Vive aparte de `personnel-sync` —y sin una sola importación— para que los
 * scripts puedan usarla: aquel módulo arrastra `server-only`, que solo resuelve
 * dentro del empaquetado de Next.
 */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "Sin nombre", lastName: "" };
  const [first, ...rest] = parts;
  return { firstName: first, lastName: rest.join(" ") };
}
