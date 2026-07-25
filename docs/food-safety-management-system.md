# Paquete de Inocuidad Alimentaria (ISO 22000 / HACCP)

Módulo `/app/food-safety`: sistema de gestión de la inocuidad — producto → materias
primas → uso previsto → diagrama de flujo → peligros → evaluación → PRP / OPRP /
PCC → límites → monitoreo → desviaciones / correcciones → validación / verificación
→ trazabilidad → retiro → alérgenos → emergencias.

## Modelos (21)

`FoodProduct` · `RawMaterial` · `IntendedUse` · `ProcessFlow` · `ProcessStep` ·
`FoodHazard` · `HazardAssessment` · `PrerequisiteProgram` · `OperationalPRP` ·
`CriticalControlPoint` · `CriticalLimit` · `MonitoringPlan` · `MonitoringRecord` ·
`Deviation` · `FoodSafetyCorrection` · `ValidationRecord` · `VerificationActivity` ·
`TraceabilityLot` · `WithdrawalRecall` · `Allergen` · `FoodSafetyEmergency`

### Reutilización (sin duplicar)

| Existente | Uso en FSMS |
|---|---|
| `Process` / `Location` | contexto de paso / lote |
| `Supplier` | materia prima y lote de entrada |
| `CAPA` | desviación / corrección / recall / emergencia |
| `Document` / `EvidenceFile` | PRP, validación, verificación, recall |

Los alérgenos se vinculan a productos y materias primas por `allergenCodes[]`
(códigos de `Allergen`), sin tabla de unión.

## Evaluación de peligros

`src/lib/food-safety/hazard.ts`:

- puntuación = severidad (1–5) × probabilidad (1–5)
- significativo si score ≥ 9 (configurable)
- decisión simplificada: `NONE` | `PRP` | `OPRP` | `CCP`

Constraints en BD: rangos 1–5 y `score = severity * likelihood`.

## Límites y monitoreo

`src/lib/food-safety/monitoring.ts` evalúa operadores `LT|LTE|GT|GTE|EQ|BETWEEN`.
Al registrar un monitoreo numérico vinculado a un PCC, si el valor está fuera de
cualquier límite crítico se abre automáticamente una `Deviation` (reteniendo producto).

## Trazabilidad adelante / atrás

Los lotes (`TraceabilityLot`) enlazan entradas vía `previousLotIds[]`:

```
proveedor → lote MP → intermedio (proceso) → terminado → cliente / distribución → retiro
```

- **Atrás:** sigue `previousLotIds` desde el lote raíz.
- **Adelante:** encuentra lotes que listan al raíz (o descendientes) en `previousLotIds`.

`runTraceabilityTest()` / acción `runFoodTraceabilityTest` ejecuta ambos sentidos.
Un retiro expande lotes afectados con la misma gráfica y marca `RECALLED`.

## Permisos

Módulo `food-safety` (`read|create|update|approve|delete|export|*`). RLS en la
migración `20260724210000_food_safety_management`.

## Pack

`PACK_ISO_22000` (`src/lib/standard-packs/iso-22000-2018.pack.ts`) — familia
`ISO_22000`, cláusulas 4–10 con foco en §8.2–8.9 (PRP, trazabilidad, emergencias,
control de peligros, NC de producto). Mapeos a ISO 9001 / 14001 / 45001.

## Reportes (`fsms-*`)

| Id | Contenido |
|---|---|
| `fsms-hazard-analysis` | Evaluaciones de peligros |
| `fsms-prp` | Programas de prerrequisitos |
| `fsms-oprp` | PRP operativos |
| `fsms-ccp` | PCC y límites |
| `fsms-monitoring` | Registros de monitoreo |
| `fsms-deviations` | Desviaciones y correcciones |
| `fsms-traceability` | Lotes + nodos adelante/atrás |
| `fsms-recalls` | Retiros / recalls |
| `fsms-allergens` | Alérgenos y presencia en producto/MP |
| `fsms-audit-package` | Paquete de auditoría de inocuidad |

## Tests

```bash
npm run test:food-safety
```

Checks puros siempre; suite DB con `DATABASE_URL` desechable.
