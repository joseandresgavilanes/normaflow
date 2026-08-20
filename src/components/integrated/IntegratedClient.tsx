"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, ScrollText, Users, Target, GitCompareArrows,
  ClipboardCheck, Layers, ShieldAlert, Search, X,
} from "lucide-react";
import type { IntegratedPayload } from "@/lib/integrated/queries";
import {
  upsertIntegratedSystem, approveIntegratedPolicy, upsertSystemStandard,
  createInterestedParty, updateInterestedParty, deleteInterestedParty,
  createIntegratedObjective, updateIntegratedObjective, deleteIntegratedObjective,
  assignRequirementOwner,
  setAuditStandards, setFindingStandards, setCapaStandards,
  setRiskDisciplines, setChangeDisciplines, setReviewStandards,
  evaluateSupplierIntegrated,
} from "@/lib/actions/integrated";
import { useModuleSection } from "@/hooks/useModuleSection";
import Modal from "@/components/ui/Modal";
import IsoSectionMetrics from "@/components/ui/IsoSectionMetrics";
import IsoTableCard from "@/components/ui/IsoTableCard";
import IsoSectionHeader from "@/components/ui/IsoSectionHeader";
import { ConfirmActionModal } from "@/components/ui/ActionDialogs";
import { toneChip } from "@/lib/tone";
import BarChart from "@/components/charts/BarChart";
import { formatDate } from "@/lib/format/datetime";
import PersonPicker from "@/components/ui/PersonPicker";
import Picker from "@/components/ui/Picker";

type Tab = "panel" | "scope" | "parties" | "objectives" | "crosswalk" | "audit" | "shared";

const SECTION_META: Record<Tab, { title: string; sub: string }> = {
  panel: { title: "Sistema Integrado de Gestión", sub: "Calidad, ambiente y seguridad y salud en un solo sistema, con requisitos, evidencias y auditorías compartidas." },
  scope: { title: "Alcance y política integrada", sub: "Alcance, límites, exclusiones, política y normas activas del sistema." },
  parties: { title: "Partes interesadas", sub: "Necesidades, requisitos, influencia y disciplinas de cada parte interesada." },
  objectives: { title: "Objetivos integrados", sub: "Objetivos, metas, responsables, plazos y oportunidades de integración." },
  crosswalk: { title: "Matriz de correspondencias", sub: "Relación entre requisitos, equivalencias, cobertura y evidencias compartidas." },
  audit: { title: "Auditorías integradas", sub: "Auditorías, hallazgos y acciones que cubren varias normas." },
  shared: { title: "Elementos compartidos", sub: "Riesgos, cambios, proveedores y elementos reutilizados entre disciplinas." },
};

const DISCIPLINE_LABEL: Record<string, string> = {
  QUALITY: "Calidad", ENVIRONMENT: "Ambiente", SAFETY: "Seguridad y salud", SECURITY: "Seguridad de la información",
};
const DISCIPLINE_COLOR: Record<string, string> = {
  QUALITY: "var(--nf-primary-active)", ENVIRONMENT: "var(--nf-primary-active)", SAFETY: "var(--nf-warning-text)", SECURITY: "var(--nf-success-text)",
};
const KIND_LABEL: Record<string, string> = {
  EQUIVALENT: "Equivalente", PARTIAL: "Parcialmente equivalente", SPECIFIC: "Específico",
};
const KIND_COLOR: Record<string, string> = { EQUIVALENT: "var(--nf-success-text)", PARTIAL: "var(--nf-warning-text)", SPECIFIC: "var(--nf-primary-active)" };

const card: React.CSSProperties = { border: "1px solid var(--nf-line)", borderRadius: 14, padding: 18, background: "var(--nf-surface)" };
const chip = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, display: "inline-block" });
const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 11px", border: "1px solid var(--nf-line)", borderRadius: 9, fontSize: 13, fontFamily: "inherit" };
const primaryBtn: React.CSSProperties = { background: "var(--nf-primary)", color: "var(--nf-text-on-primary)", border: "none", borderRadius: 9, padding: "8px 15px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" };
const ghostBtn: React.CSSProperties = { background: "var(--nf-surface)", color: "var(--nf-primary-active)", border: "1px solid #cdd6f8", borderRadius: 9, padding: "7px 13px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" };
const dangerBtn: React.CSSProperties = { background: "none", color: "var(--nf-danger-text)", border: "1px solid #f2c4c4", borderRadius: 8, padding: "4px 9px", fontWeight: 700, fontSize: 11.5, cursor: "pointer" };

