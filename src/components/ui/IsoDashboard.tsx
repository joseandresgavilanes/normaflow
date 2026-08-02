import { cn } from "@/lib/utils";

export function IsoDashboard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("nf-iso-dashboard", className)}>{children}</div>;
}

export function IsoDashboardCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("nf-iso-dashboard-card", className)}>
      <div className="nf-iso-dashboard-card-head">
        <div>
          <h2 className="nf-iso-dashboard-card-title">{title}</h2>
          {subtitle && <p className="nf-iso-dashboard-card-subtitle">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="nf-iso-dashboard-card-body">{children}</div>
    </section>
  );
}

export function IsoDashboardTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="nf-iso-dashboard-table-wrap">
      <table className="nf-iso-dashboard-table">{children}</table>
    </div>
  );
}
