/** Elimina sesiones Supabase antiguas guardadas en localStorage (cliente legacy). */
export function clearSupabaseLegacyStorage() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("sb-")) localStorage.removeItem(key);
    }
  } catch {
    /* private mode / quota */
  }
}
