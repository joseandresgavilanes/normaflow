import Link from "next/link";
import { LockKeyhole, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";

export default function PlanUpgradeGate({ module }: { module: string }) {
  return <Card style={{ maxWidth: 680, margin: "32px auto", padding: 28, textAlign: "center", borderColor: "#cbd2ff" }}><span style={{ width: 46, height: 46, borderRadius: 14, display: "inline-grid", placeItems: "center", color: "#5266F6", background: "#eef0ff" }}><LockKeyhole size={22} /></span><h2 style={{ margin: "15px 0 7px", color: "var(--nf-ink)" }}>Disponible desde Growth</h2><p style={{ margin: "0 auto 18px", maxWidth: 500, color: "var(--nf-ink-3)", fontSize: 14, lineHeight: 1.55 }}>El módulo <strong>{module}</strong> forma parte de Growth y Enterprise. Puedes probarlo durante el trial o actualizar tu plan sin perder datos.</p><Link href={`/app/billing?upgrade=${module}`} className="nf-app-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 7, textDecoration: "none" }}><Sparkles size={15} /> Ver planes</Link></Card>;
}
