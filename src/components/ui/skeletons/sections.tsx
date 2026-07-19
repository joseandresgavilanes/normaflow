import Skeleton from "@/components/ui/Skeleton";
import {
  ActionListSkeleton,
  ActivityTimelineSkeleton,
  BillingSkeletonLayout,
  CardGridSkeleton,
  ChartPanelSkeleton,
  DashboardSkeletonLayout,
  FilterToolbarSkeleton,
  FormPanelSkeleton,
  HeatmapSkeleton,
  IntegrationsGridSkeleton,
  KanbanSkeleton,
  KpiSummarySkeleton,
  MetricStripSkeleton,
  PageHeaderSkeleton,
  ProcessCardGridSkeleton,
  ProgressListSkeleton,
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

/** Procesos, auditorías, revisiones y programas en tarjetas */
export function OperationalPageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton />
      <CardGridSkeleton count={6} />
    </PageShell>
  );
}

export function ProcessesPageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton />
      <KpiSummarySkeleton count={4} />
      <ProcessCardGridSkeleton count={6} />
    </PageShell>
  );
}

export function RisksPageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton />
      <div className="nf-skeleton-risk-grid">
        <HeatmapSkeleton />
        <div>
          <KpiSummarySkeleton count={3} />
          <div className="nf-panel nf-skeleton-table-wrap" style={{ marginTop: 14 }}>
            <FilterToolbarSkeleton selects={2} />
            <TableSkeleton rows={5} />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export function GapPageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton />
      <TabsSkeleton count={2} />
      <div className="nf-skeleton-gap-grid">
        <div className="nf-panel nf-skeleton-gap-main">
          <div className="nf-skeleton-gap-summary">
            <div>
              <Skeleton style={{ width: 132, height: 13, marginBottom: 10 }} rounded="sm" />
              <Skeleton style={{ width: 112, height: 48 }} rounded="sm" />
            </div>
            <div className="nf-skeleton-gap-counts">
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <Skeleton style={{ width: 42, height: 24, margin: "0 auto 6px" }} rounded="sm" />
                  <Skeleton style={{ width: 72, height: 10 }} rounded="sm" />
                </div>
              ))}
            </div>
          </div>
          <ProgressListSkeleton rows={8} />
        </div>
        <div className="nf-skeleton-gap-side">
          <ChartPanelSkeleton height={120} />
          <div className="nf-panel nf-skeleton-chart-panel">
            <Skeleton style={{ width: 130, height: 14, marginBottom: 14 }} rounded="sm" />
            <ProgressListSkeleton rows={4} />
          </div>
          <Skeleton style={{ width: "100%", height: 40 }} rounded="pill" />
        </div>
      </div>
    </PageShell>
  );
}

export function ActionsPageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton />
      <KpiSummarySkeleton count={4} />
      <TabsSkeleton count={4} />
      <ActionListSkeleton count={5} />
    </PageShell>
  );
}

export function ChangeControlPageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton />
      <KpiSummarySkeleton count={4} />
      <KanbanSkeleton columns={4} cards={3} />
      <ChartPanelSkeleton height={150} />
    </PageShell>
  );
}

export function AuditsPageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton />
      <div className="nf-panel nf-skeleton-audit-program">
        <Skeleton style={{ width: 42, height: 42, flexShrink: 0 }} rounded="lg" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Skeleton style={{ width: 108, height: 12, marginBottom: 8 }} rounded="sm" />
          <Skeleton style={{ width: "58%", height: 17, marginBottom: 10 }} rounded="sm" />
          <Skeleton style={{ width: "84%", height: 12 }} rounded="sm" />
        </div>
      </div>
      <KpiSummarySkeleton count={4} />
      <CardGridSkeleton count={6} />
    </PageShell>
  );
}

export function IndicatorsPageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton />
      <KpiSummarySkeleton count={4} />
      <div className="nf-skeleton-report-grid">
        <ChartPanelSkeleton height={220} />
        <ChartPanelSkeleton height={220} />
      </div>
      <ActionListSkeleton count={4} />
    </PageShell>
  );
}

export function EvidencePageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton />
      <MetricStripSkeleton count={3} />
      <div className="nf-panel nf-skeleton-table-wrap">
        <FilterToolbarSkeleton selects={3} />
        <TableSkeleton rows={7} />
      </div>
    </PageShell>
  );
}

export function NotificationsPageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton />
      <MetricStripSkeleton count={3} />
      <TabsSkeleton count={4} />
      <ActionListSkeleton count={6} />
    </PageShell>
  );
}

export function IntegrationsPageSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton withAction={false} />
      <IntegrationsGridSkeleton count={8} />
    </PageShell>
  );
}

export function ReportingWorkspaceSkeleton() {
  return (
    <PageShell>
      <PageHeaderSkeleton />
      <KpiSummarySkeleton count={3} />
      <div className="nf-panel nf-skeleton-table-wrap">
        <FilterToolbarSkeleton selects={3} />
      </div>
      <CardGridSkeleton count={4} />
      <TableSkeleton rows={5} />
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
        <ChartPanelSkeleton height={200} />
        <ChartPanelSkeleton height={200} />
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
