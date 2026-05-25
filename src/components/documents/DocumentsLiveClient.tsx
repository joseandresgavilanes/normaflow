"use client";

import { useMemo, useState, useTransition } from "react";
import { DocumentType } from "@prisma/client";
import {
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Send,
  Upload,
  XCircle,
} from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import DataTable, { type Column } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import {
  approveDocument,
  createDocument,
  deleteDraftDocument,
  getDocumentVersionUrl,
  markDocumentObsolete,
  rejectDocument,
  submitForReview,
  updateDocumentMetadata,
  uploadDocumentVersion,
  type CreateDocumentInput,
} from "@/lib/actions/documents";
import type { DocumentsPayload, DocumentRowLive } from "@/lib/server-queries";
import { formatDate, timeAgo } from "@/lib/utils";

type Status = "ALL" | "DRAFT" | "IN_REVIEW" | "APPROVED" | "OBSOLETE";

const STATUS_LABEL: Record<Status, string> = {
  ALL: "Todos",
  DRAFT: "Borrador",
  IN_REVIEW: "En revisión",
  APPROVED: "Aprobado",
  OBSOLETE: "Obsoleto",
};

const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: "MANUAL", label: "Manual" },
  { value: "PROCEDURE", label: "Procedimiento" },
  { value: "POLICY", label: "Política" },
  { value: "INSTRUCTION", label: "Instrucción" },
  { value: "FORM", label: "Formato" },
  { value: "RECORD", label: "Registro" },
  { value: "PLAN", label: "Plan" },
  { value: "OTHER", label: "Otro" },
];

const TYPE_LABEL = new Map(DOC_TYPES.map((t) => [t.value, t.label]));

