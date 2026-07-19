import type { ComponentType } from "react";
import {
  ActionsPageSkeleton,
  ActivityPageSkeleton,
  AuditsPageSkeleton,
  BillingPageSkeleton,
  ChangeControlPageSkeleton,
  DashboardPageSkeleton,
  DefaultPageSkeleton,
  EvidencePageSkeleton,
  FormPageSkeleton,
  GapPageSkeleton,
  IndicatorsPageSkeleton,
  IntegrationsPageSkeleton,
  NotificationsPageSkeleton,
  OperationalPageSkeleton,
  ProcessesPageSkeleton,
  ReportingWorkspaceSkeleton,
  RisksPageSkeleton,
  SplitAdminPageSkeleton,
  TablePageSkeleton,
  TrainingPageSkeleton,
  WizardPageSkeleton,
} from "@/components/ui/skeletons/sections";

export type PageSkeletonComponent = ComponentType;

const EXACT: Record<string, PageSkeletonComponent> = {
  "/app/dashboard": DashboardPageSkeleton,
  "/app/documents": TablePageSkeleton,
  "/app/training": TrainingPageSkeleton,
  "/app/activity": ActivityPageSkeleton,
  "/app/records": TablePageSkeleton,
  "/app/billing": BillingPageSkeleton,
  "/app/reporting": ReportingWorkspaceSkeleton,
  "/app/setup": WizardPageSkeleton,
  "/app/onboarding": WizardPageSkeleton,
  "/app/settings": FormPageSkeleton,
  "/app/settings/organization": FormPageSkeleton,
  "/app/settings/users": TablePageSkeleton,
  "/app/settings/groups": SplitAdminPageSkeleton,
  "/app/processes": ProcessesPageSkeleton,
  "/app/risks": RisksPageSkeleton,
  "/app/audits": AuditsPageSkeleton,
  "/app/nonconformities": OperationalPageSkeleton,
  "/app/changes": ChangeControlPageSkeleton,
  "/app/suppliers": TablePageSkeleton,
  "/app/indicators": IndicatorsPageSkeleton,
  "/app/evidence": EvidencePageSkeleton,
  "/app/actions": ActionsPageSkeleton,
  "/app/integrations": IntegrationsPageSkeleton,
  "/app/gap": GapPageSkeleton,
  "/app/notifications": NotificationsPageSkeleton,
  "/app/audit-program": AuditsPageSkeleton,
  "/app/management-review": OperationalPageSkeleton,
  "/app/info/personnel": TablePageSkeleton,
  "/app/info/positions": TablePageSkeleton,
};

const PREFIX: { prefix: string; skeleton: PageSkeletonComponent }[] = [
  { prefix: "/app/catalogs/", skeleton: TablePageSkeleton },
];

export function resolvePageSkeleton(pathname: string): PageSkeletonComponent {
  if (EXACT[pathname]) return EXACT[pathname];
  for (const { prefix, skeleton } of PREFIX) {
    if (pathname.startsWith(prefix)) return skeleton;
  }
  return DefaultPageSkeleton;
}
