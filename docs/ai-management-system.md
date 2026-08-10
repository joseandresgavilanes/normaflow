# Paquete de Gestión de Inteligencia Artificial (ISO/IEC 42001)

Pack SPE: `PACK_ISO_42001` (familia `ISO_42001`, lifecycle **PILOT → listo
para promover**). Backlog: [`docs/pack-live-backlog.md`](pack-live-backlog.md).
Runbook: [runbooks/iso-42001-support.md](runbooks/iso-42001-support.md).
Checklist de implementación: [iso-42001-implementation-checklist.md](iso-42001-implementation-checklist.md).
Landing comercial: `/iso42001`.

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

13 pestañas: **Panel** · **Inventario IA** (crear sistema, cambiar de etapa,
aprobar, casos de uso) · **Revisión humana** · **Evaluación de impacto**
(crear, enviar a revisión, aprobar/rechazar) · **Riesgos** (crear, aceptar
riesgo residual) · **Datos** (crear dataset, evaluar calidad, revisar sesgo,
declarar fuente y pasos de linaje) · **Modelos** (crear versión, registrar
evaluación, enviar a revisión, promover a producción) · **Supervisión**
(crear control, verificar eficacia) · **Transparencia** (publicar aviso) ·
**Incidentes** (reportar, avanzar etapa) · **Proveedores** (crear evaluación)
· **Cambios** (crear, enviar a revisión, marcar implementado) ·
**Monitoreo** (registrar medición). La cabecera destaca sistemas en
producción, de alto riesgo, salvaguardas faltantes, salidas pendientes de
revisión y —en rojo— las **violaciones de la regla humana**, que deben ser
siempre cero.

Las 30 de 33 acciones que antes solo existían en el backend (crear sistema,
casos de uso, evaluación de impacto, riesgos, datasets, fuentes de datos,
linaje, modelos, evaluaciones de modelo, promoción a producción, controles de
supervisión, transparencia, incidentes, proveedores, cambios, monitoreo, y el
registro/edición/reapertura/promoción manual de salidas de IA) están
cableadas a controles reales — un usuario puede completar todo el ciclo
inventario → evaluación de impacto → mitigación de riesgo → despliegue con
supervisión humana sin salir de la aplicación.

### Cobertura CRUD y edición en UI

La misma pantalla también permite editar los registros que no deben tratarse
como simples altas: sistemas, casos de uso, evaluaciones de impacto en borrador,
riesgos, datasets, fuentes, pasos de linaje, versiones y evaluaciones de
modelos, controles de supervisión, transparencia, incidentes, proveedores,
cambios y métricas. La acción transversal `updateAimsRecord()` valida el tenant
y las referencias a sistemas, datasets, modelos, proveedores, controles,
CAPA, evidencias, documentos, cursos, indicadores y cambios corporativos antes
de escribir y auditar.

Los artefactos con ciclo de revisión humana conservan sus límites: una
evaluación aprobada no se reescribe, un modelo aprobado se corrige mediante
nueva versión, los cambios solo se implementan después de aprobación y los
incidentes avanzan únicamente por el flujo lineal de investigación. Para
registros históricos se usan retiro, archivado o transición de estado en lugar
de borrado físico, preservando la evidencia de auditoría.

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

## Seguridad de las salidas de IA (`src/lib/aims/ai-safety.ts`, puro)

El asistente de IA real del producto (`/api/ai`, usado desde los módulos GAP,
riesgos, documentos, auditoría y no conformidad) **antes de esta entrega
nunca llamaba a `recordAIOutput()`** — el libro de gobierno de salidas
(`AIGeneratedOutput`) que este pack existe para demostrar quedaba vacío en la
práctica. Cerrado: la ruta ahora registra cada respuesta real del asistente
en el mismo flujo DRAFT de la regla humana, con tres capas de seguridad
aplicadas antes de persistir o de reenviar nada a un proveedor externo:

- **Secretos** (`detectSecrets`/`redactSecrets`) — claves de API, claves AWS,
  claves privadas, JWT y tokens tipo GitHub. Si el mensaje del usuario
  contiene una credencial detectada, la llamada se **rechaza antes de
  enviarse** al proveedor (nunca se reenvía, ni redactada).
