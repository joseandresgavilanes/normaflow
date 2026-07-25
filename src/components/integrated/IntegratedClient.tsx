"use client";

import { useMemo, useState, useTransition } from "react";
import {
  LayoutDashboard, ScrollText, Users, Target, GitCompareArrows,
  ClipboardCheck, Layers, ShieldAlert,
} from "lucide-react";
import type { IntegratedPayload } from "@/lib/integrated/queries";
import {
  upsertIntegratedSystem, approveIntegratedPolicy,
  createInterestedParty, deleteInterestedParty,
  createIntegratedObjective, deleteIntegratedObjective,
  assignRequirementOwner,
} from "@/lib/actions/integrated";

type Tab = "panel" | "scope" | "parties" | "objectives" | "crosswalk" | "audit" | "shared";

const DISCIPLINE_LABEL: Record<string, string> = {
  QUALITY: "Calidad", ENVIRONMENT: "Ambiente", SAFETY: "Seguridad y salud", SECURITY: "Seguridad de la información",
};
const DISCIPLINE_COLOR: Record<string, string> = {
  QUALITY: "#123C66", ENVIRONMENT: "#6B3FB5", SAFETY: "#D68A1A", SECURITY: "#2E8B57",
};
const KIND_LABEL: Record<string, string> = {
  EQUIVALENT: "Equivalente", PARTIAL: "Parcialmente equivalente", SPECIFIC: "Específico",
};
const KIND_COLOR: Record<string, string> = { EQUIVALENT: "#16a34a", PARTIAL: "#d68a1a", SPECIFIC: "#5266F6" };

const card: React.CSSProperties = { border: "1px solid var(--nf-line, #e5eaf2)", borderRadius: 14, padding: 18, background: "var(--nf-surface, #fff)" };
const chip = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, display: "inline-block" });
const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 11px", border: "1px solid var(--nf-line,#e5eaf2)", borderRadius: 9, fontSize: 13, fontFamily: "inherit" };
const primaryBtn: React.CSSProperties = { background: "#5266F6", color: "#fff", border: "none", borderRadius: 9, padding: "8px 15px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" };
const ghostBtn: React.CSSProperties = { background: "#fff", color: "#5266F6", border: "1px solid #cdd6f8", borderRadius: 9, padding: "7px 13px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" };
const dangerBtn: React.CSSProperties = { background: "none", color: "#b91c1c", border: "1px solid #f2c4c4", borderRadius: 8, padding: "4px 9px", fontWeight: 700, fontSize: 11.5, cursor: "pointer" };

export default function IntegratedClient({ initial, demo = false }: { initial: IntegratedPayload; demo?: boolean }) {
  const [tab, setTab] = useState<Tab>("panel");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const canManage = initial.canManage && !demo;
  const canUpdate = initial.canUpdate && !demo;

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Error inesperado."); }
    });
  }

  const tabs: { id: Tab; label: string; Icon: typeof Layers }[] = [
    { id: "panel", label: "Panel integrado", Icon: LayoutDashboard },
    { id: "scope", label: "Alcance y política", Icon: ScrollText },
    { id: "parties", label: "Partes interesadas", Icon: Users },
    { id: "objectives", label: "Objetivos", Icon: Target },
    { id: "crosswalk", label: "Matriz de correspondencia", Icon: GitCompareArrows },
    { id: "audit", label: "Auditoría integrada", Icon: ClipboardCheck },
    { id: "shared", label: "Elementos compartidos", Icon: Layers },
  ];

  return (
    <div style={{ padding: "clamp(16px, 3vw, 32px)", maxWidth: 1240, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <Layers size={26} /> Sistema Integrado de Gestión
        </h1>
        <p style={{ color: "var(--nf-ink-2, #5e6b7a)", margin: "6px 0 0", fontSize: 14 }}>
          Calidad, ambiente y seguridad y salud en el trabajo en un solo sistema: un alcance, una política,
          documentos y evidencias que satisfacen varias normas sin duplicarse.
          {demo && <strong style={{ color: "#5266F6" }}> · Vista demo (solo lectura).</strong>}
        </p>
      </header>

      {error && <div role="alert" style={{ ...card, borderColor: "#f2b8b8", background: "#fdf3f3", color: "#b91c1c", marginBottom: 16 }}>{error}</div>}

      <nav style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 20, borderBottom: "1px solid var(--nf-line, #e5eaf2)" }}>
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            display: "flex", alignItems: "center", gap: 7, padding: "10px 13px", border: "none", background: "none",
            borderBottom: tab === id ? "2px solid #5266F6" : "2px solid transparent",
            color: tab === id ? "#5266F6" : "var(--nf-ink-2, #5e6b7a)",
            fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: -1,
          }}><Icon size={15} /> {label}</button>
        ))}
      </nav>

      {tab === "panel" && <PanelTab p={initial} />}
      {tab === "scope" && <ScopeTab p={initial} canUpdate={canUpdate} pending={pending} run={run} />}
      {tab === "parties" && <PartiesTab p={initial} canManage={canManage} pending={pending} run={run} />}
      {tab === "objectives" && <ObjectivesTab p={initial} canManage={canManage} pending={pending} run={run} />}
      {tab === "crosswalk" && <CrosswalkTab p={initial} canUpdate={canUpdate} pending={pending} run={run} />}
      {tab === "audit" && <AuditTab p={initial} />}
      {tab === "shared" && <SharedTab p={initial} />}
    </div>
  );
}

