"use client";

import { useState, useTransition } from "react";
import {
  LayoutDashboard, Package, FlaskConical, GitBranch, AlertTriangle, Shield,
  Crosshair, Activity, ArrowLeftRight, Undo2, Egg, Siren, ArrowRight, Check,
} from "lucide-react";
import type { FoodSafetyPayload } from "@/lib/food-safety/queries";
import {
  approveHazardAssessment,
  runFoodTraceabilityTest,
  transitionDeviation,
  transitionProcessFlow,
  transitionWithdrawalRecall,
  verifyFoodSafetyCorrection,
} from "@/lib/actions/food-safety";

type Tab =
  | "panel" | "products" | "hazards" | "flows" | "prp" | "ccp"
  | "monitoring" | "deviations" | "traceability" | "recalls" | "allergens" | "emergencies";

const card: React.CSSProperties = { border: "1px solid var(--nf-line, #e5eaf2)", borderRadius: 14, padding: 18, background: "var(--nf-surface, #fff)" };
const chip = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, display: "inline-block" });
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e5eaf2", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const miniBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 7, border: "1px solid #0f766e", background: "#f0fdfa", color: "#0f766e", fontWeight: 600, fontSize: 12, cursor: "pointer", marginRight: 4 };
const okBtn: React.CSSProperties = { ...miniBtn, borderColor: "#16a34a", background: "#f0fdf4", color: "#15803d" };
const fmt = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

