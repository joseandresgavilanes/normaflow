"use client";

import { useMemo, useState, useTransition, type CSSProperties, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  Archive,
  ArchiveX,
  ClipboardList,
  Clock,
  FileDown,
  Eye,
  Loader2,
  Paperclip,
  Plus,
  X,
} from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import DataTable, { type Column } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import FileImportArea from "@/components/ui/FileImportArea";
import { useAdminMock, type RecordEntryMockRow, type RecordMockRow } from "@/context/AdminMockStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import { formatDate, timeAgo } from "@/lib/utils";
import { exportRecordsMatrix } from "@/lib/actions/records";
import { downloadQueuedReport } from "@/components/reporting/ReportArtifactDownload";
import { Field as UiField } from "@/components/ui/Field";

type Status = "ALL" | "ACTIVE" | "INACTIVE" | "DUE_SOON" | "OVERDUE";

const STATUS_CHIPS: { id: Status; label: string }[] = [
  { id: "ALL", label: "Todos" },
  { id: "ACTIVE", label: "Activos" },
  { id: "INACTIVE", label: "Inactivos" },
  { id: "DUE_SOON", label: "Próx. vencer" },
  { id: "OVERDUE", label: "Vencidos" },
];

export default function RecordsClient() {
  const admin = useAdminMock();
  const perm = useDemoPermission();
  const canEdit = perm.can("records:*");
  const canCreate = canEdit || perm.can("records:create");

  const { records, recordEntries, recordTypes, retentionTimes, dispositions, archiveMethods, personnel, processes, members } = admin.state;
  const isProcessScopedContributor = members.some((member) => member.isSelf && member.role === "CONTRIBUTOR");

  const recordTypeName = useMemo(() => new Map(recordTypes.map((r) => [r.id, r.name])), [recordTypes]);
  const retentionLabel = useMemo(() => new Map(retentionTimes.map((r) => [r.id, { name: r.name, months: r.months }])), [retentionTimes]);
  const personnelName = useMemo(() => new Map(personnel.map((p) => [p.id, `${p.firstName} ${p.lastName}`])), [personnel]);

  const entriesByRecord = useMemo(() => {
    const m = new Map<string, number>();
    recordEntries.forEach((e) => m.set(e.recordId, (m.get(e.recordId) ?? 0) + 1));
    return m;
  }, [recordEntries]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [processFilter, setProcessFilter] = useState<string>("ALL");
  const [clauseFilter, setClauseFilter] = useState<string>("ALL");
  const [editing, setEditing] = useState<RecordMockRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<RecordMockRow | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<RecordMockRow | null>(null);
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [exportBusy, setExportBusy] = useState<"PDF" | "EXCEL" | null>(null);

  function retentionStatus(r: RecordMockRow): "ok" | "due_soon" | "overdue" | "none" {
    if (!r.retentionTimeId || !r.lastEntryAt) return "none";
    const months = retentionLabel.get(r.retentionTimeId)?.months;
    if (!months) return "none";
    const last = new Date(r.lastEntryAt).getTime();
    const due = last + months * 30.44 * 86400000;
    const now = Date.now();
    if (now > due) return "overdue";
    if (due - now < 30 * 86400000) return "due_soon";
    return "ok";
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (typeFilter !== "ALL" && r.recordTypeId !== typeFilter) return false;
      if (processFilter !== "ALL" && r.processId !== processFilter) return false;
      if (clauseFilter !== "ALL" && r.clauseId !== clauseFilter) return false;
      const st = retentionStatus(r);
      switch (statusFilter) {
        case "ACTIVE":
          if (!r.active) return false;
          break;
        case "INACTIVE":
          if (r.active) return false;
          break;
        case "DUE_SOON":
          if (st !== "due_soon") return false;
          break;
        case "OVERDUE":
          if (st !== "overdue") return false;
          break;
      }
      if (!q) return true;
      return (
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.processName ?? "").toLowerCase().includes(q) ||
        (r.observations ?? "").toLowerCase().includes(q)
      );
    });
  }, [records, search, statusFilter, typeFilter, processFilter, clauseFilter, retentionLabel]);

  const stats = useMemo(() => {
    const active = records.filter((r) => r.active);
    const inactive = records.length - active.length;
    let dueSoon = 0;
    let overdue = 0;
    active.forEach((r) => {
      const st = retentionStatus(r);
      if (st === "due_soon") dueSoon += 1;
      if (st === "overdue") overdue += 1;
    });
    return { total: records.length, active: active.length, inactive, dueSoon, overdue };
  }, [records, retentionLabel]);

  const columns: Column<RecordMockRow>[] = [
    {
      key: "code",
      label: "Código",
      render: (_, r) => (
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#5266F6", fontWeight: 700 }}>{r.code}</span>
      ),
    },
    {
      key: "name",
      label: "Nombre",
      render: (_, r) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontWeight: 600, color: "var(--nf-ink)" }}>{r.name}</span>
          {r.processName && <span style={{ fontSize: 11, color: "var(--nf-ink-3)", fontWeight: 500 }}>Proceso: {r.processName}</span>}
        </div>
      ),
    },
    {
      key: "recordTypeId",
      label: "Tipo",
      render: (_, r) =>
        r.recordTypeId ? (
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-2)" }}>{recordTypeName.get(r.recordTypeId) ?? "—"}</span>
        ) : (
          <span style={{ color: "var(--nf-ink-4)" }}>—</span>
        ),
    },
    {
      key: "retentionTimeId",
      label: "Retención",
      render: (_, r) => {
        if (!r.retentionTimeId) return <span style={{ color: "var(--nf-ink-4)" }}>—</span>;
        const st = retentionStatus(r);
        const label = retentionLabel.get(r.retentionTimeId)?.name ?? "—";
        const color = st === "overdue" ? "#DC2626" : st === "due_soon" ? "#D97706" : "var(--nf-ink-3)";
        const hint =
          st === "overdue"
            ? "Disposición vencida"
            : st === "due_soon"
              ? "Vence en menos de 30 días"
              : r.lastEntryAt
                ? `Última entrada ${timeAgo(r.lastEntryAt)}`
                : null;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-2)" }}>{label}</span>
            {hint && (
              <span style={{ fontSize: 11, color, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                {(st === "overdue" || st === "due_soon") && <AlertTriangle size={12} strokeWidth={2.5} aria-hidden />}
                {hint}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "custodianId",
      label: "Custodio",
      render: (_, r) =>
        r.custodianId ? (
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--nf-ink-2)" }}>{personnelName.get(r.custodianId) ?? "—"}</span>
        ) : (
          <span style={{ color: "var(--nf-ink-4)" }}>—</span>
        ),
    },
    {
      key: "entries",
      label: "Entradas",
      render: (_, r) => (
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 700, color: "var(--nf-ink-2)" }}>
          {entriesByRecord.get(r.id) ?? 0}
        </span>
      ),
    },
    {
      key: "active",
      label: "Estado",
      render: (_, r) => <Badge status={r.active ? "ACTIVE" : "OBSOLETE"} label={r.active ? "Activo" : "Inactivo"} />,
    },
    {
      key: "actions",
      label: "",
      render: (_, r) => (
        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", alignItems: "center" }}
        >
          <button
            type="button"
            className="nf-app-btn-ghost"
            style={{ fontSize: 12, padding: "6px 12px", flexShrink: 0 }}
            onClick={() => setDetail(r)}
          >
            Detalle
          </button>
          {canEdit && (
            <>
              <button
                type="button"
                className="nf-app-btn-ghost"
                style={{ fontSize: 12, padding: "6px 12px", flexShrink: 0 }}
                onClick={() => {
                  setEditing(r);
                  setFormError("");
                }}
              >
                Editar
              </button>
              {r.active && (
                <button
                  type="button"
                  className="nf-app-btn-outline"
                  style={{ fontSize: 12, padding: "6px 12px", color: "#DC2626", borderColor: "#f0c4c2", fontWeight: 700, flexShrink: 0 }}
                  onClick={() => setConfirmDeactivate(r)}
                >
                  Desactivar
                </button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  function handleSubmit(e: FormEvent<HTMLFormElement>, mode: "create" | "edit") {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      code: String(fd.get("code") || ""),
      name: String(fd.get("name") || ""),
      processId: String(fd.get("processId") || "") || undefined,
      clauseId: String(fd.get("clauseId") || "") || undefined,
      recordTypeId: String(fd.get("recordTypeId") || "") || undefined,
      retentionTimeId: String(fd.get("retentionTimeId") || "") || undefined,
      dispositionId: String(fd.get("dispositionId") || "") || undefined,
      archiveMethodId: String(fd.get("archiveMethodId") || "") || undefined,
      custodianId: String(fd.get("custodianId") || "") || undefined,
      reviewerId: String(fd.get("reviewerId") || "") || undefined,
      physicalLocation: String(fd.get("physicalLocation") || ""),
      digitalLocation: String(fd.get("digitalLocation") || ""),
      observations: String(fd.get("observations") || ""),
    };
    setFormError("");
    startTransition(async () => {
      try {
        if (mode === "create") {
          await admin.createRecord(payload);
          setCreating(false);
        } else if (editing) {
          await admin.updateRecord(editing.id, payload);
          setEditing(null);
        }
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "No se pudo guardar.");
      }
    });
  }

  async function exportMatrix(format: "PDF" | "EXCEL") {
    setExportBusy(format);
    setFormError("");
    try {
      const result = await exportRecordsMatrix({ format, filters: { search, status: statusFilter, processId: processFilter, recordTypeId: typeFilter, clauseId: clauseFilter } });
      await downloadQueuedReport(result.id);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "No se pudo exportar la matriz.");
    } finally {
      setExportBusy(null);
    }
  }

  return (
    <div>
      <SectionTitle
        title="Control de Registros"
        sub={isProcessScopedContributor
          ? "Registros del proceso asignado: puedes consultar y cargar entradas únicamente en este ámbito."
          : "Lista maestra de registros del SGC: retención, custodio, disposición y trazabilidad de entradas (ISOTech 13.2)."}
        action={
          canCreate ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <Plus size={17} strokeWidth={2.25} aria-hidden />
              Nuevo registro
            </span>
          ) : undefined
        }
        onAction={canCreate ? () => { setCreating(true); setFormError(""); } : undefined}
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
            <Archive size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "#16A34A", letterSpacing: "-0.03em", lineHeight: 1 }}>{stats.active}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Registros activos</div>
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
            <ArchiveX size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "var(--nf-ink-2)", letterSpacing: "-0.03em", lineHeight: 1 }}>{stats.inactive}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Inactivos</div>
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
            <Clock size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "#D97706", letterSpacing: "-0.03em", lineHeight: 1 }}>{stats.dueSoon}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Próximos a vencer</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#FEF2F2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#DC2626",
            }}
          >
            <AlertTriangle size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "#DC2626", letterSpacing: "-0.03em", lineHeight: 1 }}>{stats.overdue}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Disposición vencida</div>
          </div>
        </div>
      </div>

      <Card style={{ padding: 0, overflow: "hidden", borderRadius: 16, border: "1px solid var(--nf-line)", boxShadow: "0 1px 0 rgba(82, 102, 246, 0.04)" }}>
        <div
          style={{
            padding: "14px 18px 16px",
            borderBottom: "1px solid var(--nf-line)",
            background: "#fff",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 14 }}>
            <input aria-label="Buscar por código, nombre, proceso"
              type="search"
              placeholder="Buscar por código, nombre, proceso…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="nf-app-input"
              style={{ flex: 1, minWidth: 220, boxSizing: "border-box" }}
            />
            <select aria-label="Filtrar por tipo"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="nf-app-input"
              style={{ minWidth: 200, maxWidth: "100%", cursor: "pointer", boxSizing: "border-box" }}
            >
              <option value="ALL">Todos los tipos</option>
              {recordTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code ? `${t.code} · ` : ""}{t.name}
                </option>
              ))}
            </select>
            <select aria-label="Filtrar por proceso" value={processFilter} onChange={(e) => setProcessFilter(e.target.value)} className="nf-app-input" style={{ minWidth: 180, maxWidth: "100%", cursor: "pointer", boxSizing: "border-box" }}>
              <option value="ALL">Todos los procesos</option>
              {processes.map((process) => <option key={process.id} value={process.id}>{process.code ? `${process.code} · ` : ""}{process.name}</option>)}
            </select>
            <select aria-label="Filtrar por cláusula" value={clauseFilter} onChange={(e) => setClauseFilter(e.target.value)} className="nf-app-input" style={{ minWidth: 180, maxWidth: "100%", cursor: "pointer", boxSizing: "border-box" }}>
              <option value="ALL">Todas las cláusulas ISO</option>
              {admin.state.clauses.map((clause) => <option key={clause.id} value={clause.id}>{clause.standardCode} · {clause.code}</option>)}
            </select>
            {admin.mode === "live" && perm.can("records:export") && <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}><button type="button" className="nf-app-btn-ghost" disabled={exportBusy != null} onClick={() => void exportMatrix("EXCEL")}><FileDown size={14} />{exportBusy === "EXCEL" ? "Generando…" : "Excel"}</button><button type="button" className="nf-app-btn-ghost" disabled={exportBusy != null} onClick={() => void exportMatrix("PDF")}><FileDown size={14} />{exportBusy === "PDF" ? "Generando…" : "PDF"}</button></div>}
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--nf-ink-3)", whiteSpace: "nowrap" }}>
              {filtered.length} de {records.length}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span className="nf-filter-label" style={{ marginRight: 2 }}>
              Estado
            </span>
            {STATUS_CHIPS.map(({ id, label }) => (
              <button key={id} type="button" className={statusFilter === id ? "nf-chip nf-chip--on" : "nf-chip"} onClick={() => setStatusFilter(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={filtered}
          onRow={(r) => setDetail(r)}
          emptyText="No se encontraron registros con los filtros aplicados."
        />
      </Card>

      <RecordFormModal
        open={creating || editing != null}
        mode={creating ? "create" : "edit"}
        editing={editing}
        recordTypes={recordTypes}
        retentionTimes={retentionTimes}
        clauses={admin.state.clauses}
        dispositions={dispositions}
        archiveMethods={archiveMethods}
        personnel={personnel}
        members={members}
        processes={processes}
        persistenceMode={admin.mode}
        isPending={isPending}
        formError={formError}
        onClose={() => {
          if (!isPending) {
            setCreating(false);
            setEditing(null);
          }
        }}
        onSubmit={(e) => handleSubmit(e, creating ? "create" : "edit")}
      />

      <RecordDetailModal record={detail} canEdit={canEdit} canSubmit={canCreate} canAddEntry={canCreate} onClose={() => setDetail(null)} />

      <Modal open={confirmDeactivate != null} onClose={() => !isPending && setConfirmDeactivate(null)} title="Desactivar registro" width={480}>
        <p style={{ margin: "0 0 18px", color: "var(--nf-ink)", fontSize: 14, lineHeight: 1.55 }}>
          ¿Desactivar el registro <strong>{confirmDeactivate?.code}</strong> — {confirmDeactivate?.name}? Las entradas históricas se conservan, pero el registro dejará de aparecer en nuevos formularios.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button type="button" className="nf-app-btn-outline" onClick={() => setConfirmDeactivate(null)} disabled={isPending}>
            Cancelar
          </button>
          <button
            type="button"
            className="nf-app-btn-danger"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                if (!confirmDeactivate) return;
                try {
                  await admin.deactivateRecord(confirmDeactivate.id);
                  setConfirmDeactivate(null);
                  setDetail((d) => (d?.id === confirmDeactivate.id ? null : d));
                } catch (err: unknown) {
                  setFormError(err instanceof Error ? err.message : "No se pudo desactivar.");
                }
              })
            }
          >
            {isPending ? (
              <>
                <Loader2 size={18} strokeWidth={2.25} className="nf-icon-spin" aria-hidden />
                Desactivando…
              </>
            ) : (
              "Desactivar"
            )}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Form modal ─────────────────────────────────────────────────────

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "-0.01em", textTransform: "none", color: "var(--nf-ink-3)", marginBottom: 12 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </div>
  );
}

