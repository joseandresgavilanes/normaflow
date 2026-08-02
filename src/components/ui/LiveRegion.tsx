"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * Anunciador global para lectores de pantalla.
 *
 * La aplicación tenía UNA sola región `aria-live` en 225 ficheros: los toasts,
 * los errores de validación y los cambios de estado ocurrían en silencio para
 * quien no ve la pantalla. Es un incumplimiento de WCAG 2.2 AA — criterio
 * 4.1.3 Mensajes de estado.
 *
 * Dos regiones permanentes en el DOM, como exige la especificación: si la
 * región se monta a la vez que el mensaje, muchos lectores no la anuncian.
 *
 *  · `polite`    → confirmaciones, resultados de filtro, guardado correcto.
 *  · `assertive` → errores y fallos que interrumpen la tarea.
 *
 * Nunca mueve el foco: anunciar no debe robar el contexto al usuario.
 */

type Politeness = "polite" | "assertive";

type AnnounceFn = (message: string, politeness?: Politeness) => void;

const LiveRegionContext = createContext<AnnounceFn | null>(null);

export function LiveRegionProvider({ children }: { children: React.ReactNode }) {
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");
  const timers = useRef<{ polite?: ReturnType<typeof setTimeout>; assertive?: ReturnType<typeof setTimeout> }>({});

  useEffect(() => {
    const pending = timers.current;
    return () => {
      if (pending.polite) clearTimeout(pending.polite);
      if (pending.assertive) clearTimeout(pending.assertive);
    };
  }, []);

  const announce = useCallback<AnnounceFn>((message, politeness = "polite") => {
    const clean = message.trim();
    if (!clean) return;
    const setter = politeness === "assertive" ? setAssertive : setPolite;

    // Vaciar y volver a escribir: si el mensaje nuevo es idéntico al anterior,
    // el lector no detecta cambio y no lo repite.
    setter("");
    if (timers.current[politeness]) clearTimeout(timers.current[politeness]);
    timers.current[politeness] = setTimeout(() => setter(clean), 60);
  }, []);

  const value = useMemo(() => announce, [announce]);

  return (
    <LiveRegionContext.Provider value={value}>
      {children}
      <div className="nf-sr-only" role="status" aria-live="polite" aria-atomic="true">
        {polite}
      </div>
      <div className="nf-sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {assertive}
      </div>
    </LiveRegionContext.Provider>
  );
}

/**
 * Anuncia un mensaje. Fuera del provider devuelve una función inerte para que
 * un componente reutilizable no reviente al usarse en marketing o en auth.
 */
export function useAnnounce(): AnnounceFn {
  const announce = useContext(LiveRegionContext);
  return announce ?? noop;
}

function noop() {
  /* sin provider: el componente sigue funcionando, solo no anuncia */
}
