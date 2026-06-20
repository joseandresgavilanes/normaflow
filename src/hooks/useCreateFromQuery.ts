"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Opens a create modal when the URL contains `?create=1`, then strips the query param. */
export function useCreateFromQuery(enabled: boolean, onOpen: () => void) {
  const router = useRouter();
  const pathname = usePathname();
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") !== "1") return;
    if (enabled) onOpenRef.current();
    router.replace(pathname, { scroll: false });
  }, [enabled, router, pathname]);
}
