export default function TrustStrip() {
  return (
    <section style={{ background: "#fff", padding: "clamp(20px, 4vw, 28px) 0", borderBottom: "1px solid #E5EAF2" }}>
      <div className="nf-mkt-container">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ height: 1, flex: "1 1 40px", background: "#E5EAF2", minWidth: 24 }} />
          <span
            style={{
              fontSize: "clamp(9px, 2.2vw, 11px)",
              color: "#5E6B7A",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textAlign: "center",
              lineHeight: 1.35,
              maxWidth: "100%",
            }}
          >
            EMPRESAS QUE YA CONFÍAN EN NORMAFLOW
          </span>
          <div style={{ height: 1, flex: "1 1 40px", background: "#E5EAF2", minWidth: 24 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: "clamp(16px, 4vw, 48px)", flexWrap: "wrap" }}>
          {["Tecnoserv Industrial", "Grupo Logística Norte", "Sistemas Ibérica", "Manufactura Global", "DataSec Solutions"].map(c => (
            <div key={c} style={{ fontSize: "clamp(12px, 3vw, 14px)", fontWeight: 700, color: "#5E6B7A", letterSpacing: "0.3px", textAlign: "center" }}>
              {c}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
