"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { Ic } from "@/components/marketing/nf/Icons";
import { useReveal, useMouseParallax } from "@/components/marketing/nf/hooks";
import { PLAN_CATALOG, type PlanKey } from "@/lib/constants";
import { HOME_FAQS } from "@/lib/seo-content";

function riskHeatCellBg(lvl: number): string {
  if (lvl >= 7) return "var(--nf-danger)";
  if (lvl >= 5) return "var(--nf-warning)";
  if (lvl >= 3) return "var(--nf-success-mid)";
  return "var(--nf-success-soft)";
}

function riskHeatMarkerStyle(lvl: number, marked: boolean): Pick<CSSProperties, "color" | "border" | "boxShadow"> {
  if (!marked) return { color: "transparent", border: "none", boxShadow: "none" };
  if (lvl >= 5) {
    return {
      color: "var(--nf-text-on-primary)",
      border: "1px solid rgba(255,255,255,0.5)",
      boxShadow: "0 0 12px rgba(255,255,255,0.15)",
    };
  }
  return {
    color: "var(--nf-success-strong)",
    border: "1px solid var(--nf-success-border)",
    boxShadow: "none",
  };
}

/* ============ Hero ============ */
function HeroChaos() {
  const items = [
    { cls: "nf-chaos a nf-chaos--xls", ic: "XLS", t: "registros_riesgos_v17_FINAL.xlsx", x: "4%", y: "8%", r: "-6deg", p: 1.4 },
    { cls: "nf-chaos b nf-chaos--mail", ic: "@", t: "Fwd: Aprobar política v3 ?", x: "10%", y: "78%", r: "5deg", p: 1.6 },
    { cls: "nf-chaos a nf-chaos--pdf", ic: "PDF", t: "Politica_seguridad_2022_v2.pdf", x: "2%", y: "42%", r: "3deg", p: 1.2 },
    { cls: "nf-chaos b nf-chaos--folder", ic: "DIR", t: "/auditoría 2024 (copia copia)", x: "82%", y: "12%", r: "-4deg", p: 1.8 },
    { cls: "nf-chaos a nf-chaos--bug", ic: "NC", t: "NC-2024-118 sin asignar · vence ayer", x: "78%", y: "82%", r: "4deg", p: 1.5 },
    { cls: "nf-chaos b nf-chaos--xls", ic: "XLS", t: "KPI_Q3_borrador.xlsx", x: "88%", y: "48%", r: "-3deg", p: 1.3 },
  ];
  return (
    <>
      {items.map((it, i) => (
        <div key={i} className={it.cls}
          data-parallax={it.p}
          style={{ left: it.x, top: it.y, ["--r" as any]: it.r } as CSSProperties}>
          <span className="ic">{it.ic}</span>
          <span>{it.t}</span>
        </div>
      ))}
    </>
  );
}

function HeroDashboard() {
  return (
    <div className="nf-dash-cluster" data-parallax="0.5">
      <svg className="nf-connectors" viewBox="0 0 620 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="grad-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--nf-primary-active)" stopOpacity="0"/>
            <stop offset="0.5" stopColor="var(--nf-primary-active)" stopOpacity="0.45"/>
            <stop offset="1" stopColor="#6B7AF8" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d="M-30 110 C 80 100, 140 180, 260 200" stroke="url(#grad-line)" strokeWidth="1.2"/>
        <path d="M650 80 C 540 90, 480 180, 360 210" stroke="url(#grad-line)" strokeWidth="1.2"/>
        <path d="M-30 480 C 80 460, 160 420, 280 410" stroke="url(#grad-line)" strokeWidth="1.2"/>
        <path d="M650 500 C 540 470, 470 410, 360 410" stroke="url(#grad-line)" strokeWidth="1.2"/>
      </svg>

      <div className="nf-dash-main">
        <div className="nf-dash-bar">
          <span className="tl" style={{ background: "#ff5f57" }}></span>
          <span className="tl" style={{ background: "#febc2e" }}></span>
          <span className="tl" style={{ background: "#28c840" }}></span>
          <span className="label">normaflow.app · Tecnoserv Industrial · Q4 2026</span>
        </div>
        <div className="nf-dash-grid">

          <div className="nf-dash-tile nf-tile-score">
            <span className="tt">Cumplimiento</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span className="vv" style={{ color: "var(--nf-success-strong)" }}>94<span style={{ fontSize: 14, color: "var(--nf-ink-3)" }}>%</span></span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              {([
                ["ISO 9001:2015", 96, "var(--nf-success)"],
                ["ISO 27001:2022", 92, "var(--nf-success-strong)"],
              ] as [string, number, string][]).map(([n, v, c]) => (
                <div key={n}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--nf-ink-2)", marginBottom: 3 }}>
                    <span>{n}</span><span style={{ fontFamily: "var(--font-mono)" }}>{v}%</span>
                  </div>
                  <div style={{ height: 4, background: "var(--nf-glass-2)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${v}%`, height: "100%", background: c, boxShadow: `0 0 8px ${c}` }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 6, fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--nf-ink-3)" }}>
              <span style={{ padding: "2px 6px", border: "1px solid var(--nf-line)", borderRadius: 4 }}>148/156 controles</span>
              <span style={{ padding: "2px 6px", border: "1px solid var(--nf-line)", borderRadius: 4 }}>0 NC mayores</span>
            </div>
          </div>

          <div className="nf-dash-tile">
            <span className="tt">Matriz Riesgo</span>
            <div className="nf-heatmap" style={{ marginTop: 2 }}>
              {Array.from({ length: 25 }).map((_, i) => {
                const r = Math.floor(i / 5), c = i % 5;
                const lvl = r + c;
                const bg = riskHeatCellBg(lvl);
                const has = [6,7,11,12,13,17,18].includes(i);
                return (
                  <span key={i} className="cell" style={{ background: bg, boxShadow: has ? "inset 0 0 0 1px rgba(255,255,255,0.35)" : "none" }} />
                );
              })}
            </div>
            <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--nf-ink-3)", letterSpacing: "0.04em" }}>
              <span style={{ color: "var(--nf-success-text)" }}>●</span> 12 bajos · <span style={{ color: "var(--nf-warning-text)" }}>●</span> 7 medios · <span style={{ color: "var(--nf-danger-text)" }}>●</span> 2 altos
            </div>
          </div>

          <div className="nf-dash-tile">
            <span className="tt">CAPA</span>
            <span className="vv" style={{ fontSize: 16 }}>18 abiertas</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10, fontFamily: "var(--font-mono)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--nf-ink-2)" }}>
                <span>Causa raíz</span><span style={{ color: "var(--nf-success-strong)" }}>14 ✓</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--nf-ink-2)" }}>
                <span>Eficacia</span><span style={{ color: "var(--nf-warning-text)" }}>4 ⧗</span>
              </div>
            </div>
          </div>

          <div className="nf-dash-tile" style={{ gridColumn: "2 / 4" }}>
            <span className="tt">Aprobación — Política Seguridad v3.2</span>
            <div className="nf-flow" style={{ marginTop: 2 }}>
              <span className="chip" style={{ background: "var(--nf-glass-2)", color: "var(--nf-ink-3)" }}>Borrador</span>
              <span className="arr">→</span>
              <span className="chip" style={{ background: "var(--nf-warning-subtle)", color: "var(--nf-warning-text)" }}>Pendiente</span>
              <span className="arr">→</span>
              <span className="chip nf-chip--ok">Aprobado</span>
              <span className="arr">→</span>
              <span className="chip" style={{ background: "var(--nf-glass-2)", color: "var(--nf-ink-3)" }}>Activo</span>
            </div>
            <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--nf-ink-3)", display: "flex", gap: 10 }}>
              <span>v3.2 · maría.torres@</span>
              <span>SHA · 9f2c…ae71</span>
              <span style={{ color: "var(--nf-success-strong)" }}>● firmado</span>
            </div>
          </div>
        </div>
      </div>

      <div className="nf-float-tile" style={{ left: "-8%", top: "8%" }} data-parallax="1.2">
        <div className="h">Audit readiness</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="40" height="40" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="16" stroke="var(--nf-glass-2)" strokeWidth="3" fill="none"/>
            <circle cx="20" cy="20" r="16" stroke="var(--nf-success)" strokeWidth="3" fill="none"
              strokeDasharray="100.5" strokeDashoffset="9" transform="rotate(-90 20 20)" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 6px rgba(22, 163, 74, 0.35))" }}/>
          </svg>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em" }}>91<span style={{ fontSize: 11, color: "var(--nf-ink-3)" }}>%</span></div>
            <div style={{ fontSize: 10, color: "var(--nf-ink-3)" }}>156 evidencias</div>
          </div>
        </div>
      </div>

      <div className="nf-float-tile" style={{ right: "-6%", top: "32%", minWidth: 180 }} data-parallax="1.4">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ width: 18, height: 18, borderRadius: 5, display: "grid", placeItems: "center", background: "linear-gradient(135deg, var(--nf-accent), var(--nf-accent-2))" }}>
            <Ic.spark style={{ color: "var(--nf-text-on-primary)" }}/>
          </span>
          <span className="h" style={{ margin: 0 }}>Asistente IA</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--nf-ink-2)", lineHeight: 1.5 }}>
          Sugiero CAPA para NC-118: revisar matriz de roles antes del 14 oct.
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
          <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", padding: "3px 7px", borderRadius: 99, background: "var(--nf-warning-subtle)", color: "var(--nf-warning-text)", border: "1px solid var(--nf-warning-border)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Requiere aprobación</span>
        </div>
      </div>

      <div className="nf-float-tile" style={{ left: "-4%", bottom: "4%", minWidth: 170 }} data-parallax="1.1">
        <div className="h">Próxima auditoría</div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>03 dic 2026</div>
        <div style={{ fontSize: 11, color: "var(--nf-ink-2)", marginTop: 3 }}>ISO 9001 · Interna · M. López</div>
        <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} style={{ width: 6, height: 14, borderRadius: 2, background: i < 11 ? "var(--nf-accent)" : "var(--nf-line)" }}/>
          ))}
        </div>
      </div>

      <div className="nf-iso-badge" style={{ right: "8%", bottom: "-2%", width: 70, height: 70 }} data-parallax="1.6">
        <div>
          <div className="top">ISO</div>
          <div className="num" style={{ color: "var(--nf-primary-active)" }}>9001</div>
          <div className="yr">2015</div>
        </div>
      </div>
      <div className="nf-iso-badge" style={{ left: "30%", top: "-6%", width: 70, height: 70 }} data-parallax="1.8">
        <div>
          <div className="top">ISO</div>
          <div className="num" style={{ color: "var(--nf-accent-2)" }}>27001</div>
          <div className="yr">2022</div>
        </div>
      </div>
    </div>
  );
}

