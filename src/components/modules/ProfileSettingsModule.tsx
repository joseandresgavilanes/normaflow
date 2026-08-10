"use client";
import { useEffect, useState, useTransition } from "react";
import { Building2, Mail, Shield, UserRound } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Avatar from "@/components/ui/Avatar";
import { useWorkspace } from "@/context/WorkspaceStore";
import { updateCurrentProfile } from "@/lib/actions/account";

type ServerProfile = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  organizationId: string;
  organizationName: string;
  role: string;
};

export default function ProfileSettingsModule({ serverProfile }: { serverProfile?: ServerProfile }) {
  const { state, dispatch, showToast } = useWorkspace();
  const { session } = state;
  const live = serverProfile !== undefined;
  const profile = serverProfile ?? { name: session.name, email: session.email, organizationName: session.orgName, role: session.roleLabel };
  const [savedName, setSavedName] = useState(profile.name);
  const [name, setName] = useState(profile.name);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setName(profile.name);
    setSavedName(profile.name);
  }, [profile.name]);

  function save() {
    if (!name.trim()) {
      showToast("El nombre no puede estar vacío");
      return;
    }
    if (!live) {
      dispatch({ type: "updateSession", patch: { name: name.trim() } });
      setSavedName(name.trim());
      showToast("Perfil actualizado en esta sesión demo");
      return;
    }
    startTransition(async () => {
      try {
        const result = await updateCurrentProfile({ name });
        setSavedName(result.name);
        setName(result.name);
        showToast("Perfil actualizado");
      } catch (error) {
        showToast(error instanceof Error ? error.message : "No se pudo actualizar el perfil");
      }
    });
  }

  return (
    <div>
      <SectionTitle title="Cuenta y perfil" sub={live ? "Perfil vinculado a tu identidad y organización en Supabase." : "Datos de la sesión demo del navegador."} />

      <Card style={{ padding: 0, overflow: "hidden", maxWidth: 640, marginBottom: 20 }}>
        <div
          style={{
            padding: "28px 24px 24px",
            background: "linear-gradient(135deg, rgba(82, 102, 246, 0.12) 0%, rgba(82, 102, 246, 0.04) 50%, rgba(46, 139, 87, 0.06) 100%)",
            borderBottom: "1px solid var(--nf-line)",
          }}
        >
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <Avatar name={savedName} size={72} />
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  color: "var(--nf-ink)",
                  letterSpacing: "-0.03em",
                  lineHeight: 1.2,
                  fontFamily: "var(--font-inter, Inter), system-ui, sans-serif",
                }}
              >
                {savedName}
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 14, color: "var(--nf-ink-2)", fontWeight: 600 }}>
                <Mail size={16} strokeWidth={2.25} aria-hidden style={{ flexShrink: 0, opacity: 0.85 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.email}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 99,
                    fontSize: 12,
                    fontWeight: 700,
                    background: "var(--nf-glass)",
                    border: "1px solid rgba(82, 102, 246, 0.12)",
                    color: "var(--nf-primary-active)",
                  }}
                >
                  <Building2 size={14} strokeWidth={2.25} aria-hidden />
                  {profile.organizationName}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 99,
                    fontSize: 12,
                    fontWeight: 700,
                    background: "var(--nf-glass)",
                    border: "1px solid rgba(82, 102, 246, 0.12)",
                    color: "var(--nf-ink-2)",
                  }}
                >
                  <Shield size={14} strokeWidth={2.25} aria-hidden />
                  {profile.role.replaceAll("_", " ")}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: "22px 24px 24px" }}>
          <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--nf-ink-3)", lineHeight: 1.55 }}>
            {live ? "Puedes cambiar tu nombre visible. El correo y la organización provienen de la sesión autenticada y son de solo lectura." : "Puedes cambiar cómo te muestra la app durante esta sesión demo."}
          </p>

          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)", display: "block", marginBottom: 16 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
              <UserRound size={16} strokeWidth={2.25} aria-hidden style={{ color: "var(--nf-primary-active)" }} />
              Nombre visible
            </span>
            <input
              className="nf-app-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Tu nombre"
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </label>

          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)", display: "block", marginBottom: 20 }}>
            Correo (solo lectura)
            <input
              className="nf-app-input"
              value={profile.email}
              readOnly
              style={{
                width: "100%",
                boxSizing: "border-box",
                marginTop: 8,
                background: "var(--nf-app-surface-2)",
                color: "var(--nf-ink-3)",
                cursor: "not-allowed",
              }}
            />
            <span style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--nf-ink-3)", marginTop: 8, lineHeight: 1.45 }}>
              El correo identifica tu cuenta autenticada y no se edita desde esta pantalla.
            </span>
          </label>

          <button
            type="button"
            onClick={save}
            disabled={pending}
            style={{
              width: "100%",
              maxWidth: 280,
              background: "var(--nf-primary)",
              color: "var(--nf-text-on-primary)",
              border: "none",
              borderRadius: 10,
              padding: "12px 18px",
              fontSize: 14,
              fontWeight: 700,
              cursor: pending ? "wait" : "pointer",
            }}
          >
            {pending ? "Guardando…" : "Guardar nombre"}
          </button>
        </div>
      </Card>
    </div>
  );
}
