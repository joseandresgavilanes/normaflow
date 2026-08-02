"use client";

import { useState, useTransition } from "react";
import {
  LayoutDashboard, Cross, FileStack, PenTool, ShieldAlert, Truck,
  FlaskConical, Boxes, Siren, Eye, Undo2, Scale, ArrowRight, Check,
} from "lucide-react";
import type { MedicalDevicesPayload } from "@/lib/medical-devices/queries";
import {
  transitionComplaint,
  transitionDeviceMasterRecord,
  transitionProductRecall,
} from "@/lib/actions/medical-devices";
import {
  nextComplaintStatuses,
  nextRecallStatuses,
  nextRecordStatuses,
} from "@/lib/medical-devices/workflows";
import type { MdComplaintStatus, MdRecallStatus, MdRecordStatus } from "@prisma/client";

type Tab =
  | "panel" | "devices" | "dmr" | "design" | "risks" | "suppliers"
  | "validations" | "batches" | "vigilance" | "regulatory";

const card: React.CSSProperties = { border: "1px solid var(--nf-line, #e5eaf2)", borderRadius: 14, padding: 18, background: "var(--nf-surface, #fff)" };
const chip = (bg: string, fg: string): React.CSSProperties => ({ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, display: "inline-block" });
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e5eaf2", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const miniBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 7, border: "1px solid #0e7490", background: "#ecfeff", color: "#0e7490", fontWeight: 600, fontSize: 12, cursor: "pointer", marginRight: 4 };
const fmt = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