/* ─── PANEL INTEGRADO (dashboard) ─────────────────── */
function PanelTab({ p }: { p: IntegratedPayload }) {
  const s = p.summary;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 12 }}>
        <Stat label="Cumplimiento global" value={`${p.globalScore}%`} accent="#5266F6" />
        <Stat label="Grado de integración" value={`${p.integrationRate}%`} sub="requisitos compartidos" accent="#16a34a" />
        <Stat label="Factor de reutilización" value={`${p.reuseFactor}×`} sub="requisitos por elemento" accent="#6B3FB5" />
        <Stat label="Normas activas" value={String(s.standards)} />
        <Stat label="Evidencias faltantes" value={String(s.missingEvidence)} accent={s.missingEvidence ? "#b91c1c" : undefined} />
      </div>

      <section style={card}>
        <h2 style={{ fontSize: 15, margin: "0 0 12px" }}>Cumplimiento por norma</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {p.compliance.map((c) => (
            <div key={c.familyCode}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                <span><strong>{c.familyCode.replace("_", " ")}</strong> <span style={chip(DISCIPLINE_COLOR[c.discipline] + "1a", DISCIPLINE_COLOR[c.discipline])}>{DISCIPLINE_LABEL[c.discipline]}</span></span>
                <span style={{ color: "var(--nf-ink-2,#5e6b7a)" }}>{c.score}% · {c.covered}/{c.total} con evidencia</span>
              </div>
              <Bar pct={c.score} color={DISCIPLINE_COLOR[c.discipline]} />
            </div>
          ))}
          {!p.compliance.length && <Empty text="Activa las normas del sistema para ver el cumplimiento." />}
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
        <section style={card}>
          <h3 style={{ fontSize: 14, margin: "0 0 10px" }}>Requisitos comunes vs específicos</h3>
          <Row label="Equivalentes" value={s.equivalent} color="#16a34a" />
          <Row label="Parcialmente equivalentes" value={s.partial} color="#d68a1a" />
          <Row label="Específicos de una norma" value={s.specific} color="#5266F6" />
          <p style={{ fontSize: 11.5, color: "var(--nf-ink-3,#8794a5)", marginTop: 10, marginBottom: 0 }}>
            Los requisitos equivalentes se cubren una sola vez para todas las normas.
          </p>
        </section>
        <section style={card}>
          <h3 style={{ fontSize: 14, margin: "0 0 10px" }}>Acciones y auditorías</h3>
          <Row label="CAPA abiertas" value={s.openCapas} color="#b91c1c" />
          <Row label="Auditorías integradas" value={s.integratedAudits} color="#5266F6" />
          <Row label="Hallazgos multi-norma" value={p.multiNormFindings.length} color="#d68a1a" />
        </section>
        <section style={card}>
          <h3 style={{ fontSize: 14, margin: "0 0 10px" }}>Riesgos críticos por disciplina</h3>
          {(["QUALITY", "ENVIRONMENT", "SAFETY"] as const).map((d) => (
            <Row key={d} label={DISCIPLINE_LABEL[d]}
              value={p.risks.filter((r) => r.score >= 15 && r.disciplines.includes(d)).length}
              color={DISCIPLINE_COLOR[d]} />
          ))}
          <Row label="Total críticos" value={s.criticalRisks} color="#b91c1c" />
        </section>
      </div>
    </div>
  );
}

