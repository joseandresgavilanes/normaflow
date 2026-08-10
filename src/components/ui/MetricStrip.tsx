import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export function MetricCell({
  label,
  value,
  sub,
  icon: Icon,
  color = "#5266F6",
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  color?: string;
  href?: string;
}) {
  const inner = (
    <div className="nf-metric-cell">
      {Icon && (
        <div className="nf-metric-cell-icon" style={{ background: `${color}14`, color }}>
          <Icon size={18} strokeWidth={2} aria-hidden />
        </div>
      )}
      <div className="nf-metric-cell-body">
        <div className="nf-metric-cell-value" style={color !== "var(--nf-primary)" ? { color } : undefined}>
          {value}
        </div>
        <div className="nf-metric-cell-label">{label}</div>
        {sub && <div className="nf-metric-cell-sub">{sub}</div>}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="nf-metric-cell-link">
        {inner}
      </Link>
    );
  }
  return inner;
}

export default function MetricStrip({ children }: { children: React.ReactNode }) {
  return <div className="nf-metric-strip">{children}</div>;
}
