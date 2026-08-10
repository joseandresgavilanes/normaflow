"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Monitor, Moon, Sun } from "lucide-react";
import { useI18n } from "@/context/I18nProvider";
import { cn } from "@/lib/utils";
import { setThemePreference } from "@/lib/actions/theme";
import type { ThemePreference } from "@/lib/theme/config";

/**
 * Conmutador de tema: claro, oscuro o el del sistema.
 *
 * El bloque de tokens oscuros existía desde el principio y era código muerto:
 * nadie escribía `data-theme`, no había media query ni persistencia. Nunca se
 * había renderizado.
 *
 * `system` es una opción de primera clase, no la ausencia de elección: quien
 * tiene el sistema en oscuro por la noche quiere que la aplicación lo siga sin
 * tener que volver aquí. Con `system` se quita el atributo del `<html>` para
 * que actúe `@media (prefers-color-scheme: dark)`.
 */

const OPCIONES = [
  { value: "light", icon: Sun, label: "theme.light" },
  { value: "dark", icon: Moon, label: "theme.dark" },
  { value: "system", icon: Monitor, label: "theme.system" },
] as const satisfies readonly { value: ThemePreference; icon: typeof Sun; label: Parameters<ReturnType<typeof useI18n>["t"]>[0] }[];

export function ThemeSwitcher({
  /** Opcional: si no llega, se lee del atributo que pintó el servidor. */
  initial,
  compact = false,
  className,
}: {
  initial?: ThemePreference;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [theme, setTheme] = useState<ThemePreference>(initial ?? "system");
  const [elegido, setElegido] = useState(Boolean(initial));
  const [, startTransition] = useTransition();

  // El tema de la PÁGINA ya lo pintó el servidor. Lo único que se resuelve al
  // hidratar es qué opción aparece marcada en el conmutador, leyéndolo del
  // propio atributo: así el componente se puede colocar en cualquier sitio sin
  // arrastrar la cookie por todas las capas de layout.
  useEffect(() => {
    if (elegido) return;
    const actual = document.documentElement.getAttribute("data-theme");
    setTheme(actual === "light" || actual === "dark" ? actual : "system");
  }, [elegido]);

  function aplicar(value: ThemePreference) {
    const root = document.documentElement;
    if (value === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", value);
  }

  function elegir(value: ThemePreference) {
    setElegido(true);
    setTheme(value);
    // El atributo se pone AQUÍ, no en un efecto: guardar la preferencia es una
    // server action y su transición vuelve a renderizar la ruta con la cookie
    // anterior, lo que revertía el atributo antes de que la nueva llegara.
    // Aplicarlo en el manejador también da respuesta inmediata al clic.
    aplicar(value);
    startTransition(async () => {
      await setThemePreference(value);
      // `layout.tsx` pinta `data-theme` en <html>: el atributo lo gobierna
      // React, no este componente. Sin refrescar, el árbol de cliente sigue
      // creyendo el tema anterior, y cualquier re-render posterior del layout
      // —otra server action, una navegación blanda— revertiría el atributo que
      // acabamos de poner a mano. El refresco vuelve a renderizarlo ya con la
      // cookie nueva, así que servidor y cliente dicen lo mismo.
      router.refresh();
    });
  }

  return (
    <div
      className={cn("nf-theme-switch", className)}
      role="radiogroup"
      aria-label={t("theme.label")}
      data-compact={compact ? "" : undefined}
    >
      {OPCIONES.map(({ value, icon: Icon, label }) => {
        const activa = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={activa}
            className="nf-theme-switch__option"
            onClick={() => elegir(value)}
          >
            <Icon size={14} aria-hidden="true" />
            <span className={compact ? "nf-sr-only" : undefined}>{t(label)}</span>
          </button>
        );
      })}
    </div>
  );
}