/* ─── ALCANCE Y POLÍTICA ──────────────────────────── */
function ScopeTab({ p, canUpdate, pending, run }: { p: IntegratedPayload; canUpdate: boolean; pending: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const [scope, setScope] = useState(p.system?.scope ?? "");
  const [policy, setPolicy] = useState(p.system?.policy ?? "");
  const [boundaries, setBoundaries] = useState(p.system?.boundaries ?? "");
  const [contextNotes, setContextNotes] = useState(p.system?.contextNotes ?? "");
  const [exclusions, setExclusions] = useState(p.system?.scopeExclusions ?? "");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section style={card}>
        <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>Alcance integrado</h2>
        <p style={{ fontSize: 12.5, color: "var(--nf-ink-2,#5e6b7a)", margin: "0 0 12px" }}>
          Un solo alcance para las tres normas; cada una puede añadir su nota y exclusiones.
        </p>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Alcance</label>
        <textarea value={scope} onChange={(e) => setScope(e.target.value)} disabled={!canUpdate} rows={3} style={{ ...input, marginBottom: 10 }} />
        <label style={{ fontSize: 12, fontWeight: 700 }}>Exclusiones justificadas</label>
        <textarea value={exclusions} onChange={(e) => setExclusions(e.target.value)} disabled={!canUpdate} rows={2} style={{ ...input, marginBottom: 10 }} />
        <label style={{ fontSize: 12, fontWeight: 700 }}>Límites físicos y organizacionales</label>
        <textarea value={boundaries} onChange={(e) => setBoundaries(e.target.value)} disabled={!canUpdate} rows={2} style={{ ...input, marginBottom: 10 }} />
        <label style={{ fontSize: 12, fontWeight: 700 }}>Cuestiones internas y externas (contexto común 4.1)</label>
        <textarea value={contextNotes} onChange={(e) => setContextNotes(e.target.value)} disabled={!canUpdate} rows={3} style={input} />
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>Política integrada</h2>
        <p style={{ fontSize: 12.5, color: "var(--nf-ink-2,#5e6b7a)", margin: "0 0 12px" }}>
          Documento único que declara el compromiso de calidad, ambiente y SST.
          {p.system?.policyApprovedAt && <> · Aprobada el {new Date(p.system.policyApprovedAt).toLocaleDateString()} por {p.system.policyApprovedByName ?? "—"}.</>}
        </p>
        <textarea value={policy} onChange={(e) => setPolicy(e.target.value)} disabled={!canUpdate} rows={8} style={input} />
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button disabled={!canUpdate || pending} style={primaryBtn}
            onClick={() => run(() => upsertIntegratedSystem({ scope, policy, boundaries, contextNotes, scopeExclusions: exclusions }))}>
            {pending ? "Guardando…" : "Guardar alcance y política"}
          </button>
          <button disabled={!canUpdate || pending} style={ghostBtn} onClick={() => run(() => approveIntegratedPolicy())}>
            Aprobar política (v{p.system?.policyVersion ?? "1.0"})
          </button>
        </div>
      </section>

      <section style={card}>
        <h3 style={{ fontSize: 14, margin: "0 0 10px" }}>Normas incluidas en el alcance</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {p.activeStandards.map((s) => (
            <span key={s.editionId} style={chip(DISCIPLINE_COLOR[s.discipline] + "1a", DISCIPLINE_COLOR[s.discipline])}>
              {s.familyCode.replace("_", " ")}:{s.editionCode} · {DISCIPLINE_LABEL[s.discipline]}
            </span>
          ))}
          {!p.activeStandards.length && <Empty text="No hay normas activas." />}
        </div>
      </section>
    </div>
  );
}