export default function FoodSafetyClient({ initial, demo = false }: { initial: FoodSafetyPayload; demo?: boolean }) {
  const [tab, setTab] = useState<Tab>("panel");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [traceMsg, setTraceMsg] = useState<string | null>(initial.lastTraceTest?.summary ?? null);
  const can = initial.can;
  const live = !demo;
  const s = initial.summary;

  const tabs: { id: Tab; label: string; Icon: typeof Package; badge?: number }[] = [
    { id: "panel", label: "Panel", Icon: LayoutDashboard },
    { id: "products", label: "Productos y MP", Icon: Package },
    { id: "flows", label: "Flujos", Icon: GitBranch, badge: initial.flows.length },
    { id: "hazards", label: "Peligros", Icon: FlaskConical, badge: s.significantHazards },
    { id: "prp", label: "PRP / OPRP", Icon: Shield },
    { id: "ccp", label: "PCC", Icon: Crosshair, badge: s.ccps },
    { id: "monitoring", label: "Monitoreo", Icon: Activity, badge: s.outOfLimit },
    { id: "deviations", label: "Desviaciones", Icon: AlertTriangle, badge: s.openDeviations },
    { id: "traceability", label: "Trazabilidad", Icon: ArrowLeftRight, badge: s.lots },
    { id: "recalls", label: "Retiros", Icon: Undo2, badge: s.openRecalls },
    { id: "allergens", label: "Alérgenos", Icon: Egg },
    { id: "emergencies", label: "Emergencias", Icon: Siren, badge: s.openEmergencies },
  ];

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Error inesperado."); }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#ccfbf1", display: "grid", placeItems: "center" }}>
          <Shield size={22} color="#0f766e" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Inocuidad alimentaria (HACCP)</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
            ISO 22000:2018 — productos, peligros, PRP/OPRP/PCC, monitoreo, trazabilidad adelante/atrás y retiros.
          </p>
        </div>
        {demo && <span style={{ ...chip("#eef2ff", "#4f46e5"), marginLeft: "auto" }}>Demo</span>}
      </header>

      {error && <div style={{ ...card, borderColor: "#fecaca", background: "#fef2f2", color: "#b91c1c" }}>{error}</div>}
      {traceMsg && <div style={{ ...card, borderColor: "#99f6e4", background: "#f0fdfa", color: "#0f766e", fontSize: 13 }}>{traceMsg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12 }}>
        <Stat label="Productos" value={s.products} />
        <Stat label="Peligros sig." value={s.significantHazards} accent={s.significantHazards ? "#0f766e" : undefined} />
        <Stat label="PCC" value={s.ccps} />
        <Stat label="Fuera de límite" value={s.outOfLimit} accent={s.outOfLimit ? "#dc2626" : undefined} />
        <Stat label="Desviaciones abiertas" value={s.openDeviations} accent={s.openDeviations ? "#d68a1a" : undefined} />
        <Stat label="Retiros abiertos" value={s.openRecalls} accent={s.openRecalls ? "#dc2626" : undefined} />
      </div>

      <nav style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {tabs.map(({ id, label, Icon, badge }) => (
          <button key={id} onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, border: "1px solid " + (tab === id ? "#0f766e" : "#e5eaf2"), background: tab === id ? "#f0fdfa" : "#fff", color: tab === id ? "#0f766e" : "#334155", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <Icon size={15} /> {label}
            {badge ? <span style={chip("#ccfbf1", "#0f766e")}>{badge}</span> : null}
          </button>
        ))}
      </nav>

      {tab === "panel" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Producto y proceso (§8.1–8.5)</h3>
            <Row k="Productos activos" v={s.products} />
            <Row k="Materias primas" v={s.materials} />
            <Row k="Flujos aprobados" v={s.flows} />
            <Row k="Peligros activos" v={s.hazards} />
            <Row k="Evaluaciones significativas" v={s.significantHazards} danger={s.significantHazards > 0} />
          </div>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Control (§8.2, §8.5)</h3>
            <Row k="PRP" v={s.prps} />
            <Row k="OPRP" v={s.oprps} />
            <Row k="PCC" v={s.ccps} />
            <Row k="Registros fuera de límite" v={s.outOfLimit} danger={s.outOfLimit > 0} />
            <Row k="Desviaciones abiertas" v={s.openDeviations} danger={s.openDeviations > 0} />
          </div>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Trazabilidad y crisis (§8.3–8.4, §8.9)</h3>
            <Row k="Lotes" v={s.lots} />
            <Row k="Retiros abiertos" v={s.openRecalls} danger={s.openRecalls > 0} />
            <Row k="Alérgenos" v={s.allergens} />
            <Row k="Emergencias abiertas" v={s.openEmergencies} danger={s.openEmergencies > 0} />
            <Row k="Validaciones pendientes" v={s.pendingValidations} />
            <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 12 }}>
              La prueba de trazabilidad recorre previousLotIds hacia atrás (proveedor) y hacia adelante (cliente/distribución).
            </p>
          </div>
        </div>
      )}

      {tab === "products" && (
        <div style={{ display: "grid", gap: 14 }}>
          <Table headers={["Código", "Producto", "Categoría", "Alérgenos", "Vida útil"]}>
            {initial.products.map((p) => (
              <tr key={p.id}>
                <td style={td}>{p.code}</td>
                <td style={td}>{p.name}</td>
                <td style={td}>{p.category ?? "—"}</td>
                <td style={td}>{p.allergenCodes.join(", ") || "—"}</td>
                <td style={td}>{p.shelfLifeDays ?? "—"}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Código", "Materia prima", "Proveedor", "Alérgenos"]}>
            {initial.materials.map((m) => (
              <tr key={m.id}>
                <td style={td}>{m.code}</td>
                <td style={td}>{m.name}</td>
                <td style={td}>{m.supplierId ?? "—"}</td>
                <td style={td}>{m.allergenCodes.join(", ") || "—"}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "flows" && (
        <Table headers={["Código", "Versión", "Producto", "Título", "Pasos", "Estado", "Acción"]}>
          {initial.flows.map((f) => (
            <tr key={f.id}>
              <td style={td}>{f.code}</td>
              <td style={td}>{f.version}</td>
              <td style={td}>{f.product.code}</td>
              <td style={td}>{f.title}</td>
              <td style={td}>{f._count.steps}</td>
              <td style={td}><span style={chip("#f1f5f9", "#334155")}>{f.status}</span></td>
              <td style={td}>
                {live && can.approve && f.status !== "APPROVED" && (
                  <button disabled={pending} style={okBtn} onClick={() => run(() => transitionProcessFlow(f.id, "APPROVED"))}>
                    <Check size={12} /> Aprobar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "hazards" && (
        <Table headers={["Código", "Peligro", "Tipo", "Paso", "Sev×Prob", "Sig.", "Decisión", "Estado", "Acción"]}>
          {initial.assessments.map((a) => (
            <tr key={a.id}>
              <td style={td}>{a.code}</td>
              <td style={td}>{a.hazard.code} — {a.hazard.name}</td>
              <td style={td}>{a.hazard.hazardType}</td>
              <td style={td}>{a.step?.code ?? "—"}</td>
              <td style={td}>{a.severity}×{a.likelihood}={a.score}</td>
              <td style={td}>{a.significant ? "Sí" : "No"}</td>
              <td style={td}><span style={chip(a.controlDecision === "CCP" ? "#fef3c7" : "#f1f5f9", a.controlDecision === "CCP" ? "#a16207" : "#334155")}>{a.controlDecision}</span></td>
              <td style={td}>{a.status}</td>
              <td style={td}>
                {live && can.approve && a.status !== "APPROVED" && (
                  <button disabled={pending} style={okBtn} onClick={() => run(() => approveHazardAssessment(a.id))}>
                    <Check size={12} /> Aprobar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "prp" && (
        <div style={{ display: "grid", gap: 14 }}>
          <Table headers={["Código", "PRP", "Categoría", "Frecuencia", "Activo"]}>
            {initial.prps.map((p) => (
              <tr key={p.id}>
                <td style={td}>{p.code}</td>
                <td style={td}>{p.name}</td>
                <td style={td}>{p.category}</td>
                <td style={td}>{p.frequency ?? "—"}</td>
                <td style={td}>{p.active ? "Sí" : "No"}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Código", "OPRP", "Paso", "Evaluación", "Monitoreo"]}>
            {initial.oprps.map((o) => (
              <tr key={o.id}>
                <td style={td}>{o.code}</td>
                <td style={td}>{o.name}</td>
                <td style={td}>{o.step?.code ?? "—"}</td>
                <td style={td}>{o.hazardAssessment?.code ?? "—"}</td>
                <td style={td}>{o.monitoringFrequency ?? o.monitoringMethod ?? "—"}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "ccp" && (
        <div style={{ display: "grid", gap: 14 }}>
          <Table headers={["Código", "PCC", "Paso", "Límites", "Planes", "Desviaciones"]}>
            {initial.ccps.map((c) => (
              <tr key={c.id}>
                <td style={td}>{c.code}</td>
                <td style={td}>{c.name}</td>
                <td style={td}>{c.step.code}</td>
                <td style={td}>{c._count.limits}</td>
                <td style={td}>{c._count.monitoringPlans}</td>
                <td style={td}>{c._count.deviations}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Código", "PCC", "Parámetro", "Operador", "Min", "Max", "Unidad"]}>
            {initial.limits.map((l) => (
              <tr key={l.id}>
                <td style={td}>{l.code}</td>
                <td style={td}>{l.ccp.code}</td>
                <td style={td}>{l.parameter}</td>
                <td style={td}>{l.operator}</td>
                <td style={td}>{l.minValue ?? "—"}</td>
                <td style={td}>{l.maxValue ?? "—"}</td>
                <td style={td}>{l.unit ?? "—"}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "monitoring" && (
        <Table headers={["Código", "Plan", "Fecha", "Valor", "Dentro límite", "Notas"]}>
          {initial.records.map((r) => (
            <tr key={r.id}>
              <td style={td}>{r.code}</td>
              <td style={td}>{r.plan.code}</td>
              <td style={td}>{fmt(r.recordedAt)}</td>
              <td style={td}>{r.valueNumeric ?? r.valueText ?? "—"} {r.unit ?? ""}</td>
              <td style={td}>
                <span style={chip(r.withinLimits ? "#dcfce7" : "#fee2e2", r.withinLimits ? "#15803d" : "#b91c1c")}>
                  {r.withinLimits ? "Sí" : "No"}
                </span>
              </td>
              <td style={td}>{r.notes ?? "—"}</td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "deviations" && (
        <div style={{ display: "grid", gap: 14 }}>
          <Table headers={["Código", "Título", "PCC", "Severidad", "Estado", "Lotes", "Acción"]}>
            {initial.deviations.map((d) => (
              <tr key={d.id}>
                <td style={td}>{d.code}</td>
                <td style={td}>{d.title}</td>
                <td style={td}>{d.ccp?.code ?? "—"}</td>
                <td style={td}>{d.severity}</td>
                <td style={td}>{d.status}</td>
                <td style={td}>{d.lotCodes.join(", ") || "—"}</td>
                <td style={td}>
                  {live && can.update && d.status !== "CLOSED" && d.status !== "VERIFIED" && (
                    <button disabled={pending} style={miniBtn} onClick={() => run(() => transitionDeviation(d.id, "UNDER_CORRECTION"))}>
                      <ArrowRight size={12} /> En corrección
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
          <Table headers={["Código", "Desviación", "Acción", "Efectiva", "Verificar"]}>
            {initial.corrections.map((c) => (
              <tr key={c.id}>
                <td style={td}>{c.code}</td>
                <td style={td}>{c.deviation.code}</td>
                <td style={td}>{c.actionTaken}</td>
                <td style={td}>{c.effective == null ? "—" : c.effective ? "Sí" : "No"}</td>
                <td style={td}>
                  {live && can.approve && c.effective == null && (
                    <button disabled={pending} style={okBtn} onClick={() => run(() => verifyFoodSafetyCorrection(c.id, true))}>
                      <Check size={12} /> Verificar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "traceability" && (
        <Table headers={["Código", "Tipo", "Producto/MP", "Proveedor", "Cliente", "Previos", "Estado", "Prueba"]}>
          {initial.lots.map((l) => (
            <tr key={l.id}>
              <td style={td}>{l.code}</td>
              <td style={td}>{l.lotType}</td>
              <td style={td}>{l.product?.code ?? l.rawMaterial?.code ?? "—"}</td>
              <td style={td}>{l.supplierId ?? "—"}</td>
              <td style={td}>{l.customerName ?? "—"}</td>
              <td style={td}>{l.previousLotIds.length}</td>
              <td style={td}>{l.status}</td>
              <td style={td}>
                {live ? (
                  <button
                    disabled={pending}
                    style={miniBtn}
                    onClick={() => run(async () => {
                      const res = await runFoodTraceabilityTest(l.id);
                      setTraceMsg(res.summary);
                    })}
                  >
                    <ArrowLeftRight size={12} /> Probar
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "recalls" && (
        <Table headers={["Código", "Título", "Tipo", "Lotes", "Estado", "Acción"]}>
          {initial.recalls.map((r) => (
            <tr key={r.id}>
              <td style={td}>{r.code}</td>
              <td style={td}>{r.title}</td>
              <td style={td}>{r.recallType}</td>
              <td style={td}>{r.lotCodes.join(", ")}</td>
              <td style={td}>{r.status}</td>
              <td style={td}>
                {live && can.update && r.status !== "CLOSED" && (
                  <button disabled={pending} style={miniBtn} onClick={() => run(() => transitionWithdrawalRecall(r.id, "IN_PROGRESS"))}>
                    Avanzar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "allergens" && (
        <Table headers={["Código", "Nombre", "Categoría", "Activo"]}>
          {initial.allergens.map((a) => (
            <tr key={a.id}>
              <td style={td}>{a.code}</td>
              <td style={td}>{a.name}</td>
              <td style={td}>{a.category ?? "—"}</td>
              <td style={td}>{a.active ? "Sí" : "No"}</td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "emergencies" && (
        <Table headers={["Código", "Título", "Tipo", "Estado", "Activada"]}>
          {initial.emergencies.map((e) => (
            <tr key={e.id}>
              <td style={td}>{e.code}</td>
              <td style={td}>{e.title}</td>
              <td style={td}>{e.emergencyType}</td>
              <td style={td}>{e.status}</td>
              <td style={td}>{fmt(e.activatedAt)}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

function Stat({ label, value, suffix = "", accent }: { label: string; value: number; suffix?: string; accent?: string }) {
  return (
    <div style={{ ...card, padding: 14 }}>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ?? "#0f172a" }}>{value}{suffix}</div>
    </div>
  );
}

function Row({ k, v, suffix = "", danger }: { k: string; v: number | string; suffix?: string; danger?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
      <span style={{ color: "#64748b" }}>{k}</span>
      <span style={{ fontWeight: 600, color: danger ? "#b91c1c" : "#0f172a" }}>{v}{suffix}</span>
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div style={{ ...card, overflowX: "auto", padding: 0 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>{headers.map((h) => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
