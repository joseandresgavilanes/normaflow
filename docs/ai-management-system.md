# Paquete de Gestión de Inteligencia Artificial (ISO/IEC 42001)

Módulo `/app/aims`: gobernanza del ciclo de vida completo de los sistemas de IA —
inventario → clasificación de riesgo → evaluación de impacto → datos y
procedencia → modelos y evaluación → supervisión humana → transparencia →
aprobación → monitoreo → incidentes → proveedores → cambios → retiro.

La pieza central es la **regla humana**: ninguna salida de IA se convierte en
registro oficial de forma automática.

## Regla humana

```
DRAFT ──► HUMAN_REVIEW ──► APPROVED ──► (registro oficial)
                       └─► REJECTED ──► DRAFT (corrección)
```

Se aplica a cinco artefactos: `AIGeneratedOutput`, `AIImpactAssessment`,
`ModelVersion`, `AIChangeRequest` y la puesta en producción de `AISystem`.

`AIGeneratedOutput` guarda todo lo que exige la trazabilidad de una decisión
asistida por IA:

| Dato | Campo |
|---|---|
| prompt | `prompt` (+ `parameters`, `tokensUsed`) |
| modelo | `model`, `modelVersionId` |
| versión | `modelVersionLabel` |
| output | `output` (salida cruda, nunca se sobrescribe) |
| usuario | `requestedById`, `generatedAt` |
| cambios humanos | `humanEdits`, `editSummary`, `editedById`, `editedAt`, `edited` |
| aprobación | `reviewStatus`, `reviewerId`, `reviewedAt`, `decisionNote` |
| registro oficial | `promotedEntityType`, `promotedEntityId`, `promotedAt` |

La edición humana se guarda **aparte** de la salida cruda: el auditor puede
comparar qué produjo el modelo y qué corrigió la persona.

### Defensa en tres capas

1. **Lógica pura** (`src/lib/aims/human-review.ts`) —
   `assertHumanReviewTransition()` prohíbe `DRAFT → APPROVED`,
   `assertPromotable()` exige `APPROVED`, `humanReviewIntegrity()` detecta
   decisiones sin revisor o sin fecha.
2. **Server Actions** — `submitForHumanReview()`, `decideHumanReview()`,
   `reopenForCorrection()` y `promoteAIOutput()`; aprobar exige el permiso
   `aims:approve`, que **no** tiene el rol CONTRIBUTOR.
3. **Base de datos** — `CHECK` constraints, la única capa que nadie puede
   saltarse (ni un script, ni una consulta directa):

| Constraint | Regla |
|---|---|
| `ai_generated_outputs_decision_requires_reviewer` | `APPROVED`/`REJECTED` exigen `reviewerId` **y** `reviewedAt` |
| `ai_generated_outputs_promotion_requires_approval` | no hay `promotedAt`/`promotedEntityId` sin `reviewStatus = APPROVED` |
| `ai_impact_assessments_decision_requires_reviewer` | ídem para evaluaciones de impacto |
| `model_versions_decision_requires_reviewer` | ídem para versiones de modelo |
| `model_versions_production_requires_approval` | `stage = PRODUCTION` solo si `reviewStatus = APPROVED` |
| `ai_change_requests_decision_requires_reviewer` | ídem para cambios |
| `ai_change_requests_implementation_requires_approval` | `implementedAt` solo con cambio aprobado |
| `ai_systems_production_requires_approval` | `IN_PRODUCTION` exige `approvedById` **y** `approvedAt` |

## Modelos (16 tablas nuevas)

`AISystem` · `AIUseCase` · `AIImpactAssessment` · `AIRisk` · `Dataset` ·
`DataSource` · `DataLineage` · `ModelVersion` · `ModelEvaluation` ·
`HumanOversightControl` · `AITransparencyRecord` · `AIIncident` ·
`AISupplierAssessment` · `AIChangeRequest` · `AIPerformanceMetric` ·
`AIGeneratedOutput` (soporte de la regla humana).

### Campos exigidos por el enunciado

| Modelo | Campos |
|---|---|
| `AISystem` | `name`, `ownerId`, `provider`/`providerType`, `purpose`, `users`, `context`, `criticality`, `status`, `classification`, `autonomy`, `approvedById/At`, `retiredAt`/`retirementReason`/`retirementPlan` |
| `AIUseCase` | `objective`, `supportedDecisions`, `affectedPeople`/`affectedCount`, `impact`, `constraints`/`prohibitedUses`, `decisionAutonomy` |
| `AIImpactAssessment` | siete dimensiones — `rightsImpact`, `safetyImpact`, `privacyImpact`, `biasImpact`, `transparencyImpact`, `explainabilityImpact`, `oversightImpact` — más severidad agregada, clasificación resultante y revisión humana |

### Reutilización (no duplicación)

Referencias por **id escalar validado por organización** en las Server Actions
(`ensureRefs`), igual que en los paquetes ambiental, SST y continuidad:

