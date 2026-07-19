"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Eye, FileText, Plus, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import DataTable from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import { ConfirmActionModal } from "@/components/ui/ActionDialogs";
import FileImportArea from "@/components/ui/FileImportArea";
import AttestationModal from "@/components/compliance/AttestationModal";
import { useWorkspace, type DocumentRow, type DocVersion } from "@/context/WorkspaceStore";
import { useCreateFromQuery } from "@/hooks/useCreateFromQuery";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import { AUDIT_ACTIONS, createAuditEvent } from "@/lib/domain/audit-event";
import { DOCUMENT_SORT_OPTIONS, sortDocuments, type DocumentSortKey } from "@/lib/documents-sort";
import { formatDate } from "@/lib/utils";
import type { Column } from "@/components/ui/Table";

function isPdfUrl(url: string) {
  return /\.pdf($|\?)/i.test(url) || url.includes("application/pdf");
}

/** Descarga con nombre sugerido; si CORS falla, abre el recurso en una pestaña nueva. */
async function downloadArchivedFile(fileUrl: string, fileName: string) {
  const safeName = fileName.replace(/[^\w.\-()+ ]/g, "_") || "documento.pdf";
  if (fileUrl.startsWith("blob:") || fileUrl.startsWith("data:")) {
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = safeName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }
  try {
    const res = await fetch(fileUrl, { mode: "cors" });
    if (!res.ok) throw new Error("fetch");
    const blob = await res.blob();
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = safeName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(u);
  } catch {
    window.open(fileUrl, "_blank", "noopener,noreferrer");
  }
}

function PreviewBody({ doc, url }: { doc: DocumentRow; url: string | undefined }) {
  const u = url ?? doc.previewUrl ?? "";
  if (!u) {
    return <p style={{ color: "var(--nf-ink-3)", fontSize: 14 }}>No hay archivo asociado en esta sesión. Sube un archivo al crear el documento para previsualizarlo.</p>;
  }
  if (u.startsWith("data:image/") || /\.(png|jpe?g|gif|webp|svg)($|\?)/i.test(u)) {
    return <img src={u} alt={doc.title} style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid var(--nf-line)" }} />;
  }
  if (isPdfUrl(u)) {
    return <iframe title="Vista PDF" src={u} style={{ width: "100%", height: 480, border: "1px solid var(--nf-line)", borderRadius: 8 }} />;
  }
  return (
    <div style={{ padding: 16, background: "var(--nf-app-surface-2)", borderRadius: 8, fontSize: 14, color: "var(--nf-ink)" }}>
      <p style={{ marginTop: 0 }}>Vista previa no disponible para este tipo de archivo en el navegador.</p>
      <p style={{ color: "var(--nf-ink-3)", fontSize: 13 }}>Puedes abrir o descargar el recurso en una nueva pestaña.</p>
      <a href={u} target="_blank" rel="noopener noreferrer" style={{ color: "#5266F6", fontWeight: 600 }}>
        Abrir / descargar
      </a>
    </div>
  );
}

