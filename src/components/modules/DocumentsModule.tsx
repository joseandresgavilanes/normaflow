"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import DataTable from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import { DEMO_DOCUMENTS } from "@/lib/demo-data";
import type { Column } from "@/components/ui/Table";

export default function DocumentsModule() {
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<typeof DEMO_DOCUMENTS[0] | null>(null);
  const [showNew, setShowNew] = useState(false);

  const filtered = DEMO_DOCUMENTS.filter(d =>
    (filter === "ALL" || d.status === filter) &&
    (d.title.toLowerCase().includes(search.toLowerCase()) || d.code.toLowerCase().includes(search.toLowerCase()))
  );

  const columns: Column<typeof DEMO_DOCUMENTS[0]>[] = [
    { key: "code", label: "Código", render: v => <span style={{ fontFamily: "monospace", fontSize: 12, color: "#123C66", fontWeight: 600 }}>{v}</span> },
    { key: "title", label: "Título", render: v => <span style={{ fontWeight: 500, maxWidth: 280, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span> },
    { key: "type", label: "Tipo" },
    { key: "standard", label: "Norma", render: v => <span style={{ fontSize: 12, background: "#f0f4ff", color: "#123C66", padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>{v}</span> },
    { key: "version", label: "Ver.", render: v => <span style={{ fontSize: 12, color: "#5E6B7A" }}>v{v}</span> },
    { key: "status", label: "Estado", render: v => <Badge status={v} /> },
    { key: "owner", label: "Propietario", render: v => <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Avatar name={v} size={22} /><span style={{ fontSize: 12 }}>{v.split(" ")[0]}</span></div> },
    { key: "updated", label: "Actualizado" },
  ];

  return (
    <div>
      <SectionTitle title="Control de Documentos" sub={`${DEMO_DOCUMENTS.length} documentos registrados`} action="+ Nuevo Documento" onAction={() => setShowNew(true)} />

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título o código..." style={{ flex: 1, minWidth: 220, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, outline: "none" }} />
        {["ALL", "APPROVED", "IN_REVIEW", "DRAFT", "OBSOLETE"].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${filter === s ? "#123C66" : "#E5EAF2"}`, background: filter === s ? "#123C6612" : "transparent", color: filter === s ? "#123C66" : "#5E6B7A", fontSize: 13, cursor: "pointer", fontWeight: filter === s ? 600 : 400 }}>
            {s === "ALL" ? "Todos" : s === "APPROVED" ? "Aprobados" : s === "IN_REVIEW" ? "En revisión" : s === "DRAFT" ? "Borrador" : "Obsoletos"}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Aprobados", count: DEMO_DOCUMENTS.filter(d => d.status === "APPROVED").length, color: "#2E8B57" },
          { label: "En revisión", count: DEMO_DOCUMENTS.filter(d => d.status === "IN_REVIEW").length, color: "#D68A1A" },
          { label: "Borrador", count: DEMO_DOCUMENTS.filter(d => d.status === "DRAFT").length, color: "#123C66" },
          { label: "Total", count: DEMO_DOCUMENTS.length, color: "#5E6B7A" },
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

      {/* Detail Modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.title ?? ""} width={600}>
        {detail && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              {[
                ["Código", detail.code],
                ["Versión", `v${detail.version}`],
                ["Estado", <Badge status={detail.status} />],
                ["Tipo", detail.type],
                ["Norma", detail.standard],
                ["Cláusula", detail.clause],
                ["Propietario", detail.owner],
                ["Actualizado", detail.updated],
                ["Tamaño", detail.size],
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
                {detail.tags.map(t => <span key={t} style={{ background: "#F7F9FC", border: "1px solid #E5EAF2", borderRadius: 99, padding: "2px 10px", fontSize: 12, color: "#5E6B7A" }}>{t}</span>)}
              </div>
            </div>
            <div style={{ borderTop: "1px solid #E5EAF2", paddingTop: 16, display: "flex", gap: 8 }}>
              <button style={{ flex: 1, background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Ver Documento</button>
              <button style={{ flex: 1, background: "transparent", border: "1px solid #E5EAF2", borderRadius: 8, padding: "9px", fontSize: 13, cursor: "pointer", color: "#5E6B7A" }}>Historial de versiones</button>
              <button style={{ flex: 1, background: "#2E8B5718", color: "#2E8B57", border: "1px solid #2E8B5740", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>✦ IA: Generar borrador</button>
            </div>
          </div>
        )}
      </Modal>

      {/* New Document Modal */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nuevo Documento" width={520}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[["Título del documento", "text"], ["Código", "text"], ["Norma de referencia", "text"], ["Cláusula", "text"]].map(([label, type]) => (
            <div key={label}>
              <label style={{ fontSize: 13, fontWeight: 500, color: "#142033", display: "block", marginBottom: 5 }}>{label}</label>
              <input type={type} style={{ width: "100%", padding: "9px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={() => setShowNew(false)} style={{ flex: 1, background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Crear Documento</button>
            <button onClick={() => setShowNew(false)} style={{ flex: 1, background: "transparent", border: "1px solid #E5EAF2", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", color: "#5E6B7A" }}>Cancelar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
