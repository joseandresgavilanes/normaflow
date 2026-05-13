"use client";

import { useMemo, useState, useTransition, type CSSProperties, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  Archive,
  ArchiveX,
  ClipboardList,
  Clock,
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

  const { records, recordEntries, recordTypes, retentionTimes, dispositions, archiveMethods, personnel } = admin.state;

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
  const [editing, setEditing] = useState<RecordMockRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<RecordMockRow | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<RecordMockRow | null>(null);
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

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
  }, [records, search, statusFilter, typeFilter, retentionLabel]);

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
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#123C66", fontWeight: 700 }}>{r.code}</span>
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
        const color = st === "overdue" ? "#C93C37" : st === "due_soon" ? "#D68A1A" : "var(--nf-ink-3)";
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
                  style={{ fontSize: 12, padding: "6px 12px", color: "#C93C37", borderColor: "#f0c4c2", fontWeight: 700, flexShrink: 0 }}
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
      processName: String(fd.get("processName") || ""),
      recordTypeId: String(fd.get("recordTypeId") || "") || undefined,
      retentionTimeId: String(fd.get("retentionTimeId") || "") || undefined,
      dispositionId: String(fd.get("dispositionId") || "") || undefined,
      archiveMethodId: String(fd.get("archiveMethodId") || "") || undefined,
      custodianId: String(fd.get("custodianId") || "") || undefined,
      physicalLocation: String(fd.get("physicalLocation") || ""),
      digitalLocation: String(fd.get("digitalLocation") || ""),
      observations: String(fd.get("observations") || ""),
    };
    setFormError("");
    startTransition(() => {
      try {
        if (mode === "create") {
          admin.createRecord(payload);
          setCreating(false);
        } else if (editing) {
          admin.updateRecord(editing.id, payload);
          setEditing(null);
        }
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "No se pudo guardar.");
      }
    });
  }

  return (
    <div>
      <SectionTitle
        title="Control de Registros"
        sub="Lista maestra de registros del SGC: retención, custodio, disposición y trazabilidad de entradas (ISOTech 13.2)."
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
              background: "linear-gradient(135deg, rgba(46, 139, 87, 0.2) 0%, rgba(46, 139, 87, 0.07) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1f6f45",
            }}
          >
            <Archive size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#2E8B57", letterSpacing: "-0.03em", lineHeight: 1 }}>{stats.active}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Registros activos</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(18, 60, 102, 0.12) 0%, rgba(18, 60, 102, 0.04) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#314456",
            }}
          >
            <ArchiveX size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--nf-ink-2)", letterSpacing: "-0.03em", lineHeight: 1 }}>{stats.inactive}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Inactivos</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(214, 138, 26, 0.22) 0%, rgba(214, 138, 26, 0.08) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9a6510",
            }}
          >
            <Clock size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#D68A1A", letterSpacing: "-0.03em", lineHeight: 1 }}>{stats.dueSoon}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Próximos a vencer</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(201, 60, 55, 0.2) 0%, rgba(201, 60, 55, 0.07) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#C93C37",
            }}
          >
            <AlertTriangle size={22} strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#C93C37", letterSpacing: "-0.03em", lineHeight: 1 }}>{stats.overdue}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--nf-ink-3)", marginTop: 2 }}>Disposición vencida</div>
          </div>
        </div>
      </div>

      <Card style={{ padding: 0, overflow: "hidden", borderRadius: 16, border: "1px solid var(--nf-line)", boxShadow: "0 1px 0 rgba(18, 60, 102, 0.04)" }}>
        <div
          style={{
            padding: "14px 18px 16px",
            borderBottom: "1px solid var(--nf-line)",
            background: "linear-gradient(180deg, #fafbfd 0%, #fff 100%)",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 14 }}>
            <input
              type="search"
              placeholder="Buscar por código, nombre, proceso…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="nf-app-input"
              style={{ flex: 1, minWidth: 220, boxSizing: "border-box" }}
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="nf-app-input"
              style={{ minWidth: 200, maxWidth: "100%", cursor: "pointer", boxSizing: "border-box" }}
            >
              <option value="ALL">Todos los tipos</option>
              {recordTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
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
        dispositions={dispositions}
        archiveMethods={archiveMethods}
        personnel={personnel}
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

      <RecordDetailModal record={detail} canEdit={canEdit} onClose={() => setDetail(null)} />

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
              startTransition(() => {
                if (!confirmDeactivate) return;
                admin.deactivateRecord(confirmDeactivate.id);
                setConfirmDeactivate(null);
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
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--nf-ink-3)", marginBottom: 12 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </div>
  );
}

