# Paquete de Gestión de la Energía (ISO 50001)

Pack SPE: `PACK_ISO_50001` (familia `ISO_50001`, lifecycle **PILOT → listo
para promover**). Backlog: [`docs/pack-live-backlog.md`](pack-live-backlog.md).
Runbook: [runbooks/iso-50001-support.md](runbooks/iso-50001-support.md).
Checklist de implementación: [iso-50001-implementation-checklist.md](iso-50001-implementation-checklist.md).
Landing comercial: `/iso50001`.

Módulo `/app/energy`: sistema de gestión energética — fuentes → usos → revisión
energética → SEU → línea base → EnPI → medidores/lecturas → variables y factores
→ oportunidades → planes de acción → verificación de ahorros → diseño y compras.

## Modelos (15)

`EnergySource` · `EnergyUse` · `SignificantEnergyUse` · `EnergyReview` ·
`EnergyBaseline` · `EnergyPerformanceIndicator` · `EnergyMeter` ·
`EnergyReading` · `RelevantVariable` · `StaticFactor` · `EnergyOpportunity` ·
`EnergyActionPlan` · `EnergySavingVerification` · `EnergyProcurementEvaluation` ·
`EnergyDesignReview`

### Reutilización (sin duplicar)

| Existente | Uso en EnMS |
|---|---|
| `Process` / `Location` | contexto de uso / medidor / diseño |
| `Supplier` | fuente de energía y evaluación de compra |
| `Indicator` | EnPI enlazado al indicador corporativo |
| `CAPA` (`Nonconformity`) | plan de acción formal |
| `Document` / `EvidenceFile` | evidencia de revisión, baseline, verificación |
| `EnvironmentalMetric.energy` | **no se sobrecarga**; sigue siendo indicador ambiental 14001 |

## Fórmulas configurables y versionadas

Implementadas en `src/lib/energy/formulas.ts` y persistidas en:

- `EnergyBaseline.formulaVersion` + `normalizationMethod` + `formulaConfig`
- `EnergyPerformanceIndicator.formulaKind` + `formulaVersion` + `formulaConfig`
- `EnergySavingVerification.formulaKind` + `formulaVersion` + `formulaConfig`

Al crear una nueva versión con el mismo `code`, la activa previo queda
`SUPERSEDED` / `superseded=true`.

| Kind | Cálculo |
|---|---|
| `CONSUMPTION` | suma / valor de periodo |
| `INTENSITY` | consumo / actividad |
| `BASELINE_COMPARISON` | actual / base |
| `DEVIATION` | % (actual − esperado) / esperado |
| `ABSOLUTE_SAVINGS` | base − actual |
| `NORMALIZED_SAVINGS` | ahorro tras normalizar (RATIO / LINEAR) |
| `COST` | consumo × costPerUnit |
| `EMISSIONS` | consumo × emissionFactor |

Factores de coste y emisión viven en `EnergySource` (configurables) y se
aplican al registrar lecturas.

## Workflows

Revisión energética:

```
DRAFT → IN_PROGRESS → UNDER_REVIEW → APPROVED → SUPERSEDED
```

## UI — `/app/energy`

13 pestañas: Panel, Fuentes y usos, Revisión energética, Usos significativos,
Línea base, EnPI, Medidores y lecturas, Variables y factores, Oportunidades,
Acciones, Ahorros, Compras, Diseño. Los registros operativos tienen edición
desde la fila y archivado reversible: fuentes, usos, SEU, medidores, variables,
factores, oportunidades y planes. Revisiones, compras y diseño también pueden
editarse mientras corresponda al flujo. Las líneas base, EnPI, lecturas y
verificaciones se mantienen versionadas o históricas; para corregirlas se
registra una nueva versión o verificación, preservando la trazabilidad.

## AuditLog

`writeAuditLog` se ejecuta dentro de la misma `prisma.$transaction` que la
escritura de negocio, en las 18 acciones de `energy.ts` — incluidos los dos
flujos de versionado (línea base, EnPI), cuyo registro de auditoría vivía
antes fuera de la transacción de supersesión.

## Reportes (`enms-*`)

Revisión · SEU · línea base · EnPI · consumos · oportunidades · acciones ·
ahorros · `enms-audit-package`.

## Notificaciones

`safeNotify` al asignar responsable de un SEU, una oportunidad o un plan de
acción, y al verificar un ahorro (avisa al responsable del plan).

## Permisos

Módulo `energy:*` (como `environment` / `safety`). UI Growth+ vía `ALL_MODULES`.
`energy:read`/`energy:create` ya correctos para `CONTRIBUTOR` desde el origen.

## Pack

`PACK_ISO_50001` — familia `ISO_50001` / 2018, mapeos a 9001 y 14001.

## Tests

```bash
npm run test:energy                          # checks puros
DATABASE_URL=postgres://…disposable… npm run test:energy
```

Cobertura live cross-tenant: [`tests-live/energy-tenant.spec.ts`](../tests-live/energy-tenant.spec.ts)
— instalación del pack, fórmulas (cruzadas contra una lectura persistida),
versionado de línea base y EnPI (`unique(code, formulaVersion)`), datos
concurrentes (N intentos concurrentes de crear la misma versión → exactamente
uno gana, sin duplicados), tenant A/B, AuditLog append-only, reportes y
permisos. Requiere credenciales `TEST_*` de Supabase, nunca el proyecto de
producción.