function NfHero() {
  const stageRef = useRef<HTMLDivElement>(null);
  useMouseParallax(stageRef, 16);
  return (
    <section className="nf-hero" id="top">
      <div className="nf-container nf-hero-grid">
        <div className="nf-hero-copy" data-reveal>
          <span className="nf-eyebrow"><span className="dot"></span> Asistente IA · Anexo A 2022 actualizado</span>

          <h1 className="nf-h-display" style={{ marginTop: 22 }}>
            Del caos ISO al<br/>
            <span className="nf-grad-text">control continuo.</span>
          </h1>

          <p className="nf-lede" style={{ marginTop: 22 }}>
            NormaFlow centraliza documentos, riesgos, auditorías, evidencias, CAPA e indicadores en una plataforma diseñada para mantener <strong style={{ color: "var(--nf-ink)" }}>ISO 9001</strong> e <strong style={{ color: "var(--nf-ink)" }}>ISO 27001</strong> siempre bajo control. Sin hojas de cálculo, sin caos.
          </p>

          <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
            <a className="nf-btn nf-btn--primary" href="/demo">
              Solicitar demo gratuita <Ic.arrow className="nf-arrow"/>
            </a>
            <a className="nf-btn nf-btn--ghost" href="/features">
              Ver la aplicación
            </a>
          </div>

          <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "repeat(4, auto)", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
            {([
              ["ISO 9001", "Calidad"],
              ["ISO 27001", "Seguridad"],
              ["14 días", "Trial gratis"],
              ["Sin tarjeta", "Sin compromiso"],
            ] as [string, string][]).map(([v, l]) => (
              <div key={l}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--nf-primary-active)", letterSpacing: "-0.01em" }}>{v}</div>
                <div style={{ fontSize: 11, color: "var(--nf-ink-3)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="nf-hero-stage" ref={stageRef}>
          <HeroChaos/>
          <HeroDashboard/>
        </div>
      </div>
    </section>
  );
}

/* ============ Trust ============ */
/**
 * Aquí había cinco "logos de clientes": cuadrados de degradado CSS con nombres
 * de empresa que salían literalmente de los datos demo del producto
 * (src/lib/demo-data.ts, src/lib/demo/organizations.ts), bajo el titular
 * "Equipos de calidad y seguridad que confían en NormaFlow".
 *
 * Se han retirado. Afirmar que hay clientes que confían en el producto, con
 * nombres de empresa, sin que exista ninguno, es publicidad engañosa; y
 * sustituir los cuadrados por logotipos de verdad agravaría el problema.
 *
 * En su lugar se muestra lo único verificable en el repositorio: el catálogo
 * normativo que se instala, contado desde src/lib/standard-packs/ (13 paquetes,
 * ~557 requisitos catalogados). Cuando haya clientes con permiso por escrito
 * para aparecer, esta sección vuelve con sus logotipos reales.
 */
function NfTrust() {
  const hechos = [
    ["13", "paquetes normativos instalables"],
    ["557", "requisitos catalogados"],
    ["3", "sistemas integrables en uno (9001 · 14001 · 45001)"],
  ] as [string, string][];
  return (
    <section className="nf-trust">
      <div className="nf-container nf-trust-row" data-reveal>
        <span className="nf-trust-label">Catálogo normativo incluido</span>
        <dl className="nf-trust-facts">
          {hechos.map(([valor, etiqueta]) => (
            <div key={etiqueta} className="nf-trust-fact">
              <dt className="nf-trust-fact-value">{valor}</dt>
              <dd className="nf-trust-fact-label">{etiqueta}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ============ Problem ============ */
function NfProblem() {
  const problems = [
    { ic: <Ic.mail/>, t: "Correos perdidos", d: "Aprobaciones de documentos que nadie recuerda. Versiones desactualizadas circulando entre equipos." },
    { ic: <Ic.clock/>, t: "Auditorías estresantes", d: "Buscar evidencias durante semanas antes de cada auditoría. Preparación reactiva en lugar de continua." },
    { ic: <Ic.spread/>, t: "Hojas de cálculo inviables", d: "Registros de riesgos y planes de acción en archivos sin trazabilidad ni control de cambios real." },
    { ic: <Ic.bell/>, t: "Sin alertas ni seguimiento", d: "Acciones vencidas sin responsable. Indicadores que nadie actualiza. El cumplimiento se deteriora lentamente." },
  ];
  return (
    <section className="nf-section" id="problema">
      <div className="nf-container">
        <div data-reveal>
          <span className="nf-eyebrow"><span className="dot" style={{ background: "var(--nf-danger)", boxShadow: "0 0 12px var(--nf-danger)" }}></span> El problema</span>
          <h2 className="nf-h-section" style={{ marginTop: 22, maxWidth: "20ch" }}>
            El cumplimiento no falla<br/>de golpe. {" "}<em style={{ color: "var(--nf-ink-3)", fontStyle: "normal" }}>Se rompe en silencio.</em>
          </h2>
          <p className="nf-lede" style={{ marginTop: 22 }}>
            La mayoría de empresas certificadas gestionan sus sistemas en hojas de cálculo, correos y carpetas compartidas. El coste no se ve en una factura — se ve en cada auditoría.
          </p>
        </div>

        <div className="nf-problem-grid">
          {problems.map((p, i) => (
            <div key={p.t} className="nf-problem-card" data-reveal style={{ transitionDelay: `${i * 60}ms` }}>
              <div className="ic-wrap" style={{ color: "var(--nf-danger-text)" }}>{p.ic}</div>
              <div className="nf-h-4">{p.t}</div>
              <div style={{ marginTop: 8, color: "var(--nf-ink-3)", fontSize: 14, lineHeight: 1.6 }}>{p.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ Transform ============ */
function NfTransform() {
  const chaos = [
    "registros_riesgos.xlsx",
    "Fwd: Aprobar política",
    "/auditoría 2024 (copia)",
    "NC-118 sin asignar",
    "KPI_Q3_borrador",
    "Politica_v2_FINAL.pdf",
    "Acciones_pendientes.xls",
    "evidencias_dispersas/",
  ];
  const order = [
    { l: "Documentos", c: <Ic.doc/> },
    { l: "Riesgos",    c: <Ic.risk/> },
    { l: "Auditorías", c: <Ic.audit/> },
    { l: "CAPA",       c: <Ic.capa/> },
    { l: "Indicadores",c: <Ic.kpi/> },
    { l: "Evidencias", c: <Ic.evid/> },
    { l: "Acciones",   c: <Ic.action/> },
    { l: "AI",         c: <Ic.ai/> },
  ];
  return (
    <section className="nf-section nf-transform" id="transformacion">
      <div className="nf-container">
        <div data-reveal style={{ textAlign: "center", maxWidth: 740, margin: "0 auto" }}>
          <span className="nf-eyebrow"><span className="dot"/> La transformación</span>
          <h2 className="nf-h-section" style={{ marginTop: 22 }}>
            Una plataforma. <span className="nf-grad-text">Toda la evidencia.</span>
          </h2>
          <p className="nf-lede" style={{ marginTop: 18, marginInline: "auto" }}>
            El mismo trabajo, pero conectado: lo que hoy son archivos sueltos, hilos de correo y hojas dispersas se convierte en un único sistema vivo y trazable.
          </p>
        </div>

        <div className="nf-transform-stage" data-reveal>
          <div className="nf-transform-side" aria-hidden="true">
            <div style={{ position: "absolute", top: -8, left: 0, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", color: "var(--nf-danger-text)", textTransform: "uppercase" }}>antes · disperso</div>
            {chaos.map((t, i) => (
              <span key={i} className="nf-transform-tag chaos">{t}</span>
            ))}
          </div>

          <div style={{ display: "grid", placeItems: "center" }}>
            <div className="nf-transform-core">
              <div>
                <div className="ttl"><span className="nf-grad-text">NormaFlow</span></div>
                <div className="sub">Sistema único</div>
              </div>
              <svg style={{ position: "absolute", inset: -30, pointerEvents: "none" }} viewBox="0 0 280 280">
                <circle cx="140" cy="140" r="130" fill="none" stroke="var(--nf-glass-2)" strokeDasharray="2 4"/>
              </svg>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, alignContent: "center", position: "relative" }}>
            <div style={{ position: "absolute", top: -22, left: 0, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", color: "var(--nf-primary-active)", textTransform: "uppercase" }}>después · conectado</div>
            {order.map((o) => (
              <div key={o.l} className="nf-transform-tag" style={{ justifyContent: "flex-start", gap: 8, color: "var(--nf-ink)" }}>
                <span style={{ color: "var(--nf-primary-active)" }}>{o.c}</span>
                <span>{o.l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ Modules ============ */
function MiniViz({ kind }: { kind: string }) {
  if (kind === "gap") {
    return (
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
        {([
          ["4. Contexto", 88],
          ["5. Liderazgo", 95],
          ["6. Planificación", 72],
          ["7. Soporte", 81],
          ["8. Operación", 90],
        ] as [string, number][]).map(([n, v]) => (
          <div key={n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 90, fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--nf-ink-3)" }}>{n}</span>
            <span style={{ flex: 1, height: 5, background: "var(--nf-glass-2)", borderRadius: 2, overflow: "hidden" }}>
              <span style={{ display: "block", width: `${v}%`, height: "100%", background: "linear-gradient(90deg, var(--nf-success), var(--nf-success-strong))" }}/>
            </span>
            <span style={{ width: 28, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--nf-ink-2)" }}>{v}</span>
          </div>
        ))}
      </div>
    );
  }
  if (kind === "doc") {
    return (
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 4, fontFamily: "var(--font-mono)", fontSize: 10 }}>
        {([
          ["v3.2", "Aprobado", "var(--nf-success-strong)"],
          ["v3.1", "Archivado", "var(--nf-ink-3)"],
          ["v3.0", "Archivado", "var(--nf-ink-3)"],
          ["v2.8", "Archivado", "var(--nf-ink-3)"],
        ] as [string, string, string][]).map(([v, s, c], i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", borderRadius: 4, background: i === 0 ? "var(--nf-success-bg)" : "var(--nf-surface-muted)", border: "1px solid var(--nf-line)" }}>
            <span style={{ color: "var(--nf-ink-2)" }}>{v}</span>
            <span style={{ color: c }}>● {s}</span>
          </div>
        ))}
      </div>
    );
  }
  if (kind === "risk") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 3, width: 100, height: 100 }}>
        {Array.from({ length: 25 }).map((_, i) => {
          const r = Math.floor(i / 5), c = i % 5;
          const lvl = r + c;
          return <span key={i} style={{ background: riskHeatCellBg(lvl), borderRadius: 2 }}/>;
        })}
      </div>
    );
  }
  if (kind === "audit") {
    return (
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 5, fontFamily: "var(--font-mono)", fontSize: 10 }}>
        {([
          ["□", "4.1 Comprensión del contexto", "ok"],
          ["☑", "5.2 Política de calidad", "ok"],
          ["☑", "7.5 Información documentada", "ok"],
          ["⚠", "9.2 Auditoría interna", "warn"],
          ["☑", "10.2 NC y CAPA", "ok"],
        ] as [string, string, string][]).map(([k, t, st], i) => (
          <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", color: st === "warn" ? "var(--nf-warning-text)" : "var(--nf-ink-2)" }}>
            <span style={{ color: st === "warn" ? "var(--nf-warning-text)" : "var(--nf-success-strong)", width: 12 }}>{k}</span>
            <span style={{ fontSize: 10 }}>{t}</span>
          </div>
        ))}
      </div>
    );
  }
  if (kind === "capa") {
    return (
      <div style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: 10, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ color: "var(--nf-ink-3)", marginBottom: 2, letterSpacing: "0.06em" }}>5 PORQUÉS · NC-118</div>
        {["1. ¿Por qué falló el control?", "2. ¿Por qué se omitió el paso?", "3. ¿Por qué no se detectó?", "4. ¿Por qué no había alerta?"].map((q, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ color: "var(--nf-primary-active)", width: 12, flexShrink: 0 }}>↳</span>
            <span style={{ color: "var(--nf-ink-2)" }}>{q}</span>
          </div>
        ))}
      </div>
    );
  }
  if (kind === "kpi") {
    return (
      <svg viewBox="0 0 200 80" style={{ width: "100%", height: "100%" }}>
        <defs>
          <linearGradient id="kpi-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--nf-accent)" stopOpacity="0.4"/>
            <stop offset="1" stopColor="var(--nf-accent)" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d="M0 60 L25 50 L50 55 L75 40 L100 42 L125 30 L150 35 L175 18 L200 22 L200 80 L0 80 Z" fill="url(#kpi-grad)"/>
        <path d="M0 60 L25 50 L50 55 L75 40 L100 42 L125 30 L150 35 L175 18 L200 22" fill="none" stroke="var(--nf-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 4px var(--nf-accent))" }}/>
        <line x1="0" y1="34" x2="200" y2="34" stroke="var(--nf-warning)" strokeWidth="0.6" strokeDasharray="2 3"/>
        <text x="6" y="32" fill="var(--nf-warning-text)" fontSize="7" fontFamily="JetBrains Mono">objetivo</text>
      </svg>
    );
  }
  if (kind === "action") {
    return (
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 5, fontFamily: "var(--font-mono)", fontSize: 10 }}>
        {([
          ["Plan revisión Q4", "M.T", "03 dic", "ok"],
          ["Implantar 8.1.4", "A.R", "vencido", "danger"],
          ["Revisar 5×5", "L.C", "12 nov", "warn"],
        ] as [string, string, string, string][]).map(([t, w, d, st], i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 6, alignItems: "center", padding: "4px 6px", borderRadius: 4, background: "var(--nf-surface-muted)", border: "1px solid var(--nf-line)" }}>
            <span style={{ color: "var(--nf-ink-2)" }}>{t}</span>
            <span style={{ color: "var(--nf-ink-3)" }}>{w}</span>
            <span style={{ color: st === "danger" ? "var(--nf-danger-text)" : st === "warn" ? "var(--nf-warning-text)" : "var(--nf-accent)" }}>{d}</span>
          </div>
        ))}
      </div>
    );
  }
  if (kind === "evidence") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, width: "100%" }}>
        {["PDF", "PNG", "XLS", "PDF", "DOC", "PNG", "PDF", "MP4"].map((t, i) => (
          <div key={i} style={{ aspectRatio: "1", borderRadius: 6, background: "var(--nf-glass-2)", border: "1px solid var(--nf-line)", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--nf-ink-3)" }}>{t}</div>
        ))}
      </div>
    );
  }
  if (kind === "ai") {
    return (
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6, fontSize: 10, fontFamily: "var(--font-mono)" }}>
        <div style={{ padding: 6, background: "var(--nf-glass-2)", border: "1px solid var(--nf-line)", borderRadius: 6, color: "var(--nf-ink-2)" }}>
          <div style={{ color: "var(--nf-ink-3)", marginBottom: 2 }}>▸ borrador · política de acceso</div>
          <div>El acceso lógico se concederá según el principio de mínimo privilegio…</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--nf-warning-text)", padding: "2px 6px", borderRadius: 99, border: "1px solid var(--nf-warning-border)", background: "var(--nf-warning-subtle)" }}>● Requiere aprobación</span>
          <span style={{ color: "var(--nf-ink-3)" }}>+3 sugerencias</span>
        </div>
      </div>
    );
  }
  return null;
}