/* ─── PARTES INTERESADAS ──────────────────────────── */
function PartiesTab({ p, canManage, pending, run }: { p: IntegratedPayload; canManage: boolean; pending: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [needs, setNeeds] = useState("");
  const [disciplines, setDisciplines] = useState<string[]>([]);

  const toggle = (d: string) => setDisciplines((c) => c.includes(d) ? c.filter((x) => x !== d) : [...c, d]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {canManage && (
        <section style={{ ...card, background: "#f7f9fc" }}>
          <h3 style={{ fontSize: 14, margin: "0 0 10px" }}>Nueva parte interesada (común a todas las normas)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
            <input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} style={input} />
            <input placeholder="Tipo (cliente, trabajador…)" value={type} onChange={(e) => setType(e.target.value)} style={input} />
            <input placeholder="Necesidades y expectativas" value={needs} onChange={(e) => setNeeds(e.target.value)} style={input} />
          </div>
          <div style={{ display: "flex", gap: 8, margin: "10px 0", flexWrap: "wrap" }}>
            {(["QUALITY", "ENVIRONMENT", "SAFETY"] as const).map((d) => (
              <button key={d} onClick={() => toggle(d)} style={{
                ...ghostBtn, background: disciplines.includes(d) ? DISCIPLINE_COLOR[d] : "#fff",
                color: disciplines.includes(d) ? "#fff" : DISCIPLINE_COLOR[d], borderColor: DISCIPLINE_COLOR[d],
              }}>{DISCIPLINE_LABEL[d]}</button>
            ))}
          </div>
          <button disabled={pending || !name.trim()} style={primaryBtn}
            onClick={() => run(async () => {
              await createInterestedParty({ name, type: type || null, needs: needs || null, disciplines: disciplines as never[] });
              setName(""); setType(""); setNeeds(""); setDisciplines([]);
            })}>Añadir</button>
        </section>
      )}
      <Table
        head={["Código", "Parte interesada", "Tipo", "Necesidades", "Disciplinas", canManage ? "" : null]}
        rows={p.interestedParties.map((party) => [
          <strong key="c">{party.code}</strong>,
          party.name,
          party.type ?? "—",
          <span key="n" style={{ color: "var(--nf-ink-2,#5e6b7a)" }}>{party.needs ?? "—"}</span>,
          <span key="d" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {party.disciplines.length
              ? party.disciplines.map((d) => <span key={d} style={chip(DISCIPLINE_COLOR[d] + "1a", DISCIPLINE_COLOR[d])}>{DISCIPLINE_LABEL[d]}</span>)
              : <span style={chip("#f0f3f8", "#8794a5")}>Todas</span>}
          </span>,
          canManage ? <button key="x" style={dangerBtn} disabled={pending} onClick={() => run(() => deleteInterestedParty(party.id))}>Eliminar</button> : null,
        ])}
        empty="Aún no hay partes interesadas registradas."
      />
    </div>
  );
}