export default function MedicalDevicesClient({ initial, demo = false }: { initial: MedicalDevicesPayload; demo?: boolean }) {
  const [tab, setTab] = useState<Tab>("panel");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const can = initial.can;
  const live = !demo;
  const s = initial.summary;

  const tabs: { id: Tab; label: string; Icon: typeof Cross; badge?: number }[] = [
    { id: "panel", label: "Panel", Icon: LayoutDashboard },
    { id: "devices", label: "Dispositivos", Icon: Cross, badge: s.devices },
    { id: "dmr", label: "Expediente maestro", Icon: FileStack, badge: s.dmrsApproved },
    { id: "design", label: "Diseño (DHF)", Icon: PenTool, badge: s.dhfsOpen },
    { id: "risks", label: "Riesgos", Icon: ShieldAlert },
    { id: "suppliers", label: "Proveedores", Icon: Truck, badge: s.criticalSuppliers },
    { id: "validations", label: "Validaciones", Icon: FlaskConical },
    { id: "batches", label: "Lotes / traza", Icon: Boxes, badge: s.batchesReleased },
    { id: "vigilance", label: "Vigilancia", Icon: Siren, badge: s.openComplaints + s.openAdverseEvents + s.openRecalls },
    { id: "regulatory", label: "Regulatorio", Icon: Scale, badge: s.activeRequirements },
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
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#cffafe", display: "grid", placeItems: "center" }}>
          <Cross size={22} color="#0e7490" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Calidad de dispositivos médicos</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
            ISO 13485 — DMR/DHF, controles de diseño, proveedores, lotes, trazabilidad y vigilancia post-comercialización.
          </p>
        </div>
        {demo && <span style={{ ...chip("#eef2ff", "#4f46e5"), marginLeft: "auto" }}>Demo</span>}
      </header>

      <div style={{ ...card, borderColor: "#fde68a", background: "#fffbeb", color: "#92400e", fontSize: 13 }}>
        {initial.disclaimer}
      </div>

      {error && <div style={{ ...card, borderColor: "#fecaca", background: "#fef2f2", color: "#b91c1c" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12 }}>
        <Stat label="Dispositivos" value={s.devices} />
        <Stat label="DMR aprobados" value={s.dmrsApproved} />
        <Stat label="Cobertura inputs %" value={s.inputCoveragePercent} />
        <Stat label="Quejas abiertas" value={s.openComplaints} accent={s.openComplaints ? "#dc2626" : undefined} />
        <Stat label="Eventos adversos" value={s.openAdverseEvents} accent={s.openAdverseEvents ? "#dc2626" : undefined} />
        <Stat label="Retiros abiertos" value={s.openRecalls} accent={s.openRecalls ? "#dc2626" : undefined} />
      </div>

      <nav style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {tabs.map(({ id, label, Icon, badge }) => (
          <button key={id} onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, border: "1px solid " + (tab === id ? "#0e7490" : "#e5eaf2"), background: tab === id ? "#ecfeff" : "#fff", color: tab === id ? "#0e7490" : "#334155", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <Icon size={15} /> {label}
            {badge ? <span style={chip("#cffafe", "#0e7490")}>{badge}</span> : null}
          </button>
        ))}
      </nav>

      {tab === "panel" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Expediente y diseño (§4.2, §7.3)</h3>
            <Row k="Dispositivos activos/producción" v={s.devices} />
            <Row k="DMR aprobados" v={s.dmrsApproved} />
            <Row k="DHF abiertos" v={s.dhfsOpen} />
            <Row k="Cobertura inputs→outputs" v={`${s.inputCoveragePercent}%`} danger={s.inputCoveragePercent < 100} />
          </div>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Producción y proveedores (§7.4–7.5)</h3>
            <Row k="Proveedores críticos" v={s.criticalSuppliers} />
            <Row k="Lotes liberados" v={s.batchesReleased} />
            <Row k="Validaciones de proceso" v={initial.processVals.length} />
            <Row k="Validaciones de esterilización" v={initial.sterVals.length} />
          </div>
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Vigilancia (§8.2–8.3)</h3>
            {s.sensitiveLocked ? (
              <p style={{ margin: 0, color: "#b45309", fontSize: 13 }}>
                Datos de quejas, eventos adversos, FSCA y retiros requieren permiso <code>md-sensitive</code>.
              </p>
            ) : (
              <>
                <Row k="Quejas abiertas" v={s.openComplaints} danger={s.openComplaints > 0} />
                <Row k="Eventos adversos abiertos" v={s.openAdverseEvents} danger={s.openAdverseEvents > 0} />
                <Row k="Retiros abiertos" v={s.openRecalls} danger={s.openRecalls > 0} />
              </>
            )}
            <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 12 }}>
              Solo referencias opacas de sujeto — sin PII clínica innecesaria.
            </p>
          </div>
        </div>
      )}

      {tab === "devices" && (
        <div style={{ display: "grid", gap: 14 }}>
          <Table headers={["Código", "Familia", "Nombre"]}>
            {initial.families.map((f) => (
              <tr key={f.id}>
                <td style={td}>{f.code}</td>
                <td style={td} colSpan={2}>{f.name}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Código", "Nombre", "Familia", "Clase", "UDI-DI", "Estado"]}>
            {initial.devices.map((d) => (
              <tr key={d.id}>
                <td style={td}>{d.code}</td>
                <td style={td}>{d.name}</td>
                <td style={td}>{d.family?.code ?? "—"}</td>
                <td style={td}>{d.classification ?? "—"}</td>
                <td style={td}>{d.udiDi ?? "—"}</td>
                <td style={td}>{d.status}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "dmr" && (
        <Table headers={["Código", "Ver.", "Dispositivo", "Título", "Estado", "Acción"]}>
          {initial.dmrs.map((r) => {
            const next = nextRecordStatuses(r.status as MdRecordStatus)[0];
            return (
              <tr key={r.id}>
                <td style={td}>{r.code}</td>
                <td style={td}>{r.version}</td>
                <td style={td}>{r.device.code}</td>
                <td style={td}>{r.title}</td>
                <td style={td}>{r.status}</td>
                <td style={td}>
                  {live && next && can.approve && (
                    <button disabled={pending} style={miniBtn} onClick={() => run(() => transitionDeviceMasterRecord(r.id, next))}>
                      <ArrowRight size={12} /> {next} <Check size={12} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      {tab === "design" && (
        <div style={{ display: "grid", gap: 14 }}>
          <Table headers={["DHF", "Dispositivo", "Estado", "In", "Out", "Rev", "Ver", "Val"]}>
            {initial.dhfs.map((d) => (
              <tr key={d.id}>
                <td style={td}>{d.code}</td>
                <td style={td}>{d.device.code}</td>
                <td style={td}>{d.status}</td>
                <td style={td}>{d._count.inputs}</td>
                <td style={td}>{d._count.outputs}</td>
                <td style={td}>{d._count.reviews}</td>
                <td style={td}>{d._count.verifications}</td>
                <td style={td}>{d._count.validations}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Input", "Requisito", "Estado"]}>
            {initial.inputs.map((i) => (
              <tr key={i.id}>
                <td style={td}>{i.code}</td>
                <td style={td}>{i.requirement}</td>
                <td style={td}>{i.status}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Output", "Descripción", "Inputs enlazados"]}>
            {initial.outputs.map((o) => (
              <tr key={o.id}>
                <td style={td}>{o.code}</td>
                <td style={td}>{o.description}</td>
                <td style={td}>{(o.linkedInputCodes ?? []).join(", ") || "—"}</td>
              </tr>
            ))}
          </Table>
          {initial.coverage.uncovered.length > 0 && (
            <div style={{ ...card, borderColor: "#fde68a", background: "#fffbeb" }}>
              Inputs sin output: {initial.coverage.uncovered.join(", ")}
            </div>
          )}
        </div>
      )}

      {tab === "risks" && (
        <Table headers={["Código", "Ver.", "Dispositivo", "Título", "Metodología", "Estado"]}>
          {initial.riskFiles.map((r) => (
            <tr key={r.id}>
              <td style={td}>{r.code}</td>
              <td style={td}>{r.version}</td>
              <td style={td}>{r.device.code}</td>
              <td style={td}>{r.title}</td>
              <td style={td}>{r.methodology ?? "—"}</td>
              <td style={td}>{r.status}</td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "suppliers" && (
        <div style={{ display: "grid", gap: 14 }}>
          <Table headers={["Código", "Nombre", "Tipo", "Criticidad", "Estado"]}>
            {initial.suppliers.map((srow) => (
              <tr key={srow.id}>
                <td style={td}>{srow.code}</td>
                <td style={td}>{srow.name}</td>
                <td style={td}>{srow.serviceType ?? "—"}</td>
                <td style={td}>{srow.criticality}</td>
                <td style={td}>{srow.status}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Código", "Proveedor", "Estado", "Próx. revisión"]}>
            {initial.qualifications.map((q) => (
              <tr key={q.id}>
                <td style={td}>{q.code}</td>
                <td style={td}>{q.criticalSupplier.code}</td>
                <td style={td}>{q.status}</td>
                <td style={td}>{fmt(q.nextReviewAt)}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "validations" && (
        <div style={{ display: "grid", gap: 14 }}>
          <Table headers={["Proceso", "Dispositivo", "Título", "Resultado", "Fecha"]}>
            {initial.processVals.map((v) => (
              <tr key={v.id}>
                <td style={td}>{v.code}</td>
                <td style={td}>{v.device?.code ?? "—"}</td>
                <td style={td}>{v.title}</td>
                <td style={td}>{v.result}</td>
                <td style={td}>{fmt(v.validatedAt)}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Esterilización", "Dispositivo", "Método", "Resultado", "Fecha"]}>
            {initial.sterVals.map((v) => (
              <tr key={v.id}>
                <td style={td}>{v.code}</td>
                <td style={td}>{v.device?.code ?? "—"}</td>
                <td style={td}>{v.method}</td>
                <td style={td}>{v.result}</td>
                <td style={td}>{fmt(v.validatedAt)}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "batches" && (
        <div style={{ display: "grid", gap: 14 }}>
          <Table headers={["Código", "Lote", "Dispositivo", "Cantidad", "Estado", "Fabricado"]}>
            {initial.batches.map((b) => (
              <tr key={b.id}>
                <td style={td}>{b.code}</td>
                <td style={td}>{b.lotNumber}</td>
                <td style={td}>{b.device.code}</td>
                <td style={td}>{b.quantity ?? "—"} {b.unit ?? ""}</td>
                <td style={td}>{b.status}</td>
                <td style={td}>{fmt(b.manufacturedAt)}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Traza", "Lote", "Lote proveedor", "Distribución", "Cuenta", "Notas"]}>
            {initial.traces.map((t) => (
              <tr key={t.id}>
                <td style={td}>{t.code}</td>
                <td style={td}>{t.batch.lotNumber}</td>
                <td style={td}>{t.supplierLot ?? "—"}</td>
                <td style={td}>{t.distributionRef ?? "—"}</td>
                <td style={td}>{t.customerAccountRef ?? "—"}</td>
                <td style={td}>{t.notes ?? "—"}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {tab === "vigilance" && (
        s.sensitiveLocked ? (
          <div style={{ ...card, borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" }}>
            <Eye size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />
            Vigilancia bloqueada: se requiere <strong>md-sensitive:read</strong> para quejas, eventos adversos, acciones de campo y retiros.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            <Table headers={["Queja", "Dispositivo", "Fuente", "Estado", "Sujeto", "Acción"]}>
              {initial.complaints.map((c) => {
                const next = nextComplaintStatuses(c.status as MdComplaintStatus)[0];
                return (
                  <tr key={c.id}>
                    <td style={td}>{c.code}</td>
                    <td style={td}>{c.device?.code ?? "—"}</td>
                    <td style={td}>{c.source}</td>
                    <td style={td}>{c.status}</td>
                    <td style={td}>{c.anonymizedSubjectRef ?? "—"}</td>
                    <td style={td}>
                      {live && next && can.sensitiveUpdate && (
                        <button disabled={pending} style={miniBtn} onClick={() => run(() => transitionComplaint(c.id, next))}>
                          <ArrowRight size={12} /> {next}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Table>
            <Table headers={["Evento", "Dispositivo", "Severidad", "Reportable", "Estado", "Sujeto"]}>
              {initial.adverseEvents.map((e) => (
                <tr key={e.id}>
                  <td style={td}>{e.code}</td>
                  <td style={td}>{e.device?.code ?? "—"}</td>
                  <td style={td}>{e.severity}</td>
                  <td style={td}>{e.reportable ? "Sí" : "No"}</td>
                  <td style={td}>{e.status}</td>
                  <td style={td}>{e.anonymizedSubjectRef ?? "—"}</td>
                </tr>
              ))}
            </Table>
            <Table headers={["PMS", "Dispositivo", "Periodo", "Estado"]}>
              {initial.pms.map((p) => (
                <tr key={p.id}>
                  <td style={td}>{p.code}</td>
                  <td style={td}>{p.device.code}</td>
                  <td style={td}>{fmt(p.periodStart)} → {fmt(p.periodEnd)}</td>
                  <td style={td}>{p.status}</td>
                </tr>
              ))}
            </Table>
            <Table headers={["Tipo", "Código", "Dispositivo", "Título", "Estado", "Acción"]}>
              {[
                ...initial.fieldActions.map((f) => ({ kind: "FSCA", ...f })),
                ...initial.recalls.map((r) => ({ kind: "RETIRO", ...r })),
              ].map((row) => {
                const isRecall = row.kind === "RETIRO";
                const next = isRecall ? nextRecallStatuses(row.status as MdRecallStatus)[0] : null;
                return (
                  <tr key={row.id}>
                    <td style={td}>{row.kind}</td>
                    <td style={td}>{row.code}</td>
                    <td style={td}>{row.device?.code ?? "—"}</td>
                    <td style={td}>{row.title}</td>
                    <td style={td}>{row.status}</td>
                    <td style={td}>
                      {live && isRecall && next && can.sensitiveUpdate && (
                        <button disabled={pending} style={miniBtn} onClick={() => run(() => transitionProductRecall(row.id, next))}>
                          <Undo2 size={12} /> {next}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Table>
          </div>
        )
      )}

      {tab === "regulatory" && (
        <div style={{ display: "grid", gap: 14 }}>
          <Table headers={["Código", "Marco", "Título", "Jurisdicción", "Activo"]}>
            {initial.requirements.map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.code}</td>
                <td style={td}>{r.framework}</td>
                <td style={td}>{r.title}</td>
                <td style={td}>{r.jurisdiction ?? "—"}</td>
                <td style={td}>{r.active ? "Sí" : "No"}</td>
              </tr>
            ))}
          </Table>
          <Table headers={["Código", "Dispositivo", "Jurisdicción", "Tipo", "Estado", "Enviado"]}>
            {initial.submissions.map((srow) => (
              <tr key={srow.id}>
                <td style={td}>{srow.code}</td>
                <td style={td}>{srow.device?.code ?? "—"}</td>
                <td style={td}>{srow.jurisdiction}</td>
                <td style={td}>{srow.submissionType}</td>
                <td style={td}>{srow.status}</td>
                <td style={td}>{fmt(srow.submittedAt)}</td>
              </tr>
            ))}
          </Table>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 12 }}>
            Requisitos regulatorios configurables por organización. NormaFlow no certifica cumplimiento nacional.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ?? "#0f172a", marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Row({ k, v, danger }: { k: string; v: string | number; danger?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
      <span style={{ color: "#64748b" }}>{k}</span>
      <strong style={{ color: danger ? "#dc2626" : "#0f172a" }}>{v}</strong>
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div style={{ ...card, padding: 0, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>{headers.map((h) => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
