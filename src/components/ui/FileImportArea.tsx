"use client";

import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { FileText, ImageIcon, Upload, X } from "lucide-react";
import { useI18n } from "@/context/I18nProvider";

/**
 * Zona de adjuntos.
 *
 * Es el patrón de «Entradas del registro»: se arrastra o se elige, y una vez
 * elegido el archivo se ve —nombre, peso y, si es imagen, su miniatura— con
 * «Cambiar» y «Quitar» a mano. Un `<input type="file">` pelado no dice qué has
 * adjuntado más allá de un nombre en gris, no admite arrastrar, y su botón lo
 * pinta el sistema operativo, así que ni sigue el tema ni está en español.
 *
 * El campo real sigue siendo un `<input type="file">` de verdad, solo que
 * invisible: por eso el archivo viaja en el FormData con su `name` y `required`
 * dispara la validación del navegador, sin que el formulario tenga que
 * enterarse de nada.
 */

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Lista de extensiones legible: «PDF, Word, Excel o imagen». */
function describeAccept(accept?: string) {
  if (!accept) return null;
  const partes = accept.split(",").map((p) => p.trim().toLowerCase());
  const grupos = new Set<string>();
  partes.forEach((parte) => {
    if (parte.startsWith("image/")) grupos.add("imagen");
    else if ([".doc", ".docx"].includes(parte)) grupos.add("Word");
    else if ([".xls", ".xlsx", ".csv"].includes(parte)) grupos.add("Excel");
    else if ([".ppt", ".pptx"].includes(parte)) grupos.add("PowerPoint");
    else if (parte.startsWith(".")) grupos.add(parte.slice(1).toUpperCase());
    else grupos.add(parte);
  });
  return [...grupos].join(" · ");
}

export type FileImportAreaProps = {
  /** Prefijo del id del input (`${baseId}-input`) para dispararlo desde fuera. */
  baseId?: string;
  /** Clave del FormData. Con ella el archivo viaja solo en el envío. */
  name?: string;
  accept?: string;
  /** Modo controlado. Sin estas dos props el componente se gobierna solo. */
  file?: File | null;
  onFileChange?: (file: File | null) => void;
  label: string;
  /** Línea de ayuda bajo la zona. */
  hint?: string;
  /** Texto dentro de la zona vacía. Si falta, se describe `accept` y el máximo. */
  zoneNote?: string;
  disabled?: boolean;
  required?: boolean;
  /** Tamaño máximo en MB. Se avisa en el sitio, antes de enviar nada. */
  maxSizeMB?: number;
  /** Disposición apretada para modales densos. */
  compact?: boolean;
};