| Módulo existente | Uso en IA |
|---|---|
| `Process` | proceso donde opera el sistema o el caso de uso |
| `Risk` / `OrganizationControl` | riesgo corporativo y control ISO 27001 que mitiga un riesgo de IA |
| `Supplier` | proveedor del sistema, de la fuente de datos o evaluado |
| `Document` | política de IA, ficha del modelo, aviso de transparencia |
| `EvidenceFile` | evidencia de evaluación, linaje, verificación de control, incidente |
| `Nonconformity` (CAPA) | acción correctiva por incidente, sesgo o evaluación fallida |
| `ChangeRequest` | cambio corporativo asociado a un cambio de IA |
| `Indicator` | indicador corporativo alimentado por una métrica de IA |

## Lógica de dominio (`src/lib/aims/*`, pura y testeable sin base de datos)

- `human-review.ts` — la regla humana: transiciones permitidas, promoción e
  integridad de la decisión.
- `risk.ts` — `computeAIRisk()`: probabilidad × impacto (1-5), riesgo residual
  según eficacia del control, nivel y aceptabilidad; la aceptación de un riesgo
  no aceptable exige justificación y persona que la aprueba.
- `classification.ts` — `assessImpact()` agrega las siete dimensiones (**la peor
  dimensión manda**), `classifySystem()` combina criticidad y evaluación (la
  criticidad sube la clase, nunca la baja) y `missingHighRiskSafeguards()` lista
  las salvaguardas que faltan en un sistema de alto riesgo.
- `data-quality.ts` — puntuación ponderada de cinco dimensiones, dimensiones
  débiles, señales de sesgo y aptitud del dataset para entrenar.
- `lineage.ts` — `buildLineageChain()`: procedencia auditable (sin huecos ni
  duplicados, ingesta primero, fuente declarada) y operaciones irreversibles.
- `monitoring.ts` — umbral y deriva respetando la dirección de la métrica
  (exactitud: más es mejor; latencia y tasa de error: menos es mejor).
- `incident-workflow.ts` — flujo lineal `REPORTED → TRIAGED → INVESTIGATING →
  ROOT_CAUSE → ACTION_PLAN → IMPLEMENTED → EFFECTIVENESS_VERIFIED → CLOSED`, sin
  saltos ni retrocesos, y decisión obligatoria de notificación en brechas de
  privacidad, discriminación o daño físico.
- `lifecycle.ts` — transiciones del sistema y **retiro** con motivo y plan de
  disposición obligatorios.

## UI — `/app/aims`

13 pestañas: **Panel** · **Inventario IA** · **Revisión humana** ·
**Evaluación de impacto** · **Riesgos** · **Datos** · **Modelos** ·
**Supervisión** · **Transparencia** · **Incidentes** · **Proveedores** ·
**Cambios** · **Monitoreo**. La cabecera destaca sistemas en producción, de alto
riesgo, salvaguardas faltantes, salidas pendientes de revisión y —en rojo— las
**violaciones de la regla humana**, que deben ser siempre cero.

## Reportes

`ai-inventory` · `ai-impact-assessment` · `ai-risks` · `ai-datasets` ·
`ai-models` · `ai-controls` · `ai-incidents` · `ai-transparency` ·
`ai-human-review` · `ai-audit-package`. Construidos en
`src/lib/aims/report-data.ts` y expuestos por el pipeline PDF/XLSX existente.
`ai-human-review` es la pieza de auditoría: una fila por salida de IA con
prompt, modelo, versión, usuario, cambios humanos, aprobador, fecha y si llegó a
ser registro oficial.

## Privacidad

`Dataset` declara `containsPersonalData`, `containsSpecialCategories`,
`legalBasis`, `retentionMonths` y `anonymization`; `AIGeneratedOutput` marca
`containsPersonalData`. Las señales de sesgo advierten explícitamente cuando hay
categorías especiales. `DataLineage` registra anonimización y agregación como
operaciones irreversibles.

## Seguridad y tenant

RLS org-scoped en las 16 tablas mediante `nf_has_org_permission`, con el módulo
de permisos nuevo `aims` (`read`, `create`, `update`, `approve`, `delete`,
`export`) añadido a la
matriz y a `nf_role_permissions`. Todas las Server Actions usan
`requirePermission` + Zod + `tenantWhere`/`tenantData` + `logAuditEvent` con
módulo `aims`.

## Norma

Pack `ISO_42001` (`src/lib/standard-packs/iso-42001-2023.pack.ts`): árbol de
requisitos 4-10 y Anexo A, reglas de evidencia, preguntas GAP, checklist de
auditoría, plantillas de documento y mapeos a ISO 9001 (cláusulas comunes de la
estructura armonizada) e ISO 27001 (riesgo, privacidad, proveedores e
incidentes), de forma que el SGIA entre en el sistema integrado en lugar de
vivir aparte.

## Pruebas

```bash
DATABASE_URL=<postgres desechable> npm run test:aims
```

28 comprobaciones idempotentes: instalación del pack, la regla humana en lógica
pura **y** contra los `CHECK` de la base (aprobar sin revisor, promover sin
aprobación, promover una salida rechazada), valoración de riesgo, agregación de
las siete dimensiones de impacto, clasificación, calidad de datos y sesgo,
huecos de procedencia, promoción de modelo a producción, flujo lineal de
incidentes, monitoreo con umbral y deriva, ciclo de vida hasta el retiro,
AuditLog, filas de informe trazables y aislamiento multi-tenant. El script se
niega a ejecutarse contra una base gestionada.
