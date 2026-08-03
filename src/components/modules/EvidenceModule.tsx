"use client";
import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
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
      <p className="nf-app-help">En producción el archivo vendría de tu almacenamiento seguro. Aquí puedes abrir el enlace disponible en el workspace.</p>
      <a href={url} target="_blank" rel="noopener noreferrer" download style={{ color: "var(--nf-primary)", fontWeight: 600 }}>
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

  const columns = useMemo<DataTableColumn<EvidenceItem>[]>(() => [
    { id: "title", header: "Título", primary: true, minWidth: 200, hideable: false, sortValue: (ev) => ev.title,
      cell: (ev) => <span style={{ fontWeight: 600 }}>{ev.title}</span> },
    { id: "origin", header: "Origen", minWidth: 120, sortValue: (ev) => ev.origin ?? "MANUAL",
      cell: (ev) => <span style={{ fontWeight: 600, color: "var(--nf-ink-2)" }}>{ev.origin ?? "MANUAL"}</span> },
    { id: "link", header: "Vínculo", minWidth: 160, sortValue: (ev) => ev.relatedEntityType ?? ev.module ?? "",
      cell: (ev) => <span style={{ fontWeight: 500, color: "var(--nf-ink-2)" }}>{ev.relatedEntityType && ev.relatedEntityId ? `${ev.relatedEntityType} ${ev.relatedEntityId}` : ev.module || "—"}</span> },
    { id: "framework", header: "Marco", minWidth: 120, sortValue: (ev) => ev.framework ?? "",
      cell: (ev) => <span style={{ fontWeight: 500, color: "var(--nf-ink-2)" }}>{ev.framework ?? "—"}</span> },
    { id: "date", header: "Fecha", minWidth: 120, numeric: true, sortValue: (ev) => String(ev.createdAt ?? ""),
      cell: (ev) => <span style={{ fontWeight: 600, color: "var(--nf-ink-2)" }}>{formatDate(ev.createdAt)}</span> },
  ], []);


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
          hint="Los archivos se procesan en el navegador; no se suben a servidor en esta sesión local."
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
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(ev) => ev.id}
          rowAction={(ev) => setPreview(ev)}
          caption="Evidencias: título, origen, vínculo con la entidad, marco normativo y fecha de carga."
          storageKey="evidence-module"
          empty={<EmptyState kind="empty" title="No hay evidencias." description="Sube un archivo para empezar a registrar el soporte documental de cada requisito." />}
        />
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