/* ─── OBJETIVOS ───────────────────────────────────── */
function ObjectivesTab({ p, canManage, pending, run }: { p: IntegratedPayload; canManage: boolean; pending: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const toggle = (d: string) => setDisciplines((c) => c.includes(d) ? c.filter((x) => x !== d) : [...c, d]);
  const shared = p.objectives.filter((o) => o.shared).length;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        <Stat label="Objetivos totales" value={String(p.objectives.length)} />
        <Stat label="Compartidos (multi-disciplina)" value={String(shared)} accent="#16a34a" />
        <Stat label="Logrados" value={String(p.objectives.filter((o) => o.status === "ACHIEVED").length)} />
      </div>
      {canManage && (
        <section style={{ ...card, background: "#f7f9fc" }}>
          <h3 style={{ fontSize: 14, margin: "0 0 10px" }}>Nuevo objetivo — marca varias disciplinas para hacerlo compartido</h3>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
            <input placeholder="Objetivo" value={title} onChange={(e) => setTitle(e.target.value)} style={input} />
            <input placeholder="Meta" value={target} onChange={(e) => setTarget(e.target.value)} style={input} />
          </div>
          <div style={{ display: "flex", gap: 8, margin: "10px 0", flexWrap: "wrap" }}>
            {(["QUALITY", "ENVIRONMENT", "SAFETY"] as const).map((d) => (
              <button key={d} onClick={() => toggle(d)} style={{
                ...ghostBtn, background: disciplines.includes(d) ? DISCIPLINE_COLOR[d] : "#fff",
                color: disciplines.includes(d) ? "#fff" : DISCIPLINE_COLOR[d], borderColor: DISCIPLINE_COLOR[d],
              }}>{DISCIPLINE_LABEL[d]}</button>
            ))}
          </div>
          <button disabled={pending || !title.trim()} style={primaryBtn}
            onClick={() => run(async () => {
              await createIntegratedObjective({ title, target: target || null, disciplines: disciplines as never[] });
              setTitle(""); setTarget(""); setDisciplines([]);
            })}>Añadir objetivo</button>
        </section>
      )}
      <Table
        head={["Código", "Objetivo", "Meta", "Disciplinas", "Estado", canManage ? "" : null]}
        rows={p.objectives.map((o) => [
          <strong key="c">{o.code}</strong>,
          <span key="t">{o.title}{o.shared && <span style={{ ...chip("#eafaf0", "#16a34a"), marginLeft: 7 }}>compartido</span>}</span>,
          o.target ?? "—",
          <span key="d" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {o.disciplines.map((d) => <span key={d} style={chip(DISCIPLINE_COLOR[d] + "1a", DISCIPLINE_COLOR[d])}>{DISCIPLINE_LABEL[d]}</span>)}
          </span>,
          <span key="s" style={chip("#eef1fe", "#5266F6")}>{o.status}</span>,
          canManage ? <button key="x" style={dangerBtn} disabled={pending} onClick={() => run(() => deleteIntegratedObjective(o.id))}>Eliminar</button> : null,
        ])}
        empty="Aún no hay objetivos definidos."
      />
    </div>
  );
}

