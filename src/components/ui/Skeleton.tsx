import { cn } from "@/lib/utils";

type SkeletonProps = {
  className?: string;
  style?: React.CSSProperties;
  rounded?: "sm" | "md" | "lg" | "pill";
};

export default function Skeleton({ className, style, rounded = "md" }: SkeletonProps) {
  return (
    <div
      className={cn(
        "nf-skeleton",
        rounded === "sm" && "nf-skeleton--sm",
        rounded === "lg" && "nf-skeleton--lg",
        rounded === "pill" && "nf-skeleton--pill",
        className,
      )}
      style={style}
      aria-hidden
    />
  );
}

export { PageLoadingSkeleton } from "@/components/ui/skeletons/sections";