function NfModules() {
  const modules = [
    { n: "01", t: "GAP Assessment",       d: "Evalúa tu nivel de cumplimiento por cláusula. Scoring global, plan de acción y exportación a PDF.", viz: "gap" },
    { n: "02", t: "Control de Documentos",d: "Versionado automático, flujo de aprobación y trazabilidad completa con cláusulas ISO.", viz: "doc" },
    { n: "03", t: "Gestión de Riesgos",   d: "Heatmap 5×5 interactivo, tratamiento (mitigar, aceptar, transferir, evitar) y controles vinculados.", viz: "risk" },
    { n: "04", t: "Auditorías",           d: "Plan anual, checklists editables, hallazgos NC y informe final con firma digital.", viz: "audit" },
    { n: "05", t: "No Conformidades & CAPA", d: "Causa raíz con 5 porqués e Ishikawa, acción correctiva, validación de eficacia y cierre con evidencia.", viz: "capa" },
    { n: "06", t: "Indicadores KPI",      d: "Metas, umbrales, semáforo y alertas cuando un indicador se sale de objetivo.", viz: "kpi" },
    { n: "07", t: "Plan de Acción",       d: "Seguimiento centralizado: responsables, vencimientos y notificaciones automáticas.", viz: "action" },
    { n: "08", t: "Evidencias",           d: "Repositorio único de pruebas vinculadas a auditoría, riesgo, documento o NC.", viz: "evidence" },
    { n: "09", t: "Asistente IA",         d: "Borradores, resúmenes y sugerencias. Toda salida requiere confirmación humana.", viz: "ai" },
  ];

  const onMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const card = e.currentTarget;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  }, []);

  const vizIcon: Record<string, React.ReactNode> = {
    gap: <Ic.kpi/>, doc: <Ic.doc/>, risk: <Ic.risk/>, audit: <Ic.audit/>,
    capa: <Ic.capa/>, kpi: <Ic.kpi/>, action: <Ic.action/>, evidence: <Ic.evid/>, ai: <Ic.ai/>,
  };

  return (
    <section className="nf-section" id="modulos">
      <div className="nf-container">
        <div data-reveal style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 32, alignItems: "end" }}>
          <div>
            <span className="nf-eyebrow"><span className="dot"/> Módulos</span>
            <h2 className="nf-h-section" style={{ marginTop: 22, maxWidth: "24ch" }}>
              Nueve módulos. Un mismo sistema, <span className="nf-grad-text-cool">cada paso conectado.</span>
            </h2>
          </div>
          <p className="nf-lede" style={{ maxWidth: 360 }}>
            Cada módulo escribe en la misma capa de evidencia, así nada se duplica y todo se puede auditar.
          </p>
        </div>

        <div className="nf-modules-grid">
          {modules.map((m, i) => (
            <article key={m.t} className="nf-module-card" data-reveal style={{ transitionDelay: `${(i % 3) * 60}ms` }} onMouseMove={onMove}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span className="nf-module-num">MÓDULO {m.n}</span>
                <span style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: "var(--nf-glass-2)", border: "1px solid var(--nf-line)", color: "var(--nf-primary-active)" }}>
                  {vizIcon[m.viz]}
                </span>
              </div>
              <div className="nf-module-title nf-h-4">{m.t}</div>
              <div className="nf-module-desc">{m.d}</div>
              <div className="nf-module-viz"><MiniViz kind={m.viz}/></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ Walkthrough ============ */
function ScreenDoc() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 18 }}>
      <div>
        <div style={{ fontSize: 12, color: "var(--nf-ink-3)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 8 }}>DOC · SGSI-POL-001</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>Política de Seguridad de la Información</div>
        <div style={{ fontSize: 12, color: "var(--nf-ink-3)" }}>Vinculado a ISO 27001 · A.5.1 · Proceso “Gobierno”</div>

        <div style={{ marginTop: 18, padding: 14, border: "1px solid var(--nf-line)", borderRadius: 10, background: "var(--nf-surface-muted)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--nf-ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Flujo de aprobación</div>
          <div className="nf-flow">
            <span className="chip" style={{ background: "var(--nf-glass-2)", color: "var(--nf-ink-3)" }}>Borrador</span>
            <span className="arr">→</span>
            <span className="chip" style={{ background: "var(--nf-glass-2)", color: "var(--nf-ink-3)" }}>Revisión Calidad</span>
            <span className="arr">→</span>
            <span className="chip nf-chip--ok">Aprobado · M. Torres</span>
            <span className="arr">→</span>
            <span className="chip" style={{ background: "var(--nf-glass-2)", color: "var(--nf-ink-3)" }}>Activo</span>
          </div>
          <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--nf-ink-3)" }}>
            firmado 2026-10-12 · SHA 9f2c…ae71 · próxima revisión 12-04-2027
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--nf-ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Historial</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {([
            ["v3.2", "2026-10-12", "M. Torres", "Aprobado", "var(--nf-success-strong)"],
            ["v3.1", "2026-04-08", "M. Torres", "Archivado", "var(--nf-ink-3)"],
            ["v3.0", "2025-10-02", "A. Ríos",   "Archivado", "var(--nf-ink-3)"],
            ["v2.8", "2025-04-19", "M. Torres", "Archivado", "var(--nf-ink-3)"],
            ["v2.7", "2024-11-04", "A. Ríos",   "Archivado", "var(--nf-ink-3)"],
            ["v2.6", "2024-06-10", "L. Castro", "Archivado", "var(--nf-ink-3)"],
          ] as [string, string, string, string, string][]).map(([v, d, p, s, c], i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", padding: "8px 10px", borderRadius: 8, background: i === 0 ? "var(--nf-success-bg)" : "var(--nf-surface-muted)", border: "1px solid var(--nf-line)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--nf-ink)" }}>{v}</span>
              <span style={{ fontSize: 11, color: "var(--nf-ink-3)" }}>{d} · {p}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: c }}>● {s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScreenAudit() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 18 }}>
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--nf-ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Plan 2026</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 4 }}>
          {Array.from({ length: 12 }).map((_, i) => {
            const m = ["E","F","M","A","M","J","J","A","S","O","N","D"][i];
            const isAudit = [2, 5, 9].includes(i);
            const isPlan = [1, 4, 8, 11].includes(i);
            return (
              <div key={i} style={{ aspectRatio: "1/1.4", borderRadius: 6, border: "1px solid var(--nf-line)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: isAudit ? "var(--nf-accent)" : isPlan ? "var(--nf-glass-2)" : "transparent" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: isAudit ? "#fff" : "var(--nf-ink-2)" }}>{m}</span>
                {isAudit && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--nf-surface)", boxShadow: "0 0 4px rgba(255,255,255,0.5)" }}/>}
                {isPlan && <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--nf-warning-text)" }}/>}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--nf-ink-3)", display: "flex", gap: 12 }}>
          <span><span style={{ color: "var(--nf-primary-active)" }}>●</span> Auditoría</span>
          <span><span style={{ color: "var(--nf-warning-text)" }}>●</span> Planificación</span>
        </div>

        <div style={{ marginTop: 18, padding: 14, borderRadius: 10, border: "1px solid var(--nf-line)", background: "var(--nf-surface-muted)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700 }}>Auditoría interna · 03 dic</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 8px", borderRadius: 99, background: "var(--nf-accent-soft)", color: "var(--nf-primary-active)", border: "1px solid rgba(82, 102, 246, 0.25)" }}>Programada</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--nf-ink-2)" }}>ISO 9001:2015 · alcance: Producción + Calidad · 12 procesos</div>
        </div>
      </div>

      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--nf-ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Hallazgos · YTD</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
          {([["NC mayores", 0, "var(--nf-success-strong)"], ["NC menores", 4, "var(--nf-warning-text)"], ["Observaciones", 11, "var(--nf-ink-2)"]] as [string, number, string][]).map(([l, v, c]) => (
            <div key={l} style={{ padding: 12, borderRadius: 8, border: "1px solid var(--nf-line)", background: "var(--nf-surface-muted)" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, color: c, letterSpacing: "-0.02em" }}>{v}</div>
              <div style={{ fontSize: 10, color: "var(--nf-ink-3)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 5, fontFamily: "var(--font-mono)", fontSize: 11 }}>
          {([
            ["8.5.1", "Control de la producción", "ok"],
            ["7.5.3", "Información documentada", "ok"],
            ["9.1.3", "Análisis y evaluación", "warn"],
            ["10.2",  "NC y acción correctiva", "ok"],
            ["6.1.2", "Riesgos y oportunidades", "warn"],
          ] as [string, string, string][]).map(([c, t, st], i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", padding: "7px 10px", borderRadius: 6, background: "var(--nf-surface-muted)", border: "1px solid var(--nf-line)" }}>
              <span style={{ color: "var(--nf-accent-2)" }}>{c}</span>
              <span style={{ color: "var(--nf-ink-2)" }}>{t}</span>
              <span style={{ color: st === "warn" ? "var(--nf-warning-text)" : "var(--nf-success-strong)" }}>● {st === "warn" ? "menor" : "ok"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScreenRisk() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--nf-ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>Heatmap 5×5 · Probabilidad × Impacto</div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 6 }}>
          <div style={{ display: "flex", flexDirection: "column-reverse", justifyContent: "space-around", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--nf-ink-3)" }}>
            {["1","2","3","4","5"].map((n) => <span key={n}>{n}</span>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
            {Array.from({ length: 25 }).map((_, i) => {
              const r = 4 - Math.floor(i / 5), c = i % 5;
              const lvl = r + c;
              const bg = riskHeatCellBg(lvl);
              const has = [{r:4,c:4},{r:3,c:3},{r:3,c:4},{r:2,c:3},{r:1,c:1},{r:1,c:2},{r:0,c:1}].find((p) => p.r === r && p.c === c);
              const marker = riskHeatMarkerStyle(lvl, Boolean(has));
              return (
                <div key={i} style={{ aspectRatio: "1", borderRadius: 5, background: bg, display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, ...marker }}>
                  {has ? "•" : ""}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ marginTop: 8, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--nf-ink-3)" }}>Probabilidad →</div>
      </div>

      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--nf-ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Riesgos críticos</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {([
            ["R-021", "Acceso no autorizado a producción", "Mitigar", 16, "var(--nf-danger)"],
            ["R-014", "Pérdida de evidencia digital",     "Mitigar", 12, "var(--nf-warning)"],
            ["R-008", "Proveedor crítico sin SLA",        "Transferir", 9, "var(--nf-warning)"],
            ["R-033", "Cambios en marco regulatorio",      "Aceptar",  6, "var(--nf-success-strong)"],
          ] as [string, string, string, number, string][]).map(([id, t, tr, sc, c], i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 8, padding: "8px 10px", borderRadius: 8, background: "var(--nf-surface-muted)", border: "1px solid var(--nf-line)", alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--nf-ink-3)" }}>{id}</span>
              <span style={{ fontSize: 12, color: "var(--nf-ink-2)" }}>{t}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "var(--nf-glass-2)", color: "var(--nf-ink-3)" }}>{tr}</span>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14, color: c }}>{sc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScreenCapa() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--nf-ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>NC-2026-118 · Causa raíz · 5 porqués</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            "El control 8.1.4 no se ejecutó en el lote L-2891.",
            "El operador no recibió la alerta del SGC.",
            "La regla de notificación seguía apuntando a un usuario inactivo.",
            "El offboarding no actualizó la matriz de roles.",
            "El procedimiento no incluía revisión cruzada de alertas.",
          ].map((t, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, padding: 10, borderRadius: 8, background: i === 4 ? "var(--nf-success-bg)" : "var(--nf-surface-muted)", border: i === 4 ? "1px solid var(--nf-success-border)" : "1px solid var(--nf-line)" }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: i === 4 ? "var(--nf-success)" : "var(--nf-glass-2)", color: i === 4 ? "#fff" : "var(--nf-ink-2)", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
              <span style={{ fontSize: 13, color: "var(--nf-ink)", lineHeight: 1.45 }}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--nf-ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Acciones</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {([
            ["CORR", "Reasignar regla de notificación", "L. Castro · 14 oct", "var(--nf-accent)"],
            ["CORR", "Revisión cruzada en cierre de turno", "A. Ríos · 22 oct", "var(--nf-accent-2)"],
            ["PREV", "Procedimiento de offboarding actualizado", "M. Torres · 02 nov", "var(--nf-warning)"],
            ["PREV", "Validación de eficacia 30 días", "L. Castro · 02 dic", "var(--nf-warning)"],
          ] as [string, string, string, string][]).map(([k, t, w, c], i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, padding: "10px 12px", borderRadius: 8, background: "var(--nf-surface-muted)", border: "1px solid var(--nf-line)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 7px", borderRadius: 4, background: "var(--nf-glass-2)", color: c, height: 22 }}>{k}</span>
              <div>
                <div style={{ fontSize: 13, color: "var(--nf-ink)" }}>{t}</div>
                <div style={{ fontSize: 11, color: "var(--nf-ink-3)", fontFamily: "var(--font-mono)" }}>{w}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, padding: 10, borderRadius: 8, border: "1px dashed var(--nf-success-border)", background: "var(--nf-success-bg)", fontSize: 12, color: "var(--nf-ink-2)" }}>
          <span style={{ color: "var(--nf-success-strong)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.06em" }}>EFICACIA · 02 DIC 2026</span><br/>
          Cierre automático cuando se valide la ausencia de reincidencia.
        </div>
      </div>
    </div>
  );
}

function ScreenEvid() {
  const files = [
    { t: "Acta_revision_direccion_q3.pdf", k: "PDF", l: "Audit · 09.3" },
    { t: "captura_consola_acceso.png",     k: "PNG", l: "Riesgo · R-021" },
    { t: "registro_formacion_2026.xlsx",   k: "XLS", l: "Doc · 7.2" },
    { t: "informe_pentest_externo.pdf",    k: "PDF", l: "27001 · A.8.29" },
    { t: "video_test_continuidad.mp4",     k: "VID", l: "27001 · A.5.30" },
    { t: "firma_politica_v32.png",         k: "PNG", l: "Doc · SGSI-POL-001" },
    { t: "checklist_revision_interna.pdf", k: "PDF", l: "Audit · INT-Q4" },
    { t: "matriz_riesgos_export.xlsx",     k: "XLS", l: "Riesgo · global" },
  ];
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--nf-ink-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Repositorio · 4 124 evidencias</div>
        <div style={{ display: "flex", gap: 6 }}>
          {["Todas", "Audit", "Riesgo", "Doc", "CAPA"].map((t, i) => (
            <span key={t} style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 9px", borderRadius: 99, border: "1px solid var(--nf-line)", background: i === 0 ? "var(--nf-glass-2)" : "transparent", color: i === 0 ? "var(--nf-ink)" : "var(--nf-ink-3)" }}>{t}</span>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {files.map((f, i) => (
          <div key={i} style={{ padding: 12, borderRadius: 10, background: "var(--nf-surface-muted)", border: "1px solid var(--nf-line)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ aspectRatio: "1.4", borderRadius: 6, background: "linear-gradient(180deg, var(--nf-glass-2), transparent)", border: "1px solid var(--nf-line)", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, color: f.k === "VID" ? "oklch(0.78 0.13 25)" : f.k === "PNG" ? "var(--nf-accent-3)" : f.k === "XLS" ? "var(--nf-accent)" : "var(--nf-ink-2)" }}>{f.k}</div>
            <div>
              <div style={{ fontSize: 11, color: "var(--nf-ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.t}</div>
              <div style={{ fontSize: 10, color: "var(--nf-primary-active)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em", marginTop: 2 }}>↳ {f.l}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WalkCanvas({ active }: { active: string }) {
  return (
    <div style={{ position: "relative", height: "100%", minHeight: 460 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 14, borderBottom: "1px solid var(--nf-line)", marginBottom: 18 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#ff5f57" }}></span>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#febc2e" }}></span>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#28c840" }}></span>
        <span style={{ marginLeft: 10, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--nf-ink-3)", letterSpacing: "0.06em" }}>
          normaflow.app / {active}
        </span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--nf-primary-active)" }}>● en vivo</span>
      </div>

      {active === "doc" && <ScreenDoc/>}
      {active === "audit" && <ScreenAudit/>}
      {active === "risk" && <ScreenRisk/>}
      {active === "capa" && <ScreenCapa/>}
      {active === "evid" && <ScreenEvid/>}
    </div>
  );
}

function NfWalkthrough() {
  const steps = [
    { id: "doc",   l: "01 · Documentación", t: "Control documental con versionado real", d: "Cada documento conserva su historial, su flujo de aprobación y su vínculo a las cláusulas ISO. La versión activa es siempre la que se ve." },
    { id: "audit", l: "02 · Auditorías",    t: "Auditorías siempre preparadas", d: "Plan anual, checklists por norma y hallazgos vinculados a la evidencia. Sin semanas de búsqueda previas a cada auditoría." },
    { id: "risk",  l: "03 · Riesgos",       t: "Riesgos con un heatmap 5×5 vivo", d: "Tratamiento, controles preventivos/detectivos y revisiones programadas. El nivel residual se recalcula al cerrar acciones." },
    { id: "capa",  l: "04 · CAPA",          t: "CAPA de causa a eficacia", d: "5 porqués, Ishikawa, acción correctiva, validación de eficacia y cierre con evidencia. Todo en un solo expediente." },
    { id: "evid",  l: "05 · Evidencias",    t: "Una sola fuente de verdad", d: "Toda la evidencia (firmas, capturas, informes, registros) está enlazada al riesgo, control, documento o auditoría que la justifica." },
  ];

  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height - vh;
      const p = Math.min(1, Math.max(0, -rect.top / Math.max(1, total)));
      const idx = Math.min(steps.length - 1, Math.floor(p * steps.length));
      setActiveIdx(idx);
    };
    const onScroll = () => {
      if (reduced) return update();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [steps.length]);

  const active = steps[activeIdx].id;

  return (
    <section className="nf-walk-section" id="walkthrough">
      <div className="nf-container">
        <div data-reveal style={{ marginBottom: 56, maxWidth: 740 }}>
          <span className="nf-eyebrow"><span className="dot"/> Producto</span>
          <h2 className="nf-h-section" style={{ marginTop: 22 }}>
            Un recorrido. <span className="nf-grad-text-cool">Cinco módulos. Cero contexto perdido.</span>
          </h2>
        </div>

        <div className="nf-walk-wrap-scroll" ref={wrapRef}>
          <div className="nf-walk-sticky">
            <div className="nf-walk-grid">
              <div className="nf-walk-steps">
                <div className="nf-walk-rail" aria-hidden="true">
                  <div className="nf-walk-rail-fill" style={{ height: `${((activeIdx + 1) / steps.length) * 100}%` }} />
                </div>
                {steps.map((s, i) => (
                  <div
                    key={s.id}
                    className={`nf-walk-step ${activeIdx === i ? "active" : ""} ${i < activeIdx ? "done" : ""}`}
                    onClick={() => {
                      const el = wrapRef.current;
                      if (!el) return;
                      const rect = el.getBoundingClientRect();
                      const vh = window.innerHeight;
                      const total = rect.height - vh;
                      const targetP = (i + 0.4) / steps.length;
                      const targetTop = window.scrollY + rect.top + targetP * total;
                      window.scrollTo({ top: targetTop, behavior: "smooth" });
                    }}
                  >
                    <div className="lbl">{s.l}</div>
                    <div className="tt">{s.t}</div>
                    <div className="ds">{s.d}</div>
                  </div>
                ))}
              </div>

              <div className="nf-walk-canvas">
                <WalkCanvas active={active}/>
              </div>
            </div>

            <div className="nf-walk-progress" aria-hidden="true">
              {steps.map((s, i) => (
                <span key={s.id} className={`dot ${activeIdx === i ? "active" : ""} ${i < activeIdx ? "done" : ""}`} />
              ))}
              <span className="lbl">{String(activeIdx + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ Approval ============ */
function NfApproval() {
  const [active, setActive] = useState(2);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const id = setInterval(() => setActive((a) => (a + 1) % 4), 2200);
    return () => clearInterval(id);
  }, []);
  const steps = [
    { l: "Borrador",   t: "Editor con plantilla por norma", s: "Plantilla · ISO 27001 A.5.1" },
    { l: "Revisión",   t: "Validación por Calidad",         s: "L. Castro · 06 oct" },
    { l: "Aprobación", t: "Firma con sello digital",        s: "M. Torres · SHA 9f2c…ae71" },
    { l: "Activo",     t: "Versión en uso · trazabilidad",  s: "v3.2 · revisión 04-2027" },
  ];
  return (
    <section className="nf-section nf-flow-section" id="flujo-documental">
      <div className="nf-container">
        <div data-reveal style={{ maxWidth: 740 }}>
          <span className="nf-eyebrow"><span className="dot"/> Flujo documental</span>
          <h2 className="nf-h-section" style={{ marginTop: 22 }}>
            Cada documento sigue el mismo camino. <span className="nf-grad-text">Sin atajos por correo.</span>
          </h2>
          <p className="nf-lede" style={{ marginTop: 18 }}>
            Borrador → revisión → aprobación → activo. Con historial completo, firma digital y notificaciones automáticas a cada responsable.
          </p>
        </div>

        <div className="nf-approval" data-reveal>
          <div className="nf-approval-row">
            {steps.map((s, i) => (
              <div key={i} className={`nf-approval-step ${active === i ? "active" : ""}`}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: active === i ? "var(--nf-accent)" : "var(--nf-ink-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                  {String(i + 1).padStart(2, "0")} · {s.l}
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, letterSpacing: "-0.015em", margin: "6px 0 4px" }}>{s.t}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--nf-ink-3)" }}>{s.s}</div>
                {active === i && (
                  <div style={{ position: "absolute", inset: 0, borderRadius: 12, pointerEvents: "none", boxShadow: "inset 0 0 0 1px var(--nf-accent)" }}/>
                )}
              </div>
            ))}
            <div aria-hidden="true" style={{ position: "absolute", left: 14, right: 14, top: "50%", height: 1, background: "linear-gradient(90deg, transparent, var(--nf-line-2), transparent)", zIndex: -1 }}/>
          </div>

          <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div style={{ padding: 16, borderRadius: 12, border: "1px solid var(--nf-line)", background: "var(--nf-surface-muted)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--nf-ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Trazabilidad</div>
              <div style={{ fontSize: 13, color: "var(--nf-ink-2)" }}>Cada cambio queda registrado con autor, fecha y diff exportable a PDF.</div>
            </div>
            <div style={{ padding: 16, borderRadius: 12, border: "1px solid var(--nf-line)", background: "var(--nf-surface-muted)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--nf-ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Vínculo ISO</div>
              <div style={{ fontSize: 13, color: "var(--nf-ink-2)" }}>Cláusulas, controles del Anexo A y procesos enlazados al documento.</div>
            </div>
            <div style={{ padding: 16, borderRadius: 12, border: "1px solid var(--nf-line)", background: "var(--nf-surface-muted)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--nf-ink-3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Revisión periódica</div>
              <div style={{ fontSize: 13, color: "var(--nf-ink-2)" }}>Alertas automáticas antes de que cualquier política quede desactualizada.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ PDCA ============ */
function NfPDCA() {
  const phases = [
    { ph: "01", nm: "Planificar", a: { left: "50%", top: "0%", transform: "translate(-50%, 0)" } as CSSProperties, items: ["GAP Assessment", "Plan de auditorías", "Registro de riesgos", "Objetivos de calidad"] },
    { ph: "02", nm: "Hacer",       a: { right: "0%", top: "50%", transform: "translate(0, -50%)" } as CSSProperties, items: ["Control documental", "Formación y evidencias", "Acciones preventivas", "Implementación de controles"] },
    { ph: "03", nm: "Verificar",  a: { left: "50%", bottom: "0%", transform: "translate(-50%, 0)" } as CSSProperties, items: ["Auditorías internas", "Indicadores KPI", "Revisión por dirección", "Seguimiento de acciones"] },
    { ph: "04", nm: "Actuar",      a: { left: "0%", top: "50%", transform: "translate(0, -50%)" } as CSSProperties, items: ["CAPA", "Acciones correctivas", "Mejora continua", "Actualización del SGC"] },
  ];
  return (
    <section className="nf-section" id="pdca">
      <div className="nf-container">
        <div data-reveal style={{ textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
          <span className="nf-eyebrow"><span className="dot"/> PDCA</span>
          <h2 className="nf-h-section" style={{ marginTop: 22 }}>
            Mejora continua <span className="nf-grad-text">en movimiento.</span>
          </h2>
          <p className="nf-lede" style={{ marginTop: 18, marginInline: "auto" }}>
            NormaFlow estructura el trabajo alrededor de las cuatro fases del ciclo PDCA — y conecta cada una con sus módulos.
          </p>
        </div>

        <div className="nf-pdca-stage" data-reveal>
          <div className="nf-pdca-ring">
            {phases.map((p) => (
              <div key={p.nm} className="nf-pdca-quad-anchor" style={p.a}>
                <div className="nf-pdca-quad">
                  <div className="ph">FASE {p.ph}</div>
                  <div className="nm">{p.nm}</div>
                  <ul>
                    {p.items.map((it) => <li key={it}>{it}</li>)}
                  </ul>
                </div>
              </div>
            ))}
            <div className="nf-pdca-center">
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--nf-ink-2)", letterSpacing: "0.16em" }}>SGC</div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em" }}>PDCA</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ Standards ============ */
function NfStandards() {
  return (
    <section className="nf-section" id="estandares">
      <div className="nf-container">
        <div data-reveal style={{ maxWidth: 740 }}>
          <span className="nf-eyebrow"><span className="dot"/> Estándares</span>
          <h2 className="nf-h-section" style={{ marginTop: 22 }}>
            Soporte nativo para las normas <span className="nf-grad-text-cool">más demandadas.</span>
          </h2>
        </div>

        <div className="nf-standards-grid">
          <div className="nf-standard" id="iso9001" data-reveal>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
              <div className="nf-iso-badge" style={{ position: "relative", left: 0, top: 0, width: 64, height: 64 }}>
                <div>
                  <div className="top">ISO</div>
                  <div className="num" style={{ color: "var(--nf-primary-active)" }}>9001</div>
                  <div className="yr">2015</div>
                </div>
              </div>
              <div>
                <h3 className="nf-h-3">ISO 9001:2015</h3>
                <div style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Sistema de Gestión de la Calidad</div>
              </div>
            </div>
            <ul>
              {["GAP Assessment por cláusula", "Control documental completo", "Auditorías y CAPA", "Indicadores de calidad", "Revisión por dirección"].map((t) => (
                <li key={t}><span style={{ color: "var(--nf-primary-active)" }}><Ic.check/></span>{t}</li>
              ))}
            </ul>
          </div>

          <div className="nf-standard iso27001" id="iso27001" data-reveal>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
              <div className="nf-iso-badge" style={{ position: "relative", left: 0, top: 0, width: 64, height: 64 }}>
                <div>
                  <div className="top">ISO</div>
                  <div className="num" style={{ color: "var(--nf-accent-2)" }}>27001</div>
                  <div className="yr">2022</div>
                </div>
              </div>
              <div>
                <h3 className="nf-h-3">ISO 27001:2022</h3>
                <div style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>Sistema de Gestión de Seguridad de la Información</div>
              </div>
            </div>
            <ul>
              {["Gestión de riesgos de seguridad", "Controles Anexo A · 93 controles", "Gestión de incidentes", "Continuidad del negocio", "Auditorías técnicas"].map((t) => (
                <li key={t}><span style={{ color: "var(--nf-accent-2)" }}><Ic.check/></span>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ AI ============ */
function NfAI() {
  return (
    <section className="nf-section" id="ai">
      <div className="nf-container nf-ai-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.05fr", gap: 56, alignItems: "center" }}>
        <div data-reveal>
          <span className="nf-eyebrow"><span className="dot"/> Asistente IA</span>
          <h2 className="nf-h-section" style={{ marginTop: 22 }}>
            IA que <span className="nf-grad-text">redacta y sugiere.</span><br/>
            <span style={{ color: "var(--nf-ink-3)" }}>El humano aprueba.</span>
          </h2>
          <p className="nf-lede" style={{ marginTop: 18 }}>
            Borradores de políticas, resúmenes de evaluaciones GAP, propuestas de causa raíz y sugerencias de controles — pero nada entra al sistema sin la confirmación explícita de una persona responsable.
          </p>

          <ul style={{ listStyle: "none", padding: 0, margin: "28px 0 0", display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              "Borradores de políticas y procedimientos por norma",
              "Resumen de evaluaciones GAP listo para dirección",
              "Sugerencia de acciones correctivas con justificación",
              "Análisis del tratamiento de un riesgo",
              "Resumen de hallazgos de auditoría con prioridades",
            ].map((t) => (
              <li key={t} style={{ display: "flex", gap: 12, alignItems: "flex-start", color: "var(--nf-ink-2)", fontSize: 15 }}>
                <span style={{ color: "var(--nf-primary-active)", marginTop: 4 }}><Ic.check/></span>{t}
              </li>
            ))}
          </ul>

          <div className="nf-ai-human-callout">
            <span className="icon"><Ic.human/></span>
            <p>
              <strong>Human-in-the-loop por diseño.</strong> Cada sugerencia se marca como tal hasta que un responsable la aprueba y la firma.
            </p>
          </div>
        </div>

        <div data-reveal>
          <div className="nf-ai-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: "linear-gradient(135deg, var(--nf-accent), var(--nf-accent-2))", color: "var(--nf-text-on-primary)" }}>
                  <Ic.spark/>
                </span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14 }}>NormaFlow · Asistente</span>
              </div>
              <span className="nf-ai-pill"><Ic.human/> Requiere aprobación humana</span>
            </div>

            <div style={{ marginBottom: 16, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--nf-ink-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Contexto · NC-2026-118 · ISO 27001 A.5.18
            </div>
            <div style={{ padding: 16, borderRadius: 12, background: "var(--nf-glass-2)", border: "1px solid var(--nf-line)", fontSize: 14, lineHeight: 1.55, color: "var(--nf-ink-2)" }}>
              He revisado el expediente. La causa raíz más probable es <strong style={{ color: "var(--nf-ink)" }}>una regla de notificación apuntando a un usuario inactivo</strong>{" "}tras un offboarding sin actualizar la matriz de roles.
              <br/><br/>
              Sugiero <strong style={{ color: "var(--nf-ink)" }}>tres acciones</strong>:
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "var(--nf-ink-2)" }}>
                <li>Reasignar la regla a un rol funcional, no a un usuario.</li>
                <li>Añadir revisión cruzada al cierre de turno (control 8.1.4).</li>
                <li>Validar eficacia a 30 días sin nuevas incidencias.</li>
              </ul>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button className="nf-btn nf-btn--ghost nf-btn--sm" type="button">Rechazar</button>
              <button className="nf-btn nf-btn--ghost nf-btn--sm" type="button">Editar borrador</button>
              <button className="nf-btn nf-btn--primary nf-btn--sm" type="button">Aprobar y guardar <Ic.check/></button>
            </div>

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--nf-line)", display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--nf-ink-3)" }}>
              <span>fuente · 6 documentos · 2 auditorías · 1 NC histórica</span>
              <span>modelo · normaflow-iso · v2</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ Case ============ */
/**
 * Aquí había una sección rotulada "Caso real" con una cita textual firmada por
 * "María Torres · Directora de Calidad · Tecnoserv Industrial S.A." — nombre y
 * empresa tomados de los datos demo del producto — y tres métricas de
 * resultado ("70% menos tiempo", "2 días", "0 NC mayores").
 *
 * Se ha retirado por dos motivos independientes:
 *
 *  1. Un testimonio atribuido a una persona y una empresa que no existen es
 *     publicidad engañosa, no deuda de diseño.
 *  2. Contradecía a /cases/tecnoserv-industrial, que para el MISMO cliente
 *     decía "18 días → 5 días" y atribuía el 70% a otra cosa, con una cita
 *     distinta de la misma persona. Cualquiera que pulsara "Ver caso completo"
 *     veía las dos versiones.
 *
 * En su lugar va lo que el producto hace de verdad, sin atribuirlo a nadie.
 */
function NfCase() {
  const capacidades = [
    ["Evidencia una vez, sirve para varias normas", "Un documento cubre la cláusula 7.5 de ISO 9001 y la de ISO 14001 a la vez; no se mantienen dos sistemas en paralelo."],
    ["El rastro de auditoría se escribe solo", "Cada cambio de estado, aprobación y adjunto queda registrado con autor y fecha, dentro de la misma transacción que la operación."],
    ["El GAP marca lo que falta, no lo que sobra", "La evaluación por requisito indica qué cláusulas no tienen evidencia y genera el plan de acción con responsable y fecha."],
  ] as [string, string][];

  return (
    <section className="nf-section" id="caso">
      <div className="nf-container">
        <div data-reveal style={{ maxWidth: 740, marginBottom: 36 }}>
          <span className="nf-eyebrow"><span className="dot"/> Cómo funciona</span>
          <h2 className="nf-h-section" style={{ marginTop: 22 }}>
            Un sistema de gestión que se mantiene <span className="nf-grad-text">al día solo</span>.
          </h2>
          <p style={{ marginTop: 18, color: "var(--nf-ink-2)", lineHeight: 1.6 }}>
            NormaFlow es una herramienta de gestión. No emite certificados ni
            sustituye a una auditoría de certificación: prepara y mantiene la
            evidencia que esa auditoría pide.
          </p>
        </div>

        <div className="nf-capabilities" data-reveal>
          {capacidades.map(([titulo, texto]) => (
            <article key={titulo} className="nf-capability">
              <h3 className="nf-capability-title">{titulo}</h3>
              <p className="nf-capability-text">{texto}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ Pricing ============ */
function NfPricing() {
  const planMeta: Record<PlanKey, { tag: string; cta: string; popular: boolean }> = {
    STARTER: { tag: "Para implementar ISO sin caos", cta: "Empezar 14 días gratis", popular: false },
    GROWTH: { tag: "Para equipos en mantenimiento activo", cta: "Probar 14 días", popular: true },
    ENTERPRISE: { tag: "Para multi-organización y SLA", cta: "Hablar con ventas", popular: false },
  };
  const plans = (Object.keys(PLAN_CATALOG) as PlanKey[]).map((key) => ({
    ...PLAN_CATALOG[key],
    ...planMeta[key],
    price: PLAN_CATALOG[key].monthlyUsd == null ? "A medida" : `$${PLAN_CATALOG[key].monthlyUsd}`,
  }));
  return (
    <section className="nf-section" id="precios">
      <div className="nf-container">
        <div data-reveal style={{ maxWidth: 740 }}>
          <span className="nf-eyebrow"><span className="dot"/> Precios</span>
          <h2 className="nf-h-section" style={{ marginTop: 22 }}>
            Tres planes. <span className="nf-grad-text">Una sola plataforma.</span>
          </h2>
          <p className="nf-lede" style={{ marginTop: 18 }}>
            14 días de prueba en cualquier plan. Sin tarjeta, sin compromiso.
          </p>
        </div>

        <div className="nf-pricing-grid">
          {plans.map((p, i) => (
              <div key={p.key} className={`nf-price-card ${p.popular ? "popular" : ""}`} data-reveal style={{ transitionDelay: `${i * 60}ms` }}>
              {p.popular && <span className="nf-popular-badge">Más popular</span>}
              <div className="name">{p.label}</div>
              <div className="price">
                {p.price}
                {p.monthlyUsd != null && <span className="unit"> USD / mes</span>}
              </div>
              <div style={{ fontSize: 13, color: "var(--nf-ink-3)" }}>{p.tag}</div>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>
                    <span style={{ flexShrink: 0, marginTop: 1, color: "var(--nf-primary-active)" }}><Ic.check/></span>{f}
                  </li>
                ))}
              </ul>
              <a href={p.key === "ENTERPRISE" ? "/demo" : "/signup"} className={`nf-btn ${p.popular ? "nf-btn--primary" : "nf-btn--ghost"}`} style={{ justifyContent: "center" }}>
                {p.cta} <Ic.arrow className="nf-arrow"/>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ CTA ============ */
function NfCTA() {
  return (
    <section className="nf-section nf-section--tight" id="demo">
      <div className="nf-container">
        <div className="nf-cta-final" data-reveal>
          <span className="nf-eyebrow" style={{ background: "var(--nf-glass-2)" }}>
            <span className="dot"/> Cumplimiento bajo control
          </span>
          <h2 className="nf-h-display" style={{ fontSize: "clamp(36px, 5.4vw, 72px)", marginTop: 22, maxWidth: "20ch", marginInline: "auto" }}>
            Convierte el caos ISO en <span className="nf-grad-text">control continuo.</span>
          </h2>
          <p className="nf-lede" style={{ marginTop: 18, marginInline: "auto", textAlign: "center" }}>
            Programa una demo de 30 minutos con un especialista. Vemos tu sistema actual y te mostramos cómo quedaría en NormaFlow.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 32, flexWrap: "wrap" }}>
            <a className="nf-btn nf-btn--primary" href="/demo">Solicitar demo gratuita <Ic.arrow className="nf-arrow"/></a>
            <a className="nf-btn nf-btn--ghost" href="/signup">Crear cuenta · 14 días gratis</a>
          </div>
          <div style={{ display: "flex", gap: 28, justifyContent: "center", marginTop: 28, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--nf-ink-3)", flexWrap: "wrap" }}>
            <span><span style={{ color: "var(--nf-primary-active)" }}>●</span> Sin tarjeta</span>
            <span><span style={{ color: "var(--nf-primary-active)" }}>●</span> Sin compromiso</span>
            <span><span style={{ color: "var(--nf-primary-active)" }}>●</span> Cancela cuando quieras</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ FAQ ============ */
function NfFAQ() {
  return (
    <section className="nf-section nf-section--tight" id="preguntas-frecuentes">
      <div className="nf-container" style={{ maxWidth: 860 }}>
        <div data-reveal style={{ maxWidth: 700 }}>
          <span className="nf-eyebrow"><span className="dot"/> Preguntas frecuentes</span>
          <h2 className="nf-h-section" style={{ marginTop: 22 }}>
            Lo importante, <span className="nf-grad-text">sin letra pequeña.</span>
          </h2>
          <p className="nf-lede" style={{ marginTop: 18 }}>
            Respuestas directas sobre el alcance de la plataforma, las normas compatibles y el papel de la IA.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 32 }}>
          {HOME_FAQS.map((faq) => (
            <details key={faq.question} className="nfm-card" style={{ padding: "18px 22px" }}>
              <summary style={{ cursor: "pointer", fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--nf-ink)", lineHeight: 1.4 }}>
                {faq.question}
              </summary>
              <p style={{ margin: "12px 28px 0 0", color: "var(--nf-ink-2)", fontSize: 15, lineHeight: 1.65 }}>
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ App ============ */
export default function Landing() {
  useReveal();
  return (
    <>
      <NfHero/>
      <NfTrust/>
      <NfProblem/>
      <NfTransform/>
      <NfModules/>
      <NfWalkthrough/>
      <NfApproval/>
      <NfPDCA/>
      <NfStandards/>
      <NfAI/>
      <NfCase/>
      <NfPricing/>
      <NfFAQ/>
      <NfCTA/>
    </>
  );
}
