"use client";

import { useCallback, useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { FileText, Upload, X } from "lucide-react";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export type FileImportAreaProps = {
  /** Prefix for input id (`${baseId}-input`) so external triggers can call `.click()`. */
  baseId?: string;
  accept?: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** Visible title (e.g. "Archivo de esta revisión") */
  label: string;
  /** Short line under the zone (formats, demo notice, etc.) */
  hint?: string;
  disabled?: boolean;
  /** Tighter layout for toolbars or dense modals */
  compact?: boolean;
};

/**
 * Drop zone + file picker for modals and forms. Matches NormaFlow app surfaces and navy accent.
 */
export default function FileImportArea({
  baseId: baseIdProp,
  accept,
  file,
  onFileChange,
  label,
  hint,
  disabled = false,
  compact = false,
}: FileImportAreaProps) {
  const reactId = useId();
  const baseId = baseIdProp ?? `nf-file-import-${reactId.replace(/:/g, "")}`;
  const inputId = `${baseId}-input`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const pickFile = useCallback(
    (f: File | undefined) => {
      if (!f || disabled) return;
      onFileChange(f);
    },
    [disabled, onFileChange]
  );

  const onInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      pickFile(e.target.files?.[0]);
      e.target.value = "";
    },
    [pickFile]
  );

  const openPicker = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const onDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setDragOver(true);
    },
    [disabled]
  );

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (disabled) return;
      pickFile(e.dataTransfer.files?.[0]);
    },
    [disabled, pickFile]
  );

  const minH = compact ? 92 : 128;
  const pad = compact ? "14px 16px" : "20px 18px";

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--nf-ink)",
          marginBottom: 8,
          letterSpacing: "-0.01em",
        }}
      >
        {label}
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        hidden
        onChange={onInputChange}
      />

      {!file ? (
        <button
          type="button"
          disabled={disabled}
          onClick={openPicker}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          aria-describedby={hint ? `${baseId}-hint` : undefined}
          style={{
            width: "100%",
            minHeight: minH,
            padding: pad,
            boxSizing: "border-box",
            borderRadius: 14,
            border: `2px dashed ${dragOver ? "#123C66" : "rgba(18, 60, 102, 0.22)"}`,
            background: dragOver
              ? "linear-gradient(160deg, rgba(18, 60, 102, 0.08) 0%, #f4f7fc 55%, #fff 100%)"
              : "linear-gradient(180deg, #fbfcfe 0%, #f5f7fb 100%)",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.55 : 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: compact ? 8 : 10,
            textAlign: "center",
            transition: "border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease",
            boxShadow: dragOver ? "0 0 0 3px rgba(18, 60, 102, 0.12)" : "inset 0 1px 0 rgba(255,255,255,0.85)",
            color: "inherit",
            font: "inherit",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: compact ? 40 : 48,
              height: compact ? 40 : 48,
              borderRadius: 12,
              background: dragOver ? "rgba(18, 60, 102, 0.12)" : "rgba(18, 60, 102, 0.07)",
              color: "#123C66",
            }}
          >
            <Upload size={compact ? 20 : 24} strokeWidth={2} aria-hidden />
          </span>
          <div>
            <div style={{ fontSize: compact ? 13 : 14, fontWeight: 700, color: "var(--nf-ink)", lineHeight: 1.35 }}>
              {dragOver ? "Suelta para adjuntar" : "Arrastra aquí o elige archivo"}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 4, lineHeight: 1.45 }}>
              Un solo archivo · vista previa local en esta demo
            </div>
          </div>
        </button>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 14px",
            borderRadius: 14,
            border: "1px solid rgba(18, 60, 102, 0.14)",
            background: "linear-gradient(135deg, #fff 0%, #f8fafc 100%)",
            boxShadow: "0 1px 2px rgba(18, 60, 102, 0.06)",
          }}
        >
          <span
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "rgba(18, 60, 102, 0.08)",
              color: "#123C66",
            }}
          >
            <FileText size={22} strokeWidth={2} aria-hidden />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--nf-ink)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={file.name}
            >
              {file.name}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 3 }}>{formatBytes(file.size)}</div>
          </div>
          <div style={{ display: "flex", flexShrink: 0, gap: 6, alignItems: "center" }}>
            <button
              type="button"
              disabled={disabled}
              onClick={openPicker}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid rgba(18, 60, 102, 0.2)",
                background: "#fff",
                fontSize: 12,
                fontWeight: 700,
                color: "#123C66",
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            >
              Cambiar
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onFileChange(null)}
              aria-label="Quitar archivo"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 38,
                height: 38,
                borderRadius: 10,
                border: "1px solid var(--nf-line)",
                background: "#fff",
                color: "var(--nf-ink-3)",
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            >
              <X size={18} strokeWidth={2.5} aria-hidden />
            </button>
          </div>
        </div>
      )}

      {hint && (
        <p id={`${baseId}-hint`} className="nf-app-help" style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.5 }}>
          {hint}
        </p>
      )}
    </div>
  );
}
