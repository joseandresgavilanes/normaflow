const COLORS = ["var(--nf-primary)", "var(--nf-success)", "#7C3AED", "var(--nf-warning)", "var(--nf-danger)", "#6366F1"];

interface AvatarProps { name: string; size?: number; className?: string; }

export default function Avatar({ name, size = 32, className }: AvatarProps) {
  const initials = name?.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  const color = COLORS[(name?.charCodeAt(0) ?? 0) % COLORS.length];
  return (
    <div
      className={className}
      style={{ width: size, height: size, borderRadius: "50%", background: color, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.35, fontWeight: 600, flexShrink: 0, userSelect: "none" }}
    >
      {initials}
    </div>
  );
}