export default function DocumentsModule() {
  const { state, dispatch, showToast } = useWorkspace();
  const perm = useDemoPermission();
  const { documents, documentVersions, processes } = state;
  const [filter, setFilter] = useState("ALL");
  const [folderFilter, setFolderFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<DocumentSortKey>("activity_desc");
  const [detail, setDetail] = useState<DocumentRow | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);
  const [historyDoc, setHistoryDoc] = useState<DocumentRow | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newForm, setNewForm] = useState({
    title: "",
    code: "",
    standard: "",
    clause: "",
    type: "PROCEDURE" as DocumentRow["type"],
    linkedProcessCode: "",
  });
  const [processLinkDraft, setProcessLinkDraft] = useState("");
  const [versionNote, setVersionNote] = useState("");
  const [nextVersion, setNextVersion] = useState("");
  const [approveAttestOpen, setApproveAttestOpen] = useState(false);
  const [historyViewingIndex, setHistoryViewingIndex] = useState<number | null>(null);
  const [historyVersionFile, setHistoryVersionFile] = useState<File | null>(null);
  const [obsoleteConfirm, setObsoleteConfirm] = useState<DocumentRow | null>(null);

  const folderOptions = useMemo(() => {
    const u = new Set(documents.map(d => d.folder));
    return Array.from(u).sort();
  }, [documents]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const rows = documents.filter(
      (d) =>
        (filter === "ALL" || d.status === filter) &&
        (folderFilter === "ALL" || d.folder === folderFilter) &&
        (d.title.toLowerCase().includes(q) || d.code.toLowerCase().includes(q)),
    );
    return sortDocuments(rows, sortBy, (d) => new Date(d.updated).getTime());
  }, [documents, filter, folderFilter, search, sortBy]);

  const detailLive = useMemo(() => {
    if (!detail) return null;
    return documents.find(d => d.id === detail.id) ?? detail;
  }, [detail, documents]);

  useEffect(() => {
    if (detailLive) setProcessLinkDraft(detailLive.linkedProcessCode ?? "");
  }, [detailLive?.id, detailLive?.linkedProcessCode]);

  function saveDocumentProcessLink() {
    if (!detailLive) return;
    const code = processLinkDraft.trim();
    dispatch({ type: "updateDocument", id: detailLive.id, patch: { linkedProcessCode: code } });
    showToast(code ? `Documento enlazado al proceso ${code}` : "Enlace de proceso quitado");
    setDetail(null);
  }

  function markObsolete(doc: DocumentRow) {
    dispatch({ type: "updateDocument", id: doc.id, patch: { status: "OBSOLETE" } });
    dispatch({
      type: "appendAudit",
      event: createAuditEvent({
        ts: new Date().toISOString(),
        actorName: state.session.name,
        actorEmail: state.session.email,
        action: AUDIT_ACTIONS.DOCUMENT_OBSOLETE,
        entityType: "DOCUMENT",
        entityId: doc.id,
        entityLabel: doc.code,
        oldValue: doc.status,
        newValue: "OBSOLETE",
      }),
    });
    showToast("Marcado como obsoleto · evento auditado");
    setObsoleteConfirm(null);
    setDetail(null);
  }

  const columns: Column<DocumentRow>[] = [
    { key: "code", label: "Código", render: v => <span style={{ fontFamily: "monospace", fontSize: 12, color: "#5266F6", fontWeight: 600 }}>{v}</span> },
    {
      key: "title",
      label: "Título",
      render: v => <span style={{ fontWeight: 500, maxWidth: 280, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>,
    },
    { key: "type", label: "Tipo" },
    {
      key: "folder",
      label: "Carpeta",
      render: v => <span style={{ fontSize: 11, color: "var(--nf-ink-3)", fontWeight: 600 }}>{v}</span>,
    },
    { key: "standard", label: "Norma", render: v => <span style={{ fontSize: 12, background: "#f0f4ff", color: "#5266F6", padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>{v}</span> },
    { key: "version", label: "Ver.", render: v => <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>v{v}</span> },
    { key: "status", label: "Estado", render: v => <Badge status={v} /> },
    {
      key: "owner",
      label: "Propietario",
      render: v => (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Avatar name={v} size={22} />
          <span style={{ fontSize: 12 }}>{v.split(" ")[0]}</span>
        </div>
      ),
    },
    { key: "updated", label: "Actualizado" },
    {
      key: "reviewDue",
      label: "Rev.",
      render: v => <span style={{ fontSize: 11, color: "var(--nf-ink-3)" }}>{v ? formatDate(String(v)) : "—"}</span>,
    },
  ];

  function submitNewDoc() {
    if (!newForm.title.trim() || !newForm.code.trim()) {
      showToast("Título y código son obligatorios");
      return;
    }
    let previewUrl = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
    if (newFile) {
      previewUrl = URL.createObjectURL(newFile);
    }
    const sizeLabel = newFile ? `${(newFile.size / 1024).toFixed(0)} KB` : "—";
    const procCode = newForm.linkedProcessCode.trim() || processes[0]?.code || "P-01";
    const rd = new Date();
    rd.setMonth(rd.getMonth() + 12);
    const doc: DocumentRow = {
      id: `d-${Date.now()}`,
      code: newForm.code.trim(),
      title: newForm.title.trim(),
      type: newForm.type,
      status: "DRAFT",
      standard: newForm.standard.trim() || "ISO 9001",
      clause: newForm.clause.trim() || "—",
      version: "1.0",
      owner: state.session.name,
      updated: new Date().toISOString().slice(0, 10),
      size: sizeLabel,
      tags: ["nuevo"],
      previewUrl,
      folder: "SGC",
      siteId: `${state.session.activeOrgId}-s1`,
      linkedClause: newForm.clause.trim() || "8.5",
      linkedProcessCode: procCode,
      reviewDue: rd.toISOString().slice(0, 10),
      reviewCycleMonths: newForm.type === "POLICY" || newForm.type === "MANUAL" ? 12 : 24,
      reviewers: [state.session.name, "Carlos Méndez"],
      approvers: ["Ana García"],
      trainingImpact: newForm.type === "POLICY",
      linkedChangeIds: [],
    };
    dispatch({ type: "addDocument", doc });
    setShowNew(false);
    setNewFile(null);
    setNewForm({ title: "", code: "", standard: "", clause: "", type: "PROCEDURE", linkedProcessCode: processes[0]?.code ?? "" });
    showToast("Documento creado en el espacio de trabajo");
  }

  function openNewDocument() {
    setNewForm({
      title: "",
      code: "",
      standard: "",
      clause: "",
      type: "PROCEDURE",
      linkedProcessCode: processes[0]?.code ?? "",
    });
    setShowNew(true);
  }

  useCreateFromQuery(true, openNewDocument);

  function addVersion() {
    if (!historyDoc) return;
    const v = nextVersion.trim() || String((parseFloat(historyDoc.version) || 1) + 0.1);
    if (!versionNote.trim()) {
      showToast("Añade una nota de versión");
      return;
    }
    const fileUrl = historyVersionFile ? URL.createObjectURL(historyVersionFile) : historyDoc.previewUrl;
    const entry: DocVersion = {
      version: v,
      date: new Date().toISOString().slice(0, 10),
      author: state.session.name,
      note: versionNote.trim(),
      fileUrl: fileUrl || undefined,
      fileName: historyVersionFile
        ? `${historyDoc.code}-v${v}-${historyVersionFile.name}`.replace(/\s+/g, "_")
        : `${historyDoc.code}-v${v}.pdf`,
    };
    dispatch({ type: "addDocVersion", docId: historyDoc.id, v: entry });
    if (historyVersionFile && fileUrl) {
      dispatch({ type: "updateDocument", id: historyDoc.id, patch: { previewUrl: fileUrl } });
    }
    const docId = historyDoc.id;
    setHistoryDoc(null);
    setHistoryViewingIndex(null);
    setHistoryVersionFile(null);
    setDetail(prev => (prev?.id === docId ? { ...prev, version: v, updated: entry.date } : prev));
    setVersionNote("");
    setNextVersion("");
    showToast("Nueva versión registrada");
  }

  const versions = historyDoc ? documentVersions[historyDoc.id] ?? [] : [];

  return (
    <div>
      <SectionTitle
        title="Control de Documentos"
        sub={`${documents.length} documentos en el espacio de trabajo`}
        action={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Plus size={17} strokeWidth={2.25} aria-hidden />
            Nuevo documento
          </span>
        }
        onAction={openNewDocument}
      />

      <div className="nf-kpi-summary" style={{ marginBottom: 18 }}>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#F0FDF4",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1f6f45",
            }}
          >
            <FileText size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "#16A34A", letterSpacing: "-0.03em", lineHeight: 1 }}>{documents.filter(d => d.status === "APPROVED").length}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Aprobados</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#FFFBEB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9a6510",
            }}
          >
            <FileText size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "#D97706", letterSpacing: "-0.03em", lineHeight: 1 }}>{documents.filter(d => d.status === "IN_REVIEW").length}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>En revisión</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--nf-app-accent-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#5266F6",
            }}
          >
            <FileText size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "#5266F6", letterSpacing: "-0.03em", lineHeight: 1 }}>{documents.filter(d => d.status === "DRAFT").length}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Borrador</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--nf-app-accent-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#314456",
            }}
          >
            <FileText size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "var(--nf-ink)", letterSpacing: "-0.03em", lineHeight: 1 }}>{documents.length}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Total</div>
          </div>
        </div>
      </div>

      <Card style={{ marginBottom: 18, padding: "14px 16px" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="nf-app-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título o código..."
            style={{ flex: "1 1 200px", minWidth: 160, maxWidth: 440, boxSizing: "border-box" }}
          />
          <select
            className="nf-app-input"
            value={folderFilter}
            onChange={e => setFolderFilter(e.target.value)}
            style={{ flex: "0 0 auto", minWidth: 170, cursor: "pointer" }}
          >
            <option value="ALL">Todas las carpetas</option>
            {folderOptions.map(f => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select
            className="nf-app-input"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as DocumentSortKey)}
            style={{ flex: "0 0 auto", minWidth: 160, cursor: "pointer" }}
            aria-label="Ordenar documentos"
          >
            {DOCUMENT_SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="nf-filter-label" style={{ marginRight: 4 }}>
            Estado
          </span>
          {["ALL", "APPROVED", "IN_REVIEW", "DRAFT", "OBSOLETE"].map(s => (
            <button
              key={s}
              type="button"
              className={filter === s ? "nf-chip nf-chip--on" : "nf-chip"}
              onClick={() => setFilter(s)}
            >
              {s === "ALL" ? "Todos" : s === "APPROVED" ? "Aprobados" : s === "IN_REVIEW" ? "En revisión" : s === "DRAFT" ? "Borrador" : "Obsoletos"}
            </button>
          ))}
        </div>
      </Card>

      <Card style={{ padding: 0 }}>
        <DataTable columns={columns} rows={filtered} onRow={setDetail} emptyText="No se encontraron documentos con ese filtro" />
      </Card>

      <Modal open={!!detail && !previewDoc && !historyDoc} onClose={() => setDetail(null)} title={detailLive?.title ?? ""} width={600}>
        {detailLive && (
          <div>
            <div className="nf-grid-2" style={{ gap: 14, marginBottom: 20 }}>
              {[
                ["Código", detailLive.code],
                ["Versión", `v${detailLive.version}`],
                ["Estado", <Badge key="st" status={detailLive.status} />],
                ["Carpeta", detailLive.folder],
                ["Tipo", detailLive.type],
                ["Norma", detailLive.standard],
                ["Cláusula", detailLive.linkedClause || detailLive.clause],
                [
                  "Proceso",
                  detailLive.linkedProcessCode ? (
                    <Link key="proc" href="/app/processes" style={{ color: "#5266F6", fontWeight: 600, textDecoration: "none" }}>
                      {detailLive.linkedProcessCode}
                    </Link>
                  ) : (
                    "—"
                  ),
                ],
                ["Propietario", detailLive.owner],
                ["Actualizado", detailLive.updated],
                ["Tamaño", detailLive.size],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <div style={{ fontSize: 11, color: "var(--nf-ink-3)", marginBottom: 2, textTransform: "none", letterSpacing: "0.5px" }}>{k}</div>
                  <div style={{ fontSize: 13, color: "var(--nf-ink)", fontWeight: 500 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 14, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid var(--nf-line)" }}>
              <div style={{ fontSize: 11, color: "var(--nf-ink-3)", marginBottom: 8, textTransform: "none", letterSpacing: "0.5px" }}>Control documental</div>
              <div className="nf-grid-2" style={{ gap: 8, fontSize: 12, color: "var(--nf-ink)" }}>
                <div>
                  <span style={{ color: "var(--nf-ink-3)" }}>Próx. revisión: </span>
                  {detailLive.reviewDue ? formatDate(detailLive.reviewDue) : "—"}
                </div>
                <div>
                  <span style={{ color: "var(--nf-ink-3)" }}>Periodicidad: </span>
                  {detailLive.reviewCycleMonths ?? "—"} meses
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ color: "var(--nf-ink-3)" }}>Revisores: </span>
                  {(detailLive.reviewers ?? []).join(", ") || "—"}
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ color: "var(--nf-ink-3)" }}>Aprobadores: </span>
                  {(detailLive.approvers ?? []).join(", ") || "—"}
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ color: "var(--nf-ink-3)" }}>Impacto formación: </span>
                  {detailLive.trainingImpact ? "Sí — puede disparar asignaciones" : "No prioritario"}
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ color: "var(--nf-ink-3)" }}>Cambios vinculados: </span>
                  {(detailLive.linkedChangeIds ?? []).length ? (
                    (detailLive.linkedChangeIds ?? []).map(cid => (
                      <Link key={cid} href="/app/changes" style={{ color: "#5266F6", fontWeight: 600, marginRight: 8 }}>
                        {cid.split("-").pop()}
                      </Link>
                    ))
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 14, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid var(--nf-line)" }}>
              <div style={{ fontSize: 11, color: "var(--nf-ink-3)", marginBottom: 8, textTransform: "none", letterSpacing: "0.5px" }}>Proceso asociado</div>
              <select
                className="nf-app-input"
                value={processLinkDraft}
                onChange={e => setProcessLinkDraft(e.target.value)}
                disabled={!perm.documents.edit}
                style={{ width: "100%", marginBottom: 8, boxSizing: "border-box", cursor: perm.documents.edit ? "pointer" : "not-allowed" }}
              >
                <option value="">Sin proceso</option>
                {processes.map(p => (
                  <option key={p.id} value={p.code}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!perm.documents.edit}
                onClick={saveDocumentProcessLink}
                className="nf-app-btn-primary nf-app-btn-sm"
              >
                Guardar enlace de proceso
              </button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "var(--nf-ink-3)", marginBottom: 6, textTransform: "none", letterSpacing: "0.5px" }}>Etiquetas</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {detailLive.tags.map(t => (
                  <span key={t} style={{ background: "var(--nf-app-surface-2)", border: "1px solid var(--nf-line)", borderRadius: 99, padding: "2px 10px", fontSize: 12, color: "var(--nf-ink-3)" }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ borderTop: "1px solid var(--nf-line)", paddingTop: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "var(--nf-ink-3)", marginBottom: 8, textTransform: "none", letterSpacing: "0.5px" }}>Flujo documental</div>
              <div className="nf-action-bar">
                {detailLive.status === "DRAFT" && (
                  <button
                    type="button"
                    disabled={!perm.documents.edit}
                    title={!perm.documents.edit ? "Sin permiso para editar documentos" : undefined}
                    onClick={() => {
                      dispatch({ type: "updateDocument", id: detailLive.id, patch: { status: "IN_REVIEW" } });
                      dispatch({
                        type: "appendAudit",
                        event: createAuditEvent({
                          ts: new Date().toISOString(),
                          actorName: state.session.name,
                          actorEmail: state.session.email,
                          action: AUDIT_ACTIONS.DOCUMENT_SENT_REVIEW,
                          entityType: "DOCUMENT",
                          entityId: detailLive.id,
                          entityLabel: detailLive.code,
                          oldValue: detailLive.status,
                          newValue: "IN_REVIEW",
                        }),
                      });
                      showToast("Enviado a revisión · trazabilidad registrada");
                      setDetail(null);
                    }}
                    className="nf-app-btn-primary"
                  >
                    Enviar a revisión
                  </button>
                )}
                {detailLive.status === "IN_REVIEW" && (
                  <button
                    type="button"
                    disabled={!perm.documents.approve}
                    title={!perm.documents.approve ? "Solo administración o compliance puede aprobar" : undefined}
                    onClick={() => setApproveAttestOpen(true)}
                    className="nf-app-btn-success"
                  >
                    Aprobar (firma simulada)
                  </button>
                )}
                {detailLive.status !== "OBSOLETE" && (
                  <button
                    type="button"
                    disabled={!perm.documents.edit}
                    onClick={() => setObsoleteConfirm(detailLive)}
                    className="nf-app-btn-ghost"
                  >
                    Marcar obsoleto
                  </button>
                )}
              </div>
            </div>
            <div className="nf-action-bar" style={{ borderTop: "1px solid var(--nf-line)", paddingTop: 16 }}>
              <button type="button" onClick={() => setPreviewDoc(detailLive)} className="nf-app-btn-primary" style={{ flex: 1, minWidth: 120 }}>
                Ver Documento
              </button>
              <button
                type="button"
                onClick={() => {
                  setHistoryViewingIndex(null);
                  setHistoryVersionFile(null);
                  setHistoryDoc(detailLive);
                }}
                className="nf-app-btn-ghost"
                style={{ flex: 1, minWidth: 120 }}
              >
                Historial de versiones
              </button>
              <button
                type="button"
                onClick={() => showToast("Borrador IA: usa el asistente en la barra lateral.")}
                className="nf-app-btn-soft-success"
                style={{ flex: 1, minWidth: 120 }}
              >
                <Sparkles size={15} strokeWidth={2} aria-hidden />
                IA: Generar borrador
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmActionModal
        open={!!obsoleteConfirm}
        title="Marcar documento como obsoleto"
        confirmLabel="Marcar obsoleto"
        danger
        onCancel={() => setObsoleteConfirm(null)}
        onConfirm={() => obsoleteConfirm && markObsolete(obsoleteConfirm)}
      >
        ¿Marcar <strong>{obsoleteConfirm?.code}</strong> como obsoleto? Esta acción quedará en el registro de actividad del sistema.
      </ConfirmActionModal>

      <Modal open={!!previewDoc} onClose={() => setPreviewDoc(null)} title={previewDoc ? `Vista — ${previewDoc.code}` : ""} width={720}>
        {previewDoc && (
          <div>
            <p style={{ fontSize: 13, color: "var(--nf-ink-3)", marginTop: 0 }}>{previewDoc.title}</p>
            <PreviewBody doc={previewDoc} url={previewDoc.previewUrl} />
          </div>
        )}
      </Modal>

      <Modal
        open={!!historyDoc}
        onClose={() => {
          setHistoryDoc(null);
          setHistoryViewingIndex(null);
          setHistoryVersionFile(null);
        }}
        title={historyDoc ? `Historial — ${historyDoc.code}` : ""}
        width={720}
      >
        {historyDoc && (
          <div>
            {historyViewingIndex !== null && versions[historyViewingIndex] && (
              <div
                style={{
                  marginBottom: 18,
                  padding: 14,
                  borderRadius: 12,
                  border: "1px solid var(--nf-line)",
                  background: "var(--nf-app-surface-2)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--nf-ink)" }}>
                    Vista · v{versions[historyViewingIndex].version}
                    <span style={{ fontWeight: 500, color: "var(--nf-ink-3)", marginLeft: 8 }}>{versions[historyViewingIndex].date}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHistoryViewingIndex(null)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--nf-line)",
                      background: "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      color: "var(--nf-ink-3)",
                    }}
                  >
                    Cerrar vista
                  </button>
                </div>
                <PreviewBody
                  doc={historyDoc}
                  url={versions[historyViewingIndex].fileUrl ?? historyDoc.previewUrl}
                />
              </div>
            )}
            <div style={{ maxHeight: historyViewingIndex !== null ? 200 : 280, overflow: "auto", marginBottom: 16 }}>
              {versions.length === 0 ? (
                <p style={{ color: "var(--nf-ink-3)" }}>Sin versiones registradas.</p>
              ) : (
                versions.map((v, i) => {
                  const name = v.fileName ?? `${historyDoc.code}-v${v.version}.pdf`;
                  const viewing = historyViewingIndex === i;
                  return (
                    <div
                      key={`${v.version}-${v.date}-${i}`}
                      style={{
                        padding: "12px 0",
                        borderBottom: "1px solid var(--nf-line)",
                        fontSize: 13,
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: "#5266F6" }}>v{v.version}</div>
                        <div style={{ color: "var(--nf-ink-3)", marginTop: 2 }}>
                          {v.date} · {v.author}
                        </div>
                        <div style={{ color: "var(--nf-ink)", marginTop: 4 }}>{v.note}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => setHistoryViewingIndex(viewing ? null : i)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "7px 11px",
                            borderRadius: 8,
                            border: viewing ? "1px solid #5266F6" : "1px solid var(--nf-line)",
                            background: viewing ? "#f0f4ff" : "#fff",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            color: "#5266F6",
                          }}
                        >
                          <Eye size={15} strokeWidth={2} aria-hidden />
                          {viewing ? "Ocultar" : "Ver"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const u = v.fileUrl ?? historyDoc.previewUrl;
                            if (!u) {
                              showToast("No hay archivo para esta versión");
                              return;
                            }
                            void downloadArchivedFile(u, name);
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "7px 11px",
                            borderRadius: 8,
                            border: "1px solid var(--nf-line)",
                            background: "#fff",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            color: "var(--nf-ink-2)",
                          }}
                        >
                          <Download size={15} strokeWidth={2} aria-hidden />
                          Descargar
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div style={{ background: "var(--nf-app-surface-2)", padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink)", marginBottom: 8 }}>Registrar versión</div>
              <input
                placeholder="Número de versión (ej. 3.3)"
                value={nextVersion}
                onChange={e => setNextVersion(e.target.value)}
                style={{ width: "100%", marginBottom: 8, padding: "8px 12px", border: "1px solid var(--nf-line)", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              />
              <textarea
                placeholder="Nota de cambio"
                value={versionNote}
                onChange={e => setVersionNote(e.target.value)}
                rows={2}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--nf-line)", borderRadius: 8, fontSize: 13, boxSizing: "border-box", resize: "vertical" }}
              />
              <div style={{ marginTop: 10 }}>
                <FileImportArea
                  baseId="doc-history-version-file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                  file={historyVersionFile}
                  onFileChange={setHistoryVersionFile}
                  label="Archivo de esta revisión (opcional)"
                  hint="PDF, Word e imágenes (PNG, JPG, WebP). Si no adjuntas archivo, se reutiliza la vista previa actual del documento."
                  compact
                />
              </div>
              <button type="button" onClick={addVersion} className="nf-app-btn-primary" style={{ marginTop: 8, width: "100%" }}>
                Añadir versión
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nuevo Documento" width={520}>
        <div className="nf-modal-form">
          <label>Título
            <input className="nf-app-input" value={newForm.title} onChange={e => setNewForm({ ...newForm, title: e.target.value })} />
          </label>
          <label>Código
            <input className="nf-app-input" value={newForm.code} onChange={e => setNewForm({ ...newForm, code: e.target.value })} />
          </label>
          <label>Tipo
            <select className="nf-app-input" value={newForm.type} onChange={e => setNewForm({ ...newForm, type: e.target.value as DocumentRow["type"] })}>
              <option value="MANUAL">Manual</option>
              <option value="PROCEDURE">Procedimiento</option>
              <option value="POLICY">Política</option>
              <option value="PLAN">Plan</option>
              <option value="INSTRUCTION">Instrucción</option>
              <option value="FORM">Formulario</option>
            </select>
          </label>
          <label>Norma de referencia
            <input className="nf-app-input" value={newForm.standard} onChange={e => setNewForm({ ...newForm, standard: e.target.value })} />
          </label>
          <label>Cláusula
            <input className="nf-app-input" value={newForm.clause} onChange={e => setNewForm({ ...newForm, clause: e.target.value })} />
          </label>
          <label>Proceso asociado
            <select className="nf-app-input" value={newForm.linkedProcessCode} onChange={e => setNewForm({ ...newForm, linkedProcessCode: e.target.value })} style={{ cursor: "pointer" }}>
              <option value="">Sin proceso</option>
              {processes.map(p => (
                <option key={p.id} value={p.code}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </label>
          <FileImportArea
            baseId="doc-new-file"
            file={newFile}
            onFileChange={setNewFile}
            label="Archivo opcional"
            hint="Adjunta PDF, imágenes u Office para vista previa en el navegador. Los datos no se envían a ningún servidor en esta sesión local."
          />
          <div className="nf-modal-actions">
            <button type="button" className="nf-app-btn-ghost" onClick={() => setShowNew(false)}>Cancelar</button>
            <button type="button" className="nf-app-btn-primary" onClick={submitNewDoc}>Crear Documento</button>
          </div>
        </div>
      </Modal>

      <AttestationModal
        open={approveAttestOpen}
        onClose={() => setApproveAttestOpen(false)}
        title="Aprobación formal de documento"
        statement="Como aprobador documental certifica que ha revisado el contenido, la versión y la trazabilidad requerida para este documento controlado antes de liberarlo como «Aprobado»."
        sessionEmail={state.session.email}
        onConfirm={({ reason, attestationAt }) => {
          const d = detailLive ?? (detail ? documents.find(x => x.id === detail.id) : null);
          if (!d) return;
          dispatch({ type: "updateDocument", id: d.id, patch: { status: "APPROVED" } });
          dispatch({
            type: "appendAudit",
            event: createAuditEvent({
              ts: attestationAt,
              actorName: state.session.name,
              actorEmail: state.session.email,
              action: AUDIT_ACTIONS.DOCUMENT_APPROVED,
              entityType: "DOCUMENT",
              entityId: d.id,
              entityLabel: d.code,
              oldValue: d.status,
              newValue: "APPROVED",
              reason,
              attestation: {
                method: "E_SIGN_SIMULATED",
                statement: "Aprobación documental con reconfirmación de identidad",
                confirmedAt: attestationAt,
              },
            }),
          });
          setApproveAttestOpen(false);
          setDetail(null);
          showToast("Documento aprobado · firma simulada y audit trail actualizado");
        }}
      />
    </div>
  );
}
