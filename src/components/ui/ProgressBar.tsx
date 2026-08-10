interface ProgressBarProps {
  value: number;
  color?: string;
  height?: number;
  /** Background of the unfilled track. */
  railColor?: string;
}
export default function ProgressBar({
  value,
  color = "var(--nf-primary)",
  height = 6,
  // El carril por defecto era `#F0F0F0` fijo: en oscuro quedaba una barra
  // clara sobre el lienzo. Los siete consumidores lo pasaban a mano.
  railColor = "var(--nf-surface-sunken)",
}: ProgressBarProps) {
  return (
    <div
      style={{
        background: railColor,
        borderRadius: 99,
        height,
        overflow: "hidden",
        width: "100%",
      }}
    >
      <div
        style={{
          width: `${Math.min(Math.max(value, 0), 100)}%`,
          height: "100%",
          background: color,
          borderRadius: 99,
          transition: "width 0.5s ease",
        }}
      />
    </div>
  );
}