export default function DocumentsLiveClient({
  initial,
  canCreate,
  canApprove,
  currentUserId,
}: {
  initial: DocumentsPayload;
  canCreate: boolean;
  canApprove: boolean;
  currentUserId: string;
}) {
  const { documents, locations, personnel, members } = initial;
  const personnelLookup = useMemo(
    () => new Map(personnel.map((p) => [p.id, `${p.firstName} ${p.lastName}`])),
    [personnel],
  );
  const memberLookup = useMemo(() => new Map(members.map((m) => [m.userId, m.name])), [members]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status>("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | DocumentType>("ALL");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DocumentRowLive | null>(null);
  const [detail, setDetail] = useState<DocumentRowLive | null>(null);
  const [uploadingFor, setUploadingFor] = useState<DocumentRowLive | null>(null);
  const [submittingFor, setSubmittingFor] = useState<DocumentRowLive | null>(null);
  const [rejectingFor, setRejectingFor] = useState<DocumentRowLive | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DocumentRowLive | null>(null);
  const [confirmObsolete, setConfirmObsolete] = useState<DocumentRowLive | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (statusFilter !== "ALL" && d.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && d.type !== typeFilter) return false;
      if (!q) return true;
      return (
        d.code.toLowerCase().includes(q) ||
        d.title.toLowerCase().includes(q) ||
        (d.observations ?? "").toLowerCase().includes(q)
      );
    });
  }, [documents, search, statusFilter, typeFilter]);

  const stats = useMemo(
    () => ({
      draft: documents.filter((d) => d.status === "DRAFT").length,
      inReview: documents.filter((d) => d.status === "IN_REVIEW").length,
      approved: documents.filter((d) => d.status === "APPROVED").length,
      obsolete: documents.filter((d) => d.status === "OBSOLETE").length,
    }),
    [documents],
  );

  const columns: Column<DocumentRowLive>[] = [
    {
      key: "code",
      label: "Código",
      render: (_, d) => (
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#123C66", fontWeight: 700 }}>
          {d.code}
        </span>
      ),
    },
    {
      key: "title",
      label: "Título",
      render: (_, d) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--nf-ink)" }}>{d.title}</div>
          <div style={{ fontSize: 11, color: "var(--nf-ink-3)", marginTop: 2 }}>
            {TYPE_LABEL.get(d.type) ?? d.type}
            {d.isExternal && " · Externo"}
          </div>
        </div>
      ),
    },
    {
      key: "currentVersion",
      label: "Versión",
      render: (_, d) => <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>v{d.currentVersion}</span>,
    },
    {
      key: "status",
      label: "Estado",
      render: (_, d) => <Badge status={d.status} />,
    },
    {
      key: "updatedAt",
      label: "Última actividad",
      render: (_, d) => (
        <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{timeAgo(d.updatedAt)}</span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (_, d) => (
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <button type="button" onClick={(e) => { e.stopPropagation(); setDetail(d); }} style={ghostBtn}>
            Ver
          </button>
        </div>
      ),
    },
  ];

  function runAction(fn: () => Promise<unknown>, onSuccess?: () => void) {
    setError("");
    startTransition(async () => {
      try {
        await fn();
        onSuccess?.();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error en la operación.");
      }
    });
  }

  return (
    <div>
      <SectionTitle
        title="Control de Documentos"
        sub="Lista maestra del SGC con versionado, flujo de aprobación y trazabilidad ISO."
        action={canCreate ? "+ Nuevo documento" : undefined}
        onAction={canCreate ? () => { setCreating(true); setError(""); } : undefined}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
        <Stat label="Borradores"   value={stats.draft}    icon={<FileText size={20} strokeWidth={2.25}/>}      />
        <Stat label="En revisión"  value={stats.inReview} icon={<Clock size={20} strokeWidth={2.25}/>}         tone="warn" />
        <Stat label="Aprobados"    value={stats.approved} icon={<CheckCircle2 size={20} strokeWidth={2.25}/>} tone="ok" />
        <Stat label="Obsoletos"    value={stats.obsolete} icon={<XCircle size={20} strokeWidth={2.25}/>}       muted />
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(201, 60, 55, 0.08)", border: "1px solid rgba(201, 60, 55, 0.35)", color: "#C93C37", fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      <Card>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <input
            type="search"
            placeholder="Buscar por código, título, observaciones…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 240, padding: "8px 12px", fontSize: 13, border: "1px solid var(--nf-line)", borderRadius: 8, outline: "none", background: "var(--nf-app-surface-1)", color: "var(--nf-ink)" }}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Status)} style={selectStyle}>
            {(["ALL", "DRAFT", "IN_REVIEW", "APPROVED", "OBSOLETE"] as Status[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "ALL" | DocumentType)} style={selectStyle}>
            <option value="ALL">Todos los tipos</option>
            {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <span style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>{filtered.length} de {documents.length}</span>
        </div>

        <DataTable
          columns={columns}
          rows={filtered}
          onRow={(d) => setDetail(d)}
          emptyText="No hay documentos. Crea el primero para empezar."
        />
      </Card>

      {/* Form modal — create/edit metadata */}
      <DocumentFormModal
        open={creating || editing != null}
        editing={editing}
        locations={locations}
        personnel={personnel}
        isPending={isPending}
        onClose={() => { if (!isPending) { setCreating(false); setEditing(null); } }}
        onSubmit={(form) => {
          if (editing) {
            runAction(() => updateDocumentMetadata(editing.id, form), () => setEditing(null));
          } else {
            runAction(() => createDocument(form), () => setCreating(false));
          }
        }}
      />

      {/* Upload version */}
      <UploadVersionModal
        document={uploadingFor}
        isPending={isPending}
        onClose={() => !isPending && setUploadingFor(null)}
        onSubmit={(file, note, bump) => {
          if (!uploadingFor) return;
          runAction(
            () => uploadDocumentVersion(uploadingFor.id, { file, changeDescription: note, bump }),
            () => setUploadingFor(null),
          );
        }}
      />

      {/* Submit for review */}
      <SubmitReviewModal
        document={submittingFor}
        members={members}
        isPending={isPending}
        onClose={() => !isPending && setSubmittingFor(null)}
        onSubmit={(approverIds) => {
          if (!submittingFor) return;
          runAction(
            () => submitForReview(submittingFor.id, { approverIds }),
            () => setSubmittingFor(null),
          );
        }}
      />

      {/* Reject */}
      <RejectModal
        document={rejectingFor}
        isPending={isPending}
        onClose={() => !isPending && setRejectingFor(null)}
        onSubmit={(comment) => {
          if (!rejectingFor) return;
          runAction(
            () => rejectDocument(rejectingFor.id, { comment }),
            () => setRejectingFor(null),
          );
        }}
      />

      {/* Delete draft */}
      <Modal open={confirmDelete != null} onClose={() => !isPending && setConfirmDelete(null)} title="Borrar borrador" width={440}>
        <p style={{ margin: "0 0 14px", color: "var(--nf-ink)" }}>
          ¿Borrar el documento <strong>{confirmDelete?.code} — {confirmDelete?.title}</strong>?
          Los archivos subidos en Supabase Storage también se eliminarán.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={() => setConfirmDelete(null)} disabled={isPending} style={ghostBtn}>Cancelar</button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => runAction(
              () => deleteDraftDocument(confirmDelete!.id),
              () => { setConfirmDelete(null); if (detail?.id === confirmDelete?.id) setDetail(null); },
            )}
            style={{ ...primaryBtn, background: "#C93C37" }}
          >
            {isPending ? "Borrando…" : "Borrar"}
          </button>
        </div>
      </Modal>

      {/* Obsolete */}
      <Modal open={confirmObsolete != null} onClose={() => !isPending && setConfirmObsolete(null)} title="Marcar como obsoleto" width={460}>
        <p style={{ margin: "0 0 12px", color: "var(--nf-ink)" }}>
          ¿Marcar <strong>{confirmObsolete?.code}</strong> como obsoleto?
          El documento se conserva con todas sus versiones para auditoría, pero deja de estar activo.
        </p>
        <ObsoleteForm
          isPending={isPending}
          onCancel={() => setConfirmObsolete(null)}
          onConfirm={(reason) => runAction(
            () => markDocumentObsolete(confirmObsolete!.id, { reason }),
            () => setConfirmObsolete(null),
          )}
        />
      </Modal>

      {/* Detail */}
      <DocumentDetailModal
        document={detail}
        personnelLookup={personnelLookup}
        memberLookup={memberLookup}
        canCreate={canCreate}
        canApprove={canApprove}
        currentUserId={currentUserId}
        onClose={() => setDetail(null)}
        onEdit={() => detail && (setEditing(detail), setDetail(null))}
        onUpload={() => detail && setUploadingFor(detail)}
        onSubmitReview={() => detail && setSubmittingFor(detail)}
        onApprove={(comment) => detail && runAction(() => approveDocument(detail.id, { comment }))}
        onReject={() => detail && setRejectingFor(detail)}
        onDelete={() => detail && setConfirmDelete(detail)}
        onObsolete={() => detail && setConfirmObsolete(detail)}
      />
    </div>
  );
}

