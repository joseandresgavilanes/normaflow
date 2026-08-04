# Runbook — ISO 13485 (medical device QMS) customer support

Product support playbook for customers running `PACK_ISO_13485`. Not an
infra runbook — see [security-incident.md](security-incident.md) for that.
**symptoms → immediate actions → resolution → verification**, per
[README.md](README.md).

## Activation & entitlement

**Symptom:** customer can't activate ISO 13485 / sees "no incluye los
módulos requeridos" or lands on `/app/billing?upgrade=...`.
- Confirm the org has an `OrganizationPackEntitlement` row for
  `PACK_ISO_13485` (`enabled: true`, not expired) — grant via
  `grantPackEntitlement`. Never bypass via plan `modules`.
- Confirm the plan includes the pack's `requiredModules`
  (`src/lib/standard-packs/iso-13485-2016.pack.ts`) — `medical-devices` in
  particular is Growth+ only.

## Clause coverage — where each function lives

| Función | Módulo |
|---|---|
| Contexto, alcance, política, responsabilidad | `/app/context` |
| Familias, dispositivos, expediente maestro (DMR) | `/app/medical-devices` → Dispositivos, Expediente maestro |
| DHF, inputs, outputs, revisiones, verificación, validación, transferencia | `/app/medical-devices` → Diseño (DHF) |
| Gestión de riesgos | `/app/medical-devices` → Risks |
| Proveedores críticos, calificación, compras | `/app/medical-devices` → Suppliers |
| Validación de procesos, esterilización configurable | `/app/medical-devices` → Validaciones |
| Producción, lotes, trazabilidad | `/app/medical-devices` → Lotes / traza |
| Quejas, eventos adversos, PMS, FSCA, retiros | `/app/medical-devices` → Vigilancia (requiere `md-sensitive`) |
| Requisitos regulatorios, presentaciones | `/app/medical-devices` → Regulatorio |
| Producto no conforme | `/app/nonconformities` (reutilizado, sin duplicar) |
| CAPA | `/app/actions` (reutilizado) |
| Auditoría | `/app/audit-program`, `/app/audits` |
| Revisión por dirección | `/app/management-review` |

## Common issues

**Un cliente con rol CONTRIBUTOR o VIEWER no ve quejas, eventos adversos,
PMS, FSCA ni retiros.** Es intencional — esas cinco tablas están detrás
de `md-sensitive:*`, un permiso deliberadamente distinto de
`medical-devices:*` y no otorgado a CONTRIBUTOR/VIEWER por defecto (igual
que `safety-sensitive` para vigilancia de la salud en ISO 45001). Otorgar
el permiso solo a roles de gestión/auditoría que realmente necesiten ver
vigilancia de producto.

**Un evento adverso, una vigilancia PMS o una acción de campo no cambian
de estado.** Usar `transitionAdverseEvent` / `transitionPostMarketSurveillance`
/ `transitionFieldSafetyAction` respectivamente — cada uno sigue su
propio workflow (`REPORTED→…→CLOSED`, `PLANNED→…→COMPLETED`,
`DRAFT→…→CLOSED`), separado del de quejas y retiros.

**Una verificación o validación de diseño con resultado distinto de
`PENDING` no se puede guardar sin evaluador.** Es un CHECK de base de
datos (`md_verification_pass_attributed` / `md_validation_pass_attributed`)
— confirmar que la acción se llamó con un usuario autenticado real, no
una inserción directa sin `verifiedById`/`validatedById`.

**Una queja o un evento adverso no se pueden purgar.** La purga solo
procede sobre un expediente **cerrado** cuya retención ya venció —
reforzado por CHECK (`md_complaint_purge_after_retention` /
`md_ae_purge_after_retention`). El plazo de retención es configurable
por organización (`/app/medical-devices` → Vigilancia → "Configurar
retención"; por defecto 15 años) y se calcula al cerrar el expediente,
no al crearlo.

**El texto libre de una queja/evento/PMS/FSCA aparece cifrado o
ilegible.** Esos campos (`description`, `investigationSummary`,
`findings`, `reason`) se cifran en reposo con
`MD_SENSITIVE_DATA_ENCRYPTION_KEY`. Si la clave no está configurada, la
escritura falla explícitamente (no se guarda en claro); si cambia
después de escribir datos, los registros previos dejan de poder
descifrarse — nunca rotar esa clave sin plan de migración.

**Reporte "paquete de auditoría dispositivos médicos" no incluye
quejas/PMS/eventos/retiros.** Es intencional — `md-audit-package` excluye
deliberadamente las cuatro secciones `md-sensitive` (minimización de
datos: un compendio pedido con `medical-devices:export` no debe llevar
vigilancia de producto sin más). Exportarlas por separado con
`md-sensitive:read`.

## Verification after any fix

- `DATABASE_URL=…disposable… npm run test:medical-devices` against a
  disposable DB (never prod).
- `tests-live/medical-devices-tenant.spec.ts` (instalación del pack,
  acceso sensible incluida la reclasificación de PMS, diseño, lote,
  trazabilidad, queja, evento adverso, retiro, tenant A/B, RLS,
  AuditLog, reportes) — requires `TEST_*` Supabase credentials, never
  the production project.

## Escalation

Data-integrity or cross-tenant leakage suspicion, a CONTRIBUTOR/VIEWER
account that can read `md_complaints`/`md_adverse_events`/
`md_post_market_surveillances`/`md_field_safety_actions`/`md_product_recalls`,
a purge that succeeded before the retention deadline, or vigilance free
text that appears to be stored in plaintext → treat as P0
([support-sla.md](../support-sla.md)), open a `SecurityIncident`, follow
[security-incident.md](security-incident.md).
