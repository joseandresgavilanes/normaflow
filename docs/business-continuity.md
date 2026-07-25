# Paquete de Continuidad del Negocio (ISO 22301)

Amplía el módulo `/app/continuity` existente con el ciclo completo de gestión de
la continuidad: BIA → estrategias → planes → equipos de crisis → simulacros →
mejora, con versionado, aprobación y **activación** del plan.

## Reutilización (no duplicación)

El paquete se apoya en los módulos ya existentes en lugar de recrearlos. Las
referencias son **ids escalares validados por organización** en las Server
Actions (`ensureRefs`), el mismo patrón de los módulos ambiental y de SST:

| Módulo existente | Uso en continuidad |
|---|---|
| `Process` | Actividad crítica ↔ proceso (`CriticalActivity.processId`) |
| `Risk` | Escenario de continuidad ↔ riesgo (`ContinuityScenario.riskId`) |
| `InformationAsset` | Dependencia/recurso tecnológico |
| `Supplier` | Dependencia/recurso de proveedor y contacto de crisis |
| `SecurityIncident` | Activación del plan a partir de un incidente real |
| `Document` | Procedimiento de recuperación formal (`RecoveryProcedure.documentId`) |
| `EvidenceFile` | Evidencia de BIA, versión del plan, activación y resultado de simulacro |
| `Audit` / `Action` | Auditoría de continuidad y acciones de mejora |

## Modelos

**Ya existían y se han ampliado:**

- `BusinessContinuityPlan` → `version`, `approvedById/At`, `activated`,
  `activatedAt/ById`, `activationReason`, `deactivatedAt`,
  `minimumServiceLevel` (MBCO), `invocationCriteria`.
- `ContinuityScenario` → `likelihood`, `severity`, `riskId`,
  `affectedResources`, `assumptions`.
- `ContinuityTest` (= **ContinuityExercise**) → `objective`,
  `scopeDescription`, `participants`, `targetRtoMinutes`, `targetRpoMinutes`,
  `durationMinutes`.
- `TestResult` (= **ExerciseResult**) e `ImprovementAction` ya cubrían
  resultados y acciones de mejora.

**Nuevos:**

`BusinessImpactAnalysis` · `CriticalActivity` · `ProductServicePriority` ·
`BusinessDependency` · `ResourceRequirement` · `ContinuityStrategy` ·
`RecoveryProcedure` · `CrisisTeam` · `CrisisContact` · `CommunicationTree` ·
`ContinuityPlanVersion` · `PlanActivation`.

### Campos críticos

| Campo | Dónde |
|---|---|
| **MTPD** | `CriticalActivity.mtpdMinutes`, `ProductServicePriority.mtpdMinutes` |
| **RTO** | actividad, producto/servicio, plan, estrategia (`achievesRtoMinutes`), simulacro (`targetRtoMinutes`), resultado (`rtoAchievedMinutes`) |
| **RPO** | ídem |
| **Nivel mínimo aceptable (MBCO)** | `minimumServiceLevel` en actividad, producto/servicio y plan |
| **Dependencias** | `BusinessDependency.type` = PEOPLE · FACILITY · TECHNOLOGY · SUPPLIER · DATA · EQUIPMENT · UTILITY · PROCESS · OTHER |
| **Recursos alternos** | `BusinessDependency.alternative`, `ResourceRequirement.alternativeResource` + `leadTimeMinutes` |
| **Recursos mínimos** | `ResourceRequirement.normalQuantity` vs `minimumQuantity` |

## Lógica de dominio (`src/lib/continuity/bia.ts`, pura y testeable)

- `impactScore()` — 0-100 ponderado sobre cinco categorías (financiero,
  operacional, legal, reputacional, personas).
- `criticalityFor()` — combina impacto y **urgencia**: MTPD ≤ 1 h ⇒ `CRITICAL`,
  ≤ 4 h ⇒ `HIGH`, aunque el impacto sea moderado.
- `recoveryPriority()` — ordena por impacto y, a igualdad, por MTPD.
- `assertRtoWithinMtpd()` — **regla dura**: el RTO nunca puede superar el MTPD;
  se aplica al crear y actualizar actividades.
- `detectGaps()` — brechas: `NO_MTPD`, `NO_RTO`, `RTO_EXCEEDS_MTPD`,
  `NO_STRATEGY`, `STRATEGY_RTO_INSUFFICIENT`, `NO_PROCEDURE`, `SPOF`,
  `NEVER_TESTED`.
- `readinessScore()` — preparación 0-100 ponderada por criticidad.
- `meetsObjectives()` — si un simulacro cumplió el RTO/RPO objetivo.

## Ciclo de vida del plan

1. **Versionar** — `createPlanVersion()` guarda la versión en el histórico
   inmutable (`ContinuityPlanVersion`) y devuelve el plan a `DRAFT`: toda
   versión nueva exige una nueva aprobación.
2. **Aprobar** — `approvePlan()` (permiso `continuity:approve`) sella plan y
   versión con aprobador y fecha.
3. **Activar** — `activatePlan()` solo admite planes **APROBADOS**; crea un
   `PlanActivation` (motivo, escenario, incidente) y marca el plan activo.
4. **Cerrar** — `deactivatePlan()` registra resultado, lecciones aprendidas y
   evidencia; el histórico de activaciones se conserva íntegro.

## UI — `/app/continuity`

Pestañas: **Planes** · **BIA y actividades** (con impacto, criticidad, MTPD/RTO/RPO
y nivel mínimo) · **Dependencias y recursos** (marcando puntos únicos de fallo) ·
**Estrategias** (+ procedimientos, versiones y activaciones) · **Equipos de crisis**
(contactos escalados y árbol de comunicación jerárquico) · **Simulacros** ·
**Brechas**. Cabecera con preparación, actividades críticas, brechas y planes
activados.

## Reportes

`bcm-bia` · `bcm-critical-processes` · `bcm-rto-rpo` (con validación RTO ≤ MTPD)
· `bcm-dependencies` · `bcm-strategies` · `bcm-plans` · `bcm-exercises` ·
`bcm-gaps` · `bcm-audit-package` (auditoría de continuidad completa).
Exportables a PDF/XLSX por el pipeline existente.

## Seguridad

RLS org-scoped en las 12 tablas nuevas, reutilizando el módulo de permisos
`continuity:*` ya presente en la matriz (lectura `continuity:read`, escritura
`continuity:create|update|delete`, aprobación `continuity:approve`). Todas las
Server Actions usan `requirePermission` + validación Zod (`parseInput`) +
transacción + `writeAuditLog` con módulo `bcm`.

## Pruebas

```bash
DATABASE_URL=<postgres desechable> npm run test:bcm
```

23 comprobaciones idempotentes: matemática del BIA, regla RTO ≤ MTPD,
priorización, las cinco categorías de dependencia, recursos mínimos y alternos,
reutilización de proceso/activo/proveedor **sin duplicarlos**, versionado →
aprobación → activación → cierre, estrategia y procedimiento, equipo de crisis
con árbol jerárquico, simulacro → resultado → acción de mejora, informe de
brechas y aislamiento multi-tenant. El script se niega a ejecutarse contra una
base gestionada.
