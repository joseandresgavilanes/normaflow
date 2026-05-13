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
        "bg-white border border-[color:var(--nf-line,#b8c8d9)] rounded-xl p-6 min-w-0 max-w-full box-border shadow-[0_1px_0_rgba(18,60,102,0.04),0_14px_40px_-22px_rgba(18,60,102,0.14)]",
        onClick && "cursor-pointer hover:border-[#123C6640] transition-colors",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}
