"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Modal from "@/components/ui/Modal";
import { formatDate } from "@/lib/utils";
import { useWorkspace, type EvidenceItem } from "@/context/WorkspaceStore";

function previewUrlFor(ev: EvidenceItem): string {
  return ev.blobUrl ?? ev.fileUrl;
}

function EvidencePreview({ ev }: { ev: EvidenceItem }) {
  const url = previewUrlFor(ev);
  const mime = ev.mimeType ?? "";

  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)($|\?)/i.test(url)) {
    return <img src={url} alt={ev.title} style={{ maxWidth: "100%", maxHeight: 520, objectFit: "contain", borderRadius: 8, border: "1px solid #E5EAF2" }} />;
  }

  if (mime === "application/pdf" || /\.pdf($|\?)/i.test(url)) {
    return <iframe title="PDF" src={url} style={{ width: "100%", height: 480, border: "1px solid #E5EAF2", borderRadius: 8 }} />;
  }

  return (
    <div style={{ padding: 20, background: "#F7F9FC", borderRadius: 8, fontSize: 14 }}>
      <p style={{ marginTop: 0, color: "#142033", fontWeight: 600 }}>Vista previa no disponible en el navegador</p>
      <p style={{ color: "#5E6B7A", fontSize: 13 }}>Tipo MIME: {mime || "desconocido"}</p>
      {ev.fileSize != null && <p style={{ color: "#5E6B7A", fontSize: 13 }}>Tamaño: {(ev.fileSize / 1024).toFixed(1)} KB</p>}
      <p style={{ color: "#5E6B7A", fontSize: 13 }}>En producción el archivo vendría de tu almacenamiento seguro. Aquí puedes abrir el enlace local o de demostración.</p>
      <a href={url} target="_blank" rel="noopener noreferrer" download style={{ color: "#123C66", fontWeight: 600 }}>
        Abrir o descargar
      </a>
    </div>
  );
}

export default function EvidenceModule() {
  const { state, dispatch, showToast } = useWorkspace();
  const { evidence } = state;
  const [preview, setPreview] = useState<EvidenceItem | null>(null);
  const [busy, setBusy] = useState(false);

  function onUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const blobUrl = URL.createObjectURL(file);
      const ev: EvidenceItem = {
        id: `ev-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, "") || file.name,
        module: "upload",
        fileUrl: file.name,
        mimeType: file.type || null,
        fileSize: file.size,
        createdAt: new Date().toISOString(),
        blobUrl,
      };
      dispatch({ type: "addEvidence", ev });
      showToast("Evidencia añadida (solo en esta sesión)");
      setPreview(ev);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <SectionTitle
        title="Repositorio de evidencias"
        sub="Pruebas vinculadas a auditorías, riesgos y documentos · Vista previa según tipo de archivo"
        action="+ Subir evidencia"
        onAction={() => document.getElementById("evidence-file-input")?.click()}
      />
      <input id="evidence-file-input" type="file" hidden onChange={e => onUpload(e.target.files)} />

      {busy && <p style={{ fontSize: 13, color: "#5E6B7A", marginBottom: 12 }}>Procesando…</p>}

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {evidence.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#5E6B7A", fontSize: 14 }}>No hay evidencias. Sube un archivo o recarga para ver datos demo.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#F7F9FC", borderBottom: "1px solid #E5EAF2" }}>
                {["Título", "Módulo", "Tipo", "Fecha", ""].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "12px 16px", color: "#5E6B7A", fontWeight: 600 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {evidence.map(ev => (
                <tr
                  key={ev.id}
                  onClick={() => setPreview(ev)}
                  style={{ borderBottom: "1px solid #E5EAF2", cursor: "pointer" }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLTableRowElement).style.background = "#F7F9FC";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                  }}
                >
                  <td style={{ padding: "12px 16px", color: "#142033", fontWeight: 500 }}>{ev.title}</td>
                  <td style={{ padding: "12px 16px", color: "#5E6B7A" }}>{ev.module || "—"}</td>
                  <td style={{ padding: "12px 16px", color: "#5E6B7A", fontSize: 12 }}>{ev.mimeType || "—"}</td>
                  <td style={{ padding: "12px 16px", color: "#5E6B7A" }}>{formatDate(ev.createdAt)}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ color: "#123C66", fontWeight: 600 }}>Vista previa →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? "Vista previa"} width={720}>
        {preview && (
          <div>
            <EvidencePreview ev={preview} />
          </div>
        )}
      </Modal>
    </div>
  );
}
