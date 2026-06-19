"use client";

import { useEffect } from "react";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";

export default function AppError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error("[app] live route failed:", error);
  }, [error]);

  return <LiveDataUnavailable section="los datos de esta sección" />;
}
