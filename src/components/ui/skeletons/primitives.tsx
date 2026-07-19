import Skeleton from "@/components/ui/Skeleton";

export function PageHeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="nf-page-loading-header nf-skeleton-page-header">
      <div className="nf-skeleton-page-header-text">
        <Skeleton style={{ width: "min(100%, 260px)", height: 28 }} rounded="md" />
        <Skeleton style={{ width: "min(100%, 480px)", height: 14 }} rounded="md" />
      </div>
      {withAction ? <Skeleton style={{ width: 132, height: 36, flexShrink: 0 }} rounded="pill" /> : null}
    </div>
  );
}

export function MetricStripSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="nf-metric-strip">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="nf-metric-cell nf-skeleton-metric-cell">
          <Skeleton style={{ width: 40, height: 40, flexShrink: 0 }} rounded="pill" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Skeleton style={{ width: 48, height: 22, marginBottom: 6 }} rounded="sm" />
            <Skeleton style={{ width: "72%", height: 12 }} rounded="sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function KpiSummarySkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="nf-kpi-summary">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="nf-kpi-summary-cell">
          <Skeleton style={{ width: 40, height: 40, flexShrink: 0 }} rounded="lg" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Skeleton style={{ width: 56, height: 20, marginBottom: 6 }} rounded="sm" />
            <Skeleton style={{ width: "65%", height: 12 }} rounded="sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FilterToolbarSkeleton({ selects = 2 }: { selects?: number }) {
  return (
    <div className="nf-skeleton-toolbar">
      <Skeleton style={{ flex: 1, minWidth: 200, height: 36 }} rounded="md" />
      {Array.from({ length: selects }, (_, i) => (
        <Skeleton key={i} style={{ width: 132, height: 36 }} rounded="md" />
      ))}
    </div>
  );
}

