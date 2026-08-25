"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { isActionFailure } from "@/lib/actions/unwrap";

/**
 * Ejecuta server actions (o mutaciones async del admin live) y:
 * - refresca datos del servidor
 * - cierra modales vía onSuccess
 * - muestra error / mensaje de éxito breve
 */
export function useServerAction(options?: { refresh?: boolean }) {
  const router = useRouter();
  const refreshEnabled = options?.refresh !== false;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Los errores de una mutación son útiles para corregir el formulario, pero
  // no deben quedarse pegados al módulo después de que el usuario ya los vio.
  useEffect(() => {
    if (!error) return;
    const timeoutId = window.setTimeout(() => setError(""), 6000);
    return () => window.clearTimeout(timeoutId);
  }, [error]);

  const run = useCallback(
    (
      fn: () => void | Promise<unknown>,
      runOptions?: { onSuccess?: () => void; successMessage?: string },
    ) => {
      setError("");
      setSuccess("");
      startTransition(async () => {
        try {
          /* Una acción envuelta en `actionResult` devuelve el fallo en vez de
             lanzarlo, porque Next reescribe el mensaje de cualquier excepción
             que escape de una Server Action en las builds de producción. Aquí
             vuelve a ser excepción, ya en el navegador, y el `catch` de abajo
             enseña el texto que escribió la acción. */
          const outcome = await fn();
          if (isActionFailure(outcome)) throw new Error(outcome.message);
          if (refreshEnabled) router.refresh();
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("normaflow:server-action-success"));
          }
          runOptions?.onSuccess?.();
          if (runOptions?.successMessage) {
            setSuccess(runOptions.successMessage);
            window.setTimeout(() => setSuccess(""), 4500);
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Error en la operación.";
          setError(message);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("normaflow:server-action-error", { detail: { message } }));
          }
        }
      });
    },
    [router, refreshEnabled],
  );

  return { run, isPending, error, setError, success, setSuccess };
}

/** Acciones locales (workspace/demo) sin refresh de servidor. */
export function useModalAction() {
  return useServerAction({ refresh: false });
}
