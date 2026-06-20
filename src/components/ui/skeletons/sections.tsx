import Skeleton from "@/components/ui/Skeleton";
import {
  ActivityTimelineSkeleton,
  BillingSkeletonLayout,
  CardGridSkeleton,
  DashboardSkeletonLayout,
  FilterToolbarSkeleton,
  FormPanelSkeleton,
  KpiSummarySkeleton,
  MetricStripSkeleton,
  PageHeaderSkeleton,
  SplitAdminSkeleton,
  StackedCardsSkeleton,
  TableSkeleton,
  TabsSkeleton,
} from "./primitives";

function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="nf-page-loading">{children}</div>;
}

/** Fallback genérico — tabla con filtros */
export function DefaultPageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton />
      <MetricStripSkeleton count={4} />
      <div className="nf-panel nf-skeleton-table-wrap">
        <FilterToolbarSkeleton selects={2} />
        <TableSkeleton rows={7} />
      </div>
    </PageShell>
  );
}

export function DashboardPageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton withAction={false} />
      <DashboardSkeletonLayout />
    </PageShell>
  );
}

/** Documentos, registros, personal, catálogos, usuarios */
export function TablePageSkeleton({ metrics = 4, filterSelects = 3 }: { metrics?: number; filterSelects?: number }) {
  return (
    <PageShell>
      <PageHeaderSkeleton />
      <MetricStripSkeleton count={metrics} />
      <div className="nf-panel nf-skeleton-table-wrap">
        <FilterToolbarSkeleton selects={filterSelects} />
        <TableSkeleton rows={8} />
      </div>
    </PageShell>
  );
}

/** Capacitación — KPIs, tabs y tarjetas apiladas */
export function TrainingPageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton />
      <MetricStripSkeleton count={4} />
      <TabsSkeleton count={5} />
      <StackedCardsSkeleton count={4} />
    </PageShell>
  );
}

/** Procesos, riesgos, auditorías, NC, cambios, proveedores, etc. */
export function OperationalPageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton />
      <CardGridSkeleton count={6} />
    </PageShell>
  );
}

/** Actividad / audit trail */
export function ActivityPageSkeleton() {
  return (
    <PageShell>
      <div className="nf-activity-page">
        <PageHeaderSkeleton withAction={false} />
        <KpiSummarySkeleton count={4} />
        <ActivityTimelineSkeleton />
      </div>
    </PageShell>
  );
}

/** Grupos y permisos */
export function SplitAdminPageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton />
      <SplitAdminSkeleton />
    </PageShell>
  );
}

/** Cuenta, organización */
export function FormPageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton withAction={false} />
      <FormPanelSkeleton fields={6} />
    </PageShell>
  );
}

/** Billing */
export function BillingPageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton withAction={false} />
      <BillingSkeletonLayout />
    </PageShell>
  );
}

/** Informes — KPIs + paneles */
export function ReportingPageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton />
      <KpiSummarySkeleton count={3} />
      <div className="nf-skeleton-report-grid">
        <div className="nf-panel nf-skeleton-chart-panel">
          <Skeleton style={{ width: 140, height: 14, marginBottom: 16 }} rounded="sm" />
          <Skeleton style={{ width: "100%", height: 200 }} rounded="lg" />
        </div>
        <div className="nf-panel nf-skeleton-chart-panel">
          <Skeleton style={{ width: 120, height: 14, marginBottom: 16 }} rounded="sm" />
          <Skeleton style={{ width: "100%", height: 200 }} rounded="lg" />
        </div>
      </div>
      <TableSkeleton rows={5} />
    </PageShell>
  );
}

/** Setup / onboarding — pasos + formulario */
export function WizardPageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton withAction={false} />
      <div className="nf-skeleton-wizard-steps">
        {[1, 2, 3].map((i) => (
          <div key={i} className="nf-skeleton-wizard-step">
            <Skeleton style={{ width: 28, height: 28, flexShrink: 0 }} rounded="pill" />
            <Skeleton style={{ flex: 1, height: 12, maxWidth: 120 }} rounded="sm" />
          </div>
        ))}
      </div>
      <FormPanelSkeleton fields={4} />
    </PageShell>
  );
}

/** @deprecated Use DefaultPageSkeleton */
export const PageLoadingSkeleton = DefaultPageSkeleton;
