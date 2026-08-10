"use client";

import { format, isToday, isYesterday } from "date-fns";
import { enUS, es, ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  Eye,
  FileOutput,
  Link2,
  PenLine,
  Pencil,
  ScrollText,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { AuditEventRow } from "@/lib/domain/audit-event";
import { auditEntityTypeLabel } from "@/lib/audit-entity-labels";
import { cn, formatDate, timeAgo } from "@/lib/utils";
import { useI18n } from "@/context/I18nProvider";
import type { Locale } from "@/lib/i18n/config";

const dateFnsLocales = { es, en: enUS, "pt-BR": ptBR } satisfies Record<Locale, typeof es>;

function formatAction(action: string) {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function dayHeading(ts: string, locale: Locale, t: ReturnType<typeof useI18n>["t"]) {
  const d = new Date(ts);
  if (isToday(d)) return t("date.today");
  if (isYesterday(d)) return t("date.yesterday");
  return format(d, "EEEE, d MMM yyyy", { locale: dateFnsLocales[locale] });
}

function actionFlair(action: string): { Icon: LucideIcon; nodeClass: string } {
  const a = action.toUpperCase();
  if (a.includes("VIEW") || a.includes("OPEN")) {
    return { Icon: Eye, nodeClass: "nf-audit-slot-node--view" };
  }
  if (a.includes("APPROVED") || a.includes("CLOSED") || a.includes("COMPLETED") || a.includes("EFFECTIVENESS")) {
    return { Icon: CheckCircle2, nodeClass: "nf-audit-slot-node--done" };
  }
  if (a.includes("EXPORT")) {
    return { Icon: FileOutput, nodeClass: "nf-audit-slot-node--export" };
  }
  if (a.includes("INTEGRATION") || a.includes("CONNECTED") || a.includes("INGEST")) {
    return { Icon: Link2, nodeClass: "nf-audit-slot-node--integration" };
  }
  if (a.includes("UPDATE") || a.includes("CREATED") || a.includes("STATUS") || a.includes("ASSIGNED")) {
    return { Icon: Pencil, nodeClass: "nf-audit-slot-node--write" };
  }
  return { Icon: ShieldCheck, nodeClass: "nf-audit-slot-node--default" };
}

function buildDayGroups(events: AuditEventRow[], locale: Locale, t: ReturnType<typeof useI18n>["t"]) {
  const sorted = [...events].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const groups: { key: string; heading: string; events: AuditEventRow[] }[] = [];
  for (const ev of sorted) {
    const key = format(new Date(ev.ts), "yyyy-MM-dd");
    const last = groups[groups.length - 1];
    if (last?.key === key) last.events.push(ev);
    else groups.push({ key, heading: dayHeading(ev.ts, locale, t), events: [ev] });
  }
  return groups;
}

export default function AuditTimeline({
  events,
  max = 50,
  emptyText = "Sin eventos registrados.",
  groupByDay = false,
  showRelativeTime = false,
}: {
  events: AuditEventRow[];
  max?: number;
  emptyText?: string;
  /** Agrupa por día con cabeceras y carril vertical (ideal para Actividad global). */
  groupByDay?: boolean;
  /** Muestra “hace X min” junto a la hora absoluta. */
  showRelativeTime?: boolean;
}) {
  const { locale, t } = useI18n();
  const list = events.slice(0, max);
  const dateTimeFormat = locale === "en" ? "MM/dd/yyyy HH:mm" : "dd/MM/yyyy HH:mm";
  const resolvedEmptyText = emptyText === "Sin eventos registrados." ? t("audit.empty") : emptyText;

  if (list.length === 0) {
    return (
      <div className="nf-audit-empty">
        <div className="nf-audit-empty-icon nf-audit-empty-icon--glow" aria-hidden>
          <ScrollText size={22} strokeWidth={2.25} />
        </div>
        <p className="nf-app-help nf-audit-empty-text">{resolvedEmptyText}</p>
      </div>
    );
  }

  function renderCard(ev: AuditEventRow) {
    const { Icon, nodeClass } = actionFlair(ev.action);
    const cardInner = (
      <>
        <div className="nf-audit-meta-row">
          <span className="nf-audit-action-ico" aria-hidden>
            <Icon size={15} strokeWidth={2.4} />
          </span>
          <time dateTime={ev.ts} className="nf-audit-pill nf-audit-pill--date">
            {formatDate(ev.ts, dateTimeFormat, locale)}
            {showRelativeTime ? (
              <span className="nf-audit-pill-relative"> · {timeAgo(ev.ts, locale)}</span>
            ) : null}
          </time>
          <span className="nf-audit-pill nf-audit-pill--type">{auditEntityTypeLabel(ev.entityType)}</span>
          <span className="nf-audit-actor-name">{ev.actorName}</span>
          <span className="nf-audit-actor-email">{ev.actorEmail}</span>
        </div>

        <h4 className="nf-audit-action-title">{formatAction(ev.action)}</h4>

        <div className="nf-app-help nf-audit-body">
          {ev.entityLabel ? (
            <>
              <strong style={{ color: "var(--nf-ink)" }}>{ev.entityLabel}</strong>
              <span style={{ color: "var(--nf-ink-3)" }}> · {ev.entityId}</span>
            </>
          ) : ev.entityId ? (
            <span style={{ color: "var(--nf-ink)" }}>{ev.entityId}</span>
          ) : null}
          {ev.field && (
            <>
              <br />
              <span style={{ color: "var(--nf-ink-3)", fontWeight: 600 }}>{t("audit.field")}</span> {ev.field}
              {ev.oldValue != null && <span> · de «{ev.oldValue}»</span>}
              {ev.newValue != null && <span> a «{ev.newValue}»</span>}
            </>
          )}
          {ev.reason && (
            <>
              <br />
              <span style={{ fontStyle: "italic", color: "var(--nf-ink-3)" }}>{t("audit.reason")} {ev.reason}</span>
            </>
          )}
        </div>

        {ev.attestation && (
          <div className="nf-audit-sign">
            <span className="nf-audit-sign-icon" aria-hidden>
              <PenLine size={18} strokeWidth={2.25} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="nf-audit-sign-title">{t("audit.simulatedSignature")}</div>
              <div className="nf-audit-sign-text">{ev.attestation.statement}</div>
              <div className="nf-audit-sign-meta">{t("audit.confirmed")} {formatDate(ev.attestation.confirmedAt, dateTimeFormat, locale)}</div>
            </div>
          </div>
        )}
      </>
    );

    if (!groupByDay) {
      return (
        <article key={ev.id} className={cn("nf-audit-card", ev.attestation && "nf-audit-card--attested")}>
          {cardInner}
        </article>
      );
    }

    return (
      <div key={ev.id} className="nf-audit-slot">
        <div className="nf-audit-slot-gutter" aria-hidden>
          <span className={cn("nf-audit-slot-node", nodeClass, ev.attestation && "nf-audit-slot-node--signed")} />
        </div>
        <article className={cn("nf-audit-card nf-audit-card--in-rail", ev.attestation && "nf-audit-card--attested")}>{cardInner}</article>
      </div>
    );
  }

  if (!groupByDay) {
    return <div className="nf-audit-stack">{list.map((ev) => renderCard(ev))}</div>;
  }

  const groups = buildDayGroups(list, locale, t);

  return (
    <div className="nf-audit-timeline">
      {groups.map((g) => (
        <section key={g.key} className="nf-audit-day-group">
          <header className="nf-audit-day-head">
            <span className="nf-audit-day-head-marker" aria-hidden />
            <h4 className="nf-audit-day-title">{g.heading}</h4>
            <span className="nf-audit-day-count">{g.events.length}</span>
          </header>
          <div className="nf-audit-day-rail">{g.events.map((ev) => renderCard(ev))}</div>
        </section>
      ))}
    </div>
  );
}
