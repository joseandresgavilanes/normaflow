"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import Modal from "@/components/ui/Modal";
import { useWorkspace, type ProcessRow } from "@/context/WorkspaceStore";

export default function ProcessesModule() {
  const { state, dispatch, showToast } = useWorkspace();
  const { processes } = state;
  const [detail, setDetail] = useState<ProcessRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", type: "core", description: "", owner: "", inputs: "", outputs: "" });

  function openCreate() {
    setForm({ name: "", code: "", type: "core", description: "", owner: state.session.name, inputs: "", outputs: "" });
    setCreateOpen(true);
  }

  function submitCreate() {
    if (!form.name.trim()) {
      showToast("Indica el nombre del proceso");
      return;
    }
    const p: ProcessRow = {
      id: `p-${Date.now()}`,
      name: form.name.trim(),
      code: form.code.trim() || `P-${String(processes.length + 1).padStart(2, "0")}`,
      type: form.type as ProcessRow["type"],
      description: form.description.trim() || "",
      owner: form.owner.trim() || state.session.name,
      inputs: form.inputs
        .split(",")
        .map(s => s.trim())
        .filter(Boolean),
      outputs: form.outputs
        .split(",")
        .map(s => s.trim())
        .filter(Boolean),
    };
    dispatch({ type: "addProcess", p });
    setCreateOpen(false);
    showToast("Proceso añadido (sesión demo)");
  }

  return (
    <div>
      <SectionTitle title="Mapa de procesos" sub={`${processes.length} procesos en el espacio de trabajo`} action="+ Nuevo proceso" onAction={openCreate} />

      {processes.length === 0 ? (
        <Card style={{ padding: 40, textAlign: "center", color: "#5E6B7A" }}>
          <p style={{ margin: 0 }}>Aún no hay procesos. Crea el primero para enlazar documentos, riesgos e indicadores.</p>
        </Card>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {processes.map(p => (
            <Card key={p.id} onClick={() => setDetail(p)} style={{ padding: "20px 22px", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#123C66", marginBottom: 4 }}>{p.code || "—"}</div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "#142033", margin: "0 0 6px" }}>{p.name}</h3>
                  {p.type && (
                    <span style={{ fontSize: 11, background: "#F7F9FC", border: "1px solid #E5EAF2", padding: "2px 8px", borderRadius: 99, color: "#5E6B7A" }}>{p.type}</span>
                  )}
                  {p.description && <p style={{ fontSize: 14, color: "#5E6B7A", marginTop: 10, lineHeight: 1.55, marginBottom: 0 }}>{p.description}</p>}
                  <p style={{ fontSize: 12, color: "#5E6B7A", marginTop: 8 }}>Responsable: {p.owner}</p>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#5E6B7A", textTransform: "uppercase", marginBottom: 6 }}>Entradas</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#142033" }}>
                    {p.inputs.map((i, idx) => (
                      <li key={idx}>{i}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#5E6B7A", textTransform: "uppercase", marginBottom: 6 }}>Salidas</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#142033" }}>
                    {p.outputs.map((o, idx) => (
                      <li key={idx}>{o}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ""} width={560}>
        {detail && (
          <div style={{ fontSize: 14, color: "#142033" }}>
            <p style={{ marginTop: 0, color: "#5E6B7A" }}>
              {detail.code} · {detail.type} · {detail.owner}
            </p>
            {detail.description && <p>{detail.description}</p>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
              <div>
                <div style={{ fontWeight: 700, color: "#5E6B7A", fontSize: 11, marginBottom: 6 }}>ENTRADAS</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {detail.inputs.map((i, idx) => (
                    <li key={idx}>{i}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div style={{ fontWeight: 700, color: "#5E6B7A", fontSize: 11, marginBottom: 6 }}>SALIDAS</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {detail.outputs.map((o, idx) => (
                    <li key={idx}>{o}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo proceso" width={520}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Nombre
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
            />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Código
              <input
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value })}
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Tipo
              <select
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
              >
                <option value="core">Core</option>
                <option value="support">Soporte</option>
              </select>
            </label>
          </div>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Responsable
            <input
              value={form.owner}
              onChange={e => setForm({ ...form, owner: e.target.value })}
              style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Descripción
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Entradas (separadas por coma)
            <input
              value={form.inputs}
              onChange={e => setForm({ ...form, inputs: e.target.value })}
              style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Salidas (separadas por coma)
            <input
              value={form.outputs}
              onChange={e => setForm({ ...form, outputs: e.target.value })}
              style={{ width: "100%", marginTop: 4, padding: "8px 12px", border: "1px solid #E5EAF2", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
            />
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={submitCreate} style={{ flex: 1, background: "#123C66", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Crear
            </button>
            <button type="button" onClick={() => setCreateOpen(false)} style={{ flex: 1, background: "transparent", border: "1px solid #E5EAF2", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", color: "#5E6B7A" }}>
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
