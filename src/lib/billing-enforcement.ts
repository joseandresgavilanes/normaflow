import "server-only";
import { prisma } from "@/lib/prisma";

export async function enforceBillingGracePeriods(now = new Date()) {
  const overdue = await prisma.subscription.findMany({ where: { status: "GRACE_PERIOD", gracePeriodEndsAt: { lt: now } }, select: { id: true, organizationId: true } });
  if (!overdue.length) return { suspended: 0 };
  const result = await prisma.$transaction(async (tx) => {
    let suspended = 0;
    for (const subscription of overdue) {
      const changed = await tx.subscription.updateMany({ where: { id: subscription.id, status: "GRACE_PERIOD", gracePeriodEndsAt: { lt: now } }, data: { status: "SUSPENDED", suspendedAt: now } });
      if (changed.count === 1) {
        suspended += 1;
        await tx.auditLog.create({ data: { organizationId: subscription.organizationId, action: "subscription_suspended", module: "billing", recordId: subscription.id, metadata: { before: { status: "GRACE_PERIOD" }, after: { status: "SUSPENDED" }, at: now.toISOString() } } });
      }
    }
    return suspended;
  });
  return { suspended: result };
}
