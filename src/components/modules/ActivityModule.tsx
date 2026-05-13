"use client";

import { useMemo, useState } from "react";
import { Activity, BadgeCheck, CalendarClock, Layers, ListTree, Search, Shield, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import AuditTimeline from "@/components/compliance/AuditTimeline";
import { useWorkspace } from "@/context/WorkspaceStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import { auditEntityTypeLabel } from "@/lib/audit-entity-labels";
import { timeAgo } from "@/lib/utils";
import { isWithinInterval, subDays } from "date-fns";

type Period = "ALL" | "TODAY" | "WEEK";

export default function ActivityModule() {
  const { state } = useWorkspace();
  const perm = useDemoPermission();
  const [entityType, setEntityType] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("ALL");
  const [signedOnly, setSignedOnly] = useState(false);

  const types = useMemo(() => Array.from(new Set(state.auditEvents.map((e) => e.entityType))).sort(), [state.auditEvents]);

  const uniqueActors = useMemo(() => new Set(state.auditEvents.map((e) => e.actorEmail)).size, [state.auditEvents]);

  const signedCount = useMemo(() => state.auditEvents.filter((e) => e.attestation).length, [state.auditEvents]);

  const filtered = useMemo(() => {
    const ref = new Date();
    let list = state.auditEvents;
    if (entityType !== "ALL") list = list.filter((e) => e.entityType === entityType);
    if (signedOnly) list = list.filter((e) => e.attestation);
    if (period === "TODAY") {
      const start = new Date(ref);
      start.setHours(0, 0, 0, 0);
      const end = new Date(ref);
      end.setHours(23, 59, 59, 999);
      list = list.filter((e) => isWithinInterval(new Date(e.ts), { start, end }));
    } else if (period === "WEEK") {
      const start = subDays(ref, 7);
      list = list.filter((e) => new Date(e.ts).getTime() >= start.getTime());
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((e) => {
      const hay = [
        e.actorName,
        e.actorEmail,
        e.action,
        e.entityType,
        e.entityLabel,
        e.entityId,
        e.reason,
        e.field,
        e.oldValue,
        e.newValue,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [state.auditEvents, entityType, search, period, signedOnly]);

  const sortedPreview = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()),
    [filtered],
  );

  const lastActivityLabel = sortedPreview[0] ? timeAgo(sortedPreview[0].ts) : null;

  const filtersActive = search.trim() !== "" || entityType !== "ALL" || period !== "ALL" || signedOnly;

  function clearFilters() {
    setSearch("");
    setEntityType("ALL");
    setPeriod("ALL");
    setSignedOnly(false);
  }

  if (!perm.activity.read) {
    return (
      <Card style={{ padding: 32, textAlign: "center", borderRadius: 16, border: "1px solid var(--nf-line)" }}>
        <p className="nf-app-help" style={{ margin: 0, fontWeight: 600 }}>
          No tiene permiso para ver el registro de actividad global.
        </p>
      </Card>
    );
  }

  return (
    <div className="nf-activity-page">
      <div className="nf-activity-hero">
        <SectionTitle
          title="Actividad y audit trail"
          sub="Registro cronológico defendible: quién hizo qué, cuándo y por qué. Filtra por entidad, periodo o texto; preparado para exportación legal."
        />
        <div className="nf-activity-hero-badges" aria-hidden>
          <span className="nf-activity-hero-pill">
            <Sparkles size={14} strokeWidth={2.25} />
            Trazabilidad
          </span>
          <span className="nf-activity-hero-pill nf-activity-hero-pill--green">
            <Shield size={14} strokeWidth={2.25} />
            Defendible
          </span>
        </div>
      </div>

      <div className="nf-kpi-summary">
        <div className="nf-kpi-summary-cell nf-activity-kpi-cell">
          <div className="nf-activity-kpi-icon nf-activity-kpi-icon--navy" aria-hidden>
            <ListTree size={22} strokeWidth={2.25} />
          </div>
          <div>
            <div className="nf-activity-kpi-value nf-activity-kpi-value--navy">{state.auditEvents.length}</div>
            <div className="nf-activity-kpi-label">Eventos en sesión</div>
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
            <div className="nf-activity-kpi-value nf-activity-kpi-value--ink">{types.length}</div>
            <div className="nf-activity-kpi-label">Tipos de entidad</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell nf-activity-kpi-cell">
          <div className="nf-activity-kpi-icon nf-activity-kpi-icon--slate" aria-hidden>
            <Shield size={22} strokeWidth={2.25} />
          </div>
          <div>
            <div className="nf-activity-kpi-value nf-activity-kpi-value--slate">{uniqueActors}</div>
            <div className="nf-activity-kpi-label">Actores distintos</div>
          </div>
        </div>
        <div className="nf-kpi-summary-cell nf-activity-kpi-cell">
          <div className="nf-activity-kpi-icon nf-activity-kpi-icon--violet" aria-hidden>
            <BadgeCheck size={22} strokeWidth={2.25} />
          </div>
          <div>
            <div className="nf-activity-kpi-value nf-activity-kpi-value--violet">{signedCount}</div>
            <div className="nf-activity-kpi-label">Con firma simulada</div>
          </div>
        </div>
      </div>

      <div className="nf-activity-panel" role="region" aria-label="Filtros y línea de tiempo de actividad">
        <div className="nf-activity-toolbar">
          <div className="nf-activity-toolbar-row">
            <div className="nf-activity-search-wrap">
              <Search className="nf-activity-search-icon" size={18} strokeWidth={2} aria-hidden />
              <input
                type="search"
                className="nf-app-input"
                placeholder="Buscar actor, acción, entidad, motivo…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box" }}
                aria-label="Buscar en el audit trail"
              />
            </div>
            <span className="nf-activity-counter">
              <strong>{filtered.length}</strong>
              <span style={{ fontWeight: 650, opacity: 0.75 }}>de</span>
              <span style={{ fontWeight: 750 }}>{state.auditEvents.length}</span>
            </span>
          </div>
          <div className="nf-activity-chips-row">
            <span className="nf-filter-label">Periodo</span>
            <button type="button" className={period === "ALL" ? "nf-chip nf-chip--on" : "nf-chip"} onClick={() => setPeriod("ALL")}>
              Todo
            </button>
            <button type="button" className={period === "TODAY" ? "nf-chip nf-chip--on" : "nf-chip"} onClick={() => setPeriod("TODAY")}>
              Hoy
            </button>
            <button type="button" className={period === "WEEK" ? "nf-chip nf-chip--on" : "nf-chip"} onClick={() => setPeriod("WEEK")}>
              7 días
            </button>
            <span className="nf-filter-label" style={{ marginLeft: 8 }}>
              Firma
            </span>
            <button type="button" className={signedOnly ? "nf-chip nf-chip--on" : "nf-chip"} onClick={() => setSignedOnly((v) => !v)}>
              Solo firmados
            </button>
            {filtersActive ? (
              <button type="button" className="nf-app-btn-ghost nf-activity-clear-filters" onClick={clearFilters}>
                Limpiar filtros
              </button>
            ) : null}
          </div>
          <div className="nf-activity-chips-row" style={{ marginTop: 10 }}>
            <span className="nf-filter-label" style={{ marginRight: 2 }}>
              Entidad
            </span>
            <button type="button" className={entityType === "ALL" ? "nf-chip nf-chip--on" : "nf-chip"} onClick={() => setEntityType("ALL")}>
              Todas
            </button>
            {types.map((t) => (
              <button key={t} type="button" className={entityType === t ? "nf-chip nf-chip--on" : "nf-chip"} onClick={() => setEntityType(t)}>
                {auditEntityTypeLabel(t)}
              </button>
            ))}
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
                <span className="nf-activity-live-label">Sesión local</span>
              </div>
              <span className="nf-activity-section-sub">
                Hasta 300 eventos más recientes según filtros
                {lastActivityLabel ? ` · Última actividad ${lastActivityLabel}` : ""}
              </span>
            </div>
          </div>
          <AuditTimeline
            events={filtered}
            max={300}
            emptyText="No hay eventos que coincidan con los filtros."
            groupByDay
            showRelativeTime
          />
        </div>
      </div>
    </div>
  );
}
