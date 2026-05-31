"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Supabase a veces redirige al Site URL (/home) con tokens o errores en el hash.
 * Este componente reenvía a /auth/confirm para procesarlos correctamente.
 */
export default function AuthHashRedirect() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;

    const isAuthHash =
      hash.includes("access_token=") ||
      hash.includes("error=") ||
      hash.includes("error_code=");

    if (!isAuthHash) return;

    const skip = pathname.startsWith("/auth/");
    if (skip) return;

    const target = `/auth/confirm${window.location.search}${hash}`;
    window.location.replace(target);
  }, [pathname]);

  return null;
}
