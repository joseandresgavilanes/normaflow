"use client";

import { useMemo, useState } from "react";
import { useCreateFromQuery } from "@/hooks/useCreateFromQuery";
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
import { ConfirmActionModal } from "@/components/ui/ActionDialogs";
import { ModalField, NF_INPUT_CLASS, modalInputStyle } from "@/components/ui/ModalForm";
import {
  approveDocument,
  createDocument,
  deleteDraftDocument,
  getDocumentVersionUrl,
  markDocumentObsolete,
  rejectDocument,
  submitForReview,
  supersedeDocument,
  updateDocumentMetadata,
  uploadDocumentVersion,
  type CreateDocumentInput,
} from "@/lib/actions/documents";
import type { DocumentsPayload, DocumentRowLive } from "@/lib/server-queries";
import { DOCUMENT_SORT_OPTIONS, sortDocuments, type DocumentSortKey } from "@/lib/documents-sort";
import { useServerAction } from "@/hooks/useServerAction";
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
  const { run, isPending, error, setError, success } = useServerAction();
  const { documents, locations, personnel, members, processes, clauses, standards } = initial;
  const personnelLookup = useMemo(
    () => new Map(personnel.map((p) => [p.id, `${p.firstName} ${p.lastName}`])),
    [personnel],
  );
  const memberLookup = useMemo(() => new Map(members.map((m) => [m.userId, m.name])), [members]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status>("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | DocumentType>("ALL");
  const [sortBy, setSortBy] = useState<DocumentSortKey>("activity_desc");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DocumentRowLive | null>(null);
  const [detail, setDetail] = useState<DocumentRowLive | null>(null);
  const [uploadingFor, setUploadingFor] = useState<DocumentRowLive | null>(null);
  const [submittingFor, setSubmittingFor] = useState<DocumentRowLive | null>(null);
  const [rejectingFor, setRejectingFor] = useState<DocumentRowLive | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DocumentRowLive | null>(null);
  const [confirmObsolete, setConfirmObsolete] = useState<DocumentRowLive | null>(null);
  const [supersedeFor, setSupersedeFor] = useState<DocumentRowLive | null>(null);

  useCreateFromQuery(canCreate, () => {
    setCreating(true);
    setError("");
  });

  /** Evita modal con estado obsoleto tras aprobar/rechazar (p. ej. segundo clic en Aprobar). */
  const detailDoc = useMemo(
    () => (detail ? documents.find((d) => d.id === detail.id) ?? detail : null),
    [detail, documents],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = documents.filter((d) => {
      if (statusFilter !== "ALL" && d.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && d.type !== typeFilter) return false;
      if (!q) return true;
      return (
        d.code.toLowerCase().includes(q) ||
        d.title.toLowerCase().includes(q) ||
        (d.processName ?? "").toLowerCase().includes(q) ||
        d.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        (d.observations ?? "").toLowerCase().includes(q)
      );
    });
    return sortDocuments(rows, sortBy, (d) => new Date(d.updatedAt).getTime());
  }, [documents, search, statusFilter, typeFilter, sortBy]);

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
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#5266F6", fontWeight: 700 }}>
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
            {d.processCode && ` · ${d.processCode}`}
            {d.isExternal && " · Externo"}
          </div>
          {d.supersededByCode && (
            <div style={{ fontSize: 11, color: "#D97706", marginTop: 2, fontWeight: 600 }}>↪ Reemplazado por {d.supersededByCode}</div>
          )}
          {d.supersedesCode && (
            <div style={{ fontSize: 11, color: "#16A34A", marginTop: 2, fontWeight: 600 }}>Reemplaza a {d.supersedesCode}</div>
          )}
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
          {initial.access.canApprove && d.status === "APPROVED" && !d.supersededById && (
            <button type="button" onClick={(e) => { e.stopPropagation(); setError(""); setSupersedeFor(d); }} className="nf-app-btn-ghost">
              Reemplazar
            </button>
          )}
          <button type="button" onClick={(e) => { e.stopPropagation(); setDetail(d); }} className="nf-app-btn-ghost">
            Ver
          </button>
        </div>
      ),
    },
  ];

  const closeDetail = () => setDetail(null);

  return (
    <div>
      <SectionTitle
        title="Control de Documentos"
        sub="Lista maestra del SGC con versionado, flujo de aprobación y trazabilidad ISO."
        action={canCreate ? "+ Nuevo documento" : undefined}
        onAction={canCreate ? () => { setCreating(true); setError(""); } : undefined}
      />

      <div className="nf-metric-strip">
        <Stat label="Borradores"   value={stats.draft}    icon={<FileText size={20} strokeWidth={2.25}/>}      />
        <Stat label="En revisión"  value={stats.inReview} icon={<Clock size={20} strokeWidth={2.25}/>}         tone="warn" />
        <Stat label="Aprobados"    value={stats.approved} icon={<CheckCircle2 size={20} strokeWidth={2.25}/>} tone="ok" />
        <Stat label="Obsoletos"    value={stats.obsolete} icon={<XCircle size={20} strokeWidth={2.25}/>}       muted />
      </div>

      {error && <div className="nf-alert nf-alert--error">{error}</div>}
      {success && <div className="nf-alert nf-alert--success">{success}</div>}

      <Card>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <input
            type="search"
            placeholder="Buscar por código, título, observaciones…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="nf-app-input nf-app-input--toolbar"
            style={{ flex: 1, minWidth: 240 }}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Status)} className={NF_INPUT_CLASS} style={{ width: "auto", minWidth: 140 }}>
            {(["ALL", "DRAFT", "IN_REVIEW", "APPROVED", "OBSOLETE"] as Status[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "ALL" | DocumentType)} className={NF_INPUT_CLASS} style={{ width: "auto", minWidth: 140 }}>
            <option value="ALL">Todos los tipos</option>
            {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as DocumentSortKey)} className={NF_INPUT_CLASS} style={{ width: "auto", minWidth: 140 }} aria-label="Ordenar documentos">
            {DOCUMENT_SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
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
        members={members}
        processes={processes}
        standards={standards}
        clauses={clauses}
        isPending={isPending}
        onClose={() => { if (!isPending) { setCreating(false); setEditing(null); } }}
        onSubmit={(form) => {
          if (editing) {
            run(() => updateDocumentMetadata(editing.id, form), {
              onSuccess: () => setEditing(null),
              successMessage: "Documento actualizado.",
            });
          } else {
            run(() => createDocument(form), {
              onSuccess: () => setCreating(false),
              successMessage: "Documento creado.",
            });
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
          run(
            () => uploadDocumentVersion(uploadingFor.id, { file, changeDescription: note, bump }),
            {
              onSuccess: () => {
                setUploadingFor(null);
                if (detail?.id === uploadingFor.id) closeDetail();
              },
              successMessage: "Nueva versión subida.",
            },
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
          run(
            () => submitForReview(submittingFor.id, { approverIds }),
            {
              onSuccess: () => {
                setSubmittingFor(null);
                closeDetail();
              },
              successMessage: "Documento enviado a revisión.",
            },
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
          run(
            () => rejectDocument(rejectingFor.id, { comment }),
            {
              onSuccess: () => {
                setRejectingFor(null);
                closeDetail();
              },
              successMessage: "Documento rechazado y devuelto a borrador.",
            },
          );
        }}
      />

      {/* Delete draft */}
      <Modal open={confirmDelete != null} onClose={() => !isPending && setConfirmDelete(null)} title="Borrar borrador" width={440}>
        <p style={{ margin: "0 0 14px", color: "var(--nf-ink)" }}>
          ¿Borrar el documento <strong>{confirmDelete?.code} — {confirmDelete?.title}</strong>?
          Los archivos subidos en Supabase Storage también se eliminarán.
        </p>
        <div className="nf-modal-actions">
          <button type="button" onClick={() => setConfirmDelete(null)} disabled={isPending} className="nf-app-btn-ghost">Cancelar</button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(
              () => deleteDraftDocument(confirmDelete!.id),
              {
                onSuccess: () => {
                  setConfirmDelete(null);
                  if (detail?.id === confirmDelete?.id) closeDetail();
                },
                successMessage: "Borrador eliminado.",
              },
            )}
            className="nf-app-btn-danger"
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
          onConfirm={(reason) => run(
            () => markDocumentObsolete(confirmObsolete!.id, { reason }),
            {
              onSuccess: () => {
                setConfirmObsolete(null);
                closeDetail();
              },
              successMessage: "Documento marcado como obsoleto.",
            },
          )}
        />
      </Modal>

      {/* Supersede / reemplazo */}
      <Modal open={supersedeFor != null} onClose={() => !isPending && setSupersedeFor(null)} title={`Reemplazar ${supersedeFor?.code ?? ""}`} width={520}>
        {supersedeFor && (
          <SupersedeForm
            current={supersedeFor}
            options={documents.filter((d) => d.id !== supersedeFor.id && d.status !== "OBSOLETE" && !d.supersedesId)}
            isPending={isPending}
            onCancel={() => setSupersedeFor(null)}
            onConfirm={(newId, reason) => run(
              () => supersedeDocument(supersedeFor.id, newId, { reason }),
              {
                onSuccess: () => { setSupersedeFor(null); closeDetail(); },
                successMessage: "Documento reemplazado y archivado como histórico.",
              },
            )}
          />
        )}
      </Modal>

      {/* Detail */}
      <DocumentDetailModal
        document={detailDoc}
        personnelLookup={personnelLookup}
        memberLookup={memberLookup}
        canCreate={canCreate}
        canApprove={canApprove}
        currentUserId={currentUserId}
        isPending={isPending}
        onClose={closeDetail}
        onEdit={() => detailDoc && (setEditing(detailDoc), closeDetail())}
        onUpload={() => detailDoc && setUploadingFor(detailDoc)}
        onSubmitReview={() => detailDoc && setSubmittingFor(detailDoc)}
        onApprove={(comment) =>
          detailDoc &&
          run(() => approveDocument(detailDoc.id, { comment }), {
            onSuccess: closeDetail,
            successMessage: "Documento aprobado.",
          })
        }
        onReject={() => detailDoc && setRejectingFor(detailDoc)}
        onDelete={() => detailDoc && setConfirmDelete(detailDoc)}
        onObsolete={() => detailDoc && setConfirmObsolete(detailDoc)}
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
  members,
  processes,
  standards,
  clauses,
  isPending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: DocumentRowLive | null;
  locations: { id: string; name: string }[];
  personnel: { id: string; firstName: string; lastName: string }[];
  members: { userId: string; name: string }[];
  processes: DocumentsPayload["processes"];
  standards: DocumentsPayload["standards"];
  clauses: DocumentsPayload["clauses"];
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
          const clauseId = String(fd.get("clauseId") || "") || undefined;
          const selectedClause = clauses.find((clause) => clause.id === clauseId);
          const data: CreateDocumentInput = {
            code: String(fd.get("code") || ""),
            title: String(fd.get("title") || ""),
            type: String(fd.get("type") || "PROCEDURE") as DocumentType,
            ownerId: String(fd.get("ownerId") || "") || undefined,
            processId: String(fd.get("processId") || "") || undefined,
            clauseId,
            standardCode: selectedClause?.standardCode ?? (String(fd.get("standardCode") || "") || undefined),
            reviewDate: String(fd.get("reviewDate") || "") || undefined,
            tags: String(fd.get("tags") || "").split(/[,\n]/).map((tag) => tag.trim()).filter(Boolean),
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
        className="nf-modal-form"
      >
        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
          <Field label="Código *">
            <input name="code" required defaultValue={editing?.code ?? ""} className={NF_INPUT_CLASS} style={modalInputStyle} placeholder="SGSI-POL-001" />
          </Field>
          <Field label="Título *">
            <input name="title" required defaultValue={editing?.title ?? ""} className={NF_INPUT_CLASS} style={modalInputStyle} />
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Tipo">
            <select name="type" defaultValue={editing?.type ?? "PROCEDURE"} className={NF_INPUT_CLASS} style={modalInputStyle}>
              {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Norma">
            <select name="standardCode" defaultValue={editing?.standardCode ?? ""} className={NF_INPUT_CLASS} style={modalInputStyle}>
              <option value="">— Ninguna —</option>
              {standards.map((standard) => <option key={standard.code} value={standard.code}>{standard.name}</option>)}
            </select>
          </Field>
          <Field label="Ubicación / sede">
            <select name="locationId" defaultValue={editing?.locationId ?? ""} className={NF_INPUT_CLASS} style={modalInputStyle}>
              <option value="">—</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Proceso relacionado">
            <select name="processId" defaultValue={editing?.processId ?? ""} className={NF_INPUT_CLASS} style={modalInputStyle}>
              <option value="">— Sin proceso —</option>
              {processes.map((process) => <option key={process.id} value={process.id}>{process.code ?? "PROC"} · {process.name}</option>)}
            </select>
          </Field>
          <Field label="Cláusula aplicable">
            <select name="clauseId" defaultValue={editing?.clauseId ?? ""} className={NF_INPUT_CLASS} style={modalInputStyle}>
              <option value="">— Sin cláusula —</option>
              {clauses.map((clause) => <option key={clause.id} value={clause.id}>{clause.standardCode.replace("_", " ")} · {clause.code} — {clause.title}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Responsable del documento">
            <select name="ownerId" defaultValue={editing?.ownerId ?? ""} className={NF_INPUT_CLASS} style={modalInputStyle}>
              <option value="">— Usuario actual —</option>
              {members.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}
            </select>
          </Field>
          <Field label="Próxima revisión">
            <input name="reviewDate" type="date" defaultValue={editing?.reviewDate?.slice(0, 10) ?? ""} className={NF_INPUT_CLASS} style={modalInputStyle} />
          </Field>
        </div>
        <Field label="Etiquetas (separadas por coma)">
          <input name="tags" defaultValue={editing?.tags.join(", ") ?? ""} className={NF_INPUT_CLASS} style={modalInputStyle} placeholder="calidad, seguridad, política" />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Responsable elaboración">
            <select name="responsibleElaborationId" defaultValue={editing?.responsibleElaborationId ?? ""} className={NF_INPUT_CLASS} style={modalInputStyle}>
              <option value="">—</option>
              {personnel.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
            </select>
          </Field>
          <Field label="Responsable aprobación">
            <select name="responsibleApprovalId" defaultValue={editing?.responsibleApprovalId ?? ""} className={NF_INPUT_CLASS} style={modalInputStyle}>
              <option value="">—</option>
              {personnel.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
            </select>
          </Field>
          <Field label="Custodio">
            <select name="custodianId" defaultValue={editing?.custodianId ?? ""} className={NF_INPUT_CLASS} style={modalInputStyle}>
              <option value="">—</option>
              {personnel.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Ubicación física">
          <input name="physicalLocation" defaultValue={editing?.physicalLocation ?? ""} className={NF_INPUT_CLASS} style={modalInputStyle} placeholder="Archivador A, estante 3…" />
        </Field>
        <Field label="Lista de distribución (correos separados por coma o salto de línea)">
          <textarea name="distributionList" rows={2} defaultValue={editing?.distributionList.join(", ") ?? ""} className={NF_INPUT_CLASS} style={modalInputStyle} placeholder="calidad@empresa.com, produccion@empresa.com" />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "end" }}>
          <Field label="Documento externo">
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 12px", border: "1px solid var(--nf-line)", borderRadius: 8, background: "var(--nf-app-surface-1)" }}>
              <input type="checkbox" name="isExternal" defaultChecked={editing?.isExternal ?? false} />
              <span style={{ fontSize: 13 }}>Es externo</span>
            </label>
          </Field>
          <Field label="Enlace externo (si aplica)">
            <input name="externalLink" defaultValue={editing?.externalLink ?? ""} className={NF_INPUT_CLASS} style={modalInputStyle} placeholder="https://…" />
          </Field>
        </div>
        <Field label="Observaciones">
          <textarea name="observations" rows={3} defaultValue={editing?.observations ?? ""} className={NF_INPUT_CLASS} style={modalInputStyle} />
        </Field>

        <div className="nf-modal-actions">
          <button type="button" onClick={onClose} disabled={isPending} className="nf-app-btn-ghost">Cancelar</button>
          <button type="submit" disabled={isPending} className="nf-app-btn-primary">
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
        className="nf-modal-form"
        >
          <p style={{ margin: 0, fontSize: 13, color: "var(--nf-ink-2)" }}>
            Versión actual: <strong>v{doc.currentVersion}</strong>. Sube el archivo correspondiente a la nueva versión.
          </p>
          <Field label="Archivo *">
            <input type="file" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={NF_INPUT_CLASS} style={modalInputStyle} />
          </Field>
          <Field label="Tipo de versión">
            <div style={{ display: "flex", gap: 8 }}>
              <label className={radioChoiceClass(bump === "minor")}>
                <input type="radio" name="bump" value="minor" checked={bump === "minor"} onChange={() => setBump("minor")} /> Minor (v{doc.currentVersion} → {nextMinor(doc.currentVersion)})
              </label>
              <label className={radioChoiceClass(bump === "major")}>
                <input type="radio" name="bump" value="major" checked={bump === "major"} onChange={() => setBump("major")} /> Mayor (cambio sustancial)
              </label>
            </div>
          </Field>
          <Field label="Descripción del cambio *">
            <textarea required rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={NF_INPUT_CLASS} style={modalInputStyle} placeholder="Resumen de qué cambió respecto de la versión anterior." />
          </Field>
          <div className="nf-modal-actions">
            <button type="button" onClick={onClose} disabled={isPending} className="nf-app-btn-ghost">Cancelar</button>
            <button type="submit" disabled={isPending || !file} className="nf-app-btn-primary">
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
          <div className="nf-modal-actions">
            <button type="button" onClick={onClose} disabled={isPending} className="nf-app-btn-ghost">Cancelar</button>
            <button
              type="button"
              disabled={isPending || picked.size === 0}
              onClick={() => onSubmit(Array.from(picked))}
              className="nf-app-btn-primary"
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
          <textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} className={NF_INPUT_CLASS} style={modalInputStyle} />
          <div className="nf-modal-actions">
            <button type="button" onClick={onClose} disabled={isPending} className="nf-app-btn-ghost">Cancelar</button>
            <button
              type="button"
              disabled={isPending || !comment.trim()}
              onClick={() => onSubmit(comment.trim())}
              className="nf-app-btn-danger"
            >
              {isPending ? "Rechazando…" : "Rechazar"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function SupersedeForm({ current, options, isPending, onCancel, onConfirm }: {
  current: DocumentRowLive;
  options: DocumentRowLive[];
  isPending: boolean;
  onCancel: () => void;
  onConfirm: (newId: string, reason: string) => void;
}) {
  const [newId, setNewId] = useState("");
  const [reason, setReason] = useState("");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--nf-ink-3)", lineHeight: 1.55 }}>
        <strong>{current.code}</strong> quedará marcado como <strong>obsoleto</strong> y se conservará como histórico (no se borra).
        El documento de reemplazo tomará su lugar{current.processCode ? ` y su proceso (${current.processCode})` : ""}.
      </p>
      <ModalField label="Documento de reemplazo">
        <select value={newId} onChange={(e) => setNewId(e.target.value)} className={NF_INPUT_CLASS} style={modalInputStyle}>
          <option value="">Selecciona el documento que lo reemplaza…</option>
          {options.map((d) => (
            <option key={d.id} value={d.id}>{d.code} — {d.title} (v{d.currentVersion})</option>
          ))}
        </select>
      </ModalField>
      <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo del reemplazo (opcional)" className={NF_INPUT_CLASS} style={modalInputStyle} />
      <div className="nf-modal-actions">
        <button type="button" onClick={onCancel} disabled={isPending} className="nf-app-btn-ghost">Cancelar</button>
        <button type="button" disabled={isPending || !newId} onClick={() => onConfirm(newId, reason)} className="nf-app-btn-primary">
          {isPending ? "Reemplazando…" : "Reemplazar y archivar"}
        </button>
      </div>
    </div>
  );
}

function ObsoleteForm({ isPending, onCancel, onConfirm }: { isPending: boolean; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (opcional)" className={NF_INPUT_CLASS} style={modalInputStyle} />
      <div className="nf-modal-actions">
        <button type="button" onClick={onCancel} disabled={isPending} className="nf-app-btn-ghost">Cancelar</button>
        <button type="button" disabled={isPending} onClick={() => onConfirm(reason)} className="nf-app-btn-ghost">
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
  isPending,
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
  isPending: boolean;
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
          <Meta label="Cláusula" value={doc.clauseCode ? `${doc.clauseCode} · ${doc.clauseTitle ?? ""}` : "—"} />
          <Meta label="Proceso" value={doc.processCode ? `${doc.processCode} · ${doc.processName ?? ""}` : doc.processName ?? "—"} />
          <Meta label="Responsable" value={doc.ownerName ?? "—"} />
          <Meta label="Próxima revisión" value={doc.reviewDate ? formatDate(doc.reviewDate) : "—"} />
          <Meta label="Ubicación" value={doc.locationName ?? doc.physicalLocation ?? "—"} />
          <Meta label="Custodio" value={doc.custodianId ? personnelLookup.get(doc.custodianId) ?? "—" : "—"} />
          <Meta label="Elaboración" value={doc.responsibleElaborationId ? personnelLookup.get(doc.responsibleElaborationId) ?? "—" : "—"} />
          <Meta label="Aprobación" value={doc.responsibleApprovalId ? personnelLookup.get(doc.responsibleApprovalId) ?? "—" : "—"} />
        </div>

        {(doc.tags.length > 0 || doc.distributionList.length > 0 || doc.externalLink) && (
          <div style={{ display: "grid", gap: 8, padding: 12, borderRadius: 8, background: "var(--nf-app-surface-2)", border: "1px solid var(--nf-line)", fontSize: 13 }}>
            {doc.tags.length > 0 && <div><strong>Etiquetas:</strong> {doc.tags.join(" · ")}</div>}
            {doc.distributionList.length > 0 && <div><strong>Distribución:</strong> {doc.distributionList.join(" · ")}</div>}
            {doc.externalLink && <div><strong>Enlace externo:</strong> <a href={doc.externalLink} target="_blank" rel="noopener noreferrer">{doc.externalLink}</a></div>}
          </div>
        )}

        {doc.observations && (
          <div style={{ padding: 12, borderRadius: 8, background: "var(--nf-app-surface-2)", border: "1px solid var(--nf-line)", fontSize: 13, color: "var(--nf-ink-2)" }}>
            {doc.observations}
          </div>
        )}

        {(doc.supersedesCode || doc.supersededByCode) && (
          <div style={{ display: "grid", gap: 6, padding: 12, borderRadius: 8, background: "var(--nf-app-surface-2)", border: "1px solid var(--nf-line)", fontSize: 13 }}>
            <strong style={{ fontSize: 12, color: "var(--nf-ink-3)", textTransform: "none" }}>Trazabilidad de reemplazo</strong>
            {doc.supersedesCode && (
              <div style={{ color: "#16A34A", fontWeight: 600 }}>Reemplaza a {doc.supersedesCode}{doc.supersedesTitle ? ` — ${doc.supersedesTitle}` : ""} (archivado como histórico)</div>
            )}
            {doc.supersededByCode && (
              <div style={{ color: "#D97706", fontWeight: 600 }}>↪ Reemplazado por {doc.supersededByCode}{doc.supersededByTitle ? ` — ${doc.supersededByTitle}` : ""}. Este documento es histórico (obsoleto).</div>
            )}
          </div>
        )}

        {/* Acciones de workflow */}
        <div className="nf-action-bar" style={{ padding: 12, borderRadius: 8, background: "var(--nf-app-surface-2)", border: "1px solid var(--nf-line)" }}>
          {canShowUpload && (
            <button type="button" onClick={onUpload} className="nf-app-btn-primary">
              <Upload size={14} aria-hidden /> Subir versión
            </button>
          )}
          {canShowSubmit && (
            <button type="button" onClick={onSubmitReview} className="nf-app-btn-primary">
              <Send size={14} aria-hidden /> Enviar a revisión
            </button>
          )}
          {canShowApprove && (
            <>
              <input
                placeholder="Comentario de aprobación (opcional)"
                value={approveComment}
                onChange={(e) => setApproveComment(e.target.value)}
                className={NF_INPUT_CLASS}
                style={{ maxWidth: 280, flex: 1, minWidth: 180 }}
              />
              <button
                type="button"
                disabled={isPending}
                onClick={() => { onApprove(approveComment); setApproveComment(""); }}
                className="nf-app-btn-success"
              >
                <CheckCircle2 size={14} aria-hidden />
                {myPending ? "Aprobar mi parte" : "Aprobar"}
              </button>
              <button type="button" onClick={onReject} className="nf-app-btn-danger">
                <XCircle size={14} aria-hidden /> Rechazar
              </button>
            </>
          )}
          {canCreate && doc.status === "DRAFT" && (
            <button type="button" onClick={onEdit} className="nf-app-btn-ghost">
              <Pencil size={14} aria-hidden /> Editar metadata
            </button>
          )}
          {canShowDelete && (
            <button type="button" onClick={onDelete} className="nf-app-btn-danger">Borrar borrador</button>
          )}
          {canShowObsolete && (
            <button type="button" onClick={onObsolete} className="nf-app-btn-ghost">Marcar obsoleto</button>
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
  const [openError, setOpenError] = useState("");

  async function openFile() {
    if (!v.fileUrl) return;
    setLoading(true);
    try {
      const url = await getDocumentVersionUrl(v.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "60px 1fr auto auto", gap: 12, alignItems: "center", padding: "10px 12px", borderRadius: 8, background: "var(--nf-app-surface-1)", border: "1px solid var(--nf-line)" }}>
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 700, color: "#5266F6" }}>v{v.version}</span>
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
          <button type="button" onClick={openFile} disabled={loading} className="nf-app-btn-ghost" title="Abrir archivo">
            {loading ? <Loader2 size={14} className="nf-icon-spin" /> : <Download size={14} />}
          </button>
        )}
      </div>
      <ConfirmActionModal
        open={!!openError}
        title="No se pudo abrir el archivo"
        confirmLabel="Entendido"
        onCancel={() => setOpenError("")}
        onConfirm={() => setOpenError("")}
      >
        {openError}
      </ConfirmActionModal>
    </>
  );
}

// ─── Helpers UI ──────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <ModalField label={label}>{children}</ModalField>;
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--nf-ink-3)", textTransform: "none", letterSpacing: "-0.01em", marginBottom: 4 }}>{label}</div>
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
  const color = tone === "ok" ? "#16A34A" : tone === "warn" ? "#D97706" : muted ? "var(--nf-ink-3)" : "var(--nf-ink)";
  return (
    <div className="nf-metric-cell">
      <div className="nf-metric-cell-icon" style={{ background: `${color}14`, color }}>
        {icon}
      </div>
      <div className="nf-metric-cell-body">
        <div className="nf-metric-cell-value" style={{ fontSize: 22, color }}>{value}</div>
        <div className="nf-metric-cell-label">{label}</div>
      </div>
    </div>
  );
}

function radioChoiceClass(active: boolean) {
  return active ? "nf-chip-choice nf-chip-choice--active" : "nf-chip-choice";
}