function RecordFormModal({
  open,
  mode,
  editing,
  recordTypes,
  clauses,
  retentionTimes,
  dispositions,
  archiveMethods,
  personnel,
  members,
  processes,
  persistenceMode,
  isPending,
  formError,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  editing: RecordMockRow | null;
  recordTypes: { id: string; code?: string | null; name: string; active: boolean }[];
  clauses: { id: string; code: string; title: string; standardCode: string; standardName: string }[];
  retentionTimes: { id: string; name: string; active: boolean }[];
  dispositions: { id: string; name: string; active: boolean }[];
  archiveMethods: { id: string; name: string; active: boolean }[];
  personnel: { id: string; firstName: string; lastName: string; active: boolean }[];
  members: { userId: string; name: string; email: string; role: string; isSelf?: boolean }[];
  processes: { id: string; code: string | null; name: string }[];
  persistenceMode: "demo" | "live";
  isPending: boolean;
  formError: string;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const title = mode === "create" ? "Nuevo registro" : "Editar registro";

  return (
    <Modal open={open} onClose={onClose} title={title} width={720}>
      <form
        key={`record-form-${editing?.id ?? "new"}`}
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 0 }}
      >
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--nf-ink-3)", fontWeight: 500, lineHeight: 1.55 }}>
          {mode === "create"
            ? "Alta en el catálogo maestro. Los campos marcados con * son obligatorios."
            : persistenceMode === "live"
              ? `Modificando ${editing?.code ?? "—"}. Los cambios se guardarán en Supabase.`
              : `Modificando ${editing?.code ?? "—"}. Los cambios quedan reflejados en esta sesión local.`}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <FormSection title="Identificación">
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12 }}>
              <Field label="Código *">
                <input aria-label="REG-XXX-001" name="code" required defaultValue={editing?.code ?? ""} className="nf-app-input" style={inputFieldStyle} placeholder="REG-XXX-001" />
              </Field>
              <Field label="Nombre *">
                <input aria-label="Registro de" name="name" required defaultValue={editing?.name ?? ""} className="nf-app-input" style={inputFieldStyle} placeholder="Registro de…" />
              </Field>
            </div>
            <Field label="Proceso relacionado">
              <select aria-label="Proceso" name="processId" defaultValue={editing?.processId ?? ""} className="nf-app-input" style={{ ...inputFieldStyle, cursor: "pointer" }}>
                <option value="">— Sin proceso relacionado —</option>
                {processes.map((process) => (
                  <option key={process.id} value={process.id}>
                    {process.code ? `${process.code} — ` : ""}{process.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cláusula ISO relacionada">
              <select aria-label="Cláusula" name="clauseId" defaultValue={editing?.clauseId ?? ""} className="nf-app-input" style={{ ...inputFieldStyle, cursor: "pointer" }}>
                <option value="">— Sin cláusula relacionada —</option>
                {clauses.map((clause) => <option key={clause.id} value={clause.id}>{clause.standardCode} · {clause.code} — {clause.title}</option>)}
              </select>
            </Field>
          </FormSection>

          <FormSection title="Clasificación y custodio">
            <div className="nf-grid-2" style={{ gap: 12 }}>
              <Field label="Tipo de registro">
                <select aria-label="Tipo de registro" name="recordTypeId" defaultValue={editing?.recordTypeId ?? ""} className="nf-app-input" style={{ ...inputFieldStyle, cursor: "pointer" }}>
                  <option value="">— Sin tipo —</option>
                  {recordTypes.filter((t) => t.active).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code ? `${t.code} · ` : ""}{t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Custodio">
                <select aria-label="Custodio" name="custodianId" defaultValue={editing?.custodianId ?? ""} className="nf-app-input" style={{ ...inputFieldStyle, cursor: "pointer" }}>
                  <option value="">— Sin custodio asignado —</option>
                  {personnel
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
            <Field label="Revisor asignado">
              <select aria-label="Revisor" name="reviewerId" defaultValue={editing?.reviewerId ?? ""} className="nf-app-input" style={{ ...inputFieldStyle, cursor: "pointer" }}>
                <option value="">— Seleccionar revisor —</option>
                {members.filter((m) => m.role === "ORG_ADMIN" || m.role === "COMPLIANCE_MANAGER" || m.role === "AUDITOR").map((member) => (
                  <option key={member.userId} value={member.userId}>{member.name} · {member.role}</option>
                ))}
              </select>
            </Field>
          </FormSection>

          <FormSection title="Retención y archivo">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: 12 }}>
              <Field label="Tiempo de retención">
                <select aria-label="Tiempo de retención" name="retentionTimeId" defaultValue={editing?.retentionTimeId ?? ""} className="nf-app-input" style={{ ...inputFieldStyle, cursor: "pointer" }}>
                  <option value="">—</option>
                  {retentionTimes.filter((r) => r.active).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Disposición">
                <select aria-label="Disposición" name="dispositionId" defaultValue={editing?.dispositionId ?? ""} className="nf-app-input" style={{ ...inputFieldStyle, cursor: "pointer" }}>
                  <option value="">—</option>
                  {dispositions.filter((d) => d.active).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Método de archivo">
                <select aria-label="Método de archivo" name="archiveMethodId" defaultValue={editing?.archiveMethodId ?? ""} className="nf-app-input" style={{ ...inputFieldStyle, cursor: "pointer" }}>
                  <option value="">—</option>
                  {archiveMethods.filter((a) => a.active).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </FormSection>

          <FormSection title="Ubicaciones">
            <div className="nf-grid-2" style={{ gap: 12 }}>
              <Field label="Ubicación física">
                <input aria-label="Archivador, estante" name="physicalLocation" defaultValue={editing?.physicalLocation ?? ""} className="nf-app-input" style={inputFieldStyle} placeholder="Archivador, estante…" />
              </Field>
              <Field label="Ubicación digital">
                <input aria-label="/ruta/del/registro" name="digitalLocation" defaultValue={editing?.digitalLocation ?? ""} className="nf-app-input" style={inputFieldStyle} placeholder="/ruta/del/registro" />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Observaciones">
            <Field label="Notas internas">
              <textarea aria-label="Observaciones" name="observations" rows={3} defaultValue={editing?.observations ?? ""} className="nf-app-input" style={{ ...inputFieldStyle, resize: "vertical" }} />
            </Field>
          </FormSection>
        </div>

        {formError && (
          <div
            style={{
              marginTop: 18,
              padding: "12px 14px",
              borderRadius: 12,
              background: "#fff0f0",
              border: "1px solid #f5c2c0",
              color: "#DC2626",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {formError}
          </div>
        )}

        <div
          style={{
            marginTop: 22,
            paddingTop: 18,
            borderTop: "1px solid var(--nf-line)",
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button type="button" className="nf-app-btn-outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </button>
          <button type="submit" className="nf-app-btn-primary" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 size={18} strokeWidth={2.25} className="nf-icon-spin" aria-hidden />
                Guardando…
              </>
            ) : mode === "create" ? (
              "Crear registro"
            ) : (
              "Guardar cambios"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Detail modal (entries) ─────────────────────────────────────────

function RecordEntryAttachmentPreview({ entry }: { entry: RecordEntryMockRow }) {
  const url = entry.blobUrl ?? "";
  const name = entry.fileName ?? "adjunto";
  const mime = entry.mimeType ?? "";

  if (!url || !url.startsWith("blob:")) {
    return (
      <p style={{ margin: 0, fontSize: 14, color: "var(--nf-ink-3)" }}>No hay archivo cargado en el navegador para esta entrada.</p>
    );
  }

  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(name)) {
    return <img src={url} alt={name} style={{ maxWidth: "100%", maxHeight: 520, objectFit: "contain", borderRadius: 12, border: "1px solid var(--nf-line)" }} />;
  }

  if (mime === "application/pdf" || /\.pdf$/i.test(name)) {
    return <iframe title={name} src={url} style={{ width: "100%", height: 480, border: "1px solid var(--nf-line)", borderRadius: 12 }} />;
  }

  return (
    <div style={{ padding: 16, borderRadius: 12, background: "var(--nf-app-surface-2)", border: "1px solid var(--nf-line)" }}>
      <p style={{ margin: "0 0 10px", fontSize: 14, color: "var(--nf-ink)", fontWeight: 600 }}>Vista previa no integrada para este tipo de archivo</p>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--nf-ink-3)", lineHeight: 1.5 }}>
        Tipo MIME: {mime || "desconocido"}
        {entry.fileSize != null && ` · ${(entry.fileSize / 1024).toFixed(1)} KB`}
      </p>
      <a
        href={url}
        download={name}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "10px 18px",
          fontSize: 14,
          fontWeight: 700,
          color: "#fff",
          background: "var(--nf-app-accent)",
          border: "1px solid #0f3255",
          borderRadius: 10,
          textDecoration: "none",
          boxShadow: "0 1px 3px rgba(15, 50, 85, 0.28)",
        }}
      >
        Abrir o descargar
      </a>
    </div>
  );
}

function RecordDetailModal({ record, canEdit, canSubmit, canAddEntry, onClose }: { record: RecordMockRow | null; canEdit: boolean; canSubmit: boolean; canAddEntry: boolean; onClose: () => void }) {
  const admin = useAdminMock();
  const [addingEntry, setAddingEntry] = useState(false);
  const [entryError, setEntryError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [previewEntry, setPreviewEntry] = useState<RecordEntryMockRow | null>(null);
  const [entryFile, setEntryFile] = useState<File | null>(null);
  const [reviewComment, setReviewComment] = useState("");

  if (!record) return null;
  const recordId = record.id;

  const entries = admin.state.recordEntries
    .filter((e) => e.recordId === recordId)
    .sort((a, b) => (b.entryDate ?? b.enteredAt).localeCompare(a.entryDate ?? a.enteredAt));

  const actorName = new Map([
    ...admin.state.personnel.map((p) => [p.id, `${p.firstName} ${p.lastName}`] as const),
    ...admin.state.members.map((member) => [member.userId, member.name] as const),
  ]);
  const retention = record.retentionTimeId ? admin.state.retentionTimes.find((r) => r.id === record.retentionTimeId) : null;
  const disposition = record.dispositionId ? admin.state.dispositions.find((d) => d.id === record.dispositionId) : null;
  const archive = record.archiveMethodId ? admin.state.archiveMethods.find((a) => a.id === record.archiveMethodId) : null;
  const recordType = record.recordTypeId ? admin.state.recordTypes.find((t) => t.id === record.recordTypeId) : null;
  const clause = record.clauseId ? admin.state.clauses.find((item) => item.id === record.clauseId) : null;
  const currentUserId = admin.state.members.find((member) => member.isSelf)?.userId;
  const reviewerName = record.reviewerId ? actorName.get(record.reviewerId) ?? "—" : "Sin asignar";
  const canReview = canEdit || record.reviewerId === currentUserId;

  function review(action: "submit" | "approve" | "reject") {
    setEntryError("");
    startTransition(async () => {
      try {
        if (action === "submit") await admin.submitRecordForReview(recordId);
        if (action === "approve") await admin.approveRecord(recordId, reviewComment);
        if (action === "reject") await admin.rejectRecord(recordId, reviewComment);
        setReviewComment("");
        onClose();
      } catch (err: unknown) {
        setEntryError(err instanceof Error ? err.message : "No se pudo actualizar la revisión.");
      }
    });
  }

  function handleAddEntry(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setEntryError("");
    startTransition(async () => {
      try {
        await admin.addRecordEntry(recordId, {
          title: String(fd.get("title") || ""),
          reference: String(fd.get("reference") || ""),
          description: String(fd.get("description") || "") || undefined,
          entryDate: String(fd.get("entryDate") || "") || undefined,
          status: String(fd.get("status") || "VALID") as "DRAFT" | "VALID" | "EXPIRED" | "ARCHIVED",
          responsibleId: String(fd.get("responsibleId") || "") || undefined,
          file: entryFile ?? undefined,
        });
        setAddingEntry(false);
        setEntryFile(null);
        (e.target as HTMLFormElement).reset();
      } catch (err: unknown) {
        setEntryError(err instanceof Error ? err.message : "Error.");
      }
    });
  }

  return (
    <>
      <Modal open onClose={onClose} title={`${record.code} — ${record.name}`} width={800}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--nf-ink-3)", fontWeight: 500, lineHeight: 1.55 }}>
          Vista de ficha y entradas asociadas. Las acciones dependen de tus permisos y del estado del registro.
        </p>
        <div
          style={{
            padding: "16px 18px",
            borderRadius: 14,
            border: "1px solid var(--nf-line)",
            background: "#fff",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "-0.01em", textTransform: "none", color: "var(--nf-ink-3)", marginBottom: 12 }}>
            Ficha del registro
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))", gap: 10 }}>
            <MetaCell label="Estado" value={<Badge status={record.active ? "ACTIVE" : "OBSOLETE"} label={record.active ? "Activo" : "Inactivo"} />} />
            <MetaCell label="Tipo" value={recordType?.name ?? "—"} />
            <MetaCell label="Cláusula ISO" value={clause ? `${clause.standardCode} · ${clause.code}` : "—"} />
            <MetaCell label="Proceso" value={record.processName ?? "—"} />
            <MetaCell label="Custodio" value={record.custodianId ? actorName.get(record.custodianId) ?? "—" : "—"} />
            <MetaCell label="Revisor" value={reviewerName} />
            <MetaCell label="Revisión" value={<Badge status={record.reviewStatus ?? "DRAFT"} label={record.reviewStatus === "IN_REVIEW" ? "En revisión" : record.reviewStatus === "APPROVED" ? "Aprobado" : record.reviewStatus === "REJECTED" ? "Devuelto" : "Borrador"} />} />
            <MetaCell label="Retención" value={retention ? `${retention.name} (${retention.months} m)` : "—"} />
            <MetaCell label="Disposición" value={disposition?.name ?? "—"} />
            <MetaCell label="Método archivo" value={archive?.name ?? "—"} />
            <MetaCell label="Creado" value={formatDate(record.createdAt)} />
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", padding: "12px 14px", borderRadius: 12, background: "var(--nf-app-surface-2)", border: "1px solid var(--nf-line)" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--nf-ink)" }}>Flujo de revisión</div>
            <div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 3 }}>
              {record.reviewStatus === "IN_REVIEW" ? "El registro espera la aprobación del revisor asignado." : record.reviewComment ?? "Asigna un revisor y envía el registro para aprobación."}
            </div>
          </div>
          {canSubmit && record.reviewStatus !== "IN_REVIEW" && record.active && (
            <button type="button" className="nf-app-btn-primary" disabled={isPending} onClick={() => review("submit")}>Enviar a revisión</button>
          )}
          {canReview && record.reviewStatus === "IN_REVIEW" && (
            <>
              <input aria-label="Comentario (opcional)" value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Comentario (opcional)" className="nf-app-input" style={{ minWidth: 190, flex: 1 }} />
              <button type="button" className="nf-app-btn-success" disabled={isPending} onClick={() => review("approve")}>Aprobar</button>
              <button type="button" className="nf-app-btn-danger" disabled={isPending || !reviewComment.trim()} onClick={() => review("reject")}>Devolver</button>
            </>
          )}
        </div>
        {entryError && !addingEntry && <div style={{ padding: "10px 12px", borderRadius: 10, background: "#fff0f0", border: "1px solid #f5c2c0", color: "#DC2626", fontSize: 13, fontWeight: 600 }}>{entryError}</div>}

        {(record.physicalLocation || record.digitalLocation) && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 10 }}>
            {record.physicalLocation && <MetaCell label="Ubicación física" value={record.physicalLocation} />}
            {record.digitalLocation && (
              <MetaCell label="Ubicación digital" value={<code style={{ fontSize: 12, wordBreak: "break-all" }}>{record.digitalLocation}</code>} />
            )}
          </div>
        )}

        {record.observations && (
          <div style={{ padding: "14px 16px", borderRadius: 14, background: "var(--nf-app-surface-2)", border: "1px solid var(--nf-line)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--nf-ink-3)", textTransform: "none", letterSpacing: "-0.01em", marginBottom: 8 }}>
              Observaciones
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--nf-ink-2)", lineHeight: 1.55, fontWeight: 500 }}>{record.observations}</p>
          </div>
        )}

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 11,
                  background: "rgba(82, 102, 246, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#5266F6",
                }}
              >
                <ClipboardList size={20} strokeWidth={2.25} aria-hidden />
              </div>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--nf-ink)", letterSpacing: "-0.02em" }}>
                Entradas del registro
                <span style={{ fontWeight: 700, color: "var(--nf-ink-3)", marginLeft: 8 }}>({entries.length})</span>
              </h4>
            </div>
            {canAddEntry && record.active && (
              <button
                type="button"
                className="nf-app-btn-primary"
                onClick={() => {
                  setEntryFile(null);
                  setAddingEntry(true);
                  setEntryError("");
                }}
              >
                <Plus size={17} strokeWidth={2.25} aria-hidden />
                Nueva entrada
              </button>
            )}
          </div>

          {addingEntry && (
            <form
              onSubmit={handleAddEntry}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                padding: "16px 18px",
                borderRadius: 14,
                background: "#fff",
                border: "1px solid var(--nf-line)",
                marginBottom: 14,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "-0.01em", textTransform: "none", color: "var(--nf-ink-3)" }}>Nueva entrada</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--nf-ink)", marginBottom: 6 }}>Título *</label>
                  <input aria-label="Acta, inspección, certificado" name="title" required placeholder="Acta, inspección, certificado…" className="nf-app-input" style={inputFieldStyle} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div><label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--nf-ink)", marginBottom: 6 }}>Referencia</label><input aria-label="LOTE-…, INC-" name="reference" placeholder="LOTE-…, INC-…" className="nf-app-input" style={inputFieldStyle} /></div>
                  <div><label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--nf-ink)", marginBottom: 6 }}>Fecha del registro *</label><input aria-label="Fecha de entrada" name="entryDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="nf-app-input" style={inputFieldStyle} /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div><label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--nf-ink)", marginBottom: 6 }}>Responsable *</label><select aria-label="Responsable" name="responsibleId" required defaultValue={admin.state.members.find((member) => member.isSelf)?.userId ?? ""} className="nf-app-input" style={inputFieldStyle}>{admin.state.members.filter((member) => member.active !== false).map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select></div>
                  <div><label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--nf-ink)", marginBottom: 6 }}>Estado</label><select aria-label="Estado" name="status" defaultValue="VALID" className="nf-app-input" style={inputFieldStyle}><option value="DRAFT">Borrador</option><option value="VALID">Vigente</option><option value="EXPIRED">Vencido</option><option value="ARCHIVED">Archivado</option></select></div>
                </div>
                <FileImportArea
                  baseId={`record-entry-${recordId}`}
                  file={entryFile}
                  onFileChange={setEntryFile}
                  label="Archivo adjunto (opcional)"
                  zoneNote={admin.mode === "live" ? "Un solo archivo · máximo 50 MB" : undefined}
                  hint={admin.mode === "live" ? "El archivo se subirá al repositorio privado de la organización." : "El archivo se guarda solo en esta sesión del navegador."}
                  compact
                  disabled={isPending}
                />
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--nf-ink)", marginBottom: 6 }}>Descripción</label>
                  <textarea aria-label="Descripción u observaciones" name="description" rows={2} placeholder="Descripción u observaciones" className="nf-app-input" style={{ ...inputFieldStyle, resize: "vertical" }} />
                </div>
              </div>
              {entryError && (
                <div style={{ padding: "10px 12px", borderRadius: 10, background: "#fff0f0", border: "1px solid #f5c2c0", color: "#DC2626", fontSize: 13, fontWeight: 600 }}>
                  {entryError}
                </div>
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", paddingTop: 2 }}>
                <button type="button" className="nf-app-btn-outline" onClick={() => { setAddingEntry(false); setEntryFile(null); }} disabled={isPending}>
                  Cancelar
                </button>
                <button type="submit" className="nf-app-btn-primary" disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 size={18} strokeWidth={2.25} className="nf-icon-spin" aria-hidden />
                      Añadiendo…
                    </>
                  ) : (
                    "Añadir entrada"
                  )}
                </button>
              </div>
            </form>
          )}

          {entries.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "28px 16px",
                borderRadius: 14,
                border: "1px dashed var(--nf-line)",
                background: "var(--nf-app-surface-2)",
              }}
            >
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--nf-ink-3)" }}>Aún no hay entradas en este registro.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 340, overflow: "auto", paddingRight: 2 }}>
              {entries.map((e) => (
                <div
                  key={e.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, auto) minmax(0, 1fr) minmax(0, auto) auto",
                    gap: 12,
                    alignItems: "center",
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: "var(--nf-app-surface-1)",
                    border: "1px solid var(--nf-line)",
                  }}
                >
                  <code style={{ fontSize: 11, color: "#5266F6", fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{e.reference}</code>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><div style={{ fontSize: 13, color: "var(--nf-ink)", fontWeight: 700, lineHeight: 1.45 }}>{e.title ?? e.reference}</div><span className="nf-chip" style={{ fontSize: 10 }}>{e.status === "DRAFT" ? "Borrador" : e.status === "EXPIRED" ? "Vencido" : e.status === "ARCHIVED" ? "Archivado" : "Vigente"}</span></div>
                    {e.description && <div style={{ fontSize: 13, color: "var(--nf-ink-2)", fontWeight: 500, lineHeight: 1.45 }}>{e.description}</div>}
                    {e.fileName && (
                      <div style={{ fontSize: 11, color: "var(--nf-ink-3)", marginTop: 4, display: "flex", alignItems: "center", gap: 5, fontWeight: 600, flexWrap: "wrap" }}>
                        <Paperclip size={13} strokeWidth={2.25} aria-hidden />
                        {e.fileName}
                        {e.fileSize != null && (
                          <span style={{ fontWeight: 500, color: "var(--nf-ink-4)" }}>· {(e.fileSize / 1024).toFixed(1)} KB</span>
                        )}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--nf-ink-3)", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>
                    {e.responsibleId ? actorName.get(e.responsibleId) ?? "—" : e.enteredById ? actorName.get(e.enteredById) ?? "—" : "—"}
                    <br />
                    <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 500 }}>{formatDate(e.entryDate ?? e.enteredAt)}</span>
                  </span>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 8,
                      justifyContent: "flex-end",
                      alignItems: "center",
                      minWidth: 0,
                    }}
                  >
                    {(e.blobUrl || e.hasFile || e.fileName) && (
                      <button
                        type="button"
                        className="nf-app-btn-outline"
                        style={{
                          fontSize: 12,
                          padding: "8px 12px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          flexShrink: 0,
                          whiteSpace: "nowrap",
                          boxSizing: "border-box",
                          fontFamily: "inherit",
                        }}
                        onClick={() => {
                          if (admin.mode === "demo" && e.blobUrl) {
                            setPreviewEntry(e);
                            return;
                          }
                          startTransition(async () => {
                            try {
                              const url = await admin.getRecordEntryUrl(e.id);
                              window.open(url, "_blank", "noopener,noreferrer");
                            } catch (err: unknown) {
                              setEntryError(err instanceof Error ? err.message : "No se pudo abrir el archivo.");
                            }
                          });
                        }}
                      >
                        <Eye size={14} strokeWidth={2.25} aria-hidden />
                        {admin.mode === "live" || e.hasFile || e.blobUrl ? "Abrir archivo" : "Ver referencia"}
                      </button>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        className="nf-app-btn-outline"
                        style={{
                          padding: "8px 10px",
                          minWidth: 40,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#DC2626",
                          borderColor: "#f0c4c2",
                          flexShrink: 0,
                          boxSizing: "border-box",
                          fontFamily: "inherit",
                        }}
                        onClick={() =>
                          startTransition(async () => {
                            try {
                              await admin.deleteRecordEntry(e.id);
                            } catch (err: unknown) {
                              setEntryError(err instanceof Error ? err.message : "No se pudo eliminar la entrada.");
                            }
                          })
                        }
                        title="Eliminar entrada"
                        aria-label="Eliminar entrada"
                      >
                        <X size={18} strokeWidth={2.25} aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 8, paddingTop: 18, borderTop: "1px solid var(--nf-line)", display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="nf-app-btn-outline" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>

      <Modal
        open={previewEntry != null && !!previewEntry.blobUrl}
        onClose={() => setPreviewEntry(null)}
        title={previewEntry ? `${previewEntry.reference} — ${previewEntry.fileName ?? "Archivo"}` : ""}
        width={720}
      >
        {previewEntry?.blobUrl ? <RecordEntryAttachmentPreview entry={previewEntry} /> : null}
      </Modal>
    </>
  );
}

// ─── Small helpers ──────────────────────────────────────────────────

const inputFieldStyle: CSSProperties = { width: "100%", marginTop: 6, boxSizing: "border-box" };

function Field({ label, children }: { label: string; children: ReactNode }) {
  // Antes: <label> sin htmlFor, que no asocia con ningún control.
  return <UiField label={label}>{children}</UiField>;
}

function MetaCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 12, background: "var(--nf-app-surface-1)", border: "1px solid var(--nf-line)" }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--nf-ink-3)", textTransform: "none", letterSpacing: "-0.01em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--nf-ink)" }}>{value}</div>
    </div>
  );
}