export default function IntegratedClient({ initial, demo = false }: { initial: IntegratedPayload; demo?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useModuleSection<Tab>("panel");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const canManage = initial.canManage && !demo;
  const canUpdate = initial.canUpdate && !demo;

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
        window.dispatchEvent(new Event("normaflow:server-action-success"));
      } catch (e) {
        const message = e instanceof Error ? e.message : "Error inesperado.";
        setError(message);
        window.dispatchEvent(new CustomEvent("normaflow:server-action-error", { detail: { message } }));
      }
    });
  }

  return (
    <div className="nf-iso-module" style={{ padding: "clamp(16px, 3vw, 32px)", maxWidth: 1240, margin: "0 auto" }}>
      <IsoSectionHeader headingLevel={1} icon={Layers} title={SECTION_META[tab].title}
        description={`${SECTION_META[tab].sub}${demo ? " Vista demo (solo lectura)." : ""}`} />

      {error && <div role="alert" style={{ ...card, borderColor: "#f2b8b8", background: "var(--nf-danger-subtle)", color: "var(--nf-danger-text)", marginBottom: 16 }}>{error}</div>}

      {tab !== "panel" && <IsoSectionMetrics items={tab === "scope" ? [{ label: "Normas activas", value: initial.activeStandards.length }, { label: "Requisitos", value: initial.summary.requirements }, { label: "Cobertura global", value: initial.globalScore, suffix: "%" }] : tab === "parties" ? [{ label: "Partes interesadas", value: initial.interestedParties.length }, { label: "Relevantes", value: initial.interestedParties.filter((row) => row.isRelevant).length }, { label: "Normas activas", value: initial.activeStandards.length }] : tab === "objectives" ? [{ label: "Objetivos", value: initial.objectives.length }, { label: "Compartidos", value: initial.objectives.filter((row) => row.shared).length }, { label: "Vencidos", value: initial.objectives.filter((row) => row.dueDate && new Date(row.dueDate) < new Date() && row.status !== "ACHIEVED").length, accent: "var(--nf-danger-text)" }] : tab === "crosswalk" ? [{ label: "Correspondencias", value: initial.crosswalk.length }, { label: "Equivalentes", value: initial.summary.equivalent }, { label: "Sin evidencia", value: initial.summary.missingEvidence, accent: initial.summary.missingEvidence ? "var(--nf-danger-text)" : undefined }] : tab === "audit" ? [{ label: "Auditorías integradas", value: initial.integratedAuditCount }, { label: "Hallazgos multinorma", value: initial.multiNormFindings.length, accent: initial.multiNormFindings.length ? "var(--nf-warning-text)" : undefined }, { label: "CAPA abiertas", value: initial.summary.openCapas, accent: initial.summary.openCapas ? "var(--nf-danger-text)" : undefined }] : [{ label: "Elementos compartidos", value: initial.summary.sharedElements }, { label: "Riesgos críticos", value: initial.summary.criticalRisks, accent: initial.summary.criticalRisks ? "var(--nf-danger-text)" : undefined }, { label: "Proveedores", value: initial.suppliers.length }]} />}

      {tab === "panel" && <PanelTab p={initial} />}
      {tab === "scope" && <ScopeTab p={initial} canUpdate={canUpdate} pending={pending} run={run} />}
      {tab === "parties" && <PartiesTab p={initial} canManage={canManage} pending={pending} run={run} />}
      {tab === "objectives" && <ObjectivesTab p={initial} canManage={canManage} pending={pending} run={run} />}
      {tab === "crosswalk" && <CrosswalkTab p={initial} canUpdate={canUpdate} pending={pending} run={run} />}
      {tab === "audit" && <AuditTab p={initial} canUpdate={canUpdate} canManage={canManage} pending={pending} run={run} />}
      {tab === "shared" && <SharedTab p={initial} />}
    </div>
  );
}

