"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import DataTable from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import { useWorkspace, type DocumentRow, type DocVersion } from "@/context/WorkspaceStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import type { Column } from "@/components/ui/Table";

function isPdfUrl(url: string) {
  return /\.pdf($|\?)/i.test(url) || url.includes("application/pdf");
}

function PreviewBody({ doc, url }: { doc: DocumentRow; url: string | undefined }) {
  const u = url ?? doc.previewUrl ?? "";
  if (!u) {
    return <p style={{ color: "#5E6B7A", fontSize: 14 }}>No hay archivo asociado en esta sesión demo. Sube un archivo al crear el documento para previsualizarlo.</p>;
  }
  if (u.startsWith("data:image/") || /\.(png|jpe?g|gif|webp|svg)($|\?)/i.test(u)) {
    return <img src={u} alt={doc.title} style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #E5EAF2" }} />;
  }
  if (isPdfUrl(u)) {
    return <iframe title="Vista PDF" src={u} style={{ width: "100%", height: 480, border: "1px solid #E5EAF2", borderRadius: 8 }} />;
  }
  return (
    <div style={{ padding: 16, background: "#F7F9FC", borderRadius: 8, fontSize: 14, color: "#142033" }}>
      <p style={{ marginTop: 0 }}>Vista previa no disponible para este tipo de archivo en el navegador.</p>
      <p style={{ color: "#5E6B7A", fontSize: 13 }}>Puedes abrir o descargar el recurso en una nueva pestaña.</p>
      <a href={u} target="_blank" rel="noopener noreferrer" style={{ color: "#123C66", fontWeight: 600 }}>
        Abrir / descargar
      </a>
    </div>
  );
}

