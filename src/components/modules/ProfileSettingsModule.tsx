"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
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

      <Card style={{ maxWidth: 520 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#142033", display: "block", marginBottom: 6 }}>Nombre</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#142033", display: "block", marginBottom: 6 }}>Correo</label>
          <input value={session.email} readOnly style={{ width: "100%", padding: "10px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 14, boxSizing: "border-box", background: "#F7F9FC", color: "#5E6B7A" }} />
          <p style={{ fontSize: 12, color: "#5E6B7A", marginTop: 6 }}>El correo proviene de la sesión actual y no se edita aquí en modo frontend-first.</p>
        </div>
        <div style={{ marginBottom: 20, padding: 14, background: "#F7F9FC", borderRadius: 8, fontSize: 13, color: "#142033" }}>
          <div>
            <span style={{ color: "#5E6B7A" }}>Organización: </span>
            <strong>{session.orgName}</strong>
          </div>
          <div style={{ marginTop: 6 }}>
            <span style={{ color: "#5E6B7A" }}>Rol: </span>
            <strong>{session.roleLabel}</strong>
          </div>
        </div>
        <button type="button" onClick={save} style={{ background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          Guardar nombre
        </button>
      </Card>
    </div>
  );
}
