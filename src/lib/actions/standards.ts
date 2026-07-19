"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { getStandardSpec } from "@/lib/standards-catalog";
import { adoptStandardForOrganization, ensureStandardCatalog } from "@/lib/standards-adoption";

/**
 * Adopción de una norma por la organización actual.
 *
 * 1. Siembra (idempotente) el catálogo global Standard + Clause.
 * 2. Crea el vínculo OrganizationStandard si no existe.
 * 3. Crea la evaluación GAP inicial con una respuesta NOT_EVALUATED por
 *    cláusula hoja, para que el módulo GAP tenga filas editables desde
 *    el primer día.
 */
export async function adoptStandard(standardCode: "ISO_9001" | "ISO_27001") {
  const ctx = await requirePermission("gap:create");
  const spec = getStandardSpec(standardCode);
  if (!spec) throw new Error("Norma no soportada.");

  const standard = await ensureStandardCatalog(spec);
  const result = await adoptStandardForOrganization({
    organizationId: ctx.organization.id,
    standardCode: spec.code,
    standardId: standard.id,
    assessorId: ctx.user.id,
  });

  await logAuditEvent({
    ctx,
    action: "create",
    module: "gap",
    recordId: result.assessmentId,
    after: { standard: spec.code, version: spec.version, answersCreated: result.answersCreated },
    extra: { event: "adopt_standard" },
  });

  revalidatePath("/app/gap");
  revalidatePath("/app/dashboard");
  revalidatePath("/app/setup");
  return result;
}