// ─── Form modal (create / edit) ───────────────────────────────────────

function DocumentFormModal({
  open,
  editing,
  locations,
  personnel,
  isPending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: DocumentRowLive | null;
  locations: { id: string; name: string }[];
  personnel: { id: string; firstName: string; lastName: string }[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (data: CreateDocumentInput) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={editing ? "Editar documento" : "Nuevo documento"} width={720}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const data: CreateDocumentInput = {
            code: String(fd.get("code") || ""),
            title: String(fd.get("title") || ""),
            type: String(fd.get("type") || "PROCEDURE") as DocumentType,
            standardCode: String(fd.get("standardCode") || "") || undefined,
            observations: String(fd.get("observations") || "") || undefined,
            locationId: String(fd.get("locationId") || "") || undefined,
            physicalLocation: String(fd.get("physicalLocation") || "") || undefined,
            responsibleElaborationId: String(fd.get("responsibleElaborationId") || "") || undefined,
            responsibleApprovalId: String(fd.get("responsibleApprovalId") || "") || undefined,
            custodianId: String(fd.get("custodianId") || "") || undefined,
            isExternal: fd.get("isExternal") === "on",
            externalLink: String(fd.get("externalLink") || "") || undefined,
            distributionList: String(fd.get("distributionList") || "")
              .split(/[,\n]/)
              .map((s) => s.trim())
              .filter(Boolean),
          };
          onSubmit(data);
        }}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
          <Field label="Código *">
            <input name="code" required defaultValue={editing?.code ?? ""} style={inputStyle} placeholder="SGSI-POL-001" />
          </Field>
          <Field label="Título *">
            <input name="title" required defaultValue={editing?.title ?? ""} style={inputStyle} />
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Tipo">
            <select name="type" defaultValue={editing?.type ?? "PROCEDURE"} style={inputStyle}>
              {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Norma">
            <select name="standardCode" defaultValue={editing?.standardCode ?? ""} style={inputStyle}>
              <option value="">— Ninguna —</option>
              <option value="ISO_9001">ISO 9001</option>
              <option value="ISO_27001">ISO 27001</option>
              <option value="ISO_14001">ISO 14001</option>
              <option value="ISO_45001">ISO 45001</option>
            </select>
          </Field>
          <Field label="Ubicación / sede">
            <select name="locationId" defaultValue={editing?.locationId ?? ""} style={inputStyle}>
              <option value="">—</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Responsable elaboración">
            <select name="responsibleElaborationId" defaultValue={editing?.responsibleElaborationId ?? ""} style={inputStyle}>
              <option value="">—</option>
              {personnel.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
            </select>
          </Field>
          <Field label="Responsable aprobación">
            <select name="responsibleApprovalId" defaultValue={editing?.responsibleApprovalId ?? ""} style={inputStyle}>
              <option value="">—</option>
              {personnel.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
            </select>
          </Field>
          <Field label="Custodio">
            <select name="custodianId" defaultValue={editing?.custodianId ?? ""} style={inputStyle}>
              <option value="">—</option>
              {personnel.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Ubicación física">
          <input name="physicalLocation" defaultValue={editing?.physicalLocation ?? ""} style={inputStyle} placeholder="Archivador A, estante 3…" />
        </Field>
        <Field label="Lista de distribución (correos separados por coma o salto de línea)">
          <textarea name="distributionList" rows={2} defaultValue={editing?.distributionList.join(", ") ?? ""} style={inputStyle} placeholder="calidad@empresa.com, produccion@empresa.com" />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "end" }}>
          <Field label="Documento externo">
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 12px", border: "1px solid var(--nf-line)", borderRadius: 8, background: "var(--nf-app-surface-1)" }}>
              <input type="checkbox" name="isExternal" defaultChecked={editing?.isExternal ?? false} />
              <span style={{ fontSize: 13 }}>Es externo</span>
            </label>
          </Field>
          <Field label="Enlace externo (si aplica)">
            <input name="externalLink" defaultValue={editing?.externalLink ?? ""} style={inputStyle} placeholder="https://…" />
          </Field>
        </div>
        <Field label="Observaciones">
          <textarea name="observations" rows={3} defaultValue={editing?.observations ?? ""} style={inputStyle} />
        </Field>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
          <button type="button" onClick={onClose} disabled={isPending} style={ghostBtn}>Cancelar</button>
          <button type="submit" disabled={isPending} style={primaryBtn}>
            {isPending && <Loader2 size={14} className="nf-icon-spin" style={{ marginRight: 6 }} />}
            {isPending ? "Guardando…" : editing ? "Guardar cambios" : "Crear documento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Upload version ───────────────────────────────────────────────────

function UploadVersionModal({
  document: doc,
  isPending,
  onClose,
  onSubmit,
}: {
  document: DocumentRowLive | null;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (file: File, note: string, bump: "minor" | "major") => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [bump, setBump] = useState<"minor" | "major">("minor");

  return (
    <Modal open={doc != null} onClose={() => { setFile(null); setNote(""); onClose(); }} title="Subir nueva versión" width={520}>
      {doc && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!file) return;
            onSubmit(file, note, bump);
            setFile(null);
            setNote("");
          }}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "var(--nf-ink-2)" }}>
            Versión actual: <strong>v{doc.currentVersion}</strong>. Sube el archivo correspondiente a la nueva versión.
          </p>
          <Field label="Archivo *">
            <input type="file" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={inputStyle} />
          </Field>
          <Field label="Tipo de versión">
            <div style={{ display: "flex", gap: 8 }}>
              <label style={radioLabel(bump === "minor")}>
                <input type="radio" name="bump" value="minor" checked={bump === "minor"} onChange={() => setBump("minor")} /> Minor (v{doc.currentVersion} → {nextMinor(doc.currentVersion)})
              </label>
              <label style={radioLabel(bump === "major")}>
                <input type="radio" name="bump" value="major" checked={bump === "major"} onChange={() => setBump("major")} /> Mayor (cambio sustancial)
              </label>
            </div>
          </Field>
          <Field label="Descripción del cambio *">
            <textarea required rows={3} value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} placeholder="Resumen de qué cambió respecto de la versión anterior." />
          </Field>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} disabled={isPending} style={ghostBtn}>Cancelar</button>
            <button type="submit" disabled={isPending || !file} style={primaryBtn}>
              {isPending ? "Subiendo…" : "Subir versión"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function nextMinor(v: string): string {
  const parts = v.split(".").map((p) => parseInt(p, 10));
  if (parts.length === 1) return `${parts[0]}.1`;
  parts[parts.length - 1] = (parts[parts.length - 1] ?? 0) + 1;
  return parts.join(".");
}

// ─── Submit review ────────────────────────────────────────────────────

function SubmitReviewModal({
  document: doc,
  members,
  isPending,
  onClose,
  onSubmit,
}: {
  document: DocumentRowLive | null;
  members: { userId: string; name: string; email: string; role: string }[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (approverIds: string[]) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());

  return (
    <Modal open={doc != null} onClose={() => { setPicked(new Set()); onClose(); }} title="Enviar a revisión" width={520}>
      {doc && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--nf-ink-2)" }}>
            Selecciona las personas que deben aprobar <strong>{doc.code}</strong>. Recibirán una notificación.
          </p>
          <div style={{ maxHeight: 280, overflow: "auto", border: "1px solid var(--nf-line)", borderRadius: 8 }}>
            {members.filter((m) => m.role === "ORG_ADMIN" || m.role === "COMPLIANCE_MANAGER").map((m) => (
              <label key={m.userId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: "1px solid var(--nf-line)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={picked.has(m.userId)}
                  onChange={() => {
                    const next = new Set(picked);
                    if (next.has(m.userId)) next.delete(m.userId); else next.add(m.userId);
                    setPicked(next);
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--nf-ink)" }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: "var(--nf-ink-3)" }}>{m.email} · {m.role}</div>
                </div>
              </label>
            ))}
            {members.filter((m) => m.role === "ORG_ADMIN" || m.role === "COMPLIANCE_MANAGER").length === 0 && (
              <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: "var(--nf-ink-4)" }}>
                No hay aprobadores disponibles. Invita un Admin o Compliance Manager primero.
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} disabled={isPending} style={ghostBtn}>Cancelar</button>
            <button
              type="button"
              disabled={isPending || picked.size === 0}
              onClick={() => onSubmit(Array.from(picked))}
              style={primaryBtn}
            >
              {isPending ? "Enviando…" : `Enviar a revisión (${picked.size})`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Reject ──────────────────────────────────────────────────────────

function RejectModal({
  document: doc,
  isPending,
  onClose,
  onSubmit,
}: {
  document: DocumentRowLive | null;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (comment: string) => void;
}) {
  const [comment, setComment] = useState("");
  return (
    <Modal open={doc != null} onClose={() => { setComment(""); onClose(); }} title="Rechazar documento" width={460}>
      {doc && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--nf-ink)" }}>
            El documento <strong>{doc.code}</strong> volverá a borrador. Indica el motivo:
          </p>
          <textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} style={inputStyle} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} disabled={isPending} style={ghostBtn}>Cancelar</button>
            <button
              type="button"
              disabled={isPending || !comment.trim()}
              onClick={() => onSubmit(comment.trim())}
              style={{ ...primaryBtn, background: "#C93C37" }}
            >
              {isPending ? "Rechazando…" : "Rechazar"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ObsoleteForm({ isPending, onCancel, onConfirm }: { isPending: boolean; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (opcional)" style={inputStyle} />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} disabled={isPending} style={ghostBtn}>Cancelar</button>
        <button type="button" disabled={isPending} onClick={() => onConfirm(reason)} style={{ ...primaryBtn, background: "#5E6B7A" }}>
          {isPending ? "Marcando…" : "Marcar obsoleto"}
        </button>
      </div>
    </div>
  );
}

// ─── Detail modal ────────────────────────────────────────────────────

function DocumentDetailModal({
  document: doc,
  personnelLookup,
  memberLookup,
  canCreate,
  canApprove,
  currentUserId,
  onClose,
  onEdit,
  onUpload,
  onSubmitReview,
  onApprove,
  onReject,
  onDelete,
  onObsolete,
}: {
  document: DocumentRowLive | null;
  personnelLookup: Map<string, string>;
  memberLookup: Map<string, string>;
  canCreate: boolean;
  canApprove: boolean;
  currentUserId: string;
  onClose: () => void;
  onEdit: () => void;
  onUpload: () => void;
  onSubmitReview: () => void;
  onApprove: (comment?: string) => void;
  onReject: () => void;
  onDelete: () => void;
  onObsolete: () => void;
}) {
  const [approveComment, setApproveComment] = useState("");

  if (!doc) return null;

  const myPending = doc.approvals.find((a) => a.approverId === currentUserId && a.status === "PENDING");
  const canShowApprove = canApprove && doc.status === "IN_REVIEW";
  const canShowSubmit = canCreate && doc.status === "DRAFT" && doc.versions.length > 0;
  const canShowUpload = canCreate && (doc.status === "DRAFT" || doc.status === "APPROVED");
  const canShowDelete = canCreate && doc.status === "DRAFT";
  const canShowObsolete = canApprove && doc.status === "APPROVED";

  return (
    <Modal open onClose={onClose} title={`${doc.code} — ${doc.title}`} width={820}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <Meta label="Estado" value={<Badge status={doc.status} />} />
          <Meta label="Versión actual" value={<span style={{ fontFamily: "ui-monospace, monospace" }}>v{doc.currentVersion}</span>} />
          <Meta label="Tipo" value={TYPE_LABEL.get(doc.type) ?? doc.type} />
          <Meta label="Norma" value={doc.standardCode ?? "—"} />
          <Meta label="Ubicación" value={doc.locationName ?? doc.physicalLocation ?? "—"} />
          <Meta label="Custodio" value={doc.custodianId ? personnelLookup.get(doc.custodianId) ?? "—" : "—"} />
          <Meta label="Elaboración" value={doc.responsibleElaborationId ? personnelLookup.get(doc.responsibleElaborationId) ?? "—" : "—"} />
          <Meta label="Aprobación" value={doc.responsibleApprovalId ? personnelLookup.get(doc.responsibleApprovalId) ?? "—" : "—"} />
        </div>

        {doc.observations && (
          <div style={{ padding: 12, borderRadius: 8, background: "var(--nf-app-surface-2)", border: "1px solid var(--nf-line)", fontSize: 13, color: "var(--nf-ink-2)" }}>
            {doc.observations}
          </div>
        )}

        {/* Acciones de workflow */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: 12, borderRadius: 8, background: "var(--nf-app-surface-2)", border: "1px solid var(--nf-line)" }}>
          {canShowUpload && (
            <button type="button" onClick={onUpload} style={primaryBtn}>
              <Upload size={14} style={{ marginRight: 6 }} /> Subir versión
            </button>
          )}
          {canShowSubmit && (
            <button type="button" onClick={onSubmitReview} style={primaryBtn}>
              <Send size={14} style={{ marginRight: 6 }} /> Enviar a revisión
            </button>
          )}
          {canShowApprove && (
            <>
              <input
                placeholder="Comentario de aprobación (opcional)"
                value={approveComment}
                onChange={(e) => setApproveComment(e.target.value)}
                style={{ ...inputStyle, maxWidth: 280, padding: "6px 10px", fontSize: 12 }}
              />
              <button
                type="button"
                onClick={() => { onApprove(approveComment); setApproveComment(""); }}
                style={{ ...primaryBtn, background: "#2E8B57" }}
              >
                <CheckCircle2 size={14} style={{ marginRight: 6 }} />
                {myPending ? "Aprobar mi parte" : "Aprobar"}
              </button>
              <button type="button" onClick={onReject} style={dangerBtn}>
                <XCircle size={14} style={{ marginRight: 6 }} /> Rechazar
              </button>
            </>
          )}
          {canCreate && doc.status === "DRAFT" && (
            <button type="button" onClick={onEdit} style={ghostBtn}>
              <Pencil size={14} style={{ marginRight: 6 }} /> Editar metadata
            </button>
          )}
          {canShowDelete && (
            <button type="button" onClick={onDelete} style={dangerBtn}>Borrar borrador</button>
          )}
          {canShowObsolete && (
            <button type="button" onClick={onObsolete} style={{ ...ghostBtn, color: "#5E6B7A" }}>Marcar obsoleto</button>
          )}
        </div>

        {/* Versions history */}
        <div>
          <h4 style={{ margin: "0 0 10px", fontSize: 14, color: "var(--nf-ink)" }}>
            Versiones ({doc.versions.length})
          </h4>
          {doc.versions.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--nf-ink-4)", margin: 0 }}>
              Aún no se ha subido ningún archivo.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {doc.versions.map((v) => (
                <VersionRow key={v.id} version={v} memberLookup={memberLookup} />
              ))}
            </div>
          )}
        </div>

        {/* Approvals trail */}
        {doc.approvals.length > 0 && (
          <div>
            <h4 style={{ margin: "0 0 10px", fontSize: 14, color: "var(--nf-ink)" }}>
              Aprobaciones ({doc.approvals.length})
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {doc.approvals.map((a) => (
                <div key={a.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 10, alignItems: "center", padding: "8px 12px", borderRadius: 8, background: "var(--nf-app-surface-1)", border: "1px solid var(--nf-line)" }}>
                  <Badge status={a.status} />
                  <div>
                    <div style={{ fontSize: 13, color: "var(--nf-ink)" }}>{memberLookup.get(a.approverId) ?? a.approverId}</div>
                    {a.comment && <div style={{ fontSize: 11, color: "var(--nf-ink-3)", marginTop: 2 }}>{a.comment}</div>}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--nf-ink-3)", fontFamily: "ui-monospace, monospace" }}>
                    {a.decidedAt ? formatDate(a.decidedAt, "dd/MM/yyyy HH:mm") : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function VersionRow({
  version: v,
  memberLookup,
}: {
  version: DocumentRowLive["versions"][number];
  memberLookup: Map<string, string>;
}) {
  const [loading, setLoading] = useState(false);

  async function openFile() {
    if (!v.fileUrl) return;
    setLoading(true);
    try {
      const url = await getDocumentVersionUrl(v.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "60px 1fr auto auto", gap: 12, alignItems: "center", padding: "10px 12px", borderRadius: 8, background: "var(--nf-app-surface-1)", border: "1px solid var(--nf-line)" }}>
      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 700, color: "#123C66" }}>v{v.version}</span>
      <div>
        <div style={{ fontSize: 13, color: "var(--nf-ink)" }}>
          {v.changeDescription ?? <span style={{ color: "var(--nf-ink-4)" }}>Sin descripción</span>}
        </div>
        <div style={{ fontSize: 11, color: "var(--nf-ink-3)", marginTop: 2 }}>
          {v.createdById ? memberLookup.get(v.createdById) ?? "—" : "Sistema"} · {formatDate(v.createdAt, "dd/MM/yyyy HH:mm")}
          {v.fileSize && ` · ${Math.round(v.fileSize / 1024)} KB`}
        </div>
      </div>
      {v.previousVersion && (
        <span style={{ fontSize: 10, color: "var(--nf-ink-4)", fontFamily: "monospace" }}>
          ← v{v.previousVersion}
        </span>
      )}
      {v.fileUrl && (
        <button type="button" onClick={openFile} disabled={loading} style={ghostBtn} title="Abrir archivo">
          {loading ? <Loader2 size={14} className="nf-icon-spin" /> : <Download size={14} />}
        </button>
      )}
    </div>
  );
}

// ─── Helpers UI ──────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      {children}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--nf-ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: "var(--nf-ink)" }}>{value}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone,
  muted,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "ok" | "warn";
  muted?: boolean;
}) {
  const color = tone === "ok" ? "#2E8B57" : tone === "warn" ? "#D68A1A" : muted ? "var(--nf-ink-3)" : "var(--nf-ink)";
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color }}>{icon}</span>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{value}</div>
          <div style={{ fontSize: 11, color: "var(--nf-ink-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
        </div>
      </div>
    </Card>
  );
}

function radioLabel(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "8px 12px", borderRadius: 8,
    background: active ? "rgba(18, 60, 102, 0.1)" : "var(--nf-app-surface-1)",
    border: `1px solid ${active ? "#123C66" : "var(--nf-line)"}`,
    cursor: "pointer", fontSize: 12, fontWeight: 500, color: "var(--nf-ink)",
  };
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", fontSize: 14,
  border: "1px solid var(--nf-line)", borderRadius: 8, outline: "none",
  fontFamily: "inherit", boxSizing: "border-box",
  background: "var(--nf-app-surface-1)", color: "var(--nf-ink)",
};
const selectStyle: React.CSSProperties = {
  padding: "8px 10px", fontSize: 12,
  border: "1px solid var(--nf-line)", borderRadius: 8,
  background: "var(--nf-app-surface-1)", color: "var(--nf-ink)",
};
const primaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center",
  padding: "8px 14px", fontSize: 13, fontWeight: 600,
  color: "#fff", background: "#123C66", border: "none",
  borderRadius: 8, cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center",
  padding: "8px 12px", fontSize: 12, fontWeight: 500,
  color: "var(--nf-ink-3)", background: "var(--nf-app-surface-1)",
  border: "1px solid var(--nf-line)", borderRadius: 8, cursor: "pointer",
};
const dangerBtn: React.CSSProperties = { ...ghostBtn, color: "#C93C37", border: "1px solid #fde0e0" };