- **PII** (`detectPII`/`redactPII`) — email, teléfono, tarjeta (validación
  Luhn para evitar falsos positivos), documento de identidad, IP. No bloquea
  la llamada (hay usos legítimos, p. ej. citar el email de un cliente en un
  hallazgo de auditoría) pero marca automáticamente
  `AIGeneratedOutput.containsPersonalData` sin intervención manual.
- **Inyección de prompt** (`detectPromptInjection`) — heurística sobre
  frases de anulación de instrucciones ("ignore previous instructions",
  "ignora las instrucciones anteriores", "revela tu system prompt"…). No
  bloquea (los falsos positivos son comunes) pero queda registrada en
  `AIGeneratedOutput.parameters` (`{ promptInjectionSuspected, reasons }`)
  para que la revisión humana la tenga en cuenta.
- **Presupuesto mensual** (`assertAIBudget`, `src/lib/plan-entitlements.ts`)
  — tope de tokens acumulados por mes y organización
  (`CommercialPlan.aiMonthlyTokenBudget`: Growth 300.000, Enterprise sin
  tope), independiente del *rate limit* por minuto ya existente.
- **Trazabilidad** — cada salida real queda vinculada a un `AISystem` de
  inventario (`IA-ASSISTANT`, autoregistrado en `PLANNED` la primera vez que
  se usa el asistente — nunca autoaprobado para producción, eso sigue
  siendo una decisión humana con su propio CHECK), al modelo, al prompt
  completo, al usuario y al conteo de tokens de la respuesta de Anthropic.
- **Separación de tenant** — el registro usa el `organizationId` de la
  sesión igual que cualquier otra escritura; el asistente nunca envía datos
  de otra organización al proveedor.
- **Proveedores** — el único proveedor real hoy es Anthropic, ya declarado
  como `providerType: THIRD_PARTY_API` en el sistema autoregistrado; el
  campo existe para declarar proveedores adicionales sin cambios de esquema.

## Seguridad y tenant

RLS org-scoped en las 16 tablas mediante `nf_has_org_permission`, con el módulo
de permisos `aims` (`read`, `create`, `update`, `approve`, `delete`,
`export`) en la matriz y en `nf_role_permissions` — `CONTRIBUTOR` ya tenía el
par `read`+`create` desde el origen, la única entrega de esta sesión sin esa
inconsistencia que sí hubo que corregir en otros paquetes. Todas las Server
Actions usan `requirePermission` + Zod (`.partial()` correctamente aplicado
en cada punto de actualización) + `tenantWhere`/`tenantData` + `writeAuditLog`
**atómico** (misma transacción que la escritura de negocio, módulo `aims` —
antes usaba `logAuditEvent`, transacción separada, incluyendo un
`prisma.$transaction([...])` cuyo registro de auditoría vivía fuera de la
propia transacción; corregido).

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

31 comprobaciones idempotentes: instalación del pack, la regla humana en lógica
pura **y** contra los `CHECK` de la base (aprobar sin revisor, promover sin
aprobación, promover una salida rechazada), **seguridad de salidas de IA**
(detección/redacción de PII y secretos, heurística de inyección de prompt —
nuevo esta entrega), valoración de riesgo, agregación de las siete
dimensiones de impacto, clasificación, calidad de datos y sesgo, huecos de
procedencia, promoción de modelo a producción, flujo lineal de incidentes,
monitoreo con umbral y deriva, ciclo de vida hasta el retiro, AuditLog, filas
de informe trazables y aislamiento multi-tenant. El script se niega a
ejecutarse contra una base gestionada.

Como en todo `scripts/test-*.ts` de este repositorio, este script ejercita la
lógica de dominio pura y los `CHECK` de la base directamente por Prisma — no
llama a las Server Actions de `aims.ts` (`requirePermission` necesita el
contexto de una petición real de Next.js, que no existe en un script plano).
Ese camino se cubre en `tests-live/aims-tenant.spec.ts`.

Live cross-tenant: `tests-live/aims-tenant.spec.ts` (instalación del pack,
tenant A/B, sistemas, datasets, modelos, salidas, supervisión, incidentes,
AuditLog, reportes, permisos) — requiere credenciales `TEST_*` de un proyecto
Supabase de pruebas.
