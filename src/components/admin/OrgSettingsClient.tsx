"use client";

import { useState, useTransition } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import { useAdminMock } from "@/context/AdminMockStore";
import { useDemoPermission } from "@/hooks/useDemoPermission";

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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(() => {
      try {
        if (!name.trim()) throw new Error("El nombre de la organización es obligatorio.");
        admin.updateOrganization({ name: name.trim(), industry: industry.trim() || null, country: country.trim() || "ES", logoUrl: logoUrl.trim() || null });
        setSavedAt(new Date().toLocaleTimeString());
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error.");
      }
    });
  }

  return (
    <div>
      <SectionTitle title="Organización" sub="Datos generales y plan de tu organización." />
      <Card>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
          <Field label="Nombre">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit}
              required
              style={inputStyle}
            />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 12 }}>
            <Field label="Sector / industria">
              <input value={industry} onChange={(e) => setIndustry(e.target.value)} disabled={!canEdit} style={inputStyle} placeholder="p.ej. Manufactura, Servicios IT, Salud…" />
            </Field>
            <Field label="País (ISO)">
              <input value={country} onChange={(e) => setCountry(e.target.value)} disabled={!canEdit} maxLength={3} style={{ ...inputStyle, fontFamily: "monospace", textTransform: "uppercase" }} />
            </Field>
          </div>
          <Field label="Logo (URL)">
            <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} disabled={!canEdit} style={inputStyle} placeholder="https://…" />
          </Field>
          <Field label="Plan">
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "#F7F9FC", border: "1px solid #E5EAF2", fontSize: 13, fontWeight: 600, color: "#142033" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2E8B57" }} /> {org.plan}
            </div>
            <p style={{ fontSize: 12, color: "#9aa5b1", margin: "6px 0 0" }}>Cambia tu plan desde <a href="/app/billing" style={{ color: "#123C66" }}>Billing</a>.</p>
          </Field>

          {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fff0f0", color: "#C93C37", fontSize: 13 }}>{error}</div>}
          {savedAt && !error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "#e8f5ee", color: "#2E8B57", fontSize: 13 }}>Guardado a las {savedAt}</div>}

          {canEdit && (
            <div>
              <button type="submit" disabled={isPending} style={primaryBtn}>
                {isPending ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5E6B7A", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid #E5EAF2", borderRadius: 8, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { padding: "10px 22px", fontSize: 14, fontWeight: 600, color: "#fff", background: "#123C66", border: "none", borderRadius: 8, cursor: "pointer" };
