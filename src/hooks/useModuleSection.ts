"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Keeps a module's current section addressable in the URL while preserving the
 * existing button-based navigation used by the app. This makes every section
 * reloadable and shareable without putting the module's data in a single view.
 */
export function useModuleSection<T extends string>(fallback: T): [T, (section: T) => void] {
  const [section, setSection] = useState<T>(fallback);
  const searchParams = useSearchParams();

  useEffect(() => {
    const value = searchParams.get("section");
    setSection(value ? (value as T) : fallback);
  }, [fallback, searchParams]);

  useEffect(() => {
    const read = () => {
      const value = new URLSearchParams(window.location.search).get("section");
      if (value) setSection(value as T);
      else setSection(fallback);
    };

    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [fallback]);

  function navigate(next: T) {
    setSection(next);
    const url = new URL(window.location.href);
    if (next === fallback) url.searchParams.delete("section");
    else url.searchParams.set("section", next);
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return [section, navigate];
}
