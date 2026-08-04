"use client";
import { useState } from "react";
import { Check, RefreshCw, Sparkles, X } from "lucide-react";
import { useI18n } from "@/context/I18nProvider";
import type { MessageKey } from "@/lib/i18n/messages";

const CONTEXT_LABEL_KEYS: Record<string, MessageKey> = {
  gap: "ai.context.gap",
  risk: "ai.context.risk",
  document: "ai.context.document",
  audit: "ai.context.audit",
  nc: "ai.context.nc",
};

const PROMPT_KEYS: Record<string, MessageKey> = {
  gap: "ai.prompt.gap",
  risk: "ai.prompt.risk",
  document: "ai.prompt.document",
  audit: "ai.prompt.audit",
  nc: "ai.prompt.nc",
};

export default function AIPanel({
  open,
  onClose,
  context,
}: {
  open: boolean;
  onClose: () => void;
  context: string;
}) {
  const { locale, t, tx } = useI18n();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  const callAI = async (promptOverride?: string) => {
    setLoading(true);
    setResult("");
    setConfirmed(false);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: promptOverride || t(PROMPT_KEYS[context] ?? PROMPT_KEYS.gap),
          context,
          locale,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(typeof data.error === "string" ? tx(data.error) : t("ai.errorSuggestion"));
      } else {
        setResult(data.text || t("ai.errorSuggestion"));
      }
    } catch {
      setResult(t("ai.errorConnect"));
    }
    setLoading(false);
  };

  if (!open) return null;

  return (
    <div
      className="nf-ai-panel"
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        bottom: 0,
        background: "var(--nf-surface)",
        borderLeft: "1px solid var(--nf-border)",
        zIndex: 900,
        display: "flex",
        flexDirection: "column",
        boxShadow: "-8px 0 40px rgba(0,0,0,0.07)",
      }}
    >
      <div
        style={{
          padding: "18px 20px 14px",
          borderBottom: "1px solid var(--nf-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={18} strokeWidth={2} color="var(--nf-success-text)" aria-hidden />
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--nf-ink)" }}>
              {t("ai.title")}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--nf-ink-2, #223648)", marginTop: 2 }}>
            {t("ai.humanReview")}
          </div>
        </div>
        <button
          type="button"
          className="nf-icon-btn"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          <X size={18} strokeWidth={2} aria-hidden />
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Context badge */}
        <div
          style={{
            background: "var(--nf-app-panel)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            color: "var(--nf-ink-2, #223648)",
            border: "1px solid var(--nf-border)",
          }}
        >
          <strong style={{ color: "var(--nf-ink)" }}>{t("ai.context")}</strong>{" "}
          {CONTEXT_LABEL_KEYS[context] ? t(CONTEXT_LABEL_KEYS[context]) : t("common.general")}
        </div>

        {/* Custom prompt */}
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--nf-ink-2, #223648)",
              display: "block",
              marginBottom: 6,
            }}
          >
            {t("ai.customPrompt")}
          </label>
          <textarea aria-label={t("ai.customPromptPlaceholder")}
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder={t("ai.customPromptPlaceholder")}
            rows={3}
            style={{
              width: "100%",
              padding: "8px 10px",
              border: "1px solid var(--nf-border)",
              borderRadius: 8,
              fontSize: 13,
              outline: "none",
              resize: "vertical",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
        </div>

        {!result && !loading && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <Sparkles size={40} strokeWidth={1.5} color="var(--nf-success-text)" aria-hidden />
            </div>
            <p
              style={{
                fontSize: 13,
                color: "var(--nf-ink-2, #223648)",
                lineHeight: 1.6,
                marginBottom: 0,
              }}
            >
              {t("ai.empty")}
            </p>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 13, color: "var(--nf-ink-2, #223648)", marginBottom: 10 }}>
              {t("ai.loadingContext")}
            </div>
            <div
              style={{
                height: 3,
                background: "var(--nf-surface-sunken)",
                borderRadius: 99,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: "50%",
                  background: "var(--nf-primary)",
                  borderRadius: 99,
                  animation: "slide 1.2s ease-in-out infinite alternate",
                }}
              />
            </div>
            <style>{`@keyframes slide{from{margin-left:0}to{margin-left:50%}}`}</style>
          </div>
        )}

        {result && !loading && (
          <div>
            <div
              style={{
                background: "var(--nf-app-panel)",
                border: "1px solid var(--nf-border)",
                borderRadius: 10,
                padding: 16,
                fontSize: 13,
                lineHeight: 1.75,
                color: "var(--nf-ink)",
                whiteSpace: "pre-wrap",
              }}
            >
              {result}
            </div>
            {!confirmed ? (
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setConfirmed(true)}
                  className="nf-app-btn-success"
                  style={{ flex: 1 }}
                >
                  <Check size={16} strokeWidth={2.5} aria-hidden />
                  {t("ai.confirmApply")}
                </button>
                <button
                  type="button"
                  onClick={() => setResult("")}
                  className="nf-app-btn-ghost"
                  style={{ flex: 1 }}
                >
                  {t("ai.dismiss")}
                </button>
              </div>
            ) : (
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "var(--nf-surface-sunken)",
                  border: "1px solid #16A34A40",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "var(--nf-success-text)",
                  fontWeight: 500,
                }}
              >
                <Check size={16} strokeWidth={2.5} aria-hidden />
                {t("ai.confirmed")}
              </div>
            )}
            <button
              type="button"
              onClick={() => callAI(customPrompt || undefined)}
              className="nf-app-btn-ghost"
              style={{ marginTop: 10, width: "100%" }}
            >
              <RefreshCw size={14} strokeWidth={2} aria-hidden />
              {t("ai.regenerate")}
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: 16, borderTop: "1px solid var(--nf-border)" }}>
        <button
          type="button"
          onClick={() => callAI(customPrompt || undefined)}
          disabled={loading}
          className="nf-app-btn-primary"
          style={{ width: "100%" }}
        >
          {loading ? (
            t("ai.generating")
          ) : (
            <>
              <Sparkles size={17} strokeWidth={2} aria-hidden />
              {t("ai.generate")}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
