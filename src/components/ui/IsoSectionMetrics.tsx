import IsoMetricCard from "@/components/ui/IsoMetricCard";

export type IsoSectionMetric = { label: string; value: string | number; suffix?: string; accent?: string };

export default function IsoSectionMetrics({ items }: { items: IsoSectionMetric[] }) {
  return <div className="nf-iso-section-metrics">{items.map((item) => <IsoMetricCard key={item.label} {...item} />)}</div>;
}
