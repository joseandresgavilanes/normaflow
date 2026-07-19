"use client";
import Link from "next/link";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import ProgressBar from "@/components/ui/ProgressBar";
import { useWorkspace } from "@/context/WorkspaceStore";
import type { SetupPayload } from "@/lib/server-queries";

const BLOCK_LABEL: Record<string, string> = {
  foundation: "Base organizativa",
  docs: "Documentación",
  ops: "Operación",
  assurance: "Aseguramiento",
};

export default function SetupGuideModule({ live }: { live?: SetupPayload | null }) {
  const { state, dispatch, showToast } = useWorkspace();
  const { sites, teams, documents, trainingAssignments, changeRequests } = state;

  // En vivo el checklist se deriva de los datos reales de la organización;
  // en demo se mantiene el checklist manual del workspace.
  const isLive = live != null;
  const onboardingChecklist = isLive ? live.items : state.onboardingChecklist;

  const totalW = onboardingChecklist.reduce((s, x) => s + x.weight, 0);
  const doneW = onboardingChecklist.filter(x => x.done).reduce((s, x) => s + x.weight, 0);
  const pct = isLive ? live.progressPct : totalW ? Math.round((doneW / totalW) * 100) : 0;

  function toggle(id: string) {
    if (isLive) return;
    dispatch({ type: "toggleOnboarding", id });
    showToast("Progreso de implementación actualizado");
  }

  return (
    <div>
      <SectionTitle
        title="Implementación guiada"
        sub={
          isLive
            ? "Progreso calculado automáticamente desde los datos reales de tu organización"
            : "Checklist de adopción empresarial — de configuración inicial a primer ciclo de aseguramiento"
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 24 }}>
        <Card>
          <div style={{ fontSize: 13, color: "var(--nf-ink-3)", marginBottom: 8 }}>Readiness general</div>
          <div style={{ fontSize: 42, fontWeight: 600, color: pct >= 70 ? "#16A34A" : pct >= 40 ? "#D97706" : "#5266F6" }}>{pct}%</div>
          <ProgressBar value={pct} color={pct >= 70 ? "#16A34A" : "#5266F6"} height={10} />
          <p style={{ fontSize: 13, color: "var(--nf-ink-3)", marginTop: 12, lineHeight: 1.5 }}>
            {isLive ? (
              <>Cada paso se completa solo cuando el dato existe en tu organización: documentos ({live.counts.documents}), personal ({live.counts.personnel}), riesgos ({live.counts.risks}), auditorías ({live.counts.audits}). El peso refleja impacto en time-to-value.</>
            ) : (
              <>Complete los bloques en orden flexible; el peso refleja impacto en time-to-value. Los datos de sedes ({sites.length}), equipos ({teams.length}), documentos ({documents.length}), formaciones ({trainingAssignments.length}) y cambios ({changeRequests.length}) alimentan el tablero de salud.</>
            )}
          </p>
        </Card>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--nf-ink)", marginBottom: 12 }}>Quick wins</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--nf-ink)", lineHeight: 1.8 }}>
            <li>
              <Link href="/app/training" style={{ color: "#5266F6", fontWeight: 600 }}>
                Cerrar 1 formación vencida
              </Link>
            </li>
            <li>
              <Link href="/app/changes" style={{ color: "#5266F6", fontWeight: 600 }}>
                Mover un cambio a «Implementado»
              </Link>
            </li>
            <li>
              <Link href="/app/reporting" style={{ color: "#5266F6", fontWeight: 600 }}>
                Generar pack de auditoría
              </Link>
            </li>
          </ul>
        </Card>
      </div>

      {(["foundation", "docs", "ops", "assurance"] as const).map(block => {
        const items = onboardingChecklist.filter(i => i.block === block);
        if (items.length === 0) return null;
        return (
          <Card key={block} style={{ marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 16, color: "var(--nf-ink)" }}>{BLOCK_LABEL[block]}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {items.map(item => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid var(--nf-line)",
                    background: item.done ? "#f6faf7" : "var(--nf-app-surface-2)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => toggle(item.id)}
                    disabled={isLive}
                    title={isLive ? "Se completa automáticamente con los datos de tu organización" : undefined}
                    style={{ marginTop: 4 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: "var(--nf-ink)" }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: "var(--nf-ink-3)", marginTop: 4 }}>{item.description}</div>
                    <Link href={item.href} style={{ fontSize: 12, color: "#5266F6", fontWeight: 600, marginTop: 8, display: "inline-block" }}>
                      Ir al módulo →
                    </Link>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--nf-ink-4)", fontWeight: 600 }}>Peso {item.weight}</span>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
