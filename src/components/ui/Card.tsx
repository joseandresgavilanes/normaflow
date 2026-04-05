import { cn } from "@/lib/utils";
interface CardProps { children: React.ReactNode; className?: string; onClick?: () => void; style?: React.CSSProperties; }
export default function Card({ children, className, onClick, style }: CardProps) {
  return (
    <div onClick={onClick} className={cn("bg-white border border-[#E5EAF2] rounded-xl p-6", onClick && "cursor-pointer hover:border-[#123C6640] transition-colors", className)} style={style}>
      {children}
    </div>
  );
}
