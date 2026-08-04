# Runbook — ISO 45001 customer support

Product support playbook for customers running `PACK_ISO_45001`. Not an
infra runbook — see [security-incident.md](security-incident.md) for that.
**symptoms → immediate actions → resolution → verification**, per
[README.md](README.md).

## Activation & entitlement

**Symptom:** customer can't activate ISO 45001 / sees "no incluye los
módulos requeridos" or lands on `/app/billing?upgrade=...`.
- Confirm the org has an `OrganizationPackEntitlement` row for
  `PACK_ISO_45001` (`enabled: true`, not expired) — grant via
  `grantPackEntitlement`. Never bypass via plan `modules`.
- Confirm the plan includes the pack's `requiredModules`
  (`src/lib/standard-packs/iso-45001-2018.pack.ts`).

## Clause coverage — where each requirement lives

| Clause | Module |
|---|---|
| 4.1/4.2 Contexto y partes interesadas | `/app/setup`, `/app/gap`, `/app/context` (standalone — no SIG needed) |
| 4.3 Alcance | `OrganizationStandard.scope` |
| 5.1/5.2 Liderazgo y política SST | `/app/documents` (tipo POLICY) |
| 5.4 Consulta y participación de trabajadores | `/app/safety` → Consulta |
| 6.1.1/6.1.2 Peligros, evaluación de riesgo | `/app/safety` → Peligros / Evaluación (W.T. Fine) |
| 6.1.2.3 Oportunidades SST | `EnvironmentalObjective`-equivalent en `/app/context` → Objetivos |
| 6.1.3 Requisitos legales | `/app/safety` → Cumplimiento |
| 7.2/7.3 Competencia y concienciación | `/app/training` |
| 7.4 Comunicación | `/app/quality-ops` → Comunicación |
| 7.5 Control documental | `/app/documents` |
| 8.1 Control operacional, permisos, EPP | `/app/safety` → Permisos, EPP |
| 8.1.3 Gestión del cambio | `/app/processes` (change control compartido) |
| 8.1.4 Compras, contratistas, tercerización | `/app/safety` → Contratistas (`Supplier`/`ContractorSafetyAssessment`) |
| 8.2 Preparación ante emergencias | `/app/safety` → Simulacros |
| 9.1.1 Vigilancia de la salud e indicadores | `/app/safety` → Vigilancia (sensible), Indicadores |
| 9.1.2 Evaluación del cumplimiento | `/app/safety` → Cumplimiento |
| 9.2 Auditoría interna | `/app/audit-program`, `/app/audits` |
| 9.3 Revisión por la dirección | `/app/management-review` |
| 10.1/10.2 Incidentes, investigación, mejora | `/app/safety` → Incidentes (workflow estricto) → CAPA |

## Common issues

**Cliente con rol de gestión no ve vigilancia de la salud.** Requiere el
permiso reforzado `safety-sensitive:*`, distinto del genérico `safety:*`.
Confirmar el rol (`ORG_ADMIN`/`ADMIN`, `MANAGER`, `COMPLIANCE_MANAGER` tienen
acceso completo; `AUDITOR` solo lectura/exportación; `CONTRIBUTOR`/`VIEWER`
nunca). Ver [occupational-safety-management.md](../occupational-safety-management.md#privacidad--vigilancia-de-la-salud).

**"Dato ilegible — verifica HEALTH_DATA_ENCRYPTION_KEY".** El campo cifrado
no pudo desencriptarse: la clave de entorno cambió o falta. Nunca rotar
`HEALTH_DATA_ENCRYPTION_KEY` sin re-cifrar los registros existentes primero
— coordinar con ingeniería, es una operación P1.

**Incidente no avanza de estado / rechaza el cambio.** El workflow es
estricto y de un solo paso: `REPORTED → CLASSIFIED → INVESTIGATING →
ROOT_CAUSE → ACTION_PLAN → IMPLEMENTED → EFFECTIVENESS_VERIFIED → CLOSED`.
No se puede saltar etapas ni retroceder — aplicado tanto en la acción del
servidor como por un trigger de Postgres (`nf_enforce_incident_workflow`).
Guiar al cliente a completar cada etapa en orden, nunca a "forzar" el
estado directamente en la base de datos.

**Permiso de trabajo atascado en DRAFT.** Debe pasar por `ACTIVE` antes de
`CLOSED`/`SUSPENDED`/`EXPIRED` — mismo patrón DB-enforced
(`nf_enforce_permit_workflow`).

**Reporte "paquete SST completo" no incluye vigilancia de la salud.** Es
intencional (minimización) — `safety-audit-package` nunca incluye
`safety-surveillance`. El cliente debe exportar ese reporte por separado si
su rol tiene `safety-sensitive:read`.

## Verification after any fix

- `npm run test:safety` against a disposable DB (never prod).
- `tests-live/occupational-safety-tenant.spec.ts` (tenant A/B, salud
  sensible, workflows DB-enforced, RLS, AuditLog, reportes, permisos) —
  requires `TEST_*` Supabase credentials, never the production project.

## Escalation

Data-integrity or cross-tenant leakage suspicion, or any suspected exposure
of health-surveillance data → treat as P0
([support-sla.md](../support-sla.md)), open a `SecurityIncident`, follow
[security-incident.md](security-incident.md).
