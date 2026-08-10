# Paquete de Continuidad del Negocio (ISO 22301)

Pack SPE: `PACK_ISO_22301` (familia `ISO_22301`, 33 requisitos, lifecycle **PILOT
→ listo para promover**). Backlog: [`docs/pack-live-backlog.md`](pack-live-backlog.md).
Runbook: [runbooks/iso-22301-support.md](runbooks/iso-22301-support.md).
Metodología de implementación: [iso-22301-implementation-checklist.md](iso-22301-implementation-checklist.md).
Landing comercial: `/iso22301`.

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

Pestañas: **Planes** (crear/editar BCP-DRP, vincular/desvincular procesos
críticos, añadir escenarios, versionar, aprobar, **activar/desactivar** con
motivo y lecciones aprendidas) · **BIA y actividades** (crear BIA y aprobarlo,
crear/editar actividades críticas con MTPD/RTO/RPO/nivel mínimo, crear
productos/servicios prioritarios) · **Dependencias y recursos** (añadir
dependencias marcando puntos únicos de fallo, añadir recursos mínimos) ·
**Estrategias** (crear estrategia, avanzar su estado propuesta→aprobada→
implementada, crear procedimientos de recuperación, versiones y activaciones
del plan) · **Equipos de crisis** (crear equipo, contactos escalados, árbol de
comunicación jerárquico) · **Simulacros** (crear, iniciar, registrar
resultado, acciones de mejora con seguimiento de estado) · **Brechas**.
Cabecera con preparación, actividades críticas, brechas y planes activados.

Las entidades BCM mantienen sus registros desde la misma pantalla: BIA,
prioridades, dependencias, recursos, estrategias, procedimientos, equipos,
contactos y nodos de comunicación se pueden editar con validación de
referencias, permisos y auditoría. Las estrategias también se pueden rechazar
o retirar. Los BIA aprobados y las versiones de plan se conservan como línea
base histórica: no se eliminan físicamente; se edita el borrador o se crea una
nueva versión.

Las 24 acciones que antes solo existían en el backend (BIA, actividad
crítica, producto/servicio, dependencia, recurso, estrategia, procedimiento,
equipo de crisis, contacto, nodo de comunicación, edición de plan/DRP,
vínculo de proceso, escenario, versión, aprobación, activación, desactivación,
inicio de simulacro, estado de mejora) están cableadas a controles reales —
un usuario puede completar todo el ciclo BIA → estrategia → plan → activación
sin salir de la aplicación.

## Reportes

`bcm-bia` · `bcm-critical-processes` · `bcm-rto-rpo` (con validación RTO ≤ MTPD)
· `bcm-priority-products` · `bcm-dependencies` · `bcm-strategies` · `bcm-plans`
· `bcm-plan-versions` · `bcm-crisis-teams` · `bcm-activations` (interrupciones
reales, resultado y lecciones aprendidas) · `bcm-exercises` · `bcm-gaps` ·
`bcm-audit-package` (agrupa los 12 anteriores). Exportables a PDF/XLSX desde
`/app/reporting` o desde el propio selector de `/app/continuity`.

## Seguridad

RLS org-scoped en las 12 tablas nuevas, reutilizando el módulo de permisos
`continuity:*` ya presente en la matriz: lectura `continuity:read`, creación
`continuity:create` (incluye `CONTRIBUTOR` desde esta entrega — antes era el
único módulo de dominio sin el par lectura/creación para ese rol), edición
`continuity:update`, aprobación `continuity:approve`, borrado
`continuity:delete` (concedido vía comodín `continuity:*` a `ADMIN`/
`MANAGER`/`COMPLIANCE_MANAGER`; ningún flujo de producto expone borrar un
BIA/plan hoy — solo desvincular un proceso crítico, bajo `continuity:update`).
Todas las Server Actions usan `requirePermission`/`requireAuthorization` +
validación Zod (`parseInput`, esquemas `.strict()`) + transacción +
`writeAuditLog` atómico con módulo `bcm`/`bcp`/`continuity_test`.
`updateBcp`/`updateDrp` usan esquemas `.partial()` con `spread` condicional
en el `update` de Prisma — antes de esta entrega enviaban el objeto completo
y un campo omitido (propietario, dependencias, próxima revisión) se
sobrescribía silenciosamente a `null`.

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

Live cross-tenant: `tests-live/bcm-tenant.spec.ts` (instalación del pack,
tenant A/B, BIA, RTO/RPO/MTPD, activación de planes, simulacros, reportes,
AuditLog, RLS, evidencias) — requiere credenciales `TEST_*` de un proyecto
Supabase de pruebas.
