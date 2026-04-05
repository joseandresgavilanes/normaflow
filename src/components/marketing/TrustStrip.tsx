export default function TrustStrip() {
  return (
    <section style={{ background: "#fff", padding: "28px 0", borderBottom: "1px solid #E5EAF2" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div style={{ height: 1, flex: 1, background: "#E5EAF2" }} />
          <span style={{ fontSize: 11, color: "#5E6B7A", fontWeight: 600, letterSpacing: 1.2, whiteSpace: "nowrap" }}>EMPRESAS QUE YA CONFÍAN EN NORMAFLOW</span>
          <div style={{ height: 1, flex: 1, background: "#E5EAF2" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 48, flexWrap: "wrap" }}>
          {["Tecnoserv Industrial", "Grupo Logística Norte", "Sistemas Ibérica", "Manufactura Global", "DataSec Solutions"].map(c => (
            <div key={c} style={{ fontSize: 14, fontWeight: 700, color: "#5E6B7A", letterSpacing: "0.3px" }}>{c}</div>
          ))}
        </div>
      </div>
    </section>
  );
}
