import { useEffect, useState } from "react";

export function createRequestKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function useCreateRequest(key: string) {
  const [requested, setRequested] = useState(false);
  const requestKey = createRequestKey(key);

  useEffect(() => {
    const read = () => {
      const value = new URLSearchParams(window.location.search).get("create");
      setRequested(value === "1" || value === requestKey);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [requestKey]);

  function clear() {
    const url = new URL(window.location.href);
    url.searchParams.delete("create");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
    setRequested(false);
  }

  return [requested, clear] as const;
}
