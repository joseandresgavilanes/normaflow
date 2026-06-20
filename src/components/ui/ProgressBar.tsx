interface ProgressBarProps {
  value: number;
  color?: string;
  height?: number;
  /** Background of the unfilled track. */
  railColor?: string;
}
export default function ProgressBar({
  value,
  color = "#5266F6",
  height = 6,
  railColor = "#F0F0F0",
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