function RecordFormModal({
  open,
  mode,
  editing,
  recordTypes,
  retentionTimes,
  dispositions,
  archiveMethods,
  personnel,
  isPending,
  formError,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  editing: RecordMockRow | null;
  recordTypes: { id: string; name: string; active: boolean }[];
  retentionTimes: { id: string; name: string; active: boolean }[];
  dispositions: { id: string; name: string; active: boolean }[];
  archiveMethods: { id: string; name: string; active: boolean }[];
  personnel: { id: string; firstName: string; lastName: string; active: boolean }[];
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
            : `Modificando ${editing?.code ?? "—"}. Los cambios quedan reflejados en esta sesión demo.`}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <FormSection title="Identificación">
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12 }}>
              <Field label="Código *">
                <input name="code" required defaultValue={editing?.code ?? ""} className="nf-app-input" style={inputFieldStyle} placeholder="REG-XXX-001" />
              </Field>
              <Field label="Nombre *">
                <input name="name" required defaultValue={editing?.name ?? ""} className="nf-app-input" style={inputFieldStyle} placeholder="Registro de…" />
              </Field>
            </div>
            <Field label="Proceso relacionado">
              <input name="processName" defaultValue={editing?.processName ?? ""} className="nf-app-input" style={inputFieldStyle} placeholder="p. ej. Producción, Calidad, RRHH" />
            </Field>
          </FormSection>

          <FormSection title="Clasificación y custodio">
            <div className="nf-grid-2" style={{ gap: 12 }}>
              <Field label="Tipo de registro">
                <select name="recordTypeId" defaultValue={editing?.recordTypeId ?? ""} className="nf-app-input" style={{ ...inputFieldStyle, cursor: "pointer" }}>
                  <option value="">— Sin tipo —</option>
                  {recordTypes.filter((t) => t.active).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Custodio">
                <select name="custodianId" defaultValue={editing?.custodianId ?? ""} className="nf-app-input" style={{ ...inputFieldStyle, cursor: "pointer" }}>
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
          </FormSection>

          <FormSection title="Retención y archivo">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: 12 }}>
              <Field label="Tiempo de retención">
                <select name="retentionTimeId" defaultValue={editing?.retentionTimeId ?? ""} className="nf-app-input" style={{ ...inputFieldStyle, cursor: "pointer" }}>
                  <option value="">—</option>
                  {retentionTimes.filter((r) => r.active).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Disposición">
                <select name="dispositionId" defaultValue={editing?.dispositionId ?? ""} className="nf-app-input" style={{ ...inputFieldStyle, cursor: "pointer" }}>
                  <option value="">—</option>
                  {dispositions.filter((d) => d.active).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Método de archivo">
                <select name="archiveMethodId" defaultValue={editing?.archiveMethodId ?? ""} className="nf-app-input" style={{ ...inputFieldStyle, cursor: "pointer" }}>
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
                <input name="physicalLocation" defaultValue={editing?.physicalLocation ?? ""} className="nf-app-input" style={inputFieldStyle} placeholder="Archivador, estante…" />
              </Field>
              <Field label="Ubicación digital">
                <input name="digitalLocation" defaultValue={editing?.digitalLocation ?? ""} className="nf-app-input" style={inputFieldStyle} placeholder="/ruta/del/registro" />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Observaciones">
            <Field label="Notas internas">
              <textarea name="observations" rows={3} defaultValue={editing?.observations ?? ""} className="nf-app-input" style={{ ...inputFieldStyle, resize: "vertical" }} />
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
              color: "#C93C37",
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

function openRecordEntryDemoFile(entry: RecordEntryMockRow) {
  const text = `NormaFlow (demo)\nReferencia: ${entry.reference}\nArchivo: ${entry.fileName ?? "—"}\n\nEn producción aquí se abriría el documento del repositorio seguro.`;
  window.open(`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

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
          background: "linear-gradient(180deg, #1a5d95 0%, #123c66 100%)",
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

function RecordDetailModal({ record, canEdit, onClose }: { record: RecordMockRow | null; canEdit: boolean; onClose: () => void }) {
  const admin = useAdminMock();
  const [addingEntry, setAddingEntry] = useState(false);
  const [entryError, setEntryError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [previewEntry, setPreviewEntry] = useState<RecordEntryMockRow | null>(null);
  const [entryFile, setEntryFile] = useState<File | null>(null);

  if (!record) return null;
  const recordId = record.id;

  const entries = admin.state.recordEntries
    .filter((e) => e.recordId === recordId)
    .sort((a, b) => b.enteredAt.localeCompare(a.enteredAt));

  const personnelName = new Map(admin.state.personnel.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
  const retention = record.retentionTimeId ? admin.state.retentionTimes.find((r) => r.id === record.retentionTimeId) : null;
  const disposition = record.dispositionId ? admin.state.dispositions.find((d) => d.id === record.dispositionId) : null;
  const archive = record.archiveMethodId ? admin.state.archiveMethods.find((a) => a.id === record.archiveMethodId) : null;
  const recordType = record.recordTypeId ? admin.state.recordTypes.find((t) => t.id === record.recordTypeId) : null;

  function handleAddEntry(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setEntryError("");
    startTransition(() => {
      try {
        admin.addRecordEntry(recordId, {
          reference: String(fd.get("reference") || ""),
          description: String(fd.get("description") || "") || undefined,
          fileName: entryFile ? entryFile.name : undefined,
          blobUrl: entryFile ? URL.createObjectURL(entryFile) : undefined,
          mimeType: entryFile ? entryFile.type || null : null,
          fileSize: entryFile ? entryFile.size : null,
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
            background: "linear-gradient(145deg, rgba(18, 60, 102, 0.05) 0%, #fff 55%)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--nf-ink-3)", marginBottom: 12 }}>
            Ficha del registro
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))", gap: 10 }}>
            <MetaCell label="Estado" value={<Badge status={record.active ? "ACTIVE" : "OBSOLETE"} label={record.active ? "Activo" : "Inactivo"} />} />
            <MetaCell label="Tipo" value={recordType?.name ?? "—"} />
            <MetaCell label="Proceso" value={record.processName ?? "—"} />
            <MetaCell label="Custodio" value={record.custodianId ? personnelName.get(record.custodianId) ?? "—" : "—"} />
            <MetaCell label="Retención" value={retention ? `${retention.name} (${retention.months} m)` : "—"} />
            <MetaCell label="Disposición" value={disposition?.name ?? "—"} />
            <MetaCell label="Método archivo" value={archive?.name ?? "—"} />
            <MetaCell label="Creado" value={formatDate(record.createdAt)} />
          </div>
        </div>

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
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--nf-ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
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
                  background: "rgba(18, 60, 102, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#123C66",
                }}
              >
                <ClipboardList size={20} strokeWidth={2.25} aria-hidden />
              </div>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--nf-ink)", letterSpacing: "-0.02em" }}>
                Entradas del registro
                <span style={{ fontWeight: 700, color: "var(--nf-ink-3)", marginLeft: 8 }}>({entries.length})</span>
              </h4>
            </div>
            {canEdit && record.active && (
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
                background: "linear-gradient(180deg, #fafbfd 0%, #fff 100%)",
                border: "1px solid var(--nf-line)",
                marginBottom: 14,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--nf-ink-3)" }}>Nueva entrada</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--nf-ink)", marginBottom: 6 }}>Referencia *</label>
                  <input name="reference" required placeholder="LOTE-…, INC-…" className="nf-app-input" style={inputFieldStyle} />
                </div>
                <FileImportArea
                  baseId={`record-entry-${recordId}`}
                  file={entryFile}
                  onFileChange={setEntryFile}
                  label="Archivo adjunto (opcional)"
                  hint="El archivo se guarda solo en esta sesión del navegador (demo), no se sube a ningún servidor."
                  compact
                  disabled={isPending}
                />
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--nf-ink)", marginBottom: 6 }}>Descripción</label>
                  <textarea name="description" rows={2} placeholder="Descripción u observaciones" className="nf-app-input" style={{ ...inputFieldStyle, resize: "vertical" }} />
                </div>
              </div>
              {entryError && (
                <div style={{ padding: "10px 12px", borderRadius: 10, background: "#fff0f0", border: "1px solid #f5c2c0", color: "#C93C37", fontSize: 13, fontWeight: 600 }}>
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
                  <code style={{ fontSize: 11, color: "#123C66", fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{e.reference}</code>
                  <div style={{ minWidth: 0 }}>
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
                    {e.enteredById ? personnelName.get(e.enteredById) ?? "—" : "—"}
                    <br />
                    <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 500 }}>{timeAgo(e.enteredAt)}</span>
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
                    {(e.blobUrl || e.fileName) && (
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
                          if (e.blobUrl) setPreviewEntry(e);
                          else if (e.fileName) openRecordEntryDemoFile(e);
                        }}
                      >
                        <Eye size={14} strokeWidth={2.25} aria-hidden />
                        {e.blobUrl ? "Ver archivo" : "Ver referencia"}
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
                          color: "#C93C37",
                          borderColor: "#f0c4c2",
                          flexShrink: 0,
                          boxSizing: "border-box",
                          fontFamily: "inherit",
                        }}
                        onClick={() => startTransition(() => admin.deleteRecordEntry(e.id))}
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
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--nf-ink)", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 12, background: "var(--nf-app-surface-1)", border: "1px solid var(--nf-line)" }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: "var(--nf-ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--nf-ink)" }}>{value}</div>
    </div>
  );
}
