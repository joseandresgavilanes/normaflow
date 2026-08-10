"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

/**
 * Guardado automático con retardo.
 *
 * Pensado para los formularios largos del producto (revisión por la
 * dirección, informes al órgano de gobierno, planes de continuidad), donde
 * perder lo escrito por cerrar una pestaña es un fallo caro.
 *
 * Detalles que importan:
 *  · No guarda en el primer render. Montar un formulario no es editarlo.
 *  · Serializa el valor para comparar: guardar de nuevo lo mismo gasta una
 *    escritura y ensucia el AuditLog.
 *  · Avisa antes de cerrar la pestaña si queda algo sin guardar.
 *  · El estado se anuncia de forma educada, nunca interrumpiendo.
 */
export function useAutosave<T>({
  value,
  onSave,
  delay = 1500,
  enabled = true,
  onAnnounce,
}: {
  value: T;
  onSave: (value: T) => void | Promise<unknown>;
  delay?: number;
  enabled?: boolean;
  onAnnounce?: (message: string) => void;
}) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const savedRef = useRef<string | null>(null);
  const valueRef = useRef(value);
  const onSaveRef = useRef(onSave);
  const announceRef = useRef(onAnnounce);
  valueRef.current = value;
  onSaveRef.current = onSave;
  announceRef.current = onAnnounce;

  const save = useCallback(async () => {
    const serialized = JSON.stringify(valueRef.current);
    if (serialized === savedRef.current) return;
    setStatus("saving");
    setError(null);
    try {
      await onSaveRef.current(valueRef.current);
      savedRef.current = serialized;
      setLastSavedAt(new Date());
      setStatus("saved");
      announceRef.current?.("Cambios guardados.");
    } catch (err: unknown) {
      setStatus("error");
      const message = err instanceof Error ? err.message : "No se pudo guardar.";
      setError(message);
      announceRef.current?.(`No se pudo guardar: ${message}`);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const serialized = JSON.stringify(value);
    // Primer render: se toma el valor inicial como ya guardado.
    if (savedRef.current === null) {
      savedRef.current = serialized;
      return undefined;
    }
    if (serialized === savedRef.current) return undefined;

    setStatus("pending");
    const timeoutId = window.setTimeout(() => {
      void save();
    }, delay);
    return () => window.clearTimeout(timeoutId);
  }, [delay, enabled, save, value]);

  // Salvavidas: si el usuario cierra con cambios pendientes, el navegador
  // pregunta. No sustituye al guardado, lo cubre.
  useEffect(() => {
    if (!enabled) return undefined;
    function beforeUnload(event: BeforeUnloadEvent) {
      if (status === "pending" || status === "saving") {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [enabled, status]);

  return { status, lastSavedAt, error, saveNow: save, hasPendingChanges: status === "pending" };
}
