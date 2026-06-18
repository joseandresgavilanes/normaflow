"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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

  const run = useCallback(
    (
      fn: () => void | Promise<unknown>,
      runOptions?: { onSuccess?: () => void; successMessage?: string },
    ) => {
      setError("");
      setSuccess("");
      startTransition(async () => {
        try {
          await fn();
          if (refreshEnabled) router.refresh();
          runOptions?.onSuccess?.();
          if (runOptions?.successMessage) {
            setSuccess(runOptions.successMessage);
            window.setTimeout(() => setSuccess(""), 4500);
          }
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : "Error en la operación.");
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
