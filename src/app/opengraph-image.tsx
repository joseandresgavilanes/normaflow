import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "NormaFlow — software de gestión ISO";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px", background: "#f7f8fc", color: "#172033", fontFamily: "Arial" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 32, fontWeight: 700 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, var(--nf-primary), #7c5ce8)" }} />
          NormaFlow
        </div>
        <div style={{ display: "flex", marginTop: 56, fontSize: 66, lineHeight: 1.08, fontWeight: 800, letterSpacing: -2 }}>
          Del caos ISO al control continuo.
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 28, color: "#59657b" }}>
          Documentos · riesgos · auditorías · evidencias · CAPA
        </div>
      </div>
    ),
    { ...size },
  );
}
