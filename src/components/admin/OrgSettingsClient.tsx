"use client";

import { useEffect, useState, useTransition } from "react";
import { Building2, Globe, ImageIcon, Loader2, Sparkles } from "lucide-react";
import SectionTitle from "@/components/ui/SectionTitle";
import { useAdminMock } from "@/context/AdminMockStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import { PLAN_LIMITS, type PlanKey } from "@/lib/constants";

function isLikelyImageUrl(url: string) {
  const u = url.trim().toLowerCase();
  if (!u.startsWith("http://") && !u.startsWith("https://")) return false;
  return /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(u) || u.includes("/logo") || u.includes("avatar");
}

export default function OrgSettingsClient() {
  const admin = useAdminMock();
  const perm = useDemoPermission();
  const canEdit = perm.can("org:*");
  const org = admin.state.organization;

  const [name, setName] = useState(org.name);
  const [industry, setIndustry] = useState(org.industry ?? "");
  const [country, setCountry] = useState(org.country);
  const [logoUrl, setLogoUrl] = useState(org.logoUrl ?? "");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [logoUrl]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        if (!name.trim()) throw new Error("El nombre de la organización es obligatorio.");
        await admin.updateOrganization({
          name: name.trim(),
          industry: industry.trim() || null,
          country: country.trim() || "ES",
          logoUrl: logoUrl.trim() || null,
        });
        setSavedAt(new Date().toLocaleTimeString());
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error.");
      }
    });
  }

  const showLogoPreview = logoUrl.trim() && isLikelyImageUrl(logoUrl) && !logoFailed;

  return (
    <div className="nf-org-page">
      <div className="nf-activity-hero" style={{ marginBottom: 4 }}>
        <SectionTitle
          title="Organización"
          sub="Nombre, sector, país y marca. Los cambios se guardan en la sesión local del navegador."
        />
        <div className="nf-activity-hero-badges" aria-hidden>
          <span className="nf-activity-hero-pill">
            <Building2 size={14} strokeWidth={2.25} />
            Perfil org.
          </span>
          <span className="nf-activity-hero-pill nf-activity-hero-pill--green">
            <Sparkles size={14} strokeWidth={2.25} />
            Workspace local
          </span>
        </div>
      </div>

      <div className="nf-org-panel">
        <div className="nf-org-panel-head">
          <h2 className="nf-org-panel-title">Datos generales</h2>
          <p className="nf-org-panel-sub">Identidad mostrada en informes y pantallas internas. El plan activo se gestiona desde Billing.</p>
        </div>

        <div className="nf-org-panel-body">
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Field label="Nombre de la organización">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEdit}
                required
                className="nf-app-input"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </Field>

            <div className="nf-org-grid-2">
              <Field label="Sector / industria">
                <input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  disabled={!canEdit}
                  className="nf-app-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                  placeholder="p.ej. Manufactura, Servicios IT, Salud…"
                />
              </Field>
              <Field label="País (ISO)">
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  disabled={!canEdit}
                  maxLength={3}
                  className="nf-app-input"
                  style={{ width: "100%", boxSizing: "border-box", fontFamily: "ui-monospace, monospace", textTransform: "uppercase" }}
                />
              </Field>
            </div>

            <Field label="Logo (URL)">
              <div className="nf-org-logo-row">
                <input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  disabled={!canEdit}
                  className="nf-app-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                  placeholder="https://…"
                />
                <div className="nf-org-logo-preview" aria-hidden>
                  {showLogoPreview ? (
                    <img
                      src={logoUrl.trim()}
                      alt=""
                      loading="lazy"
                      onError={() => setLogoFailed(true)}
                    />
                  ) : null}
                  {!showLogoPreview && (
                    <span className="nf-org-logo-placeholder">
                      <ImageIcon size={28} strokeWidth={1.75} />
                    </span>
                  )}
                </div>
              </div>
            </Field>

            <Field label="Plan actual">
              <PlanUsageCard plan={org.plan} usedUsers={admin.state.members.length} />
            </Field>

            {error ? <div className="nf-org-msg-error">{error}</div> : null}
            {savedAt && !error ? <div className="nf-org-msg-ok">Guardado a las {savedAt}</div> : null}

            {canEdit ? (
              <div>
                <button type="submit" disabled={isPending} className="nf-app-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {isPending ? (
                    <>
                      <Loader2 size={17} strokeWidth={2.5} className="nf-icon-spin" aria-hidden />
                      Guardando…
                    </>
                  ) : (
                    "Guardar cambios"
                  )}
                </button>
              </div>
            ) : (
              <p className="nf-app-help" style={{ margin: 0, fontWeight: 600 }}>
                Solo lectura: tu rol no incluye permisos de edición de organización.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="nf-org-field-label">{label}</label>
      {children}
    </div>
  );
}

function PlanUsageCard({ plan, usedUsers }: { plan: string; usedUsers: number }) {
  const info = PLAN_LIMITS[plan as PlanKey];
  const max = info?.maxUsers ?? null;
  const pct = max === null ? 0 : Math.min(100, (usedUsers / max) * 100);
  const atLimit = max !== null && usedUsers >= max;
  const nearLimit = max !== null && !atLimit && pct >= 80;
  const barColor = atLimit ? "#C93C37" : nearLimit ? "#D68A1A" : "var(--nf-accent)";

  return (
    <div className="nf-org-plan-card" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="nf-org-plan-dot" aria-hidden />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="nf-org-plan-name">{info?.label ?? plan}</div>
          <p className="nf-org-hint" style={{ marginTop: 4 }}>
            {info?.lifetimeUsd
              ? `Licencia lifetime · $${info.lifetimeUsd.toLocaleString("en-US")} USD · hasta ${max} usuarios.`
              : "Plan personalizado · usuarios ilimitados."}
          </p>
        </div>
        <Globe size={22} strokeWidth={2} style={{ color: "#123c66", opacity: 0.35, flexShrink: 0 }} aria-hidden />
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--nf-ink-3)", marginBottom: 6 }}>
          <span>Usuarios activos</span>
          <span style={{ fontFamily: "ui-monospace, monospace", color: atLimit ? "#C93C37" : "var(--nf-ink-2)", fontWeight: 700 }}>
            {usedUsers} / {max === null ? "∞" : max}
          </span>
        </div>
        {max !== null && (
          <div style={{ height: 6, background: "var(--nf-line)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: barColor, transition: "width 0.2s" }} />
          </div>
        )}
      </div>
      <p className="nf-org-hint" style={{ margin: 0 }}>
        Para cambiar de plan o ver facturación, abre <a href="/app/billing">Billing y suscripción</a>.
      </p>
    </div>
  );
}
