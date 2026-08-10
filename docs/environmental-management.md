# Paquete de Gestión Ambiental (ISO 14001)

Módulo `/app/environment`: sistema de gestión ambiental — aspectos → impactos
(significancia versionada) → cumplimiento legal → objetivos/programas →
indicadores (agua/energía/combustible/emisiones/vertidos/residuos/materias
primas) → residuos → emergencias → biodiversidad.

## Modelos (11)

`EnvironmentalAspect` · `EnvironmentalImpact` · `EnvironmentalSignificanceMethod` ·
`EnvironmentalComplianceObligation` · `EnvironmentalComplianceEvaluation` ·
`EnvironmentalObjective` · `EnvironmentalProgram` · `EnvironmentalMetric` ·
`WasteStream` · `EnvironmentalEmergencyScenario` · `EnvironmentalBiodiversityRecord`

### Reutilización (sin duplicar)

| Existente | Uso en SGA |
|---|---|
| `/app/context` (`InterestedParty` / `IntegratedObjective`) | partes interesadas y objetivos compartidos (§4.2/§6.2) — no requiere el Sistema Integrado |
| `/app/quality-ops` (`CommunicationRecord`) | comunicación ambiental interna/externa (§7.4, mismo número de cláusula que ISO 9001) |
| `Process` / `Location` | contexto de aspecto, obligación, indicador, biodiversidad |
| `Risk` / `Control` | vínculo opcional desde un impacto significativo |
| `Supplier` (`SupplierEvaluation.environmentScore`) | compras y proveedores (§8.4) |
| `Document` / `EvidenceFile` | evidencia de obligación, evaluación, programa, biodiversidad |
| `TrainingCourse` | competencia y concienciación (§7.2/§7.3) — sin modelo propio |
| `ManagementReview` (`standards: ["ISO_14001"]`) | revisión por la dirección (§9.3) |
| `CAPA` / `Nonconformity` | mejora, hallazgos derivados de una evaluación de cumplimiento no conforme |

## Significancia versionada

`EnvironmentalSignificanceMethod` es una metodología con historial: crear una
nueva versión con el mismo `name` desactiva (`active=false`) la anterior en
vez de sobrescribirla. Cálculo puro en `src/lib/environmental/significance.ts`
(`computeSignificance`), reutilizado por la acción del servidor y por
`recomputeSignificance` (recalcula todos los impactos contra el método
activo, por ejemplo tras cambiar de metodología).

| Formula | Cálculo |
|---|---|
| `WEIGHTED_SUM` | Σ(factor × peso) |
| `PRODUCT` | severidad × frecuencia × alcance |
| `SUM` | severidad + frecuencia + alcance |

`controlEffectiveness` (0-100) mitiga el valor bruto antes de comparar contra
`threshold`; el nivel resultante (`LOW`/`MODERATE`/`HIGH`/`CRITICAL`) y el
flag `significant` quedan persistidos en `EnvironmentalImpact`.

## Condición y perspectiva de ciclo de vida

`EnvironmentalAspect.condition`: `NORMAL` | `ABNORMAL` | `EMERGENCY` (§6.1.2.a
— condiciones normales, anormales y situaciones de emergencia razonablemente
previsibles). `EnvironmentalAspect.lifeCycleStage` es texto libre para la
perspectiva de ciclo de vida (§6.1.2.b) — desde adquisición de materia prima
hasta fin de vida; un aspecto de diseño puede referenciar además un
`DesignProject` (`/app/design-dev`) cuando el ciclo de vida involucra
desarrollo de producto/servicio nuevo.

## Cumplimiento legal

`EnvironmentalComplianceObligation` (fuente, jurisdicción, aplicabilidad,
frecuencia de revisión) → `EnvironmentalComplianceEvaluation` (resultado,
hallazgos, acción derivada). Registrar una evaluación con
`advanceReview: true` adelanta `reviewDate` de la obligación según
`reviewFrequencyMonths`. Estado derivado (vencida / no conforme / nunca
evaluada) es puro: `src/lib/environmental/compliance.ts`.

## Biodiversidad (configurable)

`EnvironmentalBiodiversityRecord` no es un checklist fijo: cada organización
define su propio `site`, `ecosystemType` y `monitoringFrequency` (texto
libre). Un registro con `protectedArea: true` exige `protectedAreaName` (CHECK
en BD). Ciclo `IDENTIFIED → MONITORING → MITIGATED → CLOSED`.

## Reportes (`env-*`)

Matriz de aspectos e impactos · aspectos significativos · obligaciones ·
evaluación de cumplimiento · objetivos · consumos (agua/energía/combustible/
vertidos/materias primas) · emisiones · residuos · emergencias ·
biodiversidad · `env-audit-package` (compendio de todo lo anterior).
`ReportExport` (`QUEUED → PROCESSING → COMPLETED/FAILED`), sin exportadores
base64.

## Permisos

Módulo `environment:*` (mismo patrón que `energy` / `safety`). Cada una de
las 11 tablas tiene RLS propia gateada en `environment:read|create|update|delete`;
triggers de integridad de tenant rechazan referencias cruzadas a proceso o
evidencia de otra organización.

## Pack

`PACK_ISO_14001` — familia `ISO_14001` / 2015. Mapeos de correspondencia
hacia ISO 9001 y 45001 (crosswalk del Sistema Integrado, `/app/integrated`).

## UI

`/app/environment` (panel, matriz, cumplimiento, objetivos, indicadores,
residuos, emergencias, biodiversidad). Partes interesadas y objetivos
compartidos: `/app/context`. Comunicación: `/app/quality-ops`.

La UI live expone el ciclo de gestión según el tipo de registro: crear/editar/eliminar
aspectos, impactos, residuos, escenarios de emergencia y biodiversidad; editar
obligaciones, objetivos y programas; y registrar evaluaciones de cumplimiento e
indicadores. Las evaluaciones, mediciones y versiones de metodología son
históricas: se agregan y no se eliminan para preservar trazabilidad de auditoría.

## Runbook y checklist comercial

- Soporte: [runbooks/iso-14001-support.md](runbooks/iso-14001-support.md)
- Checklist de implementación para el cliente: [iso-14001-implementation-checklist.md](iso-14001-implementation-checklist.md)

## Tests

```bash
npm run test:env                              # checks puros + DB si hay DATABASE_URL disposable
DATABASE_URL=postgres://…disposable… npm run test:env
```

Live cross-tenant: `tests-live/environmental-tenant.spec.ts` (tenant A/B,
RLS, triggers de integridad, AuditLog append-only, reportes, significancia,
evaluaciones legales, permisos) — requiere credenciales `TEST_*` de un
proyecto Supabase de pruebas; `npm run test:e2e:live` o ejecutar el spec
directamente con `LIVE_TEST_ALLOW_MUTATIONS=true NORMAFLOW_TEST_ENV=isolated`.
