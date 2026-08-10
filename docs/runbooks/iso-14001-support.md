# Runbook — ISO 14001 customer support

Product support playbook for customers running `PACK_ISO_14001`. Not an
infra runbook — see [security-incident.md](security-incident.md) for that.
**symptoms → immediate actions → resolution → verification**, per
[README.md](README.md).

## Activation & entitlement

**Symptom:** customer can't activate ISO 14001 / sees "no incluye los
módulos requeridos" or lands on `/app/billing?upgrade=...`.
- Confirm the org has an `OrganizationPackEntitlement` row for
  `PACK_ISO_14001` (`enabled: true`, not expired) — grant via
  `grantPackEntitlement`. Never bypass via plan `modules`.
- Confirm the plan includes the pack's `requiredModules`
  (`src/lib/standard-packs/iso-14001-2015.pack.ts`).

## Clause coverage — where each requirement lives

| Clause | Module |
|---|---|
| 4.1/4.2 Contexto y partes interesadas | `/app/setup`, `/app/gap`, `/app/context` (standalone — no SIG needed) |
| 4.3 Alcance | `OrganizationStandard.scope` |
| 5.2 Política ambiental | `/app/documents` (tipo POLICY) |
| 6.1.2 Aspectos, impactos, significancia | `/app/environment` → Matriz |
| 6.1.2.a Condiciones normal/anormal/emergencia | `EnvironmentalAspect.condition` |
| 6.1.2.b Perspectiva de ciclo de vida | `EnvironmentalAspect.lifeCycleStage` (+ `/app/design-dev` si hay desarrollo de producto) |
| 6.1.3 Obligaciones legales | `/app/environment` → Cumplimiento |
| 6.2 Objetivos ambientales | `/app/environment` → Objetivos, `/app/context` |
| 7.2/7.3 Competencia y concienciación | `/app/training` |
| 7.4 Comunicación ambiental | `/app/quality-ops` → Comunicación |
| 7.5 Control documental | `/app/documents` |
| 8.1 Controles operacionales | `/app/processes` |
| 8.2 Preparación y respuesta ante emergencias | `/app/environment` → Emergencias |
| 9.1.1 Seguimiento y medición | `/app/environment` → Indicadores |
| 9.1.2 Evaluación del cumplimiento | `/app/environment` → Cumplimiento |
| 9.2 Auditoría interna | `/app/audit-program`, `/app/audits` |
| 9.3 Revisión por la dirección | `/app/management-review` |
| 10.2 No conformidad y mejora | `/app/nonconformities` → CAPA |

## Common issues

**Significancia no coincide con lo esperado.** El método activo
(`EnvironmentalSignificanceMethod`) determina la fórmula/pesos/umbral.
Verifica cuál está `active: true` — crear una versión nueva con el mismo
`name` desactiva la anterior automáticamente (no la borra). Usa
`recomputeSignificance` para recalcular todos los impactos tras un cambio de
metodología, en vez de editarlos uno por uno.

**Obligación no avanza su fecha de revisión.** Solo ocurre si la evaluación
se registra con `advanceReview: true` (por defecto) y la obligación tiene
`reviewFrequencyMonths` configurado.

**"Biodiversidad" — cliente dice que el formulario no encaja con su caso.**
Es intencional: es configurable (sitio, tipo de ecosistema y cadencia de
monitoreo son texto libre definido por el cliente), no un checklist fijo.
Guíalo a describir su propio sitio/ecosistema en vez de buscar opciones
predefinidas que no existen.

**Reporte "paquete ambiental completo" no incluye una sección nueva.**
`env-audit-package` agrega manualmente una lista de secciones en
`src/lib/actions/reporting.ts` — si se agrega un nuevo tipo de reporte
ambiental, hay que añadirlo a esa lista explícitamente.

## Verification after any fix

- `npm run test:env` against a disposable DB (never prod).
- `tests-live/environmental-tenant.spec.ts` (tenant A/B, RLS, AuditLog,
  reportes, significancia, permisos) — requires `TEST_*` Supabase
  credentials, never the production project.

## Escalation

Data-integrity or cross-tenant leakage suspicion → treat as P0
([support-sla.md](../support-sla.md)), open a `SecurityIncident`, follow
[security-incident.md](security-incident.md).