/* ─── PANEL INTEGRADO (dashboard) ─────────────────── */
function PanelTab({ p }: { p: IntegratedPayload }) {
  const s = p.summary;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* La cobertura por norma ya estaba calculada: el panel la resumía en un
          único porcentaje global que escondía qué norma va rezagada. */}
      <BarChart
        title="Cobertura por norma"
        subtitle="Porcentaje de requisitos cubiertos en cada norma activa del sistema integrado."
        max={100}
        unit="%"
        data={p.activeStandards
          .filter((standard): standard is typeof standard & { score: number } => standard.score != null)
          .map((standard) => ({
            label: `${standard.familyCode.replace("_", " ")}:${standard.editionCode}`,
            value: standard.score,
          }))}
        /* Una norma sin evaluación GAP no entra en el gráfico: dibujarla al 0%
           diría que no cumple nada, cuando lo que pasa es que nadie la ha
           medido todavía. */
        empty="Ninguna norma activa tiene evaluación de cobertura todavía."
        action={{ label: "Abrir el motor de normas", href: "/app/standards" }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 12 }}>
        <Stat label="Cumplimiento global" value={`${p.globalScore}%`} accent="var(--nf-primary)" />
        <Stat label="Grado de integración" value={`${p.integrationRate}%`} sub="requisitos compartidos" accent="var(--nf-success)" />
        <Stat label="Factor de reutilización" value={`${p.reuseFactor}×`} sub="requisitos por elemento" accent="var(--nf-primary-active)" />
        <Stat label="Normas activas" value={String(s.standards)} />
        <Stat label="Evidencias faltantes" value={String(s.missingEvidence)} accent={s.missingEvidence ? "var(--nf-danger-text)" : undefined} />
      </div>

      <section style={card}>
        <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, margin: "0 0 12px" }}><ClipboardCheck size={16} aria-hidden />Cumplimiento por norma</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {p.compliance.map((c) => (
            <div key={c.familyCode}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                <span><strong>{c.familyCode.replace("_", " ")}</strong> <span style={toneChip(DISCIPLINE_COLOR[c.discipline])}>{DISCIPLINE_LABEL[c.discipline]}</span></span>
                <span style={{ color: "var(--nf-ink-2)" }}>{c.score}% · {c.covered}/{c.total} con evidencia</span>
              </div>
              <Bar pct={c.score} color={DISCIPLINE_COLOR[c.discipline]} />
            </div>
          ))}
          {!p.compliance.length && <Empty text="Activa las normas del sistema para ver el cumplimiento." />}
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
        <section style={card}>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, margin: "0 0 10px" }}><GitCompareArrows size={16} aria-hidden />Requisitos comunes vs específicos</h3>
          <Row label="Equivalentes" value={s.equivalent} color="var(--nf-success-text)" />
          <Row label="Parcialmente equivalentes" value={s.partial} color="var(--nf-warning-text)" />
          <Row label="Específicos de una norma" value={s.specific} color="var(--nf-primary-active)" />
          <p style={{ fontSize: 11.5, color: "var(--nf-ink-3)", marginTop: 10, marginBottom: 0 }}>
            Los requisitos equivalentes se cubren una sola vez para todas las normas.
          </p>
        </section>
        <section style={card}>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, margin: "0 0 10px" }}><ClipboardCheck size={16} aria-hidden />Acciones y auditorías</h3>
          <Row label="CAPA abiertas" value={s.openCapas} color="var(--nf-danger-text)" />
          <Row label="Auditorías integradas" value={s.integratedAudits} color="var(--nf-primary-active)" />
          <Row label="Hallazgos multi-norma" value={p.multiNormFindings.length} color="var(--nf-warning-text)" />
        </section>
        <section style={card}>
          <h3 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, margin: "0 0 10px" }}><ShieldAlert size={16} aria-hidden />Riesgos críticos por disciplina</h3>
          {(["QUALITY", "ENVIRONMENT", "SAFETY"] as const).map((d) => (
            <Row key={d} label={DISCIPLINE_LABEL[d]}
              value={p.risks.filter((r) => r.score >= 15 && r.disciplines.includes(d)).length}
              color={DISCIPLINE_COLOR[d]} />
          ))}
          <Row label="Total críticos" value={s.criticalRisks} color="var(--nf-danger-text)" />
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
        <p style={{ fontSize: 12.5, color: "var(--nf-ink-2)", margin: "0 0 12px" }}>
          Un solo alcance para las tres normas; cada una puede añadir su nota y exclusiones.
        </p>
        <label style={{ fontSize: 12, fontWeight: 700 }}>Alcance</label>
        <textarea aria-label="Alcance" value={scope} onChange={(e) => setScope(e.target.value)} disabled={!canUpdate} rows={3} style={{ ...input, marginBottom: 10 }} />
        <label style={{ fontSize: 12, fontWeight: 700 }}>Exclusiones justificadas</label>
        <textarea aria-label="Exclusiones" value={exclusions} onChange={(e) => setExclusions(e.target.value)} disabled={!canUpdate} rows={2} style={{ ...input, marginBottom: 10 }} />
        <label style={{ fontSize: 12, fontWeight: 700 }}>Límites físicos y organizacionales</label>
        <textarea aria-label="Límites" value={boundaries} onChange={(e) => setBoundaries(e.target.value)} disabled={!canUpdate} rows={2} style={{ ...input, marginBottom: 10 }} />
        <label style={{ fontSize: 12, fontWeight: 700 }}>Cuestiones internas y externas (contexto común 4.1)</label>
        <textarea aria-label="Notas de contexto" value={contextNotes} onChange={(e) => setContextNotes(e.target.value)} disabled={!canUpdate} rows={3} style={input} />
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>Política integrada</h2>
        <p style={{ fontSize: 12.5, color: "var(--nf-ink-2)", margin: "0 0 12px" }}>
          Documento único que declara el compromiso de calidad, ambiente y SST.
          {p.system?.policyApprovedAt && <> · Aprobada el {formatDate(p.system.policyApprovedAt)} por {p.system.policyApprovedByName ?? "—"}.</>}
        </p>
        <textarea aria-label="Política" value={policy} onChange={(e) => setPolicy(e.target.value)} disabled={!canUpdate} rows={8} style={input} />
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: p.activeStandards.length ? 14 : 0 }}>
          {p.activeStandards.map((s) => (
            <span key={s.editionId} style={toneChip(DISCIPLINE_COLOR[s.discipline])}>
              {s.familyCode.replace("_", " ")}:{s.editionCode} · {DISCIPLINE_LABEL[s.discipline]}
            </span>
          ))}
          {!p.activeStandards.length && <Empty text="No hay normas activas." />}
        </div>
        {p.activeStandards.length > 0 && (
          <div style={{ display: "grid", gap: 10 }}>
            {p.activeStandards.map((s) => (
              <SystemStandardRow key={s.editionId} standard={s} entry={p.system?.standards.find((x) => x.standardCode === s.familyCode) ?? null}
                members={p.members} canUpdate={canUpdate} pending={pending} run={run} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Fila editable: alcance/exclusiones/responsable de una norma dentro del SIG (upsertSystemStandard). */
function SystemStandardRow({ standard, entry, members, canUpdate, pending, run }: {
  standard: IntegratedPayload["activeStandards"][number];
  entry: NonNullable<IntegratedPayload["system"]>["standards"][number] | null;
  members: IntegratedPayload["members"];
  canUpdate: boolean; pending: boolean; run: (fn: () => Promise<unknown>) => void;
}) {
  const [scopeNote, setScopeNote] = useState(entry?.scopeNote ?? "");
  const [exclusions, setExclusions] = useState(entry?.exclusions ?? "");
  const [responsibleId, setResponsibleId] = useState(entry?.responsibleId ?? "");

  return (
    <div style={{ border: "1px solid var(--nf-line)", borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={toneChip(DISCIPLINE_COLOR[standard.discipline])}>{standard.familyCode.replace("_", " ")}</span>
        {canUpdate && (
          <button disabled={pending} style={ghostBtn}
            onClick={() => run(() => upsertSystemStandard({
              standardCode: standard.familyCode, discipline: standard.discipline as "QUALITY" | "ENVIRONMENT" | "SAFETY" | "SECURITY",
              scopeNote: scopeNote || null, exclusions: exclusions || null, responsibleId: responsibleId || null,
            }))}>Guardar</button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
        <input aria-label="Nota de alcance específica" placeholder="Nota de alcance específica" value={scopeNote} onChange={(e) => setScopeNote(e.target.value)} disabled={!canUpdate} style={input} />
        <input aria-label="Exclusiones de esta norma" placeholder="Exclusiones de esta norma" value={exclusions} onChange={(e) => setExclusions(e.target.value)} disabled={!canUpdate} style={input} />
        <PersonPicker people={members} value={responsibleId} onValueChange={(personId) => setResponsibleId(personId)} placeholder="Responsable sin asignar" ariaLabel="Responsable sin asignar" style={input} />
      </div>
    </div>
  );
}

/* ─── PARTES INTERESADAS ──────────────────────────── */
function PartiesTab({ p, canManage, pending, run }: { p: IntegratedPayload; canManage: boolean; pending: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [needs, setNeeds] = useState("");
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [partyToDelete, setPartyToDelete] = useState<IntegratedPayload["interestedParties"][number] | null>(null);

  const toggle = (d: string) => setDisciplines((c) => c.includes(d) ? c.filter((x) => x !== d) : [...c, d]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {canManage && (
        <>
          <button type="button" style={primaryBtn} onClick={() => setCreating(true)}>Nueva parte interesada</button>
          <Modal open={creating} onClose={() => setCreating(false)} title="Nueva parte interesada" width={640}>
            <div className="nf-modal-form nf-iso-create-form">
              <ModalError />
              <div className="nf-iso-create-fields" style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
                <input aria-label="Nombre" required placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} style={input} />
                <input aria-label="Tipo (cliente, trabajador…)" placeholder="Tipo (cliente, trabajador…)" value={type} onChange={(e) => setType(e.target.value)} style={input} />
                <input aria-label="Necesidades y expectativas" placeholder="Necesidades y expectativas" value={needs} onChange={(e) => setNeeds(e.target.value)} style={input} />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["QUALITY", "ENVIRONMENT", "SAFETY"].map((d) => (
                  <button type="button" key={d} onClick={() => toggle(d)} style={{
                    ...ghostBtn, background: disciplines.includes(d) ? DISCIPLINE_COLOR[d] : "var(--nf-surface)",
                    color: disciplines.includes(d) ? "#fff" : DISCIPLINE_COLOR[d], borderColor: DISCIPLINE_COLOR[d],
                  }}>{DISCIPLINE_LABEL[d]}</button>
                ))}
              </div>
              </div>
              <div className="nf-modal-actions nf-iso-create-form-actions">
                <button type="button" style={ghostBtn} onClick={() => setCreating(false)}>Cancelar</button>
                <button disabled={pending || !name.trim()} style={primaryBtn}
                  onClick={() => run(async () => {
                    await createInterestedParty({ name, type: type || null, needs: needs || null, disciplines: disciplines as never[] });
                    setName(""); setType(""); setNeeds(""); setDisciplines([]); setCreating(false);
                  })}>Añadir</button>
              </div>
            </div>
          </Modal>
        </>
      )}
      <Table
        head={["Código", "Parte interesada", "Tipo", "Necesidades", "Disciplinas", canManage ? "Acciones" : null]}
        rows={p.interestedParties.map((party) => [
          <strong key="c">{party.code}</strong>,
          party.name,
          party.type ?? "—",
          <span key="n" style={{ color: "var(--nf-ink-2)" }}>{party.needs ?? "—"}</span>,
          <span key="d" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {party.disciplines.length
              ? party.disciplines.map((d) => <span key={d} style={toneChip(DISCIPLINE_COLOR[d])}>{DISCIPLINE_LABEL[d]}</span>)
              : <span style={chip("var(--nf-surface-muted)", "var(--nf-text-secondary)")}>Todas</span>}
          </span>,
          canManage ? <span key="x"><EditPartyButton party={party} pending={pending} run={run} /><button type="button" style={dangerBtn} disabled={pending} onClick={() => setPartyToDelete(party)}>Eliminar</button></span> : null,
        ])}
        empty="Aún no hay partes interesadas registradas."
      />
      {partyToDelete && <ConfirmActionModal open title="Eliminar parte interesada" confirmLabel="Eliminar" danger pending={pending} onCancel={() => setPartyToDelete(null)} onConfirm={() => run(async () => { await deleteInterestedParty(partyToDelete.id); setPartyToDelete(null); })}>
        Se eliminará “{partyToDelete.name}”. Esta operación no se puede deshacer.
      </ConfirmActionModal>}
    </div>
  );
}

/* ─── OBJETIVOS ───────────────────────────────────── */
function ObjectivesTab({ p, canManage, pending, run }: { p: IntegratedPayload; canManage: boolean; pending: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [objectiveToDelete, setObjectiveToDelete] = useState<IntegratedPayload["objectives"][number] | null>(null);
  const toggle = (d: string) => setDisciplines((c) => c.includes(d) ? c.filter((x) => x !== d) : [...c, d]);
  const shared = p.objectives.filter((o) => o.shared).length;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        <Stat label="Objetivos totales" value={String(p.objectives.length)} />
        <Stat label="Compartidos (multi-disciplina)" value={String(shared)} accent="var(--nf-success)" />
        <Stat label="Logrados" value={String(p.objectives.filter((o) => o.status === "ACHIEVED").length)} />
      </div>
      {canManage && (
        <>
          <button type="button" style={primaryBtn} onClick={() => setCreating(true)}>Nuevo objetivo</button>
          <Modal open={creating} onClose={() => setCreating(false)} title="Nuevo objetivo" width={640}>
            <div className="nf-modal-form nf-iso-create-form">
              <ModalError />
              <div className="nf-iso-create-fields" style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                <input aria-label="Objetivo" required placeholder="Objetivo" value={title} onChange={(e) => setTitle(e.target.value)} style={input} />
                <input aria-label="Meta" placeholder="Meta" value={target} onChange={(e) => setTarget(e.target.value)} style={input} />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["QUALITY", "ENVIRONMENT", "SAFETY"].map((d) => (
                  <button type="button" key={d} onClick={() => toggle(d)} style={{
                    ...ghostBtn, background: disciplines.includes(d) ? DISCIPLINE_COLOR[d] : "var(--nf-surface)",
                    color: disciplines.includes(d) ? "#fff" : DISCIPLINE_COLOR[d], borderColor: DISCIPLINE_COLOR[d],
                  }}>{DISCIPLINE_LABEL[d]}</button>
                ))}
              </div>
              </div>
              <div className="nf-modal-actions nf-iso-create-form-actions">
                <button type="button" style={ghostBtn} onClick={() => setCreating(false)}>Cancelar</button>
                <button disabled={pending || !title.trim()} style={primaryBtn}
                  onClick={() => run(async () => {
                    await createIntegratedObjective({ title, target: target || null, disciplines: disciplines as never[] });
                    setTitle(""); setTarget(""); setDisciplines([]); setCreating(false);
                  })}>Añadir objetivo</button>
              </div>
            </div>
          </Modal>
        </>
      )}
      <Table
        head={["Código", "Objetivo", "Meta", "Disciplinas", "Estado", canManage ? "Acciones" : null]}
        rows={p.objectives.map((o) => [
          <strong key="c">{o.code}</strong>,
          <span key="t">{o.title}{o.shared && <span style={{ ...chip("#eafaf0", "var(--nf-success)"), marginLeft: 7 }}>compartido</span>}</span>,
          o.target ?? "—",
          <span key="d" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {o.disciplines.map((d) => <span key={d} style={toneChip(DISCIPLINE_COLOR[d])}>{DISCIPLINE_LABEL[d]}</span>)}
          </span>,
          <span key="s" style={chip("#eef1fe", "var(--nf-primary)")}>{o.status}</span>,
          canManage ? <span key="x"><EditObjectiveButton objective={o} pending={pending} run={run} /><button type="button" style={dangerBtn} disabled={pending} onClick={() => setObjectiveToDelete(o)}>Eliminar</button></span> : null,
        ])}
        empty="Aún no hay objetivos definidos."
      />
      {objectiveToDelete && <ConfirmActionModal open title="Eliminar objetivo integrado" confirmLabel="Eliminar" danger pending={pending} onCancel={() => setObjectiveToDelete(null)} onConfirm={() => run(async () => { await deleteIntegratedObjective(objectiveToDelete.id); setObjectiveToDelete(null); })}>
        Se eliminará “{objectiveToDelete.title}”. Esta operación no se puede deshacer.
      </ConfirmActionModal>}
    </div>
  );
}

function EditPartyButton({ party, pending, run }: { party: IntegratedPayload["interestedParties"][number]; pending: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(party.name);
  const [type, setType] = useState(party.type ?? "");
  const [needs, setNeeds] = useState(party.needs ?? "");
  return <>
    <button type="button" style={ghostBtn} onClick={() => setOpen(true)}>Editar</button>
    <Modal open={open} onClose={() => setOpen(false)} title={`Editar ${party.code}`} width={640}>
      <div className="nf-modal-form nf-iso-edit-form">
        <ModalError />
        <div className="nf-iso-edit-fields" style={{ display: "grid", gap: 12 }}>
        <input aria-label="Nombre" required placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} style={input} />
        <input aria-label="Tipo" placeholder="Tipo" value={type} onChange={(e) => setType(e.target.value)} style={input} />
        <textarea aria-label="Necesidades y expectativas" placeholder="Necesidades y expectativas" value={needs} onChange={(e) => setNeeds(e.target.value)} style={input} rows={4} />
        </div>
        <div className="nf-modal-actions nf-iso-edit-form-actions">
          <button type="button" style={ghostBtn} onClick={() => setOpen(false)}>Cancelar</button>
          <button type="button" style={primaryBtn} disabled={pending || !name.trim()} onClick={() => run(async () => {
            await updateInterestedParty(party.id, { name, type: type || null, needs: needs || null });
            setOpen(false);
          })}>Guardar</button>
        </div>
      </div>
    </Modal>
  </>;
}

function EditObjectiveButton({ objective, pending, run }: { objective: IntegratedPayload["objectives"][number]; pending: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(objective.title);
  const [target, setTarget] = useState(objective.target ?? "");
  return <>
    <button type="button" style={ghostBtn} onClick={() => setOpen(true)}>Editar</button>
    <Modal open={open} onClose={() => setOpen(false)} title={`Editar ${objective.code}`} width={600}>
      <div className="nf-modal-form nf-iso-edit-form">
        <ModalError />
        <div className="nf-iso-edit-fields" style={{ display: "grid", gap: 12 }}>
        <input aria-label="Objetivo" required placeholder="Objetivo" value={title} onChange={(e) => setTitle(e.target.value)} style={input} />
        <input aria-label="Meta" placeholder="Meta" value={target} onChange={(e) => setTarget(e.target.value)} style={input} />
        </div>
        <div className="nf-modal-actions nf-iso-edit-form-actions">
          <button type="button" style={ghostBtn} onClick={() => setOpen(false)}>Cancelar</button>
          <button type="button" style={primaryBtn} disabled={pending || !title.trim()} onClick={() => run(async () => {
            await updateIntegratedObjective(objective.id, { title, target: target || null });
            setOpen(false);
          })}>Guardar</button>
        </div>
      </div>
    </Modal>
  </>;
}

/* ─── MATRIZ DE CORRESPONDENCIA (CROSSWALK) ───────── */
function CrosswalkTab({ p, canUpdate, pending, run }: { p: IntegratedPayload; canUpdate: boolean; pending: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const [family, setFamily] = useState("");
  const [kind, setKind] = useState("");
  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [onlyNotShareable, setOnlyNotShareable] = useState(false);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return p.crosswalk.filter((r) =>
      (!family || r.familyCode === family) &&
      (!kind || r.kind === kind) &&
      (!onlyMissing || r.coverageCount === 0) &&
      (!onlyNotShareable || !r.shareable) &&
      (!normalizedQuery || [r.familyCode, r.code, r.title, ...r.related.map((rel) => `${rel.familyCode} ${rel.code}`)].join(" ").toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [p.crosswalk, family, kind, onlyMissing, onlyNotShareable, query]);

  const families = [...new Set(p.crosswalk.map((r) => r.familyCode))];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="nf-iso-table-card-filters" style={{ border: 0, padding: 0 }}>
        <label className="nf-iso-table-search" style={{ marginLeft: "auto" }}>
          <Search size={15} aria-hidden />
          <span className="sr-only">Buscar en correspondencias</span>
          <input className="nf-app-input nf-app-input--toolbar" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar requisito, norma o código…" />
          {query && <button type="button" className="nf-iso-table-search-clear" onClick={() => setQuery("")} aria-label="Limpiar búsqueda"><X size={14} aria-hidden /></button>}
        </label>
        <div style={{ display: "flex", gap: 10, flex: "1 1 100%", flexWrap: "wrap", alignItems: "center" }}>
        <Picker aria-label="Familia" value={family} onChange={(e) => setFamily(e.target.value)} style={{ ...input, maxWidth: 190 }}>
          <option value="">Todas las normas</option>
          {families.map((f) => <option key={f} value={f}>{f.replace("_", " ")}</option>)}
        </Picker>
        <Picker aria-label="Tipo" value={kind} onChange={(e) => setKind(e.target.value)} style={{ ...input, maxWidth: 220 }}>
          <option value="">Todos los tipos</option>
          <option value="EQUIVALENT">Equivalente</option>
          <option value="PARTIAL">Parcialmente equivalente</option>
          <option value="SPECIFIC">Específico</option>
        </Picker>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--nf-ink-2)" }}>
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> Solo sin evidencia
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--nf-ink-2)" }}>
          <input type="checkbox" checked={onlyNotShareable} onChange={(e) => setOnlyNotShareable(e.target.checked)} /> Solo no compartibles
        </label>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--nf-ink-3)" }}>{rows.length} requisitos</span>
        </div>
      </div>

      <IsoTableCard
        icon={GitCompareArrows}
        title="Matriz de correspondencias"
        description="Relaciona requisitos equivalentes, evidencia compartida y responsables entre las normas activas."
        searchable={false}
        headers={["Norma", "Requisito", "Tipo", "Compartible", "Correspondencias", "Documento compartido", "Evidencia compartida", "Responsable"]}
        exportName="correspondencias-integradas"
      >
            {rows.map((r) => (
              <tr key={r.requirementId}>
                <td><span style={chip("#eef1fe", "var(--nf-primary)")}>{r.familyCode.replace("_", " ")}</span></td>
                <td><strong>{r.code}</strong> {r.title}</td>
                <td><span style={toneChip(KIND_COLOR[r.kind])}>{KIND_LABEL[r.kind]}</span></td>
                <td>
                  {r.shareable
                    ? <span style={chip("#eafaf0", "var(--nf-success)")}>Compartible</span>
                    : <span style={chip("#fdf3f3", "var(--nf-danger-text)")}>No compartible</span>}
                </td>
                <td>
                  {r.related.length ? r.related.map((rel) => (
                    <div key={rel.requirementId} style={{ fontSize: 11.5 }}>
                      {rel.familyCode.replace("_", " ")} <strong>{rel.code}</strong>
                      <span style={{ color: "var(--nf-ink-3)" }}> · {rel.relationType === "EQUIVALENT" ? "equiv." : "parcial"}{rel.equivalencePercent != null && ` ${rel.equivalencePercent}%`}</span>
                    </div>
                  )) : <span style={{ color: "var(--nf-ink-3)" }}>— específico</span>}
                </td>
                <td>{r.sharedDocuments.length ? r.sharedDocuments.join(", ") : <span style={{ color: "var(--nf-ink-3)" }}>—</span>}</td>
                <td>{r.sharedEvidence.length ? r.sharedEvidence.join(", ") : <span style={{ color: "var(--nf-danger-text)" }}>falta</span>}</td>
                <td>
                  {canUpdate ? (
                    <PersonPicker people={p.members} value={r.responsibleId ?? ""} onValueChange={(personId) => run(() => assignRequirementOwner({ requirementId: r.requirementId, responsibleId: personId || null }))} placeholder="Sin asignar" style={{ ...input, padding: "5px 7px", fontSize: 12, minWidth: 130 }} />
                  ) : (r.responsibleName ?? "—")}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8}>No hay requisitos para los filtros seleccionados.</td></tr>}
      </IsoTableCard>
      <p style={{ fontSize: 11.5, color: "var(--nf-ink-3)", margin: 0 }}>
        Los requisitos <strong>equivalentes</strong> se satisfacen una sola vez: el mismo documento o evidencia
        cubre la cláusula en todas las normas correspondientes.
      </p>
    </div>
  );
}

/* ─── AUDITORÍA INTEGRADA Y ASIGNACIONES MULTI-NORMA ── */
function AuditTab({ p, canUpdate, canManage, pending, run }: {
  p: IntegratedPayload; canUpdate: boolean; canManage: boolean; pending: boolean; run: (fn: () => Promise<unknown>) => void;
}) {
  const standardOptions = [...new Set(p.activeStandards.map((s) => s.familyCode))];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        <Stat label="Auditorías integradas" value={String(p.integratedAuditCount)} accent="var(--nf-primary)" />
        <Stat label="Hallazgos multi-norma" value={String(p.multiNormFindings.length)} accent="var(--nf-warning-text)" />
        <Stat label="CAPA compartidas" value={String(p.capas.filter((c) => c.shared).length)} accent="var(--nf-success)" />
        <Stat label="Revisiones integradas" value={String(p.reviews.filter((r) => r.integrated).length)} />
      </div>

      <section>
        <h3 style={{ fontSize: 14, margin: "0 0 6px" }}>Auditorías — marca las normas que cubre cada una</h3>
        <p style={{ fontSize: 11.5, color: "var(--nf-ink-3)", margin: "0 0 10px" }}>Dos o más normas convierten la auditoría en integrada automáticamente.</p>
        <Table
          head={["Auditoría", "Normas", "Estado", "Hallazgos", "Multi-norma"]}
          rows={p.audits.map((a) => [
            <span key="t">{a.title}{a.integrated && <span style={{ ...chip("#eef1fe", "var(--nf-primary)"), marginLeft: 7 }}>integrada</span>}</span>,
            <StandardsToggle key="s" value={a.standards} options={standardOptions} disabled={!canUpdate || pending}
              onChange={(next) => run(() => setAuditStandards({ auditId: a.id, standards: next }))} />,
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
            <StandardsToggle key="s" value={f.standards} options={standardOptions} disabled={!canUpdate || pending}
              onChange={(next) => run(() => setFindingStandards({ findingId: f.id, standards: next }))} />,
          ])}
          empty="No hay hallazgos que afecten a varias normas."
        />
      </section>

      <section>
        <h3 style={{ fontSize: 14, margin: "0 0 10px" }}>CAPA — una sola acción correctiva puede cubrir varias normas</h3>
        <Table
          head={["Código", "Título", "Etapa", "Normas cubiertas"]}
          rows={p.capas.slice(0, 30).map((c) => [
            <strong key="c">{c.code}</strong>, c.title, c.stage,
            <StandardsToggle key="s" value={c.standards} options={standardOptions} disabled={!canUpdate || pending}
              onChange={(next) => run(() => setCapaStandards({ capaId: c.id, standards: next }))} />,
          ])}
          empty="No hay CAPA registradas todavía."
        />
      </section>

      <section>
        <h3 style={{ fontSize: 14, margin: "0 0 10px" }}>Riesgos por disciplina — un riesgo puede pertenecer a varias</h3>
        <Table
          head={["Riesgo", "Categoría", "Puntaje", "Disciplinas"]}
          rows={p.risks.slice(0, 20).map((r) => [
            r.title, r.category ?? "—", String(r.score),
            <DisciplinesToggle key="d" value={r.disciplines} disabled={!canUpdate || pending}
              onChange={(next) => run(() => setRiskDisciplines({ riskId: r.id, disciplines: next as never[] }))} />,
          ])}
          empty="No hay riesgos registrados."
        />
      </section>

      <section>
        <h3 style={{ fontSize: 14, margin: "0 0 10px" }}>Cambios con impacto múltiple</h3>
        <Table
          head={["Código", "Cambio", "Estado", "Disciplinas"]}
          rows={p.changeRequests.map((c) => [
            <strong key="c">{c.code}</strong>, c.title, c.status,
            <DisciplinesToggle key="d" value={c.disciplines} disabled={!canUpdate || pending}
              onChange={(next) => run(() => setChangeDisciplines({ changeRequestId: c.id, disciplines: next as never[] }))} />,
          ])}
          empty="No hay solicitudes de cambio registradas."
        />
      </section>

      <section>
        <h3 style={{ fontSize: 14, margin: "0 0 10px" }}>Revisión por la dirección integrada</h3>
        <Table
          head={["Revisión", "Estado", "Normas cubiertas"]}
          rows={p.reviews.map((r) => [
            <span key="t">{r.title}{r.integrated && <span style={{ ...chip("#eef1fe", "var(--nf-primary)"), marginLeft: 7 }}>integrada</span>}</span>,
            r.status,
            <StandardsToggle key="s" value={r.standards} options={standardOptions} disabled={!canUpdate || pending}
              onChange={(next) => run(() => setReviewStandards({ reviewId: r.id, standards: next }))} />,
          ])}
          empty="No hay revisiones por la dirección registradas."
        />
      </section>

      <SupplierIntegratedSection p={p} canManage={canManage} pending={pending} run={run} />
    </div>
  );
}

/** Evaluación de proveedor con las tres dimensiones (calidad/ambiente/SST) en un solo registro. */
function SupplierIntegratedSection({ p, canManage, pending, run }: {
  p: IntegratedPayload; canManage: boolean; pending: boolean; run: (fn: () => Promise<unknown>) => void;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [qualityScore, setQualityScore] = useState("");
  const [environmentScore, setEnvironmentScore] = useState("");
  const [safetyScore, setSafetyScore] = useState("");
  const scores = [qualityScore, environmentScore, safetyScore].filter(Boolean).map(Number);
  const scoresValid = scores.length > 0 && scores.every((score) => Number.isFinite(score) && score >= 0 && score <= 100);

  return (
    <section>
      <h3 style={{ fontSize: 14, margin: "0 0 6px" }}>Proveedores integrados — una evaluación, tres dimensiones</h3>
      <p style={{ fontSize: 11.5, color: "var(--nf-ink-3)", margin: "0 0 10px" }}>
        Informa al menos una dimensión; la nota global es la media de las informadas.
      </p>
      {canManage && (
        <section style={{ ...card, background: "var(--nf-surface-muted)", marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
            <Picker aria-label="Selecciona proveedor" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} style={input}>
              <option value="">Selecciona proveedor…</option>
              {p.suppliers.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
            </Picker>
            <input aria-label="Calidad (0-100)" type="number" min={0} max={100} step="0.1" placeholder="Calidad (0-100)" value={qualityScore} onChange={(e) => setQualityScore(e.target.value)} style={input} />
            <input aria-label="Ambiente (0-100)" type="number" min={0} max={100} step="0.1" placeholder="Ambiente (0-100)" value={environmentScore} onChange={(e) => setEnvironmentScore(e.target.value)} style={input} />
            <input aria-label="SST (0-100)" type="number" min={0} max={100} step="0.1" placeholder="SST (0-100)" value={safetyScore} onChange={(e) => setSafetyScore(e.target.value)} style={input} />
          </div>
          <button disabled={pending || !supplierId || !scoresValid} style={{ ...primaryBtn, marginTop: 10 }}
            onClick={() => run(async () => {
              await evaluateSupplierIntegrated({
                supplierId,
                qualityScore: qualityScore ? Number(qualityScore) : null,
                environmentScore: environmentScore ? Number(environmentScore) : null,
                safetyScore: safetyScore ? Number(safetyScore) : null,
              });
              setSupplierId(""); setQualityScore(""); setEnvironmentScore(""); setSafetyScore("");
            })}>Evaluar</button>
        </section>
      )}
      <Table
        head={["Proveedor", "Última evaluación", "Nota", "Dimensiones"]}
        rows={p.suppliers.filter((s) => s.lastEvaluationAt).map((s) => [
          <span key="n">{s.code} · {s.name}</span>,
          s.lastEvaluationAt ? formatDate(s.lastEvaluationAt) : "—",
          s.lastScore != null ? String(s.lastScore) : "—",
          <span key="d" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {s.lastDisciplines.map((d) => <span key={d} style={toneChip(DISCIPLINE_COLOR[d])}>{DISCIPLINE_LABEL[d]}</span>)}
          </span>,
        ])}
        empty="Aún no hay proveedores evaluados con criterio integrado."
      />
    </section>
  );
}

/** Multi-toggle de normas (códigos de familia) — dispara la acción al cambiar. */
function StandardsToggle({ value, options, disabled, onChange }: { value: string[]; options: string[]; disabled: boolean; onChange: (next: string[]) => void }) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {options.map((code) => {
        const active = value.includes(code);
        return (
          <button key={code} type="button" disabled={disabled}
            onClick={() => onChange(active ? value.filter((c) => c !== code) : [...value, code])}
            style={{ ...ghostBtn, padding: "3px 8px", fontSize: 11, background: active ? "var(--nf-primary)" : "var(--nf-surface)", color: active ? "#fff" : "var(--nf-primary-active)", borderColor: "var(--nf-primary)" }}>
            {code.replace("_", " ")}
          </button>
        );
      })}
      {!options.length && <span style={{ fontSize: 11.5, color: "var(--nf-ink-3)" }}>Sin normas activas</span>}
    </div>
  );
}

/** Multi-toggle de disciplinas (QUALITY/ENVIRONMENT/SAFETY) — dispara la acción al cambiar. */
function DisciplinesToggle({ value, disabled, onChange }: { value: string[]; disabled: boolean; onChange: (next: string[]) => void }) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {(["QUALITY", "ENVIRONMENT", "SAFETY"] as const).map((d) => {
        const active = value.includes(d);
        return (
          <button key={d} type="button" disabled={disabled}
            onClick={() => onChange(active ? value.filter((c) => c !== d) : [...value, d])}
            style={{ ...ghostBtn, padding: "3px 8px", fontSize: 11, background: active ? DISCIPLINE_COLOR[d] : "var(--nf-surface)", color: active ? "#fff" : DISCIPLINE_COLOR[d], borderColor: DISCIPLINE_COLOR[d] }}>
            {DISCIPLINE_LABEL[d]}
          </button>
        );
      })}
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
      <section style={{ ...card, background: "var(--nf-surface-muted)", borderColor: "var(--nf-border)" }}>
        <strong style={{ color: "var(--nf-success-text)" }}>Factor de reutilización: {p.reuseFactor}× </strong>
        <span style={{ fontSize: 13, color: "var(--nf-success-text)" }}>
          — cada elemento del sistema cubre de media {p.reuseFactor} requisitos. Un valor superior a 1 confirma
          que un mismo documento, evidencia o riesgo satisface varias normas sin crear copias.
        </span>
      </section>
      <Table
        head={["Elemento", "Tipo", "Requisitos cubiertos", "Normas"]}
        rows={p.multiNormEntities.map((e) => [
          e.label, TYPE_LABEL[e.entityType] ?? e.entityType, String(e.requirements),
          <span key="f" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {e.families.map((f) => <span key={f} style={chip("#eafaf0", "var(--nf-success)")}>{f.replace("_", " ")}</span>)}
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
      <div style={{ fontSize: 11.5, color: "var(--nf-ink-3)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 3, color: accent }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--nf-ink-3)" }}>{sub}</div>}
    </div>
  );
}
function Row({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13 }}>
      <span style={{ color: "var(--nf-ink-2)" }}>{label}</span>
      <strong style={{ color }}>{value}</strong>
    </div>
  );
}
function Bar({ pct, color = "#5266F6" }: { pct: number; color?: string }) {
  return (
    <div style={{ height: 7, background: "var(--nf-line)", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: color }} />
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div style={{ ...card, textAlign: "center", color: "var(--nf-ink-3)", padding: 32, fontSize: 13 }}>{text}</div>;
}
function ModalError() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handleError = (event: Event) => {
      const next = (event as CustomEvent<{ message?: unknown }>).detail?.message;
      if (next) setMessage(String(next));
    };
    window.addEventListener("normaflow:server-action-error", handleError);
    return () => window.removeEventListener("normaflow:server-action-error", handleError);
  }, []);

  return message ? <div className="nf-modal-error" role="alert">{message}</div> : null;
}
function Table({ head, rows, empty }: { head: (string | null)[]; rows: React.ReactNode[][]; empty: string }) {
  return <IsoTableCard icon={Layers} headers={head.filter((header): header is string => header !== null)}>
    {rows.length ? rows.map((cells, rowIndex) => <tr key={rowIndex}>{cells.filter((cell) => cell !== null).map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td colSpan={head.filter((header) => header !== null).length}>{empty}</td></tr>}
  </IsoTableCard>;
}
