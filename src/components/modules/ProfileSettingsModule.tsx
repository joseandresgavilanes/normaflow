"use client";
import { useEffect, useState } from "react";
import { Building2, Mail, Shield, UserRound } from "lucide-react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Avatar from "@/components/ui/Avatar";
import { useWorkspace } from "@/context/WorkspaceStore";

export default function ProfileSettingsModule() {
  const { state, dispatch, showToast } = useWorkspace();
  const { session } = state;
  const [name, setName] = useState(session.name);

  useEffect(() => {
    setName(session.name);
  }, [session.name]);

  function save() {
    if (!name.trim()) {
      showToast("El nombre no puede estar vacío");
      return;
    }
    dispatch({ type: "updateSession", patch: { name: name.trim() } });
    showToast("Perfil actualizado en esta sesión (no sincronizado con servidor)");
  }

  return (
    <div>
      <SectionTitle title="Cuenta y perfil" sub="Datos mostrados en la aplicación. En modo demo se guardan solo en memoria del navegador." />

      <Card style={{ padding: 0, overflow: "hidden", maxWidth: 640, marginBottom: 20 }}>
        <div
          style={{
            padding: "28px 24px 24px",
            background: "linear-gradient(135deg, rgba(18, 60, 102, 0.12) 0%, rgba(18, 60, 102, 0.04) 50%, rgba(46, 139, 87, 0.06) 100%)",
            borderBottom: "1px solid var(--nf-line)",
          }}
        >
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <Avatar name={session.name} size={72} />
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: "var(--nf-ink)",
                  letterSpacing: "-0.03em",
                  lineHeight: 1.2,
                  fontFamily: "var(--font-manrope, Manrope), var(--font-inter, Inter), system-ui, sans-serif",
                }}
              >
                {session.name}
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 14, color: "var(--nf-ink-2)", fontWeight: 600 }}>
                <Mail size={16} strokeWidth={2.25} aria-hidden style={{ flexShrink: 0, opacity: 0.85 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.email}</span>
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
                    background: "rgba(255,255,255,0.75)",
                    border: "1px solid rgba(18, 60, 102, 0.12)",
                    color: "#123C66",
                  }}
                >
                  <Building2 size={14} strokeWidth={2.25} aria-hidden />
                  {session.orgName}
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
                    background: "rgba(255,255,255,0.75)",
                    border: "1px solid rgba(18, 60, 102, 0.12)",
                    color: "var(--nf-ink-2)",
                  }}
                >
                  <Shield size={14} strokeWidth={2.25} aria-hidden />
                  {session.roleLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: "22px 24px 24px" }}>
          <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--nf-ink-3)", lineHeight: 1.55 }}>
            Puedes cambiar cómo te muestra la app. El correo y la organización vienen de la sesión simulada y no se sincronizan con un servidor todavía.
          </p>

          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--nf-ink)", display: "block", marginBottom: 16 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
              <UserRound size={16} strokeWidth={2.25} aria-hidden style={{ color: "#123C66" }} />
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
              value={session.email}
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
              El correo proviene de la sesión actual y no se edita aquí en modo frontend-first.
            </span>
          </label>

          <button
            type="button"
            onClick={save}
            style={{
              width: "100%",
              maxWidth: 280,
              background: "#123C66",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "12px 18px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Guardar nombre
          </button>
        </div>
      </Card>
    </div>
  );
}
