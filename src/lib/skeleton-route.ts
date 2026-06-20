import type { ComponentType } from "react";
import {
  ActivityPageSkeleton,
  BillingPageSkeleton,
  DashboardPageSkeleton,
  DefaultPageSkeleton,
  FormPageSkeleton,
  OperationalPageSkeleton,
  ReportingPageSkeleton,
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
  "/app/reporting": ReportingPageSkeleton,
  "/app/setup": WizardPageSkeleton,
  "/app/onboarding": WizardPageSkeleton,
  "/app/settings": FormPageSkeleton,
  "/app/settings/organization": FormPageSkeleton,
  "/app/settings/users": TablePageSkeleton,
  "/app/settings/groups": SplitAdminPageSkeleton,
  "/app/processes": OperationalPageSkeleton,
  "/app/risks": OperationalPageSkeleton,
  "/app/audits": OperationalPageSkeleton,
  "/app/nonconformities": OperationalPageSkeleton,
  "/app/changes": OperationalPageSkeleton,
  "/app/suppliers": OperationalPageSkeleton,
  "/app/indicators": OperationalPageSkeleton,
  "/app/evidence": OperationalPageSkeleton,
  "/app/actions": OperationalPageSkeleton,
  "/app/integrations": OperationalPageSkeleton,
  "/app/gap": OperationalPageSkeleton,
  "/app/notifications": TablePageSkeleton,
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
