"use client";

import { useMemo, useState, type ReactNode } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { enUS, es, ptBR } from "date-fns/locale";
import {
  Activity,
  CalendarClock,
  Download,
  Layers,
  ListTree,
  ScrollText,
  Search,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import SectionTitle from "@/components/ui/SectionTitle";
import Modal from "@/components/ui/Modal";
import { useAdminMock, type AuditTrailEntry } from "@/context/AdminMockStore";
import { useI18n } from "@/context/I18nProvider";
import { cn, formatDate, timeAgo } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";

const dateFnsLocales = { es, en: enUS, "pt-BR": ptBR } satisfies Record<Locale, typeof es>;

const MODULE_LABEL: Record<string, string> = {
  organization: "Organización",
  member: "Usuarios",
  group: "Grupos",
  group_permission: "Permisos grupo",
  position: "Cargos",
  personnel: "Personal",
  location: "Lugares",
  retention_time: "Retención",
  disposition: "Disposición",
  archive_method: "Método archivo",
  record_type: "Tipo registro",
  record: "Registros",
  record_entry: "Entradas registro",
  document: "Documentos",
  document_version: "Versiones doc",
  audit: "Auditorías",
  audit_program: "Programa audit",
  audit_finding: "Hallazgos",
  acpm: "ACPM",
  action: "Acción",
  risk: "Riesgos",
  nonconformity: "No conformidades",
  auth: "Acceso",
};

const ACTION_LABEL: Record<string, string> = {
  create: "Creado",
  update: "Modificado",
  delete: "Eliminado",
  deactivate: "Desactivado",
  approve: "Aprobado",
  reject: "Rechazado",
  transition: "Transición de etapa",
  submit_review: "Enviado a revisión",
  obsolete: "Marcado obsoleto",
  publish: "Publicado",
  invite: "Invitación enviada",
  login: "Inicio de sesión",
  logout: "Cierre de sesión",
  add_entry: "Entrada añadida",
  close: "Cerrado",
  complete: "Completado",
};

/**
 * Tono por acción, en su variante de TEXTO.
 *
 * Se usa como `color` sobre la superficie, así que necesita 4.5:1. Con los
 * tokens de relleno daba 3.30:1 (éxito) y 3.19:1 (aviso) — 28 y 1 apariciones
 * medidas en /app/activity.
 */
const ACTION_TONE: Record<string, string> = {
  create: "var(--nf-success-text)",
  update: "var(--nf-primary-active)",
  delete: "var(--nf-danger-text)",
  deactivate: "var(--nf-danger-text)",
  approve: "var(--nf-success-text)",
  reject: "var(--nf-danger-text)",
  transition: "var(--nf-primary-active)",
  submit_review: "var(--nf-warning-text)",
  obsolete: "var(--nf-text-secondary)",
  publish: "var(--nf-success-text)",
  invite: "var(--nf-primary-active)",
  login: "var(--nf-text-secondary)",
  logout: "var(--nf-text-secondary)",
  add_entry: "var(--nf-success-text)",
  close: "var(--nf-success-text)",
  complete: "var(--nf-success-text)",
};

function actionTone(action: string): string {
  return ACTION_TONE[action] ?? "var(--nf-text-secondary)";
}

function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

function moduleLabel(mod: string): string {
  return MODULE_LABEL[mod] ?? mod;
}

function adminDayHeading(dayYmd: string, locale: Locale, t: ReturnType<typeof useI18n>["t"]) {
  const d = new Date(`${dayYmd}T12:00:00`);
  if (isToday(d)) return t("date.today");
  if (isYesterday(d)) return t("date.yesterday");
  return format(d, "EEEE, d MMM yyyy", { locale: dateFnsLocales[locale] });
}

function trailNodeClass(action: string): string {
  if (["delete", "reject", "deactivate"].includes(action)) return "nf-audit-slot-node--risk";
  if (["create", "approve", "complete", "close", "add_entry", "publish"].includes(action)) return "nf-audit-slot-node--done";
  if (["update", "transition", "submit_review"].includes(action)) return "nf-audit-slot-node--write";
  if (["login", "logout", "invite"].includes(action)) return "nf-audit-slot-node--view";
  return "nf-audit-slot-node--default";
}

export default function ActivityClient({
  liveEntries,
}: {
  /** Cuando se pasa, los datos vienen de la tabla audit_logs (modo live).
   *  Cuando es undefined, se lee el mock del AdminMockProvider (modo demo). */
  liveEntries?: AuditTrailEntry[];
} = {}) {
  const admin = useAdminMock();
  const { locale, t } = useI18n();
  const events = liveEntries ?? admin.state.auditTrail;

  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("ALL");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [actorFilter, setActorFilter] = useState<string>("ALL");
  const [range, setRange] = useState<"24h" | "7d" | "30d" | "ALL">("ALL");
  const [selected, setSelected] = useState<AuditTrailEntry | null>(null);

  const modulesPresent = useMemo(() => Array.from(new Set(events.map((e) => e.module))).sort(), [events]);
  const actionsPresent = useMemo(() => Array.from(new Set(events.map((e) => e.action))).sort(), [events]);
  const actorsPresent = useMemo(() => {
    const m = new Map<string, string>();
    events.forEach((e) => {
      if (e.actorId && e.actorName) m.set(e.actorId, e.actorName);
    });
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff =
      range === "24h"
        ? Date.now() - 86400000
        : range === "7d"
          ? Date.now() - 7 * 86400000
          : range === "30d"
            ? Date.now() - 30 * 86400000
            : 0;
    return events.filter((e) => {
      if (cutoff && new Date(e.at).getTime() < cutoff) return false;
      if (moduleFilter !== "ALL" && e.module !== moduleFilter) return false;
      if (actionFilter !== "ALL" && e.action !== actionFilter) return false;
      if (actorFilter !== "ALL" && e.actorId !== actorFilter) return false;
      if (!q) return true;
      return (
        e.summary.toLowerCase().includes(q) ||
        (e.recordLabel ?? "").toLowerCase().includes(q) ||
        (e.recordId ?? "").toLowerCase().includes(q) ||
        (e.actorName ?? "").toLowerCase().includes(q)
      );
    });
  }, [events, search, moduleFilter, actionFilter, actorFilter, range]);

  const sortedPreview = useMemo(
    () => [...filtered].sort((a, b) => b.at.localeCompare(a.at)),
    [filtered],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, AuditTrailEntry[]>();
    filtered.forEach((e) => {
      const day = e.at.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, rows]) => [day, rows.sort((a, b) => b.at.localeCompare(a.at))] as const);
  }, [filtered]);

  const filtersActive =
    search.trim() !== "" || moduleFilter !== "ALL" || actionFilter !== "ALL" || actorFilter !== "ALL" || range !== "ALL";

  function clearFilters() {
    setSearch("");
    setModuleFilter("ALL");
    setActionFilter("ALL");
    setActorFilter("ALL");
    setRange("ALL");
  }

  function exportCSV() {
    const headers = ["timestamp", "action", "module", "recordId", "recordLabel", "actor", "summary"];
    const rows = filtered.map((e) => [
      e.at,
      e.action,
      e.module,
      e.recordId ?? "",
      e.recordLabel ?? "",
      e.actorName ?? "",
      e.summary.replaceAll("\n", " "),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const lastLabel = sortedPreview[0] ? timeAgo(sortedPreview[0].at, locale) : null;

  return (
    <div className="nf-activity-page">
      <div className="nf-activity-hero">
        <SectionTitle
          title="Actividad y audit trail"
          sub="Registro cronológico defendible del espacio admin: catálogos, personal, registros y ACPM — base para auditoría legal e ISO."
        />
        <div className="nf-activity-hero-badges" aria-hidden>
          <span className="nf-activity-hero-pill">
            <Sparkles size={14} strokeWidth={2.25} />
            Exportable
          </span>
          <span className="nf-activity-hero-pill nf-activity-hero-pill--green">
            <Shield size={14} strokeWidth={2.25} />
            Trazable
          </span>
        </div>
      </div>

      <div className="nf-kpi-summary">
        <div className="nf-kpi-summary-cell nf-activity-kpi-cell">
          <div className="nf-activity-kpi-icon nf-activity-kpi-icon--navy" aria-hidden>
            <ListTree size={22} strokeWidth={2.25} />
          </div>
          <div>
            <div className="nf-activity-kpi-value nf-activity-kpi-value--navy">{events.length}</div>
            <div className="nf-activity-kpi-label">Eventos totales</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell nf-activity-kpi-cell">
          <div className="nf-activity-kpi-icon nf-activity-kpi-icon--green" aria-hidden>
            <Activity size={22} strokeWidth={2.25} />
          </div>
          <div>
            <div className="nf-activity-kpi-value nf-activity-kpi-value--green">{filtered.length}</div>
            <div className="nf-activity-kpi-label">Tras filtros</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell nf-activity-kpi-cell">
          <div className="nf-activity-kpi-icon nf-activity-kpi-icon--amber" aria-hidden>
            <Layers size={22} strokeWidth={2.25} />
          </div>
          <div>
            <div className="nf-activity-kpi-value nf-activity-kpi-value--ink">{modulesPresent.length}</div>
            <div className="nf-activity-kpi-label">Módulos distintos</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell nf-activity-kpi-cell">
          <div className="nf-activity-kpi-icon nf-activity-kpi-icon--slate" aria-hidden>
            <Users size={22} strokeWidth={2.25} />
          </div>
          <div>
            <div className="nf-activity-kpi-value nf-activity-kpi-value--slate">{actorsPresent.length}</div>
            <div className="nf-activity-kpi-label">Actores distintos</div>
          </div>
        </div>
      </div>

      <div className="nf-activity-panel" role="region" aria-label="Filtros y línea de tiempo de auditoría">
        <div className="nf-activity-toolbar">
          <div className="nf-activity-toolbar-row">
            <div className="nf-activity-search-wrap">
              <Search className="nf-activity-search-icon" size={18} strokeWidth={2} aria-hidden />
              <input
                type="search"
                className="nf-app-input"
                placeholder="Buscar por resumen, recurso, actor o ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box" }}
                aria-label="Buscar en el audit trail"
              />
            </div>
            <span className="nf-activity-counter">
              <strong>{filtered.length}</strong>
              <span style={{ fontWeight: 650, opacity: 0.75 }}>de</span>
              <span style={{ fontWeight: 750 }}>{events.length}</span>
            </span>
            <button
              type="button"
              className="nf-app-btn-primary"
              onClick={exportCSV}
              disabled={filtered.length === 0}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}
            >
              <Download size={17} strokeWidth={2.25} aria-hidden />
              Exportar CSV
            </button>
          </div>

          <div className="nf-activity-chips-row">
            <span className="nf-filter-label">Periodo</span>
            <button type="button" className={range === "ALL" ? "nf-chip nf-chip--on" : "nf-chip"} onClick={() => setRange("ALL")}>
              Histórico
            </button>
            <button type="button" className={range === "24h" ? "nf-chip nf-chip--on" : "nf-chip"} onClick={() => setRange("24h")}>
              24 h
            </button>
            <button type="button" className={range === "7d" ? "nf-chip nf-chip--on" : "nf-chip"} onClick={() => setRange("7d")}>
              7 días
            </button>
            <button type="button" className={range === "30d" ? "nf-chip nf-chip--on" : "nf-chip"} onClick={() => setRange("30d")}>
              30 días
            </button>
            {filtersActive ? (
              <button type="button" className="nf-app-btn-ghost nf-activity-clear-filters" onClick={clearFilters}>
                Limpiar filtros
              </button>
            ) : null}
          </div>

          <div className="nf-activity-chips-row" style={{ marginTop: 10 }}>
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="nf-app-input"
              style={{ minWidth: 160, fontSize: 13, cursor: "pointer" }}
              aria-label="Módulo"
            >
              <option value="ALL">Todos los módulos</option>
              {modulesPresent.map((m) => (
                <option key={m} value={m}>
                  {moduleLabel(m)}
                </option>
              ))}
            </select>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="nf-app-input"
              style={{ minWidth: 168, fontSize: 13, cursor: "pointer" }}
              aria-label="Tipo de acción"
            >
              <option value="ALL">Todas las acciones</option>
              {actionsPresent.map((a) => (
                <option key={a} value={a}>
                  {actionLabel(a)}
                </option>
              ))}
            </select>
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="nf-app-input"
              style={{ minWidth: 180, fontSize: 13, cursor: "pointer", flex: "1 1 200px" }}
              aria-label="Actor"
            >
              <option value="ALL">Todos los actores</option>
              {actorsPresent.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="nf-activity-timeline-body">
          <div className="nf-activity-section-head">
            <div className="nf-activity-section-icon nf-activity-section-icon--pulse" aria-hidden>
              <CalendarClock size={20} strokeWidth={2.25} />
            </div>
            <div className="nf-activity-section-head-text">
              <div className="nf-activity-section-title-row">
                <h3 className="nf-activity-section-title">Línea de tiempo</h3>
                <span className="nf-activity-live-dot" aria-hidden />
                <span className="nf-activity-live-label">Local</span>
              </div>
              <span className="nf-activity-section-sub">
                Eventos agrupados por día · clic para ver diff y metadatos
                {lastLabel ? ` · Última actividad ${lastLabel}` : ""}
              </span>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="nf-audit-empty">
              <div className="nf-audit-empty-icon nf-audit-empty-icon--glow" aria-hidden>
                <ScrollText size={22} strokeWidth={2.25} />
              </div>
              <p className="nf-app-help nf-audit-empty-text">No hay eventos con los filtros aplicados.</p>
            </div>
          ) : (
            <div className="nf-audit-timeline">
              {grouped.map(([day, rows]) => (
                <section key={day} className="nf-audit-day-group">
                  <header className="nf-audit-day-head">
                    <span className="nf-audit-day-head-marker" aria-hidden />
                    <h4 className="nf-audit-day-title">{adminDayHeading(day, locale, t)}</h4>
                    <span className="nf-audit-day-count">{rows.length}</span>
                  </header>
                  <div className="nf-audit-day-rail">
                    {rows.map((e) => (
                      <div key={e.id} className="nf-audit-slot">
                        <div className="nf-audit-slot-gutter" aria-hidden>
                          <span className={cn("nf-audit-slot-node", trailNodeClass(e.action))} />
                        </div>
                        <button type="button" onClick={() => setSelected(e)} className="nf-audit-card nf-audit-card--in-rail">
                          <div className="nf-audit-meta-row">
                            <ActionDot action={e.action} />
                            <time dateTime={e.at} className="nf-audit-pill nf-audit-pill--date">
                              {formatDate(e.at, "HH:mm:ss", locale)}
                              <span className="nf-audit-pill-relative"> · {timeAgo(e.at, locale)}</span>
                            </time>
                            <span className="nf-audit-pill nf-audit-pill--type">{actionLabel(e.action)}</span>
                            <span className="nf-audit-pill" style={{ fontWeight: 700, textTransform: "none", letterSpacing: "0.02em" }}>
                              {moduleLabel(e.module)}
                            </span>
                            <span className="nf-audit-actor-name">{e.actorName ?? "Sistema"}</span>
                          </div>
                          <h4 className="nf-audit-action-title" style={{ marginBottom: 6 }}>
                            {e.summary}
                          </h4>
                          {e.recordLabel ? (
                            <div className="nf-app-help nf-audit-body" style={{ marginTop: 0 }}>
                              <strong style={{ color: "var(--nf-ink, #0f1b2d)" }}>{e.recordLabel}</strong>
                              {e.recordId ? (
                                <span style={{ color: "var(--nf-ink-3, #314456)" }}> · {e.recordId}</span>
                              ) : null}
                            </div>
                          ) : null}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      <EventDetailModal event={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function EventDetailModal({ event, onClose }: { event: AuditTrailEntry | null; onClose: () => void }) {
  const { locale } = useI18n();

  if (!event) return null;
  const diff = diffPairs(event.before, event.after);

  return (
    <Modal open onClose={onClose} title="Detalle del evento" width={640}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "center" }}>
          <ActionDot action={event.action} size={36} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--nf-ink, #0f1b2d)", marginBottom: 2 }}>
              {event.summary}
            </div>
            <div style={{ fontSize: 12, color: "var(--nf-ink-3, #314456)" }}>
              {actionLabel(event.action)} · {moduleLabel(event.module)}
              {event.recordLabel && (
                <>
                  {" "}
                  · <span style={{ fontFamily: "monospace" }}>{event.recordLabel}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <Meta label="Fecha y hora" value={<span style={{ fontFamily: "monospace" }}>{formatDate(event.at, "yyyy-MM-dd HH:mm:ss", locale)}</span>} />
          <Meta label="Actor" value={event.actorName ?? <span style={{ color: "var(--nf-ink-4, #3d5166)" }}>Sistema</span>} />
          <Meta label="Cuándo" value={timeAgo(event.at, locale)} />
          <Meta label="ID de recurso" value={event.recordId ? <code style={{ fontSize: 11 }}>{event.recordId}</code> : "—"} />
        </div>

        {diff.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--nf-ink-3)", textTransform: "none", letterSpacing: "-0.01em", marginBottom: 8 }}>
              Cambios
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {diff.map((d) => (
                <div
                  key={d.field}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "120px 1fr 12px 1fr",
                    gap: 10,
                    alignItems: "center",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--nf-line)",
                    background: "var(--nf-app-surface-1)",
                  }}
                >
                  <code style={{ fontSize: 11, color: "var(--nf-ink-3)" }}>{d.field}</code>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--nf-ink-3)",
                      textDecoration: d.before !== undefined ? "line-through" : "none",
                      fontFamily: "monospace",
                    }}
                  >
                    {d.before === undefined ? (
                      <span style={{ color: "var(--nf-ink-4)", textDecoration: "none" }}>— sin valor —</span>
                    ) : (
                      formatValue(d.before)
                    )}
                  </div>
                  <span style={{ color: "var(--nf-ink-3)" }}>→</span>
                  <div style={{ fontSize: 12, color: "var(--nf-primary-active)", fontFamily: "monospace" }}>
                    {d.after === undefined ? <span style={{ color: "var(--nf-ink-4)" }}>— eliminado —</span> : formatValue(d.after)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ padding: 12, borderRadius: 8, background: "var(--nf-app-surface-2)", border: "1px solid var(--nf-line)" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--nf-ink-3)", textTransform: "none", letterSpacing: "-0.01em", marginBottom: 4 }}>
            Trazabilidad
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--nf-ink-3)", lineHeight: 1.5 }}>
            Evento registrado por NormaFlow. Cuando esté conectada la base de datos (Phase 1.2), se almacenará en la tabla <code>audit_logs</code> con IP,
            user-agent y firma del actor.
          </p>
        </div>
      </div>
    </Modal>
  );
}

function diffPairs(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): { field: string; before: unknown; after: unknown }[] {
  const fields = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const out: { field: string; before: unknown; after: unknown }[] = [];
  fields.forEach((f) => {
    const b = before?.[f];
    const a = after?.[f];
    if (JSON.stringify(b) === JSON.stringify(a)) return;
    out.push({ field: f, before: b, after: a });
  });
  return out;
}

function formatValue(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function ActionDot({ action, size = 24 }: { action: string; size?: number }) {
  const color = actionTone(action);
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: size === 24 ? 8 : 10,
        display: "grid",
        placeItems: "center",
        background: `${color}18`,
        border: `1px solid ${color}50`,
        color,
        fontSize: size === 24 ? 11 : 13,
        fontWeight: 700,
        fontFamily: "monospace",
        flexShrink: 0,
      }}
    >
      {action[0]?.toUpperCase()}
    </span>
  );
}

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--nf-ink-3)", textTransform: "none", letterSpacing: "-0.01em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: "var(--nf-ink, #0f1b2d)" }}>{value}</div>
    </div>
  );
}
