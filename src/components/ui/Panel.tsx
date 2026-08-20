import InfoTip from "@/components/ui/InfoTip";
import { cn } from "@/lib/utils";

export function Panel({
  children,
  className,
  padding = true,
}: {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <div className={cn("nf-panel", padding && "nf-panel--padded", className)}>
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="nf-panel-head">
      <div className="nf-panel-head-text nf-heading-row">
        <h3 className="nf-panel-title">{title}</h3>
        {subtitle && <InfoTip text={subtitle} label={title} />}
      </div>
      {action}
    </div>
  );
}

export function PanelBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("nf-panel-body", className)}>{children}</div>;
}
