"use client";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";

export type ProcessRow = {
  id: string;
  name: string;
  code: string | null;
  type: string | null;
  description: string | null;
  inputs: string[];
  outputs: string[];
};

export default function ProcessesModule({ processes }: { processes: ProcessRow[] }) {
  return (
    <div>
      <SectionTitle title="Mapa de procesos" sub={`${processes.length} procesos registrados`} action="+ Nuevo proceso" />
      {processes.length === 0 ? (
        <Card style={{ padding: 40, textAlign: "center", color: "#5E6B7A" }}>
          <p style={{ margin: 0 }}>Aún no hay procesos. Crea el primero para enlazar documentos, riesgos e indicadores.</p>
        </Card>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {processes.map(p => (
            <Card key={p.id} style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#123C66", marginBottom: 4 }}>{p.code || "—"}</div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "#142033", margin: "0 0 6px" }}>{p.name}</h3>
                  {p.type && (
                    <span style={{ fontSize: 11, background: "#F7F9FC", border: "1px solid #E5EAF2", padding: "2px 8px", borderRadius: 99, color: "#5E6B7A" }}>{p.type}</span>
                  )}
                  {p.description && <p style={{ fontSize: 14, color: "#5E6B7A", marginTop: 10, lineHeight: 1.55, marginBottom: 0 }}>{p.description}</p>}
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
    </div>
  );
}
