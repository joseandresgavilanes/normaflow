"use client";
import Card from "@/components/ui/Card";
import SectionTitle from "@/components/ui/SectionTitle";
import { formatDate } from "@/lib/utils";

export type EvidenceRow = {
  id: string;
  title: string;
  module: string | null;
  fileUrl: string;
  fileSize: number | null;
  createdAt: string;
};

export default function EvidenceModule({ items }: { items: EvidenceRow[] }) {
  return (
    <div>
      <SectionTitle title="Repositorio de evidencias" sub="Pruebas vinculadas a auditorías, riesgos y documentos" action="+ Subir evidencia" />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#F7F9FC", borderBottom: "1px solid #E5EAF2" }}>
              {["Título", "Módulo", "Fecha", ""].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "12px 16px", color: "#5E6B7A", fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(ev => (
              <tr key={ev.id} style={{ borderBottom: "1px solid #E5EAF2" }}>
                <td style={{ padding: "12px 16px", color: "#142033", fontWeight: 500 }}>{ev.title}</td>
                <td style={{ padding: "12px 16px", color: "#5E6B7A" }}>{ev.module || "—"}</td>
                <td style={{ padding: "12px 16px", color: "#5E6B7A" }}>{formatDate(ev.createdAt)}</td>
                <td style={{ padding: "12px 16px" }}>
                  <a href={ev.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#123C66", fontWeight: 600, textDecoration: "none" }}>
                    Abrir
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