/* ─── MATRIZ DE CORRESPONDENCIA (CROSSWALK) ───────── */
function CrosswalkTab({ p, canUpdate, pending, run }: { p: IntegratedPayload; canUpdate: boolean; pending: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const [family, setFamily] = useState("");
  const [kind, setKind] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);

  const rows = useMemo(() => p.crosswalk.filter((r) =>
    (!family || r.familyCode === family) &&
    (!kind || r.kind === kind) &&
    (!onlyMissing || r.coverageCount === 0),
  ), [p.crosswalk, family, kind, onlyMissing]);

  const families = [...new Set(p.crosswalk.map((r) => r.familyCode))];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select value={family} onChange={(e) => setFamily(e.target.value)} style={{ ...input, maxWidth: 190 }}>
          <option value="">Todas las normas</option>
          {families.map((f) => <option key={f} value={f}>{f.replace("_", " ")}</option>)}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ ...input, maxWidth: 220 }}>
          <option value="">Todos los tipos</option>
          <option value="EQUIVALENT">Equivalente</option>
          <option value="PARTIAL">Parcialmente equivalente</option>
          <option value="SPECIFIC">Específico</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--nf-ink-2,#5e6b7a)" }}>
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> Solo sin evidencia
        </label>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--nf-ink-3,#8794a5)" }}>{rows.length} requisitos</span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--nf-line,#e5eaf2)" }}>
              {["Norma", "Requisito", "Tipo", "Correspondencias", "Documento compartido", "Evidencia compartida", "Responsable"].map((h) => (
                <th key={h} style={{ padding: "9px 8px", fontSize: 11.5, color: "var(--nf-ink-3,#8794a5)", textTransform: "uppercase", letterSpacing: .3 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.requirementId} style={{ borderBottom: "1px solid var(--nf-line,#f0f3f8)" }}>
                <td style={{ padding: "9px 8px" }}><span style={chip("#eef1fe", "#5266F6")}>{r.familyCode.replace("_", " ")}</span></td>
                <td style={{ padding: "9px 8px" }}><strong>{r.code}</strong> {r.title}</td>
                <td style={{ padding: "9px 8px" }}><span style={chip(KIND_COLOR[r.kind] + "1a", KIND_COLOR[r.kind])}>{KIND_LABEL[r.kind]}</span></td>
                <td style={{ padding: "9px 8px" }}>
                  {r.related.length ? r.related.map((rel) => (
                    <div key={rel.requirementId} style={{ fontSize: 11.5 }}>
                      {rel.familyCode.replace("_", " ")} <strong>{rel.code}</strong>
                      <span style={{ color: "var(--nf-ink-3,#8794a5)" }}> · {rel.relationType === "EQUIVALENT" ? "equiv." : "parcial"}{rel.equivalencePercent != null && ` ${rel.equivalencePercent}%`}</span>
                    </div>
                  )) : <span style={{ color: "var(--nf-ink-3,#8794a5)" }}>— específico</span>}
                </td>
                <td style={{ padding: "9px 8px" }}>{r.sharedDocuments.length ? r.sharedDocuments.join(", ") : <span style={{ color: "var(--nf-ink-3,#8794a5)" }}>—</span>}</td>
                <td style={{ padding: "9px 8px" }}>{r.sharedEvidence.length ? r.sharedEvidence.join(", ") : <span style={{ color: "#b91c1c" }}>falta</span>}</td>
                <td style={{ padding: "9px 8px" }}>
                  {canUpdate ? (
                    <select value={r.responsibleId ?? ""} disabled={pending} style={{ ...input, padding: "5px 7px", fontSize: 12, minWidth: 130 }}
                      onChange={(e) => run(() => assignRequirementOwner({ requirementId: r.requirementId, responsibleId: e.target.value || null }))}>
                      <option value="">Sin asignar</option>
                      {p.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  ) : (r.responsibleName ?? "—")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty text="No hay requisitos para los filtros seleccionados." />}
      </div>
      <p style={{ fontSize: 11.5, color: "var(--nf-ink-3,#8794a5)", margin: 0 }}>
        Los requisitos <strong>equivalentes</strong> se satisfacen una sola vez: el mismo documento o evidencia
        cubre la cláusula en todas las normas correspondientes.
      </p>
    </div>
  );
}

/* ─── AUDITORÍA INTEGRADA ─────────────────────────── */
function AuditTab({ p }: { p: IntegratedPayload }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        <Stat label="Auditorías integradas" value={String(p.integratedAuditCount)} accent="#5266F6" />
        <Stat label="Hallazgos multi-norma" value={String(p.multiNormFindings.length)} accent="#d68a1a" />
        <Stat label="CAPA compartidas" value={String(p.capas.filter((c) => c.shared).length)} accent="#16a34a" />
        <Stat label="Revisiones integradas" value={String(p.reviews.filter((r) => r.integrated).length)} />
      </div>

      <section>
        <h3 style={{ fontSize: 14, margin: "0 0 10px" }}>Auditorías — una auditoría puede cubrir varias normas</h3>
        <Table
          head={["Auditoría", "Normas", "Estado", "Hallazgos", "Multi-norma"]}
          rows={p.audits.map((a) => [
            <span key="t">{a.title}{a.integrated && <span style={{ ...chip("#eef1fe", "#5266F6"), marginLeft: 7 }}>integrada</span>}</span>,
            <span key="s" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {a.standards.map((s) => <span key={s} style={chip("#f0f3f8", "#5e6b7a")}>{s.replace("_", " ")}</span>)}
            </span>,
            a.status, String(a.findingCount), String(a.multiNormFindings),
          ])}
          empty="No hay auditorías registradas."
        />
      </section>

      <section>
        <h3 style={{ fontSize: 14, margin: "0 0 10px" }}>Hallazgos asociados a varias normas (sin duplicar)</h3>
        <Table
          head={["Hallazgo", "Auditoría", "Tipo", "Severidad", "Normas"]}
          rows={p.multiNormFindings.map((f) => [
            f.title, f.auditTitle, f.type, f.severity,
            <span key="s" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {f.standards.map((s) => <span key={s} style={chip("#fdf3e7", "#d68a1a")}>{s.replace("_", " ")}</span>)}
            </span>,
          ])}
          empty="No hay hallazgos que afecten a varias normas."
        />
      </section>

      <section>
        <h3 style={{ fontSize: 14, margin: "0 0 10px" }}>CAPA común</h3>
        <Table
          head={["Código", "Título", "Etapa", "Normas cubiertas"]}
          rows={p.capas.filter((c) => c.shared).map((c) => [
            <strong key="c">{c.code}</strong>, c.title, c.stage,
            <span key="s" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {c.standards.map((s) => <span key={s} style={chip("#eafaf0", "#16a34a")}>{s.replace("_", " ")}</span>)}
            </span>,
          ])}
          empty="No hay CAPA que cubran varias normas todavía."
        />
      </section>
    </div>
  );
}

/* ─── ELEMENTOS COMPARTIDOS (prueba de no-duplicación) ─── */
function SharedTab({ p }: { p: IntegratedPayload }) {
  const TYPE_LABEL: Record<string, string> = {
    DOCUMENT: "Documento", EVIDENCE: "Evidencia", RISK: "Riesgo", INDICATOR: "Indicador",
    AUDIT: "Auditoría", CAPA: "CAPA", RECORD: "Registro", PROCESS: "Proceso",
  };
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section style={{ ...card, background: "#f7fcf8", borderColor: "#b8e4c4" }}>
        <strong style={{ color: "#166534" }}>Factor de reutilización: {p.reuseFactor}× </strong>
        <span style={{ fontSize: 13, color: "#39704b" }}>
          — cada elemento del sistema cubre de media {p.reuseFactor} requisitos. Un valor superior a 1 confirma
          que un mismo documento, evidencia o riesgo satisface varias normas sin crear copias.
        </span>
      </section>
      <Table
        head={["Elemento", "Tipo", "Requisitos cubiertos", "Normas"]}
        rows={p.multiNormEntities.map((e) => [
          e.label, TYPE_LABEL[e.entityType] ?? e.entityType, String(e.requirements),
          <span key="f" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {e.families.map((f) => <span key={f} style={chip("#eafaf0", "#16a34a")}>{f.replace("_", " ")}</span>)}
          </span>,
        ])}
        empty="Aún no hay elementos que cubran requisitos de varias normas. Asócialos desde Documentos, Evidencias o la matriz de requisitos."
      />
    </div>
  );
}

/* ─── primitivos ──────────────────────────────────── */
function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 11.5, color: "var(--nf-ink-3,#8794a5)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 3, color: accent }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--nf-ink-3,#8794a5)" }}>{sub}</div>}
    </div>
  );
}
function Row({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13 }}>
      <span style={{ color: "var(--nf-ink-2,#5e6b7a)" }}>{label}</span>
      <strong style={{ color }}>{value}</strong>
    </div>
  );
}
function Bar({ pct, color = "#5266F6" }: { pct: number; color?: string }) {
  return (
    <div style={{ height: 7, background: "var(--nf-line,#e8edf5)", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: color }} />
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div style={{ ...card, textAlign: "center", color: "var(--nf-ink-3,#8794a5)", padding: 32, fontSize: 13 }}>{text}</div>;
}
function Table({ head, rows, empty }: { head: (string | null)[]; rows: React.ReactNode[][]; empty: string }) {
  if (!rows.length) return <Empty text={empty} />;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--nf-line,#e5eaf2)" }}>
            {head.filter((h) => h !== null).map((h, i) => (
              <th key={i} style={{ padding: "9px 8px", fontSize: 11.5, color: "var(--nf-ink-3,#8794a5)", textTransform: "uppercase", letterSpacing: .3 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--nf-line,#f0f3f8)" }}>
              {cells.filter((c) => c !== null).map((c, j) => <td key={j} style={{ padding: "9px 8px" }}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