export function TabsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="nf-skeleton-tabs">
      <Skeleton style={{ width: 36, height: 12 }} rounded="sm" />
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} style={{ width: 88 + (i % 3) * 12, height: 32 }} rounded="pill" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="nf-panel nf-skeleton-table">
      <div className="nf-skeleton-table-head">
        {[18, 28, 14, 12, 8].map((w, i) => (
          <Skeleton key={i} style={{ width: `${w}%`, height: 12 }} rounded="sm" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="nf-skeleton-table-row">
          <Skeleton style={{ width: 36, height: 36 }} rounded="pill" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Skeleton style={{ width: `${55 + (i % 3) * 8}%`, height: 14, marginBottom: 6 }} rounded="sm" />
            <Skeleton style={{ width: `${35 + (i % 2) * 10}%`, height: 11 }} rounded="sm" />
          </div>
          <Skeleton style={{ width: 72, height: 24 }} rounded="pill" />
          <Skeleton style={{ width: 64, height: 32 }} rounded="pill" />
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="nf-skeleton-card-grid">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="nf-panel nf-skeleton-op-card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <Skeleton style={{ width: "58%", height: 16 }} rounded="sm" />
            <Skeleton style={{ width: 68, height: 22 }} rounded="pill" />
          </div>
          <Skeleton style={{ width: "92%", height: 12, marginBottom: 8 }} rounded="sm" />
          <Skeleton style={{ width: "74%", height: 12, marginBottom: 16 }} rounded="sm" />
          <div style={{ display: "flex", gap: 8 }}>
            <Skeleton style={{ width: 80, height: 11 }} rounded="sm" />
            <Skeleton style={{ width: 96, height: 11 }} rounded="sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProcessCardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="nf-skeleton-process-grid">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="nf-panel nf-skeleton-process-card">
          <div className="nf-skeleton-process-accent" />
          <div className="nf-skeleton-process-head">
            <Skeleton style={{ width: 44, height: 44, flexShrink: 0 }} rounded="lg" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Skeleton style={{ width: "72%", height: 16, marginBottom: 8 }} rounded="sm" />
              <Skeleton style={{ width: "46%", height: 11 }} rounded="sm" />
            </div>
            <Skeleton style={{ width: 70, height: 24 }} rounded="pill" />
          </div>
          <div className="nf-skeleton-mini-metrics">
            {[0, 1, 2, 3].map((j) => (
              <Skeleton key={j} style={{ width: "100%", height: 58 }} rounded="lg" />
            ))}
          </div>
          <Skeleton style={{ width: "100%", height: 8, marginTop: 16 }} rounded="pill" />
          <div className="nf-skeleton-card-tags">
            <Skeleton style={{ width: 82, height: 22 }} rounded="pill" />
            <Skeleton style={{ width: 96, height: 22 }} rounded="pill" />
            <Skeleton style={{ width: 72, height: 22 }} rounded="pill" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StackedCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="nf-skeleton-stacked-cards">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="nf-panel nf-skeleton-course-card">
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 280px" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <Skeleton style={{ width: 72, height: 12 }} rounded="sm" />
                <Skeleton style={{ width: 88, height: 22 }} rounded="pill" />
              </div>
              <Skeleton style={{ width: "70%", height: 18, marginBottom: 8 }} rounded="sm" />
              <Skeleton style={{ width: "95%", height: 12, marginBottom: 6 }} rounded="sm" />
              <Skeleton style={{ width: "80%", height: 12 }} rounded="sm" />
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <Skeleton style={{ width: 88, height: 32 }} rounded="pill" />
              <Skeleton style={{ width: 88, height: 32 }} rounded="pill" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActionListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="nf-skeleton-action-list">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="nf-panel nf-skeleton-action-card">
          <div className="nf-skeleton-action-main">
            <div style={{ flex: "1 1 280px", minWidth: 0 }}>
              <div className="nf-skeleton-card-tags" style={{ marginTop: 0 }}>
                <Skeleton style={{ width: 78, height: 22 }} rounded="pill" />
                <Skeleton style={{ width: 92, height: 22 }} rounded="pill" />
                <Skeleton style={{ width: 58, height: 18 }} rounded="sm" />
              </div>
              <Skeleton style={{ width: `${68 + (i % 2) * 10}%`, height: 17, marginBottom: 9 }} rounded="sm" />
              <Skeleton style={{ width: `${78 - (i % 3) * 8}%`, height: 12 }} rounded="sm" />
            </div>
            <div className="nf-skeleton-action-side">
              <Skeleton style={{ width: 86, height: 12 }} rounded="sm" />
              <Skeleton style={{ width: 118, height: 8 }} rounded="pill" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function KanbanSkeleton({ columns = 3, cards = 3 }: { columns?: number; cards?: number }) {
  return (
    <div className="nf-skeleton-kanban">
      {Array.from({ length: columns }, (_, col) => (
        <div key={col} className="nf-panel nf-skeleton-kanban-column">
          <div className="nf-skeleton-kanban-head">
            <Skeleton style={{ width: 108, height: 14 }} rounded="sm" />
            <Skeleton style={{ width: 28, height: 22 }} rounded="pill" />
          </div>
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className="nf-skeleton-kanban-card">
              <Skeleton style={{ width: `${72 - (i % 2) * 10}%`, height: 14, marginBottom: 8 }} rounded="sm" />
              <Skeleton style={{ width: "92%", height: 11, marginBottom: 12 }} rounded="sm" />
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <Skeleton style={{ width: 72, height: 20 }} rounded="pill" />
                <Skeleton style={{ width: 48, height: 20 }} rounded="pill" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function HeatmapSkeleton() {
  return (
    <div className="nf-panel nf-skeleton-heatmap-panel">
      <div className="nf-skeleton-panel-head">
        <Skeleton style={{ width: 132, height: 15 }} rounded="sm" />
        <Skeleton style={{ width: 76, height: 24 }} rounded="pill" />
      </div>
      <div className="nf-skeleton-heatmap">
        {Array.from({ length: 25 }, (_, i) => (
          <Skeleton key={i} style={{ width: "100%", aspectRatio: "1 / 1" }} rounded="sm" />
        ))}
      </div>
    </div>
  );
}

export function ProgressListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="nf-skeleton-progress-list">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="nf-skeleton-progress-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Skeleton style={{ width: 42, height: 16 }} rounded="sm" />
              <Skeleton style={{ width: `${45 + (i % 4) * 8}%`, height: 14 }} rounded="sm" />
            </div>
            <Skeleton style={{ width: "100%", height: 7 }} rounded="pill" />
          </div>
          <Skeleton style={{ width: 74, height: 24, flexShrink: 0 }} rounded="pill" />
        </div>
      ))}
    </div>
  );
}

export function IntegrationsGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="nf-skeleton-integrations-grid">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="nf-panel nf-skeleton-integration-card">
          <div className="nf-skeleton-integration-top">
            <Skeleton style={{ width: 42, height: 42, flexShrink: 0 }} rounded="lg" />
            <Skeleton style={{ width: 78, height: 22 }} rounded="pill" />
          </div>
          <Skeleton style={{ width: `${58 + (i % 3) * 8}%`, height: 16, marginBottom: 8 }} rounded="sm" />
          <Skeleton style={{ width: "92%", height: 12, marginBottom: 6 }} rounded="sm" />
          <Skeleton style={{ width: "74%", height: 12 }} rounded="sm" />
        </div>
      ))}
    </div>
  );
}

export function ChartPanelSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="nf-panel nf-skeleton-chart-panel">
      <div className="nf-skeleton-panel-head">
        <Skeleton style={{ width: 136, height: 14 }} rounded="sm" />
        <Skeleton style={{ width: 90, height: 28 }} rounded="pill" />
      </div>
      <Skeleton style={{ width: "100%", height }} rounded="lg" />
    </div>
  );
}

