import { cn } from "@/lib/utils";
interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export default function Card({
  children,
  className,
  onClick,
  style,
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "nf-surface-bg border border-[color: var(--nf-line,#e8e8e8)] rounded-xl p-6 min-w-0 max-w-full box-border",
        onClick && "cursor-pointer hover:border-[#d4d4d4] transition-colors",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}
