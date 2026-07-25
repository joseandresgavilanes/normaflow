# Paquete de Gestión de la Energía (ISO 50001)

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

## Reportes (`enms-*`)

Revisión · SEU · línea base · EnPI · consumos · oportunidades · acciones ·
ahorros · `enms-audit-package`.

## Permisos

Módulo `energy:*` (como `environment` / `safety`). UI Growth+ vía `ALL_MODULES`.

## Pack

`PACK_ISO_50001` — familia `ISO_50001` / 2018, mapeos a 9001 y 14001.

## Tests

```bash
npm run test:energy                          # checks puros
DATABASE_URL=postgres://…disposable… npm run test:energy
```
