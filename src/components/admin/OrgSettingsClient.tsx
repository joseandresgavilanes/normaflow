"use client";

import { useEffect, useState, useTransition } from "react";
import { Building2, Globe, ImageIcon, Loader2, Sparkles } from "lucide-react";
import SectionTitle from "@/components/ui/SectionTitle";
import InfoTip from "@/components/ui/InfoTip";
import { useAdminMock } from "@/context/AdminMockStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";
import { PLAN_LIMITS, type PlanKey } from "@/lib/constants";
import { Field as UiField } from "@/components/ui/Field";
import Picker from "@/components/ui/Picker";

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
  const [size, setSize] = useState(org.size ?? "");
  const [contactName, setContactName] = useState(org.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(org.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(org.contactPhone ?? "");
  const [website, setWebsite] = useState(org.website ?? "");
  const [address, setAddress] = useState(org.address ?? "");
  const [standards, setStandards] = useState<string[]>(org.standards ?? ["ISO_9001"]);
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
          size: size.trim() || null,
          contactName: contactName.trim() || null,
          contactEmail: contactEmail.trim() || null,
          contactPhone: contactPhone.trim() || null,
          website: website.trim() || null,
          address: address.trim() || null,
          standards,
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
          sub="Configura la identidad, contacto y normas activas de tu organización."
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
        <div className="nf-org-panel-head nf-heading-row">
          <h2 className="nf-org-panel-title">Datos generales</h2>
          <InfoTip
            label="Datos generales"
            text="Estos datos se aplican a todos los módulos, informes y usuarios de este tenant."
          />
        </div>

        <div className="nf-org-panel-body">
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Field label="Nombre de la organización">
              <input aria-label="Nombre"
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
                <input aria-label="País"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  disabled={!canEdit}
                  maxLength={3}
                  className="nf-app-input"
                  style={{ width: "100%", boxSizing: "border-box", fontFamily: "ui-monospace, monospace", textTransform: "none" }}
                />
              </Field>
              <Field label="Tamaño">
                <Picker aria-label="Selecciona un tamaño" value={size} onChange={(e) => setSize(e.target.value)} disabled={!canEdit} className="nf-app-input w-full">
                  <option value="">Selecciona un tamaño</option>
                  <option value="1-10">1–10 personas</option>
                  <option value="11-50">11–50 personas</option>
                  <option value="51-200">51–200 personas</option>
                  <option value="201-500">201–500 personas</option>
                  <option value="501+">501+ personas</option>
                </Picker>
              </Field>
            </div>

            <div className="nf-org-grid-2">
              <Field label="Nombre de contacto">
                <input aria-label="Responsable del sistema" value={contactName} onChange={(e) => setContactName(e.target.value)} disabled={!canEdit} className="nf-app-input w-full" placeholder="Responsable del sistema" />
              </Field>
              <Field label="Email de contacto">
                <input aria-label="calidad@empresa.com" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} disabled={!canEdit} className="nf-app-input w-full" placeholder="calidad@empresa.com" />
              </Field>
              <Field label="Teléfono">
                <input aria-label="Teléfono de contacto" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} disabled={!canEdit} className="nf-app-input w-full" />
              </Field>
              <Field label="Sitio web">
                <input aria-label="https://empresa.com" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} disabled={!canEdit} className="nf-app-input w-full" placeholder="https://empresa.com" />
              </Field>
            </div>

            <Field label="Dirección">
              <textarea aria-label="Dirección" value={address} onChange={(e) => setAddress(e.target.value)} disabled={!canEdit} className="nf-app-input w-full" rows={2} />
            </Field>

            <Field label="Normas activas">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["ISO_9001", "ISO 9001:2015", "Gestión de la calidad"],
                  ["ISO_27001", "ISO 27001:2022", "Seguridad de la información"],
                ].map(([code, label, detail]) => {
                  const checked = standards.includes(code);
                  return (
                    <label key={code} className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${checked ? "nf-border-primary nf-primary-subtle-bg" : "nf-border-line nf-surface-bg"}`}>
                      <input type="checkbox" checked={checked} disabled={!canEdit || (checked && standards.length === 1)} onChange={() => setStandards((current) => checked ? current.filter((item) => item !== code) : [...current, code])} className="mt-1" />
                      <span><strong className="block text-sm nf-text-primary-fg">{label}</strong><span className="text-xs nf-text-subtle-fg">{detail}</span></span>
                    </label>
                  );
                })}
              </div>
            </Field>

            <Field label="Logo (URL)">
              <div className="nf-org-logo-row">
                <input aria-label="https://"
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
              <PlanUsageCard plan={org.plan} usedUsers={admin.state.members.filter((member) => member.active !== false).length} />
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
  // Antes: <label> sin htmlFor, que no asocia con ningún control.
  return <UiField label={label}>{children}</UiField>;
}

function PlanUsageCard({ plan, usedUsers }: { plan: string; usedUsers: number }) {
  const info = PLAN_LIMITS[plan as PlanKey];
  const max = info?.maxUsers ?? null;
  const pct = max === null ? 0 : Math.min(100, (usedUsers / max) * 100);
  const atLimit = max !== null && usedUsers >= max;
  const nearLimit = max !== null && !atLimit && pct >= 80;
  const barColor = atLimit ? "var(--nf-danger)" : nearLimit ? "var(--nf-warning)" : "var(--nf-accent)";

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
        <Globe size={22} strokeWidth={2} style={{ color: "var(--nf-primary-active)", opacity: 0.35, flexShrink: 0 }} aria-hidden />
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--nf-ink-3)", marginBottom: 6 }}>
          <span>Usuarios activos</span>
          <span style={{ fontFamily: "ui-monospace, monospace", color: atLimit ? "var(--nf-danger-text)" : "var(--nf-ink-2)", fontWeight: 700 }}>
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
