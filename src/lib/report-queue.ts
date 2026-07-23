import { createHash } from "node:crypto";
import type { LiveAppContext } from "@/lib/app-context";
import { createReportArtifact } from "@/lib/report-artifacts";
import type { ReportFilters } from "@/lib/reporting-contract";

export async function queueReportForContext(input: {
  ctx: LiveAppContext;
  reportType: string;
  title: string;
  format: "PDF" | "EXCEL";
  fileName: string;
  dateFrom: Date;
  dateTo: Date;
  filters: ReportFilters;
}) {
  const idempotencyKey = createHash("sha256").update(JSON.stringify({ organizationId: input.ctx.organization.id, reportType: input.reportType, title: input.title, format: input.format, filters: input.filters })).digest("hex");
  return createReportArtifact({ ...input, organizationId: input.ctx.organization.id, userId: input.ctx.user.id, idempotencyKey, auditContext: input.ctx });
}
