"use client";
import { useEffect } from "react";
import { useWorkspaceOptional } from "@/context/WorkspaceStore";
import { useI18n } from "@/context/I18nProvider";
import { useAnnounce } from "@/components/ui/LiveRegion";

/**
 * El toast se pintaba con estilo inline y sin región live: era invisible para
 * lectores de pantalla.
 *
 * Ahora delega el anuncio en el anunciador global —que vive permanentemente en
 * el DOM, como exige la especificación— en lugar de declarar su propio
 * `aria-live`, que al montarse a la vez que el mensaje muchos lectores no
 * llegan a leer.
 */
export default function WorkspaceToast() {
  const ws = useWorkspaceOptional();
  const { tx } = useI18n();
  const announce = useAnnounce();
  const toast = ws?.state.toast;
  const message = toast ? tx(toast) : "";

  useEffect(() => {
    if (message) announce(message, "polite");
  }, [announce, message]);

  if (!message) return null;

  // `presentation`: el contenido ya se anuncia por el anunciador global; sin
  // esto el mensaje se leería dos veces.
  return (
    <div className="nf-toast" role="presentation">
      {message}
    </div>
  );
}
