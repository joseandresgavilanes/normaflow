"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Modal from "@/components/ui/Modal";
import FileImportArea from "@/components/ui/FileImportArea";
import { formatDate } from "@/lib/utils";
import { useWorkspace, type EvidenceItem } from "@/context/WorkspaceStore";

function previewUrlFor(ev: EvidenceItem): string {
  return ev.blobUrl ?? ev.fileUrl;
}

function EvidencePreview({ ev }: { ev: EvidenceItem }) {
  const url = previewUrlFor(ev);
  const mime = ev.mimeType ?? "";

  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)($|\?)/i.test(url)) {
    return <img src={url} alt={ev.title} style={{ maxWidth: "100%", maxHeight: 520, objectFit: "contain", borderRadius: 8, border: "1px solid var(--nf-line)" }} />;
  }

  if (mime === "application/pdf" || /\.pdf($|\?)/i.test(url)) {
    return <iframe title="PDF" src={url} style={{ width: "100%", height: 480, border: "1px solid var(--nf-line)", borderRadius: 8 }} />;
  }

  return (
    <div style={{ padding: 20, background: "var(--nf-app-surface-2)", borderRadius: 8, fontSize: 14 }}>
      <p className="nf-app-help" style={{ marginTop: 0, fontWeight: 700, color: "var(--nf-ink)" }}>Vista previa no disponible en el navegador</p>
      <p className="nf-app-help">Tipo MIME: {mime || "desconocido"}</p>
      {ev.fileSize != null && <p className="nf-app-help">Tamaño: {(ev.fileSize / 1024).toFixed(1)} KB</p>}
      <p className="nf-app-help">En producción el archivo vendría de tu almacenamiento seguro. Aquí puedes abrir el enlace local o de demostración.</p>
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
  const [originFilter, setOriginFilter] = useState<"ALL" | "MANUAL" | "AUTOMATED" | "INTEGRATION">("ALL");

  const filtered = evidence.filter(ev => originFilter === "ALL" || (ev.origin ?? "MANUAL") === originFilter);

  function handleEvidencePick(file: File | null) {
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
        origin: "MANUAL",
        relatedEntityType: null,
        relatedEntityId: null,
        framework: null,
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
        onAction={() => document.getElementById("evidence-import-input")?.click()}
      />

      <div style={{ marginBottom: 16 }}>
        <FileImportArea
          baseId="evidence-import"
          file={null}
          onFileChange={handleEvidencePick}
          label="Zona de carga"
          hint="Los archivos se procesan en el navegador; no se suben a servidor en esta demo."
          compact
          disabled={busy}
        />
      </div>

      {busy && <p className="nf-app-help" style={{ marginBottom: 12 }}>Procesando…</p>}

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <span className="nf-filter-label">Origen</span>
        {(["ALL", "MANUAL", "AUTOMATED", "INTEGRATION"] as const).map(o => (
          <button
            key={o}
            type="button"
            className={originFilter === o ? "nf-chip nf-chip--on" : "nf-chip"}
            onClick={() => setOriginFilter(o)}
          >
            {o === "ALL" ? "Todos" : o === "MANUAL" ? "Manual" : o === "AUTOMATED" ? "Automatizada" : "Integración"}
          </button>
        ))}
      </div>

      <Card style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="nf-data-table-wrap">
            <div className="nf-data-table-empty">No hay evidencias. Sube un archivo o recarga para ver datos demo.</div>
          </div>
        ) : (
          <div className="nf-data-table-wrap">
            <table className="nf-data-table" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  {["Título", "Origen", "Vínculo", "Marco", "Fecha", ""].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(ev => (
                  <tr
                    key={ev.id}
                    onClick={() => setPreview(ev)}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ fontWeight: 600 }}>{ev.title}</td>
                    <td style={{ fontSize: 13, fontWeight: 600, color: "var(--nf-ink-2)" }}>{ev.origin ?? "MANUAL"}</td>
                    <td style={{ fontSize: 13, fontWeight: 500, color: "var(--nf-ink-2)" }}>
                      {ev.relatedEntityType && ev.relatedEntityId ? `${ev.relatedEntityType} ${ev.relatedEntityId}` : ev.module || "—"}
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 500, color: "var(--nf-ink-2)" }}>{ev.framework ?? "—"}</td>
                    <td style={{ fontSize: 13, fontWeight: 600, color: "var(--nf-ink-2)" }}>{formatDate(ev.createdAt)}</td>
                    <td>
                      <span style={{ color: "#123C66", fontWeight: 700 }}>Vista previa →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
