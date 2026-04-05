const COLORS = ["#123C66", "#2E8B57", "#6B3FB5", "#D68A1A", "#C93C37", "#1a5490"];

interface AvatarProps { name: string; size?: number; className?: string; }

export default function Avatar({ name, size = 32, className }: AvatarProps) {
  const initials = name?.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  const color = COLORS[(name?.charCodeAt(0) ?? 0) % COLORS.length];
  return (
    <div
      className={className}
      style={{ width: size, height: size, borderRadius: "50%", background: color, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.35, fontWeight: 700, flexShrink: 0, userSelect: "none" }}
    >
      {initials}
    </div>
  );
}