export default function FileImportArea({
  baseId: baseIdProp,
  name,
  accept,
  file: fileProp,
  onFileChange,
  label,
  hint,
  zoneNote,
  disabled = false,
  required = false,
  maxSizeMB,
  compact = false,
}: FileImportAreaProps) {
  const { tx } = useI18n();
  const reactId = useId();
  const baseId = baseIdProp ?? `nf-file-${reactId.replace(/:/g, "")}`;
  const inputId = `${baseId}-input`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [interno, setInterno] = useState<File | null>(null);

  const controlado = fileProp !== undefined;
  const file = controlado ? fileProp : interno;

  // Miniatura solo para imágenes: en un adjunto visual, el nombre del archivo
  // no dice nada y la miniatura lo dice todo.
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const aplicar = useCallback(
    (elegido: File | null) => {
      if (elegido && maxSizeMB && elegido.size > maxSizeMB * 1024 * 1024) {
        setError(`El archivo pesa ${formatBytes(elegido.size)} y el máximo son ${maxSizeMB} MB.`);
        return;
      }
      setError("");
      if (!controlado) setInterno(elegido);
      onFileChange?.(elegido);
    },
    [controlado, maxSizeMB, onFileChange],
  );

  /** El archivo soltado tiene que acabar dentro del input real, o no viajaría
   *  en el FormData: arrastrar y elegir deben dejar el campo en el mismo sitio. */
  const soltar = useCallback(
    (dropped: File | undefined) => {
      if (!dropped || disabled) return;
      const input = inputRef.current;
      if (input) {
        const datos = new DataTransfer();
        datos.items.add(dropped);
        input.files = datos.files;
      }
      aplicar(dropped);
    },
    [aplicar, disabled],
  );

  const onInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    aplicar(event.target.files?.[0] ?? null);
  }, [aplicar]);

  const abrir = useCallback(() => {
    if (disabled) return;
    // Se vacía ANTES de abrir: si no, volver a elegir el mismo archivo no
    // dispararía `change` y parecería que el selector no responde.
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.click();
  }, [disabled]);

  const quitar = useCallback(() => {
    if (inputRef.current) inputRef.current.value = "";
    aplicar(null);
  }, [aplicar]);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) setDragOver(true);
  }, [disabled]);

  const onDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
  }, []);

  const onDrop = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    soltar(event.dataTransfer.files?.[0]);
  }, [soltar]);

  const formatos = describeAccept(accept);
  const nota =
    zoneNote ?? ([formatos, maxSizeMB ? `máximo ${maxSizeMB} MB` : null].filter(Boolean).join(" · ") || "Un solo archivo");

  return (
    <div className="nf-file" data-compact={compact || undefined}>
      <div className="nf-file__label">{tx(label)}</div>

      {/* El campo real. Invisible pero presente y enfocable: así el archivo va
          en el FormData y `required` puede anclar su validación. */}
      <input
        ref={inputRef}
        id={inputId}
        className="nf-file__native"
        type="file"
        name={name}
        accept={accept}
        required={required && !file}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        onChange={onInputChange}
        onInvalid={(event) => {
          event.preventDefault();
          setError("Adjunta un archivo.");
        }}
      />

      {!file ? (
        <button
          type="button"
          className="nf-file__zone"
          data-drag={dragOver || undefined}
          data-invalid={error ? true : undefined}
          disabled={disabled}
          onClick={abrir}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          aria-describedby={hint ? `${baseId}-hint` : undefined}
        >
          <span className="nf-file__zone-icon">
            <Upload size={compact ? 20 : 24} strokeWidth={2} aria-hidden />
          </span>
          <span className="nf-file__zone-text">
            <span className="nf-file__zone-title">
              {dragOver ? tx("Suelta para adjuntar") : tx("Arrastra aquí o elige archivo")}
            </span>
            <span className="nf-file__zone-note">{tx(nota)}</span>
          </span>
        </button>
      ) : (
        <div className="nf-file__card">
          <span className="nf-file__thumb">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="nf-file__thumb-img" />
            ) : file.type.startsWith("image/") ? (
              <ImageIcon size={22} strokeWidth={2} aria-hidden />
            ) : (
              <FileText size={22} strokeWidth={2} aria-hidden />
            )}
          </span>
          <span className="nf-file__meta">
            <span className="nf-file__name" title={file.name}>{file.name}</span>
            <span className="nf-file__size">{formatBytes(file.size)}</span>
          </span>
          <span className="nf-file__actions">
            <button type="button" className="nf-app-btn-ghost nf-app-btn-sm" data-nf-no-action-icon disabled={disabled} onClick={abrir}>
              {tx("Cambiar")}
            </button>
            <button
              type="button"
              className="nf-file__remove"
              data-nf-no-action-icon
              disabled={disabled}
              onClick={quitar}
              aria-label={tx("Quitar archivo")}
            >
              <X size={16} strokeWidth={2.5} aria-hidden />
            </button>
          </span>
        </div>
      )}

      {error && <p className="nf-file__error" role="alert">{tx(error)}</p>}
      {hint && !error && (
        <p id={`${baseId}-hint`} className="nf-file__hint">{tx(hint)}</p>
      )}
    </div>
  );
}
