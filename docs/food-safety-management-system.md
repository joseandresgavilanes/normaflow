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

### Comunicación de cadena (§7.4)

Reutiliza el modelo genérico `CommunicationRecord` (el mismo que usa
quality-ops) en vez de duplicarlo, etiquetando cada fila con
`standards: ["ISO_22000"]` — acción `recordChainCommunication`, gated por
`food-safety:create`. La política RLS de `communication_records` acepta
`food-safety:read`/`food-safety:create` como alternativa a
`quality-ops:*` (migración `20260725050000_food_safety_chain_communication`),
para que un cliente ISO 22000 sin el módulo `quality-ops` activado también
pueda usarla.

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

## Atomicidad

Las 29 acciones de `food-safety.ts` escriben su `AuditLog` dentro de la misma
`prisma.$transaction` que el registro de negocio (`writeAuditLog`, no el patrón
`logAuditEvent` no atómico). Además, cuatro acciones que hacían una segunda
escritura de negocio relacionada ahora quedan atómicas entre sí:
`createMonitoringRecord` (abre `Deviation` automáticamente si el valor está
fuera de límite y se pidió `autoOpenDeviation`), `createWithdrawalRecall`
(marca los lotes afectados como `RECALLED`), `createFoodSafetyCorrection` y
`verifyFoodSafetyCorrection` (actualizan el estado de la `Deviation` padre).

## UI

Las 13 pestañas (Panel, Productos y MP, Flujos, Peligros, PRP/OPRP, PCC,
Monitoreo, Desviaciones, Trazabilidad, Retiros, Alérgenos, Emergencias y
Comunicación de cadena) incluyen edición desde la fila para los registros de
configuración y archivado reversible para productos, materias primas,
alérgenos, peligros, PRP/OPRP, PCC y planes de monitoreo. Flujos aprobados,
lecturas, correcciones, lotes, retiros y comunicaciones conservan su historial
mediante aprobación, transición o nuevos registros.

## Notificaciones

`createPrerequisiteProgram`, `createOperationalPrp` y `createMonitoringPlan`
notifican al responsable asignado (`responsibleId`). Desviaciones, retiros y
emergencias no tienen un campo de responsable individual en el modelo (son
gestión de equipo), así que no se fuerza un destinatario artificial.

## Permisos

Módulo `food-safety` (`read|create|update|approve|delete|export|*`). RLS en la
migración `20260724210000_food_safety_management` (más la ampliación de
`communication_records` en `20260725050000_food_safety_chain_communication`).

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