export function SplitAdminSkeleton() {
  return (
    <div className="nf-groups-admin">
      <aside className="nf-panel nf-skeleton-rail">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <Skeleton style={{ width: 56, height: 12 }} rounded="sm" />
          <Skeleton style={{ width: 28, height: 22 }} rounded="pill" />
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="nf-skeleton-rail-item">
            <Skeleton style={{ width: 40, height: 40, flexShrink: 0 }} rounded="lg" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Skeleton style={{ width: "78%", height: 14, marginBottom: 6 }} rounded="sm" />
              <Skeleton style={{ width: "52%", height: 11 }} rounded="sm" />
            </div>
          </div>
        ))}
      </aside>
      <div className="nf-panel nf-skeleton-detail">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Skeleton style={{ width: 180, height: 22, marginBottom: 8 }} rounded="sm" />
            <Skeleton style={{ width: "90%", height: 13 }} rounded="sm" />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Skeleton style={{ width: 96, height: 36 }} rounded="pill" />
            <Skeleton style={{ width: 96, height: 36 }} rounded="pill" />
          </div>
        </div>
        <div className="nf-groups-detail-split">
          <div>
            <Skeleton style={{ width: 100, height: 13, marginBottom: 12 }} rounded="sm" />
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="nf-skeleton-member-row">
                <Skeleton style={{ width: 32, height: 32 }} rounded="pill" />
                <Skeleton style={{ flex: 1, height: 14 }} rounded="sm" />
              </div>
            ))}
          </div>
          <div>
            <Skeleton style={{ width: 120, height: 13, marginBottom: 12 }} rounded="sm" />
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} style={{ width: "100%", height: 52, marginBottom: 8 }} rounded="lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ActivityTimelineSkeleton() {
  return (
    <div className="nf-activity-panel nf-skeleton-activity-panel">
      <FilterToolbarSkeleton selects={4} />
      <div className="nf-skeleton-timeline">
        {Array.from({ length: 2 }, (_, g) => (
          <div key={g} className="nf-skeleton-timeline-group">
            <Skeleton style={{ width: 120, height: 14, marginBottom: 12 }} rounded="sm" />
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="nf-skeleton-timeline-row">
                <Skeleton style={{ width: 10, height: 10, flexShrink: 0, marginTop: 6 }} rounded="pill" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Skeleton style={{ width: `${60 + i * 8}%`, height: 14, marginBottom: 6 }} rounded="sm" />
                  <Skeleton style={{ width: `${40 + i * 5}%`, height: 11 }} rounded="sm" />
                </div>
                <Skeleton style={{ width: 56, height: 11 }} rounded="sm" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormPanelSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="nf-panel nf-skeleton-form">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="nf-skeleton-form-field">
          <Skeleton style={{ width: 96 + (i % 3) * 20, height: 12, marginBottom: 8 }} rounded="sm" />
          <Skeleton style={{ width: "100%", height: 40 }} rounded="md" />
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
        <Skeleton style={{ width: 96, height: 36 }} rounded="pill" />
        <Skeleton style={{ width: 112, height: 36 }} rounded="pill" />
      </div>
    </div>
  );
}

export function BillingSkeletonLayout() {
  return (
    <>
      <KpiSummarySkeleton count={3} />
      <div className="nf-skeleton-billing-plans">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="nf-panel nf-skeleton-plan-card">
            <Skeleton style={{ width: 88, height: 18, marginBottom: 10 }} rounded="sm" />
            <Skeleton style={{ width: 72, height: 28, marginBottom: 16 }} rounded="sm" />
            {Array.from({ length: 3 }, (_, j) => (
              <Skeleton key={j} style={{ width: "85%", height: 12, marginBottom: 8 }} rounded="sm" />
            ))}
            <Skeleton style={{ width: "100%", height: 36, marginTop: 12 }} rounded="pill" />
          </div>
        ))}
      </div>
    </>
  );
}

export function DashboardSkeletonLayout() {
  return (
    <>
      <div className="nf-dash-actions">
        {[120, 100, 110, 95].map((w, i) => (
          <Skeleton key={i} style={{ width: w, height: 36 }} rounded="pill" />
        ))}
      </div>
      <div className="nf-dash-hero-grid">
        <div className="nf-dash-card">
          <Skeleton style={{ width: 140, height: 12, marginBottom: 10 }} rounded="sm" />
          <Skeleton style={{ width: 100, height: 36, marginBottom: 16 }} rounded="sm" />
          <Skeleton style={{ width: "100%", height: 100 }} rounded="lg" />
        </div>
        <div className="nf-dash-card">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <Skeleton style={{ width: 32, height: 32, flexShrink: 0 }} rounded="lg" />
              <Skeleton style={{ flex: 1, height: 14 }} rounded="sm" />
              <Skeleton style={{ width: 36, height: 14 }} rounded="sm" />
            </div>
          ))}
        </div>
      </div>
      <div className="nf-dash-bottom-grid">
        <div className="nf-dash-table-wrap">
          <Skeleton style={{ width: 160, height: 16, marginBottom: 16 }} rounded="sm" />
          <div className="nf-skeleton-table nf-panel">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="nf-skeleton-table-row" style={{ gridTemplateColumns: "1fr auto auto" }}>
                <Skeleton style={{ width: `${50 + i * 6}%`, height: 14 }} rounded="sm" />
                <Skeleton style={{ width: 72, height: 14 }} rounded="sm" />
                <Skeleton style={{ width: 56, height: 14 }} rounded="sm" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
