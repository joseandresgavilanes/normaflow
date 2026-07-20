"use client";
import { useWorkspaceOptional } from "@/context/WorkspaceStore";
import { useI18n } from "@/context/I18nProvider";

import { Z_INDEX } from "@/lib/z-index";

export default function WorkspaceToast() {
  const ws = useWorkspaceOptional();
  const { tx } = useI18n();
  if (!ws?.state.toast) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: Z_INDEX.toast,
        background: "var(--nf-ink)",
        color: "#fff",
        padding: "12px 18px",
        borderRadius: 10,
        fontSize: 14,
        boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
        maxWidth: 360,
      }}
    >
      {tx(ws.state.toast)}
    </div>
  );
}