export default function DocumentsModule() {
  const { state, dispatch, showToast } = useWorkspace();
  const perm = useDemoPermission();
  const { documents, documentVersions } = state;
  const [filter, setFilter] = useState("ALL");
  const [folderFilter, setFolderFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<DocumentRow | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);
  const [historyDoc, setHistoryDoc] = useState<DocumentRow | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newForm, setNewForm] = useState({ title: "", code: "", standard: "", clause: "", type: "PROCEDURE" as DocumentRow["type"] });
  const [versionNote, setVersionNote] = useState("");
  const [nextVersion, setNextVersion] = useState("");

  const folderOptions = useMemo(() => {
    const u = new Set(documents.map(d => d.folder));
    return Array.from(u).sort();
  }, [documents]);

  const filtered = documents.filter(
    d =>
      (filter === "ALL" || d.status === filter) &&
      (folderFilter === "ALL" || d.folder === folderFilter) &&
      (d.title.toLowerCase().includes(search.toLowerCase()) || d.code.toLowerCase().includes(search.toLowerCase()))
  );

  const detailLive = useMemo(() => {
    if (!detail) return null;
    return documents.find(d => d.id === detail.id) ?? detail;
  }, [detail, documents]);

  const columns: Column<DocumentRow>[] = [
    { key: "code", label: "Código", render: v => <span style={{ fontFamily: "monospace", fontSize: 12, color: "#123C66", fontWeight: 600 }}>{v}</span> },
    {
      key: "title",
      label: "Título",
      render: v => <span style={{ fontWeight: 500, maxWidth: 280, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>,
    },
    { key: "type", label: "Tipo" },
    {
      key: "folder",
      label: "Carpeta",
      render: v => <span style={{ fontSize: 11, color: "#5E6B7A", fontWeight: 600 }}>{v}</span>,
    },
    { key: "standard", label: "Norma", render: v => <span style={{ fontSize: 12, background: "#f0f4ff", color: "#123C66", padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>{v}</span> },
    { key: "version", label: "Ver.", render: v => <span style={{ fontSize: 12, color: "#5E6B7A" }}>v{v}</span> },
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
    const procCode = state.processes[0]?.code ?? "P-01";
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
      tags: ["nuevo", "demo"],
      previewUrl,
      folder: "SGC",
      siteId: `${state.session.activeOrgId}-s1`,
      linkedClause: newForm.clause.trim() || "8.5",
      linkedProcessCode: procCode,
    };
    dispatch({ type: "addDocument", doc });
    setShowNew(false);
    setNewFile(null);
    setNewForm({ title: "", code: "", standard: "", clause: "", type: "PROCEDURE" });
    showToast("Documento creado en el espacio de trabajo (demo)");
  }

  function addVersion() {
    if (!historyDoc) return;
    const v = nextVersion.trim() || String((parseFloat(historyDoc.version) || 1) + 0.1);
    if (!versionNote.trim()) {
      showToast("Añade una nota de versión");
      return;
    }
    const entry: DocVersion = {
      version: v,
      date: new Date().toISOString().slice(0, 10),
      author: state.session.name,
      note: versionNote.trim(),
    };
    dispatch({ type: "addDocVersion", docId: historyDoc.id, v: entry });
    const docId = historyDoc.id;
    setHistoryDoc(null);
    setDetail(prev => (prev?.id === docId ? { ...prev, version: v, updated: entry.date } : prev));
    setVersionNote("");
    setNextVersion("");
    showToast("Nueva versión registrada (demo)");
  }

  const versions = historyDoc ? documentVersions[historyDoc.id] ?? [] : [];

  return (
    <div>
      <SectionTitle title="Control de Documentos" sub={`${documents.length} documentos en el espacio de trabajo`} action="+ Nuevo Documento" onAction={() => setShowNew(true)} />

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por título o código..."
          style={{ flex: 1, minWidth: 220, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, outline: "none" }}
        />
        <select
          value={folderFilter}
          onChange={e => setFolderFilter(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, background: "#fff" }}
        >
          <option value="ALL">Todas las carpetas</option>
          {folderOptions.map(f => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        {["ALL", "APPROVED", "IN_REVIEW", "DRAFT", "OBSOLETE"].map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: `1px solid ${filter === s ? "#123C66" : "#E5EAF2"}`,
              background: filter === s ? "#123C6612" : "transparent",
              color: filter === s ? "#123C66" : "#5E6B7A",
              fontSize: 13,
              cursor: "pointer",
              fontWeight: filter === s ? 600 : 400,
            }}
          >
            {s === "ALL" ? "Todos" : s === "APPROVED" ? "Aprobados" : s === "IN_REVIEW" ? "En revisión" : s === "DRAFT" ? "Borrador" : "Obsoletos"}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Aprobados", count: documents.filter(d => d.status === "APPROVED").length, color: "#2E8B57" },
          { label: "En revisión", count: documents.filter(d => d.status === "IN_REVIEW").length, color: "#D68A1A" },
          { label: "Borrador", count: documents.filter(d => d.status === "DRAFT").length, color: "#123C66" },
          { label: "Total", count: documents.length, color: "#5E6B7A" },
        ].map(s => (
          <Card key={s.label} style={{ padding: "14px 18px", textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 12, color: "#5E6B7A" }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <Card style={{ padding: 0 }}>
        <DataTable columns={columns} rows={filtered} onRow={setDetail} emptyText="No se encontraron documentos con ese filtro" />
      </Card>

      <Modal open={!!detail && !previewDoc && !historyDoc} onClose={() => setDetail(null)} title={detailLive?.title ?? ""} width={600}>
        {detailLive && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
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
                  <Link key="proc" href="/app/processes" style={{ color: "#123C66", fontWeight: 600, textDecoration: "none" }}>
                    {detailLive.linkedProcessCode}
                  </Link>,
                ],
                ["Propietario", detailLive.owner],
                ["Actualizado", detailLive.updated],
                ["Tamaño", detailLive.size],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <div style={{ fontSize: 11, color: "#5E6B7A", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.5px" }}>{k}</div>
                  <div style={{ fontSize: 13, color: "#142033", fontWeight: 500 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "#5E6B7A", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Etiquetas</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {detailLive.tags.map(t => (
                  <span key={t} style={{ background: "#F7F9FC", border: "1px solid #E5EAF2", borderRadius: 99, padding: "2px 10px", fontSize: 12, color: "#5E6B7A" }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ borderTop: "1px solid #E5EAF2", paddingTop: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "#5E6B7A", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Flujo documental (demo)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {detailLive.status === "DRAFT" && (
                  <button
                    type="button"
                    disabled={!perm.documents.edit}
                    title={!perm.documents.edit ? "Sin permiso para editar documentos" : undefined}
                    onClick={() => {
                      dispatch({ type: "updateDocument", id: detailLive.id, patch: { status: "IN_REVIEW" } });
                      showToast("Enviado a revisión");
                      setDetail(null);
                    }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: perm.documents.edit ? "#D68A1A" : "#e5eaf2",
                      color: perm.documents.edit ? "#fff" : "#9aa5b1",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: perm.documents.edit ? "pointer" : "not-allowed",
                    }}
                  >
                    Enviar a revisión
                  </button>
                )}
                {detailLive.status === "IN_REVIEW" && (
                  <button
                    type="button"
                    disabled={!perm.documents.approve}
                    title={!perm.documents.approve ? "Solo administración o compliance puede aprobar" : undefined}
                    onClick={() => {
                      dispatch({ type: "updateDocument", id: detailLive.id, patch: { status: "APPROVED" } });
                      showToast("Documento aprobado");
                      setDetail(null);
                    }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: perm.documents.approve ? "#2E8B57" : "#e5eaf2",
                      color: perm.documents.approve ? "#fff" : "#9aa5b1",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: perm.documents.approve ? "pointer" : "not-allowed",
                    }}
                  >
                    Aprobar
                  </button>
                )}
                {detailLive.status !== "OBSOLETE" && (
                  <button
                    type="button"
                    disabled={!perm.documents.edit}
                    onClick={() => {
                      if (!window.confirm("¿Marcar este documento como obsoleto? (demo)")) return;
                      dispatch({ type: "updateDocument", id: detailLive.id, patch: { status: "OBSOLETE" } });
                      showToast("Marcado como obsoleto");
                      setDetail(null);
                    }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #E5EAF2",
                      background: "#fff",
                      color: perm.documents.edit ? "#5E6B7A" : "#9aa5b1",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: perm.documents.edit ? "pointer" : "not-allowed",
                    }}
                  >
                    Marcar obsoleto
                  </button>
                )}
              </div>
            </div>
            <div style={{ borderTop: "1px solid #E5EAF2", paddingTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setPreviewDoc(detailLive)} style={{ flex: 1, minWidth: 120, background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Ver Documento
              </button>
              <button type="button" onClick={() => setHistoryDoc(detailLive)} style={{ flex: 1, minWidth: 120, background: "transparent", border: "1px solid #E5EAF2", borderRadius: 8, padding: "9px", fontSize: 13, cursor: "pointer", color: "#5E6B7A" }}>
                Historial de versiones
              </button>
              <button type="button" onClick={() => showToast("Borrador IA (demo): usa el asistente en la barra lateral.")} style={{ flex: 1, minWidth: 120, background: "#2E8B5718", color: "#2E8B57", border: "1px solid #2E8B5740", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                ✦ IA: Generar borrador
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!previewDoc} onClose={() => setPreviewDoc(null)} title={previewDoc ? `Vista — ${previewDoc.code}` : ""} width={720}>
        {previewDoc && (
          <div>
            <p style={{ fontSize: 13, color: "#5E6B7A", marginTop: 0 }}>{previewDoc.title}</p>
            <PreviewBody doc={previewDoc} url={previewDoc.previewUrl} />
          </div>
        )}
      </Modal>

      <Modal open={!!historyDoc} onClose={() => setHistoryDoc(null)} title={historyDoc ? `Historial — ${historyDoc.code}` : ""} width={560}>
        {historyDoc && (
          <div>
            <div style={{ maxHeight: 280, overflow: "auto", marginBottom: 16 }}>
              {versions.length === 0 ? (
                <p style={{ color: "#5E6B7A" }}>Sin versiones registradas.</p>
              ) : (
                versions.map((v, i) => (
                  <div key={`${v.version}-${i}`} style={{ padding: "10px 0", borderBottom: "1px solid #E5EAF2", fontSize: 13 }}>
                    <div style={{ fontWeight: 700, color: "#123C66" }}>v{v.version}</div>
                    <div style={{ color: "#5E6B7A" }}>
                      {v.date} · {v.author}
                    </div>
                    <div style={{ color: "#142033" }}>{v.note}</div>
                  </div>
                ))
              )}
            </div>
            <div style={{ background: "#F7F9FC", padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#142033", marginBottom: 8 }}>Registrar versión (demo)</div>
              <input
                placeholder="Número de versión (ej. 3.3)"
                value={nextVersion}
                onChange={e => setNextVersion(e.target.value)}
                style={{ width: "100%", marginBottom: 8, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              />
              <textarea
                placeholder="Nota de cambio"
                value={versionNote}
                onChange={e => setVersionNote(e.target.value)}
                rows={2}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box", resize: "vertical" }}
              />
              <button type="button" onClick={addVersion} style={{ marginTop: 8, width: "100%", background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Añadir versión
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nuevo Documento" width={520}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Título
            <input
              value={newForm.title}
              onChange={e => setNewForm({ ...newForm, title: e.target.value })}
              style={{ width: "100%", marginTop: 4, padding: "9px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Código
            <input
              value={newForm.code}
              onChange={e => setNewForm({ ...newForm, code: e.target.value })}
              style={{ width: "100%", marginTop: 4, padding: "9px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Tipo
            <select
              value={newForm.type}
              onChange={e => setNewForm({ ...newForm, type: e.target.value as DocumentRow["type"] })}
              style={{ width: "100%", marginTop: 4, padding: "9px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
            >
              <option value="MANUAL">Manual</option>
              <option value="PROCEDURE">Procedimiento</option>
              <option value="POLICY">Política</option>
              <option value="PLAN">Plan</option>
              <option value="INSTRUCTION">Instrucción</option>
              <option value="FORM">Formulario</option>
            </select>
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Norma de referencia
            <input
              value={newForm.standard}
              onChange={e => setNewForm({ ...newForm, standard: e.target.value })}
              style={{ width: "100%", marginTop: 4, padding: "9px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Cláusula
            <input
              value={newForm.clause}
              onChange={e => setNewForm({ ...newForm, clause: e.target.value })}
              style={{ width: "100%", marginTop: 4, padding: "9px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Archivo opcional (previsualización local)
            <input
              type="file"
              onChange={e => setNewFile(e.target.files?.[0] ?? null)}
              style={{ display: "block", marginTop: 6, fontSize: 13 }}
            />
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={submitNewDoc} style={{ flex: 1, background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Crear Documento
            </button>
            <button type="button" onClick={() => setShowNew(false)} style={{ flex: 1, background: "transparent", border: "1px solid #E5EAF2", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", color: "#5E6B7A" }}>
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
