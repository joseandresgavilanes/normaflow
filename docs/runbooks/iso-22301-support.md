# Runbook — ISO 22301 (BCM) customer support

Product support playbook for customers running `PACK_ISO_22301`. Not an
infra runbook — see [security-incident.md](security-incident.md) for that.
**symptoms → immediate actions → resolution → verification**, per
[README.md](README.md).

## Activation & entitlement

**Symptom:** customer can't activate ISO 22301 / sees "no incluye los
módulos requeridos" or lands on `/app/billing?upgrade=...`.
- Confirm the org has an `OrganizationPackEntitlement` row for
  `PACK_ISO_22301` (`enabled: true`, not expired) — grant via
  `grantPackEntitlement`. Never bypass via plan `modules`.
- Confirm the plan includes the pack's `requiredModules`
  (`src/lib/standard-packs/iso-22301-2019.pack.ts`) — `continuity` in
  particular is Growth+ only.

## Clause coverage — where each function lives

| Función | Módulo |
|---|---|
| Contexto, partes interesadas, alcance | `/app/setup`, `/app/gap`, `/app/context` (standalone — no SIG needed) |
| Política de continuidad | `/app/documents` (tipo POLICY) |
| Roles | `IntegratedSystemStandard.responsibleId` / propietarios por entidad (BIA, actividad, estrategia, equipo de crisis) |
| Riesgos | `/app/risks` + `ContinuityScenario.riskId` |
| Objetivos | `/app/context` → Objetivos |
| BIA, procesos críticos, productos/servicios, MTPD/RTO/RPO, nivel mínimo | `/app/continuity` → BIA y actividades |
| Dependencias (personas, instalaciones, tecnología, datos, proveedores) | `/app/continuity` → Dependencias y recursos |
| Estrategias | `/app/continuity` → Estrategias |
| Planes | `/app/continuity` → Planes |
| Equipos de crisis, comunicación | `/app/continuity` → Equipos de crisis |
| Activación | `/app/continuity` → Planes → Activar plan |
| Escenarios | `/app/continuity` → Planes → detalle del plan |
| Simulacros, ejercicios, resultados | `/app/continuity` → Simulacros |
| Lecciones aprendidas | Registradas al desactivar el plan o cerrar un simulacro |
| Auditoría | `/app/audit-program`, `/app/audits` |
| Revisión por dirección | `/app/management-review` |
| Mejora | `/app/continuity` → Simulacros → acciones de mejora, `/app/nonconformities` |

## Common issues

**Cliente no puede activar un plan.** Solo se pueden activar planes en
estado `APPROVED` (`activatePlan` lo rechaza si no). Guiar al cliente a
aprobar el plan primero (`/app/continuity` → Planes → "Aprobar plan").

**RTO mayor que el MTPD al crear una actividad crítica.** Es un rechazo
intencional (`assertRtoWithinMtpd`, `src/lib/continuity/bia.ts`) — el tiempo
objetivo de recuperación nunca puede superar el tiempo máximo tolerable de
interrupción. Corregir uno de los dos valores.

**Plan editado pierde el propietario o la fecha de próxima revisión.**
Corregido en esta entrega: `updateBcp`/`updateDrp` ahora usan un esquema
parcial — un campo que no se envía ya no se sobrescribe a vacío. Si un
cliente reporta este síntoma, confirmar que está en la versión desplegada
después del fix (migración de código, no de base de datos).

**Reporte "auditoría de continuidad completa" no incluye una sección
nueva.** `bcm-audit-package` agrega manualmente una lista de secciones en
`src/lib/actions/reporting.ts` — si se agrega un nuevo tipo de reporte BCM,
hay que añadirlo a esa lista explícitamente.

**Cliente pregunta por qué no puede borrar un BIA o un plan.** No hay un
flujo de "eliminar" para BIA/actividades/planes en el producto — solo
desvincular un proceso crítico de un plan. El permiso `continuity:delete`
existe a nivel de RLS (vía el comodín `continuity:*` de roles de gestión)
pero ningún botón lo ejercita hoy; es una decisión de producto (histórico de
continuidad no se borra), no un bug.

## Verification after any fix

- `DATABASE_URL=…disposable… npm run test:bcm` against a disposable DB
  (never prod).
- `tests-live/bcm-tenant.spec.ts` (instalación del pack, tenant A/B, BIA,
  RTO/RPO/MTPD, activación de planes, simulacros, reportes, AuditLog, RLS,
  evidencias) — requires `TEST_*` Supabase credentials, never the
  production project.

## Escalation

Data-integrity or cross-tenant leakage suspicion, or any activation record
that appears to have been tampered with → treat as P0
([support-sla.md](../support-sla.md)), open a `SecurityIncident`, follow
[security-incident.md](security-incident.md).
