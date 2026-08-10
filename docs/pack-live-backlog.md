# Backlog maestro — Paquetes normativos a LIVE

**Objetivo:** cada paquete listado debe alcanzar estado comercial **LIVE**.
DEVELOPMENT / PILOT son solo estados temporales de desarrollo — no existe un
estado "DISABLED" final; retirar un pack del catálogo es `archivedAt`, aparte
del lifecycle.

**No declarar LIVE** solo por tablas o pantallas. Checklist obligatorio (32 criterios)
en `src/lib/standard-packs/readiness.ts` y resumen abajo.

## Fundamentos compartidos (Fase 0) — completa

| Ítem | Estado | Notas |
|---|---|---|
| Enum `PackLifecycleStatus` DEVELOPMENT\|PILOT\|LIVE | DONE | Separado de `StandardEditionStatus`; colapsado desde 4 estados (BETA fusionado en DEVELOPMENT, DISABLED retirado del enum) |
| Campo `StandardPack.lifecycleStatus` + `archivedAt` + migración | DONE | |
| Manifest `lifecycleStatus` en los 12 packs | DONE | |
| `PackReadinessAssessment` / `PackReadinessCheck` / `StandardPackLifecycleEvent` | DONE | Checklist de 32 criterios y transición de lifecycle persistidos, no solo en memoria — `promotePackLifecycle()` |
| `OrganizationPackEntitlement` + `assertPackEntitlement` | DONE | Único gate real de activación (plan + lifecycle + entitlement + permiso); nunca `ALL_MODULES` |
| Ediciones ACTIVE/SUPERSEDED/WITHDRAWN inmutables | DONE | App-level (`installPack`) + triggers Postgres (`nf_standard_requirements_lock`, `nf_standard_editions_lock`) |
| AuditLog atómico con el escritura de negocio | DONE (en standards.ts/standard-packs.ts) | `writeAuditLog(tx, …)` en la misma transacción; `audit_logs` append-only por trigger. Migrar el resto de ~35 archivos con `logAuditEvent` no-atómico sigue pendiente |
| Zod comunes (código, paginación, filtros, comentario, archivo) | DONE | `src/lib/validation/common.ts` |
| RLS en tablas nuevas + storage por prefijo de organización + signed URLs | DONE | Reportes ya usaban este patrón; se replicó en entitlements/readiness/lifecycle |
| `ReportExport`/worker (QUEUED→PROCESSING→COMPLETED/FAILED, idempotencia, checksum, reintentos) | DONE (ya existía) | Sin exportadores base64 pendientes |
| Fábrica de pruebas reusable (tenant A/B, audit, entitlements, lifecycle) | DONE | `scripts/lib/pack-test-factory.ts` |
| Live tenant por dominio vertical | PENDING | Plantilla + specs por pack |
| Runbooks + páginas comerciales por pack | PENDING | |
| Notificaciones por eventos de pack | PENDING | |

**Bug de fundamentos corregido en esta entrega:** los 11 packs (todos salvo
27001) declaraban `requiredModules` con claves del *permission matrix*
(`nc`, `capa`, `mgmt-review`) en vez de claves del *plan catalog*
(`nonconformities`, `actions`, `management-review`) — el gate de plan nunca
podía satisfacerse. Corregido en los manifests; ver `ALL_MODULES` en
`src/lib/constants.ts`.

**Deuda descubierta al migrar y correr las 61 migraciones + suites de test por
primera vez de punta a punta contra una base real** (ninguna había llegado a
aplicarse, ni en Supabase ni local): assertion de `test-sig.ts` desactualizada
sobre 45001 cláusula 5.4, `import "server-only"` mal ubicado en
`src/lib/aims/report-data.ts`, mensaje de error desalineado en
`src/lib/compliance/evaluation.ts`, y drift de esquema/migración en
`SignificantEnergyUse` (ISO 50001). Fuera del alcance de esta entrega (no son
fundamentos compartidos); quedaron marcadas como tareas de seguimiento.

## Criterios globales (todos los packs)

1. StandardFamily · 2. StandardEdition versionada · 3. Pack instalable · 4. Árbol requisitos propios · 5. GAP · 6. Checklist auditoría · 7. Reglas evidencia · 8. Plantillas · 9. Módulos especializados · 10. Workflows estrictos · 11. Prisma · 12. Migraciones · 13. organizationId · 14. RLS · 15. Guards · 16. Zod · 17. AuditLog · 18. Reportes persistentes · 19. Notificaciones · 20. Permisos · 21. Unit · 22. Integración · 23. E2E · 24. Live cross-tenant · 25. Docs usuario · 26. Runbook · 27. Página comercial · 28. Pricing/entitlement · 29. Sin P0 · 30. Sin P1 seguridad/integridad · 31. Marketing alineado · 32. Aceptación aprobada

## Por norma — estado y gaps hacia LIVE

| # | Norma | Pack | Lifecycle actual | Cobertura est. | Bloqueos hacia LIVE |
|---|---|---|---|---|---|
| 1 | ISO 9001 | PACK_ISO_9001 | LIVE | 31/32 | Solo falta `acceptance_approved` (firma comercial humana). Cerrado: 4.2/6.2 standalone (`/app/context`), 7.2/7.4/8.5.3/8.5.4/9.1.2 (`/app/quality-ops`), 8.3 genérico (`/app/design-dev`), runbook dedicado |
| 2 | ISO/IEC 27001 | PACK_ISO_27001 | LIVE | 31/32 | Solo falta `acceptance_approved` (firma comercial humana). Cerrado: 4.2/6.2 standalone, 7.4 (comparte módulo con 9001), runbook dedicado |
| 3 | ISO 14001 | PACK_ISO_14001 | PILOT → listo para promover | 31/32 | Solo falta `acceptance_approved` (firma comercial humana). Cerrado: live tenant env (`environmental-tenant.spec.ts`), notificaciones (evaluación no conforme), runbook, checklist de implementación, página comercial, biodiversidad configurable, AuditLog atómico |
| 4 | ISO 45001 | PACK_ISO_45001 | PILOT → listo para promover | 31/32 | Solo falta `acceptance_approved` (firma comercial humana). Cerrado: privacidad reforzada de vigilancia de la salud (permiso, RLS, cifrado, minimización), workflows de incidente/permiso DB-enforced, live tenant safety (`occupational-safety-tenant.spec.ts`), runbook, checklist de implementación, página comercial |
| 5 | SIG 9001+14001+45001 | PACK_SIG_9001_14001_45001 | PILOT → listo para promover | 31/32 | Solo falta `acceptance_approved` (firma comercial humana). Cerrado: pack propio registrado (antes no existía como `StandardPack`), AuditLog atómico, 8 acciones huérfanas cableadas a UI, compartibilidad de 5 categorías en el crosswalk, 2 reportes nuevos, `installCrosswalk()` automático al activar, live tenant integrated (`integrated-tenant.spec.ts`), runbook, metodología de implementación, página comercial |
| 6 | ISO 22301 | PACK_ISO_22301 | PILOT → listo para promover | 31/32 | Solo falta `acceptance_approved` (firma comercial humana). Cerrado: 24 acciones huérfanas cableadas a UI (BIA→estrategia→plan→activación completo), bug de sobrescritura silenciosa en updateBcp/updateDrp, permiso continuity:create para CONTRIBUTOR, 4 reportes nuevos, live tenant BCM (`bcm-tenant.spec.ts`), runbook, checklist de implementación, página comercial |
| 7 | ISO/IEC 42001 | PACK_ISO_42001 | PILOT → listo para promover | 31/32 | Solo falta `acceptance_approved` (firma comercial humana). Cerrado: 30 acciones huérfanas cableadas a UI (el peor ratio de toda la sesión), AuditLog atómico, seguridad de salidas de IA (PII/secretos/prompt injection, presupuesto mensual), traza del asistente real (`/api/ai`) al ledger de gobernanza, live tenant AIMS (`aims-tenant.spec.ts`), runbook, checklist de implementación, página comercial |
| 8 | ISO 37301 | PACK_ISO_37301 | PILOT → listo para promover | 31/32 | Solo falta `acceptance_approved` (firma comercial humana). Cerrado: 31 de 49 acciones huérfanas cableadas a UI (incluida `submitSpeakUpReport`, la presentación de una denuncia — la función central del canal, antes inalcanzable desde la interfaz), AuditLog atómico, cifrado de campo para la identidad del informante, `compliance-audit-package`, live tenant compliance (`compliance-tenant.spec.ts`), runbook, checklist de implementación, página comercial |
| 9 | ISO 37001 | PACK_ISO_37001 | PILOT → listo para promover | 31/32 | Solo falta `acceptance_approved` (firma comercial humana — pendiente por separado del resto). Cerrado: 14 de 22 acciones huérfanas cableadas a UI (64%), AuditLog atómico + escritura múltiple de createBeneficialOwner corregida, permiso `antibribery-sensitive` nuevo (beneficiario final/UBO/PEP reclasificado, antes bajo compliance:read general), `abms-audit-package` nuevo (excluye UBO por diseño), script de test corregido (le faltaba la rama de solo-pruebas-puras), live tenant antibribery (`antibribery-tenant.spec.ts`), runbook, checklist de implementación, página comercial |
| 10 | ISO 50001 | PACK_ISO_50001 | PILOT → listo para promover | 31/32 | Solo falta `acceptance_approved` (firma comercial humana). Cerrado: 15 de 18 acciones huérfanas cableadas a UI (el peor ratio de la sesión — la interfaz era de solo lectura salvo tres transiciones), 2 pestañas nuevas (Fuentes y usos; Variables y factores), AuditLog atómico (incluidas 4 acciones sin ningún registro previo), notificaciones nuevas, live tenant energy (`energy-tenant.spec.ts` con prueba de datos concurrentes), runbook, checklist de implementación, página comercial |
| 11 | ISO 22000 | PACK_ISO_22000 | PILOT → listo para promover | 31/32 | Solo falta `acceptance_approved` (firma comercial humana). Cerrado: 22 de 29 acciones huérfanas cableadas a UI (79%, segundo peor ratio de la sesión), AuditLog atómico + 4 escrituras múltiples no atómicas corregidas (monitoreo→desviación, retiro→lotes, corrección→desviación), comunicación de cadena (§7.4) nueva reutilizando `CommunicationRecord` + brecha de RLS real cerrada, notificaciones nuevas, live tenant food safety (`food-safety-tenant.spec.ts` con trazabilidad real adelante/atrás), runbook, checklist de implementación, página comercial |
| 12 | ISO/IEC 20000-1 | PACK_ISO_20000 | PILOT → listo para promover | 31/32 | Solo falta `acceptance_approved` (firma comercial humana). Cerrado: 20 de 23 acciones huérfanas cableadas a UI (87%, el peor ratio de la sesión), AuditLog atómico + escritura múltiple de createKnownError corregida, IncidentCrossLink nuevo (integra ITSMIncident con SecurityIncident/AIIncident/OccupationalIncident sin fusionar workflows), itsm-audit-package nuevo, notificaciones nuevas, live tenant ITSM (`itsm-tenant.spec.ts`), runbook, checklist de implementación, página comercial |
| 13 | ISO 13485 | PACK_ISO_13485 | PILOT → listo para promover | 31/32 | Solo falta `acceptance_approved` (firma comercial humana). Cerrado: 23 de 26 acciones huérfanas cableadas a UI (88%, empata como peor ratio de la sesión), AuditLog atómico (15 acciones sin ningún registro previo), workflows nuevos de evento adverso/PMS/FSCA (antes inalcanzables), PMS reclasificada a `md-sensitive:*` (brecha de RLS real), cifrado de campo para texto libre de vigilancia, retención configurable con purga DB-enforced, `md-audit-package` corregido para excluir datos sensibles, live tenant md-sensitive (`medical-devices-tenant.spec.ts`), runbook, checklist de implementación, página comercial con disclaimer MDR/FDA |

El SIG es desde esta entrega un `StandardPack` propio (`PACK_SIG_9001_14001_45001`,
familia `SIG_9001_14001_45001`) con su propio checklist de 32 criterios y
entitlement — antes su madurez solo se inferría como min(9001,14001,45001) +
crosswalk, sin pasar por el mecanismo real de promoción a LIVE.

### Cierre 9001/27001 — auditoría clausa por clausa (esta entrega)

Auditados los 27 puntos operativos de ISO 9001 y los 24 de ISO 27001 contra el
código real (no contra el `DOMAIN` autoreportado de `readiness.ts`). La
mayoría ya tenía módulo dedicado. Brechas reales encontradas y cerradas:

- **4.2/6.2 (partes interesadas, objetivos) — ambas normas.** El modelo ya
  existía (`InterestedParty`, `IntegratedObjective`) pero solo era alcanzable
  vía `/app/integrated` (Sistema Integrado), bloqueado detrás del plan Growth+
  para un cliente que solo compra 9001 o solo 27001. Nueva página
  `/app/context`, sin requerir SIG, módulo esencial (no bloqueado por plan).
- **7.2, 8.5.3, 8.5.4, 9.1.2 — ISO 9001.** Sin modelo estructurado; dependían
  de texto libre en Documentos. Nuevos modelos `CustomerRequirement`,
  `CustomerProperty`, `PreservationRecord`, `CustomerFeedback` + página
  `/app/quality-ops`.
- **7.4 (comunicación) — ambas normas** (mismo número de cláusula en Anexo
  SL). Nuevo modelo `CommunicationRecord`, misma página `/app/quality-ops`.
- **8.3 (diseño y desarrollo) — ISO 9001.** Los modelos DHF
  (`DesignHistoryFile`/…) existían pero solo cableados a ISO 13485
  (`deviceId` obligatorio). Nuevos modelos genéricos `DesignProject` +
  `DesignStage` (etapas configurables, sin depender de un dispositivo
  médico) + página `/app/design-dev`.
- **Runbooks de soporte** — `docs/runbooks/iso-9001-support.md` y
  `docs/runbooks/iso-27001-support.md` (tabla de cobertura por cláusula +
  problemas comunes), cerrando el único criterio que `readiness.ts` ya
  marcaba `false` para ambos packs.

Verificado: migraciones `20260725010000_quality_operations` y
`20260725020000_design_development` aplican limpio; `npm run
test:iso9001-completeness` (CHECK constraints + aislamiento multi-tenant en
las 9 tablas nuevas) y `npm run test:concurrency` (lease del worker de
reportes bajo carga concurrente real) en verde; suite completa sin
regresiones; `tsc`/`build` limpios.

**No cerrado — requiere decisión humana, no código:** `acceptance_approved`
(firma comercial de que el checklist de 32 criterios se dio por bueno para
vender). `promoteStandardPack` no lo marca automáticamente por diseño: forzarlo
falsearía el propósito del gate.

### Cierre ISO 14001 (esta entrega)

Auditados los 35 puntos operativos contra el código real. La mayoría ya tenía
modelo dedicado (11 modelos EnMS). Brechas reales cerradas:

- **Biodiversidad (configurable).** No existía ningún concepto de
  biodiversidad en el esquema. Nuevo modelo `EnvironmentalBiodiversityRecord`
  (migración `20260725030000_environmental_biodiversity`): sitio, tipo de
  ecosistema, área protegida (con CHECK que exige nombre si aplica),
  especie/hábitat, medidas de mitigación y **cadencia de monitoreo definida
  por la organización** (texto libre, no un checklist fijo). Nueva pestaña en
  `/app/environment`.
- **AuditLog no atómico (P1 real).** `environment.ts` usaba `logAuditEvent`
  (transacción separada de la escritura de negocio) en sus 17 acciones.
  Reescrito completo a `writeAuditLog(tx, …)` dentro de la misma transacción,
  siguiendo el patrón de referencia de `standards.ts`.
- **Sin notificaciones.** Ninguna acción ambiental notificaba a nadie. Cerrado
  el caso de mayor valor: `notifyUser` al responsable de una obligación legal
  cuando una evaluación resulta no conforme o parcial.
- **Sin runbook, sin manual, sin página comercial, sin checklist de
  implementación.** Los cuatro no existían para 14001 (a diferencia de otros
  packs especializados). Creados: `docs/environmental-management.md`,
  `docs/runbooks/iso-14001-support.md`,
  `docs/iso-14001-implementation-checklist.md`, `/iso14001`.
- **Sin pruebas live cross-tenant.** `tests-live/environmental-tenant.spec.ts`
  (nuevo): tenant A/B en las 11 tablas, triggers de integridad, CHECK de
  biodiversidad, cálculo de significancia contra la función pura real,
  relación evaluación↔obligación, AuditLog append-only, artefactos de
  reporte, y permisos (viewer/auditor).
- **Sin e2e.** `/app/environment` no aparecía en ningún spec de Playwright.
  Añadido a `tests/app.spec.ts` (navegación + pestaña biodiversidad),
  verificado en verde.
- **Ya cerrado en la entrega anterior, reutilizado aquí:** partes interesadas
  y objetivos vía `/app/context` (standalone, sin requerir SIG); comunicación
  ambiental vía `/app/quality-ops` (mismo número de cláusula 7.4 que ISO 9001).

Resultado: **31/32 (97%)** — igual que 9001 y 27001, solo falta
`acceptance_approved`. No se fuerza: es la misma decisión humana pendiente en
los otros dos packs.

### Cierre ISO 45001 (esta entrega)

Auditados los 39 puntos operativos contra el código real. La mayoría ya tenía
modelo dedicado (11 modelos SG-SST). Brechas reales cerradas:

- **Vigilancia de la salud sin protección reforzada (P1 real).**
  `OccupationalHealthSurveillance` solo estaba detrás del permiso genérico
  `safety:*` — cualquier `CONTRIBUTOR`/`VIEWER` con acceso al módulo de
  seguridad podía ver datos médicos. Cerrado en varias capas: permiso
  dedicado `safety-sensitive:*` (mismo patrón que `md-sensitive` de ISO
  13485, nunca concedido a `CONTRIBUTOR`/`VIEWER`, `AUDITOR` solo
  lectura/exportación); RLS dedicada en la tabla (migración
  `20260725040000_safety_sensitive_privacy`); minimización en
  `getSafetyPayload()` (nunca devuelve filas, solo un conteo condicionado al
  permiso); cifrado de campo AES-256-GCM (`src/lib/crypto/field-encryption.ts`)
  sobre el contenido médico; AuditLog sin contenido de salud en metadatos;
  reporte `safety-surveillance` exige el permiso reforzado al encolarse y
  queda excluido del compendio `safety-audit-package`.
- **Workflows solo aplicados en la capa de aplicación (P1 real).** Una
  escritura directa a Supabase podía saltarse el estado de un incidente
  (p. ej. `REPORTED → CLOSED` sin investigación) o de un permiso de trabajo.
  Añadidos triggers de Postgres (`nf_enforce_incident_workflow`,
  `nf_enforce_permit_workflow`) que replican las mismas transiciones que
  `assertIncidentTransition`/`PERMIT_TRANSITIONS`, como segunda capa
  independiente de la aplicación.
- **AuditLog no atómico.** `safety.ts` usaba `logAuditEvent` (transacción
  separada) en sus ~16 acciones. Reescrito completo a `writeAuditLog(tx, …)`
  dentro de la misma transacción.
- **Sin runbook, sin manual, sin página comercial, sin checklist de
  implementación.** Creados: `docs/occupational-safety-management.md`,
  `docs/runbooks/iso-45001-support.md`,
  `docs/iso-45001-implementation-checklist.md`, `/iso45001`.
- **Sin pruebas live cross-tenant.**
  `tests-live/occupational-safety-tenant.spec.ts` (nuevo): tenant A/B en las
  11 tablas, vigilancia de la salud (permiso reforzado vs. genérico,
  auditor limitado a lectura), workflow de incidente y de permiso de trabajo
  (rechazo de saltos y retrocesos a nivel de base de datos), AuditLog
  append-only, artefactos de reporte, y permisos (viewer/auditor).
- **Ya cerrado en la entrega anterior, reutilizado aquí:** partes
  interesadas vía `/app/context` (standalone); comunicación de SST vía
  `/app/quality-ops` (misma cláusula 7.4 que 9001/14001).

Resultado: **31/32 (97%)** — igual que 9001, 27001 y 14001, solo falta
`acceptance_approved`. No se fuerza: es la misma decisión humana pendiente en
los otros tres packs.

### Cierre SIG 9001+14001+45001 (esta entrega)

Auditadas las 20 funcionalidades del sistema integrado contra el código
real. La base (crosswalk, modelos de integración, panel) ya existía de la
Fase 0; la brecha real era que **el SIG nunca pasó por el mecanismo real de
promoción a LIVE** porque no existía como `StandardPack`, y varias
funcionalidades tenían backend sin interfaz. Brechas reales cerradas:

- **El SIG no era un `StandardPack` (gap estructural).** No podía evaluarse
  con `evaluatePackReadiness`/`promotePackLifecycle` como el resto de packs
  — su "madurez" era una estimación derivada, no un checklist real. Nuevo
  `PACK_SIG_9001_14001_45001` (`src/lib/standard-packs/sig-9001-14001-45001.pack.ts`),
  familia `SIG_9001_14001_45001`, edición `1.0` con 20 requisitos de
  gobierno (uno por funcionalidad pedida), registrado en `STANDARD_PACKS`.
- **`installCrosswalk()` no se ejecutaba en la activación real.** Solo la
  corrían scripts de test y el seed — un cliente que activaba las tres
  normas desde `/app/standards` (`activateStandard`) nunca recibía la
  matriz de correspondencia entre ellas. Cerrado: `activateStandard` ahora
  llama `installCrosswalk()` cuando la norma activada es ISO 9001, ISO
  14001, ISO 45001 o el propio pack SIG.
- **8 de 17 acciones de `integrated.ts` sin interfaz (P1 real).**
  `upsertSystemStandard`, `setAuditStandards`, `setFindingStandards`,
  `setCapaStandards`, `setRiskDisciplines`, `setChangeDisciplines`,
  `evaluateSupplierIntegrated`, `setReviewStandards` existían en el backend
  pero ningún componente las llamaba — checklist items 6, 7, 12, 13, 14, 15,
  16 y 17 eran solo teóricos. Cableadas a controles reales en
  `IntegratedClient.tsx` (pestañas Alcance y política, Auditoría integrada).
- **AuditLog no atómico.** `integrated.ts` usaba `logAuditEvent` en sus 17
  acciones. Reescrito completo a `writeAuditLog(tx, …)` en la misma
  transacción.
- **Solo 3 categorías de crosswalk, el negocio pedía 5.** `kind` solo
  distinguía equivalente/parcial/específico. Añadida la dimensión
  `shareable` (compartible/no compartible): equivalente y parcial siempre
  son compartibles por estructura; un requisito específico solo es
  compartible si hay evidencia real de reutilización (un elemento que
  también cubre un requisito de otra norma), no solo en teoría.
- **"Cumplimiento por norma" y "requisitos comunes" sin reporte propio.**
  Solo existían como columnas embebidas en `sig-crosswalk`. Nuevos
  `sig-compliance-by-standard` y `sig-common-requirements`.
- **Sin runbook, sin metodología, sin página comercial.** Creados:
  `docs/runbooks/sig-support.md`, `docs/sig-implementation-checklist.md`
  (metodología de integración por fases, no solo activación), `/sig`.
- **Sin pruebas live cross-tenant.** `tests-live/integrated-tenant.spec.ts`
  (nuevo): tenant A/B, un documento que cubre tres requisitos, una
  evidencia que cubre requisitos de dos normas, auditoría integrada y CAPA
  compartida (multi-norma sobre las tablas subyacentes), **inmutabilidad
  histórica** (triggers `nf_standard_requirements_lock`/
  `nf_standard_editions_lock` verificados con `service_role`, no solo con
  RLS), AuditLog append-only, artefactos de reporte y permisos
  (`standards:activate` para la tabla de cobertura, distinto de
  `integrated:*`).
- **Sin e2e.** Ni `/app/safety` (deuda de la entrega anterior, corregida de
  paso) ni `/app/integrated` aparecían en `tests/app.spec.ts`. Añadidos los
  dos, verificados en verde (20/20, Chromium + Firefox).

Resultado: **31/32 (97%)** — igual que los otros tres packs, solo falta
`acceptance_approved`.

### Cierre ISO 22301 (esta entrega)

Auditadas las 33 funcionalidades solicitadas contra el código real. El
modelo de datos y las Server Actions ya eran sustancialmente completos desde
la Fase 0 (12 modelos BCM, `writeAuditLog` atómico desde el origen, Zod
`.strict()`, 23 pruebas de integración) — la brecha real no era de
backend, sino de superficie de producto y de un par de bugs de escritura:

- **24 de 31 acciones de `continuity.ts` sin interfaz (P1 real, el mayor
  hallazgo de todas las entregas de este tipo en la sesión).** Todo el ciclo
  BIA → actividad crítica → dependencia/recurso → estrategia →
  procedimiento → equipo de crisis → contacto → comunicación →
  versión/aprobación/**activación**/desactivación de plan era inalcanzable
  desde `/app/continuity` pese a existir, tener permiso y quedar auditado.
  Un cliente no podía, por ejemplo, activar su plan de continuidad ante una
  interrupción real a través de la aplicación. Cableadas las 24 a controles
  reales en `ContinuityLiveClient.tsx` (BIA/actividades/productos,
  dependencias/recursos, estrategias/procedimientos, equipos de
  crisis/contactos/comunicación, y el ciclo de vida completo del plan
  incluida la activación/desactivación con lecciones aprendidas).
- **Bug de sobrescritura silenciosa en `updateBcp`/`updateDrp` (P1 real,
  descubierto al construir el formulario de edición).** Los esquemas no
  eran `.partial()`: un campo omitido en la llamada (propietario,
  dependencias, próxima revisión) se sobrescribía a `null` en cada
  actualización. Corregido: `bcpUpdateSchema`/`drpUpdateSchema` a
  `.partial()` + `spread` condicional en el `update` de Prisma, siguiendo el
  patrón ya correcto de `updateCriticalActivity`.
- **`CONTRIBUTOR` sin `continuity:create` (inconsistencia real).** Único
  módulo de dominio donde ese rol tenía `:read` sin el `:create` que sí
  tiene en riesgos, evidencia, activos, ambiente, SST, energía e ITSM.
  Corregido en la matriz de permisos.
- **4 funcionalidades sin reporte dedicado.** Productos/servicios
  prioritarios, equipos de crisis/contactos/comunicación, activaciones del
  plan (interrupciones reales + lecciones aprendidas) y el historial de
  versiones/aprobación de planes no tenían reporte propio. Nuevos
  `bcm-priority-products`, `bcm-crisis-teams`, `bcm-activations`,
  `bcm-plan-versions`, incorporados a `bcm-audit-package`.
- **El selector de exportación de `/app/continuity` solo ofrecía 2 tipos de
  reporte heredados**, sin acceso a ninguno de los 13 `bcm-*` — corregido
  `CONTINUITY_REPORT_TYPES` y el `<select>` para ofrecer el catálogo
  completo.
- **Sin runbook, sin checklist de implementación, sin página comercial.**
  Creados: `docs/runbooks/iso-22301-support.md`,
  `docs/iso-22301-implementation-checklist.md`, `/iso22301`.
- **Sin pruebas live cross-tenant.** `tests-live/bcm-tenant.spec.ts` (nuevo,
  nombre exacto solicitado): instalación del pack (familia/edición/33
  requisitos), tenant A/B en las 12 tablas BCM, BIA y MTPD/RTO/RPO,
  activación/desactivación de plan con lecciones aprendidas, simulacro y
  resultado, evidencia vinculada a versión de plan, AuditLog append-only,
  artefactos de reporte, y permisos (viewer/auditor).
- **Sin e2e.** `/app/continuity` no aparecía en `tests/app.spec.ts`.
  Añadido, verificado en verde.

Resultado: **31/32 (97%)** — igual que los otros cuatro packs, solo falta
`acceptance_approved`.

### Cierre ISO 42001 (esta entrega)

Auditadas las 32 funcionalidades solicitadas, el flujo DRAFT → HUMAN_REVIEW →
APPROVED/REJECTED de salidas de IA, y la sección SEGURIDAD (prompt injection,
PII, secretos, rate limit, presupuestos, trazabilidad, separación tenant,
proveedores) contra el código real. El modelo de datos ya era el más maduro
de todos los packs de la sesión (16 modelos, 7 CHECK de base de datos que
imponen la regla humana incluso ante escritura directa, 10 reportes `aims-*`
ya existentes, `CONTRIBUTOR` ya correcto, esquemas Zod ya `.partial()`) — la
brecha real era casi enteramente de superficie de producto y de seguridad de
las salidas de IA:

- **30 de 33 acciones de `aims.ts` sin interfaz (P1 real, el peor ratio de
  toda la sesión).** Todo el ciclo inventario → caso de uso → evaluación de
  impacto → riesgo → dataset (calidad/sesgo/procedencia/linaje) → modelo
  (evaluación/promoción a producción) → supervisión → transparencia →
  incidente → proveedor → cambio → métrica → salida de IA (revisión/
  aprobación/promoción) era inalcanzable desde `/app/aims` pese a existir,
  tener permiso y quedar auditado. Cableadas las 30 a controles reales en
  `AimsClient.tsx` a través de las 13 pestañas.
- **`logAuditEvent` no atómico en las 33 funciones de `aims.ts` (P1 real,
  mismo patrón que en cada pack anterior de la sesión).** Reescrito a
  `prisma.$transaction` con `writeAuditLog(tx, …)` dentro de la misma
  transacción que la escritura de negocio, incluida `promoteModelToProduction`
  (antes usaba la forma de array de `$transaction`, con el log fuera).
- **Sin seguridad de salidas de IA (P1 real, hallazgo destacado de esta
  entrega).** El asistente de IA real del producto (`/api/ai`, usado desde
  GAP/riesgos/documentos/auditorías/no conformidades) estaba completamente
  desconectado del ledger de gobernanza AIMS — `recordAIOutput()` no tenía
  ninguna llamada real. Corregido: `/api/ai/route.ts` ahora (a) bloquea el
  mensaje **antes** de enviarlo al proveedor si contiene un secreto (API key,
  clave AWS, clave privada, JWT), (b) detecta PII y la marca sin bloquear
  (`containsPersonalData`), (c) detecta prompt injection heurísticamente (ES+EN)
  y lo registra en `parameters` sin bloquear, (d) aplica un presupuesto
  mensual de tokens por plan (`assertAIBudget`, nuevo), y (e) registra cada
  respuesta real en `AIGeneratedOutput` vía `recordAIOutput`, autoregistrando
  el sistema `IA-ASSISTANT` en el inventario en estado `PLANNED` (nunca
  aprobado automáticamente para producción). Nuevo módulo puro
  `src/lib/aims/ai-safety.ts` (detección/redacción de PII y secretos,
  heurística de prompt injection) con cobertura en `scripts/test-aims.ts`.
- **Sin runbook, sin checklist de implementación, sin página comercial.**
  Creados: `docs/runbooks/iso-42001-support.md`,
  `docs/iso-42001-implementation-checklist.md`, `/iso42001`.
- **Sin pruebas live cross-tenant.** `tests-live/aims-tenant.spec.ts` (nuevo,
  nombre exacto solicitado): instalación del pack, tenant A/B en las 16
  tablas AIMS, sistemas (incluida la promoción a producción rechazada por
  CHECK sin aprobación), datasets, modelos (aprobación → promoción exitosa,
  y el camino negativo DRAFT → producción rechazado), salidas de IA (DRAFT no
  promovible, envío a revisión, aprobación denegada a viewer), supervisión,
  incidentes (transición permitida a un rol, denegada a otro), AuditLog
  append-only, artefactos de reporte, y permisos.
- **Sin e2e.** `/app/aims` no aparecía en `tests/app.spec.ts`. Añadido,
  verificado en verde.

Resultado: **31/32 (97%)** — igual que los otros cinco packs, solo falta
`acceptance_approved`.

### Cierre ISO 37301 (esta entrega)

Auditadas las 30 funcionalidades solicitadas, el flujo del canal de denuncias
y la sección SEGURIDAD REFORZADA (denunciantes, reportes, investigaciones,
evidencias, conflictos, datos personales) contra el código real. Este pack
partía del estado de base más maduro de toda la sesión: 19 modelos, dos
módulos de permiso deliberadamente separados desde el origen
(`compliance` vs `speakup`), políticas RLS `RESTRICTIVE` de necesidad de
conocer, y CHECK constraints que ya imponían anonimato real, independencia del
investigador y purga solo tras retención — nada de eso hubo que construirlo.
La brecha real era casi enteramente de superficie de producto y de una capa
de protección de datos que faltaba:

- **31 de 49 acciones sin interfaz (P1 real).** El hallazgo más grave: entre
  ellas, `submitSpeakUpReport` — el formulario para **presentar una
  denuncia** no existía en `/app/compliance`, dejando inalcanzable la razón
  de ser del canal. También sin cablear: registro de obligaciones/riesgos/
  controles/evaluaciones/calendario/cambios regulatorios/declaraciones de
  conflicto/incumplimientos/planes de remediación/formación/informes al
  órgano de gobierno, y del lado del canal, configuración, autorización y
  revocación de acceso a un caso, evidencia protegida, apertura de
  investigación y recusación. Cableadas las 31 a controles reales en
  `ComplianceClient.tsx` (13 formularios nuevos más paneles expandibles por
  fila para aplicabilidad, prueba de controles, evaluación de cambios,
  finalización de formación, y gestión de accesos/evidencia por caso).
- **`logAuditEvent` no atómico en las 49 acciones (P1 real, mismo patrón que
  en cada pack anterior de la sesión).** Reescrito a `prisma.$transaction`
  con `writeAuditLog(tx, …)` dentro de la misma transacción que la escritura
  de negocio. `refreshCalendarAlerts` se reestructuró además para no mezclar
  notificaciones de red dentro de la transacción de base de datos: primero
  calcula y persiste los cambios de estado y el registro de auditoría en una
  sola transacción, luego dispara las notificaciones best-effort.
- **Sin cifrado de campo para la identidad del informante (P1 real,
  hallazgo destacado de esta entrega).** El nombre, correo y teléfono del
  informante se guardaban en texto plano en `SpeakUpReport` para los modos
  IDENTIFIED y CONFIDENTIAL — pese a que el propio módulo se documenta como
  protegido, esa protección se apoyaba solo en RLS y permisos, nunca en el
  contenido de la columna. Corregido: `src/lib/crypto/field-encryption.ts`
  generalizado en una fábrica reutilizable (antes específico de vigilancia
  de la salud ISO 45001), y aplicado a `reporterName`/`reporterEmail`/
  `reporterPhone` con una clave propia (`SPEAKUP_DATA_ENCRYPTION_KEY`),
  cifrando al escribir y descifrando solo para quien ya tiene una concesión
  viva sobre el caso.
- **Sin reporte agregado de auditoría.** Los 9 reportes `compliance-*` ya
  existían (sin brecha ahí, a diferencia de otros packs), pero faltaba
  `compliance-audit-package` — el patrón que todos los demás packs ya
  tienen. Añadido: `REPORT_IDS`, `reportRows()` y el catálogo de
  `ReportingModule.tsx`.
- **Sin runbook, sin checklist de implementación, sin página comercial.**
  Creados: `docs/runbooks/iso-37301-support.md`,
  `docs/iso-37301-implementation-checklist.md`, `/iso37301`.
- **Sin pruebas live cross-tenant.** `tests-live/compliance-tenant.spec.ts`
  (nuevo, nombre exacto solicitado): instalación del pack, tenant A/B,
  presentación de denuncia con el permiso mínimo, anonimato (CHECK de
  identidad y trigger de modo permitido por configuración del canal), acceso
  restringido (una concesión viva en `SpeakUpCaseAccess` — ni siquiera
  `speakup:read` de un segundo `COMPLIANCE_MANAGER` sin esa concesión basta,
  y la revocación quita la visibilidad de inmediato), independencia del
  investigador (CHECK), AuditLog append-only, artefactos de reporte y
  permisos. Requirió crear dos actores `COMPLIANCE_MANAGER` locales al
  archivo del test, porque el fixture compartido de `global-setup.ts` no
  tenía ese rol (es el único con `speakup:read/update/approve`).
- **Sin e2e.** `/app/compliance` no aparecía en `tests/app.spec.ts`.
  Añadido, verificado en verde.

Resultado: **31/32 (97%)** — igual que los otros seis packs, solo falta
`acceptance_approved`.

### Cierre ISO 50001 (esta entrega)

Auditadas las 27 funcionalidades solicitadas y la sección CÁLCULOS (consumo,
intensidad, desviación, ahorro, ahorro normalizado, coste, emisiones
configurables, todas versionadas) contra el código real. Este era el pack
menos maduro de la sesión: partía de lifecycle `DEVELOPMENT` (no `PILOT`
como los seis anteriores) y ~60% de cobertura estimada. El motor de fórmulas
(`src/lib/energy/formulas.ts`) y el modelo de versionado de línea base/EnPI
ya eran sólidos desde el origen — la brecha real era casi enteramente de
superficie de producto:

- **15 de 18 acciones sin interfaz (P1 real, el peor ratio de toda la
  sesión — un 83%).** La interfaz de `/app/energy` era de solo lectura salvo
  tres transiciones de estado (aprobar revisión, verificar ahorro, avanzar
  plan +25%). Ni fuentes, ni usos, ni revisiones, ni SEU, ni líneas base, ni
  EnPI, ni medidores, ni lecturas, ni variables relevantes, ni factores
  estáticos, ni oportunidades, ni planes de acción, ni verificaciones de
  ahorro, ni evaluaciones de compra, ni revisiones de diseño podían crearse
  desde la aplicación. Cableadas las 15 a formularios reales en
  `EnergyClient.tsx`, y añadidas dos pestañas que no existían en absoluto
  (**Fuentes y usos**, **Variables y factores**) — sin ellas ni siquiera se
  podían consultar esos datos, no solo crearlos.
- **`logAuditEvent` no atómico, y 4 acciones sin ningún registro de
  auditoría (P1 real).** `createRelevantVariable`, `createStaticFactor`,
  `updateEnergyActionProgress` y `createEnergyProcurementEvaluation` no
  dejaban rastro alguno. Reescrito todo a `prisma.$transaction` con
  `writeAuditLog(tx, …)`, incluidos los dos flujos de versionado (línea
  base, EnPI) cuyo log vivía fuera de la transacción de supersesión.
- **Sin notificaciones en todo el módulo (hallazgo real, cerrado esta
  entrega).** Ninguna acción avisaba a nadie. Añadido `safeNotify` en la
  asignación de responsable de un SEU, una oportunidad o un plan de acción,
  y al verificar un ahorro (avisa al responsable del plan).
- **Datos concurrentes: comprobado, no corregido — porque ya era correcto.**
  El versionado de línea base/EnPI depende de `unique(organizationId, code,
  formulaVersion)`: dos escrituras concurrentes a la misma versión
  colisionan de forma segura (una gana, la otra falla), sin duplicar ni
  corromper nada. `tests-live/energy-tenant.spec.ts` lo demuestra con 8
  intentos concurrentes reales, mismo patrón que
  `scripts/test-concurrency.ts`.
- **Sin runbook, sin checklist de implementación, sin página comercial.**
  Creados: `docs/runbooks/iso-50001-support.md`,
  `docs/iso-50001-implementation-checklist.md`, `/iso50001`.
- **Sin pruebas live cross-tenant.** `tests-live/energy-tenant.spec.ts`
  (nuevo, nombre exacto solicitado): instalación del pack, fórmulas
  (cruzadas contra una lectura persistida), líneas base y EnPI versionados,
  datos concurrentes, tenant A/B, AuditLog append-only, artefactos de
  reporte y permisos.
- **Sin e2e.** `/app/energy` no aparecía en `tests/app.spec.ts`. Añadido,
  verificado en verde.

Resultado: **31/32 (97%)** — igual que los otros siete packs, solo falta
`acceptance_approved`.

### Cierre ISO 22000 (esta entrega)

Auditadas las 33 funcionalidades solicitadas y la sección TRAZABILIDAD
(proveedor → materia prima → lote → proceso → producto terminado → cliente →
distribución, prueba hacia adelante y hacia atrás) contra el código real. Los
21 modelos HACCP y la lógica pura de trazabilidad
(`src/lib/food-safety/traceability.ts`, BFS sobre `previousLotIds[]`) ya eran
sólidos desde el origen — la brecha real era de atomicidad, superficie de
producto y una brecha de RLS genuina descubierta durante el cierre:

- **22 de 29 acciones sin interfaz (P1 real, 79%).** Prácticamente todo el
  dominio HACCP —productos, materias primas, uso previsto, flujos, etapas,
  peligros, evaluaciones, PRP, OPRP, CCP, límites críticos, validaciones,
  verificaciones, planes de monitoreo, registros de monitoreo, desviaciones,
  correcciones, alérgenos, lotes de trazabilidad, retiros/recalls,
  emergencias— no tenía formulario. Cableadas las 22 en `FoodSafetyClient.tsx`
  (13 pestañas), incluida una pestaña nueva de **Comunicación de cadena**.
- **`logAuditEvent` no atómico en las 28 acciones originales (P1 real).**
  Reescrito todo a `prisma.$transaction` con `writeAuditLog(tx, …)`.
- **4 escrituras de negocio secundarias fuera de la transacción (P1 real, más
  grave que en rondas anteriores por tratarse de HACCP).** `createMonitoringRecord`
  abría la `Deviation` automática fuera de la transacción de la lectura — un
  fallo a mitad de camino podía dejar una lectura fuera de límite sin su
  desviación. `createWithdrawalRecall` marcaba los lotes afectados como
  `RECALLED` en una escritura aparte — un fallo podía dejar un retiro sin
  todos sus lotes marcados. `createFoodSafetyCorrection` y
  `verifyFoodSafetyCorrection` actualizaban el estado de la `Deviation` padre
  fuera de transacción. Las cuatro corregidas: ahora ambas escrituras + el
  log de auditoría comparten una sola `$transaction`.
- **Comunicación de cadena (§7.4) sin ninguna interfaz, pese a existir un
  modelo genérico reutilizable — y una brecha de RLS real detrás.** En vez de
  duplicar `CommunicationRecord` (ya usado por quality-ops), se añadió
  `recordChainCommunication` gated por `food-safety:create` — pero al revisar
  la política RLS de `communication_records` se confirmó que solo aceptaba
  `quality-ops:*`, permiso que un cliente ISO 22000 sin el módulo quality-ops
  activado (no está en `requiredModules` del pack) nunca tiene: la
  comprobación de permiso en Next.js habría pasado pero el `INSERT` real
  habría sido rechazado en silencio por Postgres. Corregido con la migración
  `20260725050000_food_safety_chain_communication`, que amplía SELECT/INSERT
  a `food-safety:read`/`food-safety:create` como alternativa, sin tocar
  UPDATE/DELETE.
- **Sin notificaciones en todo el módulo (hallazgo real, cerrado esta
  entrega).** Añadido `safeNotify` en la asignación de responsable de un PRP,
  un OPRP o un plan de monitoreo. Desviaciones, retiros y emergencias no
  tienen un campo de responsable individual en el modelo (son gestión de
  equipo), así que deliberadamente no se fuerza un destinatario artificial.
- **Sin runbook, sin checklist de implementación, sin página comercial.**
  Creados: `docs/runbooks/iso-22000-support.md`,
  `docs/iso-22000-implementation-checklist.md`, `/iso22000`.
- **Sin pruebas live cross-tenant.** `tests-live/food-safety-tenant.spec.ts`
  (nuevo, nombre exacto solicitado): instalación del pack, peligros (CHECK
  `score = severity × likelihood` real contra Postgres), CCP y límites (CHECK
  de orden BETWEEN), OPRP, monitoreo con desviación vinculada, trazabilidad
  real hacia adelante y hacia atrás sobre una cadena de 5 lotes sembrada
  (proveedor→MP→intermedio→terminado→distribuido/cliente), recall con
  expansión de lotes en ambas direcciones (CHECK de cierre atribuido), tenant
  A/B, RLS (viewer/auditor/contributor), AuditLog append-only, reporte
  `fsms-audit-package`, y una prueba de regresión específica de que
  `food-safety:create` por sí solo ya puede insertar en
  `communication_records` (verificación directa del fix de RLS).
- **Sin e2e.** `/app/food-safety` no aparecía en `tests/app.spec.ts` —
  explícitamente marcado como "E2E HACCP" faltante en el backlog. Añadido,
  verificado en verde.

Resultado: **31/32 (97%)** — igual que los otros ocho packs, solo falta
`acceptance_approved`.

### Cierre ISO/IEC 20000 (esta entrega)

Auditadas las 29 funcionalidades solicitadas y la sección INTEGRACIÓN
("Integrar sin confundir: ITSMIncident; SecurityIncident; AIIncident;
OccupationalIncident. Permitir relaciones, pero mantener workflows
separados") contra el código real. Los 20 modelos ITSM y sus tres
workflows (incidente, problema, cambio) ya eran sólidos desde el
origen — la brecha real era casi enteramente de superficie de producto,
más un requisito de integración explícitamente pedido que no existía en
absoluto:

- **20 de 23 acciones sin interfaz (P1 real, el peor ratio de toda la
  sesión — un 87%).** La interfaz de `/app/itsm` era de solo lectura
  salvo tres transiciones de estado (incidente, problema, cambio). Ni
  servicios, ni catálogo, ni propietarios, ni SLA, ni OLA, ni
  solicitudes, ni incidentes, ni problemas, ni errores conocidos, ni
  cambios, ni releases, ni despliegues, ni CIs, ni relaciones CMDB, ni
  planes de disponibilidad/capacidad/continuidad, ni proveedores, ni
  artículos de conocimiento, ni informes podían crearse desde la
  aplicación. Cableadas las 20 a formularios reales en `ItsmClient.tsx`
  a través de sus 11 pestañas, incluyendo una tabla de informes que
  antes ni siquiera se mostraba.
- **`logAuditEvent` no atómico en las 20 acciones originales (P1 real).**
  Reescrito todo a `prisma.$transaction` con `writeAuditLog(tx, …)`.
  Además, `createKnownError` avanzaba el `Problem` padre a
  `KNOWN_ERROR` en una escritura separada de la creación del error
  conocido — corregido para compartir una sola transacción.
- **Integración entre dominios de incidente — pedida explícitamente y
  completamente ausente.** `ITSMIncident`, `SecurityIncident`,
  `AIIncident` y `OccupationalIncident` no tenían ninguna forma de
  relacionarse entre sí, ni en el esquema ni en la UI. En vez de
  fusionar tablas o forzar un enum de estado compartido —que habría
  violado el propio requisito de "mantener workflows separados"— se
  añadió `IncidentCrossLink` (migración
  `20260725060000_itsm_incident_cross_link`, RLS propia gated por
  `itsm:*`): relaciona un `ITSMIncident` con un incidente de cualquiera
  de los otros tres dominios sin tocar el estado de ninguno.
  `targetId` se valida en la capa de aplicación contra la tabla del
  dominio correspondiente al no existir una FK real cross-tabla.
  Verificado con una prueba de regresión explícita en el live test:
  tras cerrar el `ITSMIncident` vinculado, el `AIIncident` relacionado
  permanece en su propio estado (`REPORTED`) — cero fuga de workflow.
- **Sin un reporte de auditoría agregado.** Los otros ocho packs de la
  sesión tienen un `*-audit-package` que agrupa sus reportes
  individuales; ITSM tenía 9 reportes `itsm-*` pero ninguno bundle.
  Añadido `itsm-audit-package` con el mismo patrón (SLA, incidentes,
  problemas, cambios, disponibilidad, capacidad, continuidad,
  proveedores).
- **Sin notificaciones en todo el módulo (hallazgo real, cerrado esta
  entrega).** Añadido `safeNotify` en la asignación de propietario de
  servicio, de solicitud/incidente/problema y de propietario de CI.
- **Sin runbook, sin checklist de implementación, sin página comercial.**
  Creados: `docs/runbooks/iso-20000-support.md`,
  `docs/iso-20000-implementation-checklist.md`, `/iso20000`.
- **Sin pruebas live cross-tenant.** `tests-live/itsm-tenant.spec.ts`
  (nuevo, nombre exacto solicitado): instalación del pack, SLA (CHECK de
  tiempos positivos), incidentes (workflow completo hasta CLOSED con
  CHECKs de atribución), problemas (conversión atómica a error
  conocido), cambios (CHECK de aprobación atribuida), CMDB (CHECK de
  auto-relación), el vínculo cruzado ITSMIncident↔AIIncident con la
  regresión de independencia de workflow ya descrita, tenant A/B, RLS,
  AuditLog append-only, y el artefacto `itsm-audit-package`.
- **Sin e2e.** `/app/itsm` no aparecía en `tests/app.spec.ts`. Añadido,
  verificado en verde.

Resultado: **31/32 (97%)** — igual que los otros nueve packs, solo falta
`acceptance_approved`.

### Cierre ISO 13485 (esta entrega)

Auditadas las 35 funcionalidades solicitadas, la sección AUDITLOG (diseño,
lotes, trazabilidad, quejas, eventos adversos, PMS, FSCA, recall,
regulación) y la sección SEGURIDAD (permisos reforzados, minimización,
cifrado, RLS, AuditLog, acceso restringido, retención configurable) contra
el código real. Este era el pack menos maduro de la sesión: partía de
lifecycle `DEVELOPMENT` y ~50% de cobertura estimada. Los 24 modelos
originales y la lógica pura de privacidad/workflows
(`src/lib/medical-devices/privacy.ts`, `workflows.ts`) ya eran sólidos —
la brecha real era de superficie de auditoría, workflows incompletos y
varios hallazgos de seguridad concretos:

- **23 de 26 acciones sin interfaz (P1 real, 88%, empata como peor ratio
  de la sesión).** Cableadas todas en `MedicalDevicesClient.tsx` — 100% de
  las 33 acciones finales quedan con formulario, incluidas las 7 añadidas
  esta entrega.
- **15 de 26 acciones sin ningún registro de auditoría (P1 real) — pese a
  ser exactamente las áreas que el cierre exige cubrir.** Todo el diseño
  (input/output/revisión/verificación/validación/transferencia), lotes,
  trazabilidad, la transición de queja, PMS, FSCA y ambos regulatorios no
  dejaban rastro alguno. Reescrito todo a `prisma.$transaction` con
  `writeAuditLog(tx, …)`.
- **Evento adverso, PMS y FSCA tenían workflow de estados completo en el
  schema pero ninguna función para transicionarlo (P1 real — estado
  inalcanzable).** Añadidas `transitionAdverseEvent`,
  `transitionPostMarketSurveillance`, `transitionFieldSafetyAction`, cada
  una con su propio grafo de transiciones, separado de quejas y retiros.
- **PMS bajo RLS incorrecta (hallazgo de seguridad real).**
  `PostMarketSurveillance.findings` lleva la misma minimización de PII que
  `Complaint`/`AdverseEvent`, pero su política RLS estaba en el grupo
  `medical-devices:*` (legible por CONTRIBUTOR/VIEWER) en vez de
  `md-sensitive:*` como las otras tres tablas de vigilancia. Reclasificada
  con una migración nueva, con prueba de regresión directa en el live spec.
- **`md-audit-package` filtraba las 4 secciones sensibles sin
  re-chequear permiso (hallazgo de seguridad real).** Un usuario con solo
  `medical-devices:export` podía recibir quejas/PMS/eventos/retiros
  bundleados. Excluidas del paquete (mismo patrón que
  `safety-audit-package` excluyendo `safety-surveillance`) y añadido un
  guard `md-sensitive:read` explícito en `exportReport` para exportarlas
  por separado.
- **Sin cifrado de campo para vigilancia (hallazgo real, cerrado esta
  entrega).** Nuevo cifrador `MD_SENSITIVE_DATA_ENCRYPTION_KEY` (mismo
  patrón que salud ocupacional/canal de denuncias) aplicado a
  `description`/`investigationSummary`/`findings`/`reason` — deliberadamente
  no aplicado a `anonymizedSubjectRef`/`customerAccountRef`, que deben
  seguir en claro para que su CHECK de opacidad los siga inspeccionando.
- **Sin retención configurable (hallazgo real, cerrado esta entrega).**
  `MdRetentionPolicy` por organización (por defecto 15 años) +
  `retentionUntil`/`purgedAt` en queja y evento adverso, con purga
  bloqueada por CHECK hasta que la retención vence.
- **Sin runbook, sin checklist de implementación, sin página comercial.**
  Creados: `docs/runbooks/iso-13485-support.md`,
  `docs/iso-13485-implementation-checklist.md`, `/iso13485` (con
  disclaimer explícito de no sustituir MDR/FDA QSR/QMSR/MDSAP).
- **Sin pruebas live cross-tenant.** `tests-live/medical-devices-tenant.spec.ts`
  (nuevo, nombre exacto solicitado): acceso sensible (incluida la
  regresión de la reclasificación de PMS), diseño (CHECK de atribución de
  verificación), lote, trazabilidad, queja (CHECK de sujeto opaco y de
  purga antes de retención), evento adverso, recall (CHECK de cierre
  atribuido), tenant A/B, RLS, AuditLog append-only, reportes.
- **Sin e2e.** `/app/medical-devices` no aparecía en `tests/app.spec.ts`.
  Añadido, verificado en verde.

Resultado: **31/32 (97%)** — igual que los otros diez packs, solo falta
`acceptance_approved`.

### Cierre ISO 37001 (esta entrega, tras auditoría independiente de los 13 packs)

Auditados los 22 puntos operativos, las 13 tablas especializadas y la
extensión sobre ISO 37301 contra el código real. Este era el único pack de
los 13 que no había recibido una ronda de cierre — la auditoría
independiente lo detectó explícitamente (8/32 en `evaluatePackReadiness`
frente a 31/32 de los otros doce). El código funcional
(`src/lib/actions/antibribery.ts`, `src/lib/antibribery/*`, el componente
de UI, la migración `20260724190000_anti_bribery_management_system`) ya
era sólido — la brecha era, otra vez, de auditoría, superficie de
producto y un hallazgo de seguridad real:

- **14 de 22 acciones sin interfaz (P1 real, 64%).** Todas las
  creaciones (evaluación de riesgo, socio de negocio, debida diligencia,
  beneficiario final, regalo, donación, conflicto ABMS, pago de
  facilitación, prueba de control financiero/no financiero, aprobación
  de alto riesgo, compromiso, puente de investigación) carecían de
  formulario. Cableadas las 14 en `AntibriberyClient.tsx`.
- **`logAuditEvent` no atómico en las 22 acciones (P1 real).** Reescrito
  todo a `prisma.$transaction` con `writeAuditLog(tx, …)`. Corregida
  además una escritura múltiple no atómica: `createBeneficialOwner`
  marcaba `businessAssociate.ownershipKnown` en una escritura separada
  de la creación del UBO.
- **Beneficiario final (UBO/PEP) sin permiso reforzado — hallazgo de
  seguridad real.** `BeneficialOwner` guarda nombre legal completo y
  condición de persona expuesta políticamente de terceros reales, pero
  estaba detrás del permiso general `compliance:read` — legible por
  cualquier rol con ese permiso. Nuevo permiso `antibribery-sensitive:*`
  (migración `20260725080000_antibribery_sensitive_privacy`), no
  otorgado a CONTRIBUTOR/VIEWER, mismo patrón que `safety-sensitive`
  (ISO 45001) y `md-sensitive` (ISO 13485). `verifyBeneficialOwner` y
  `createBeneficialOwner` migradas al permiso sensible.
- **Sin `abms-audit-package` pese a que los otros doce packs ya tenían
  su `*-audit-package`.** Añadido, agregando las 9 secciones no
  sensibles y excluyendo deliberadamente `abms-beneficial-owners`
  (mismo patrón que `safety-audit-package`/`md-audit-package` excluyendo
  sus secciones sensibles). Añadido también un guard explícito
  `antibribery-sensitive:read` en `exportReport` para exportarla por
  separado.
- **Script de pruebas con un defecto real, distinto a los otros doce.**
  `test-antibribery.ts` no tenía la rama de solo-pruebas-puras cuando
  `DATABASE_URL` apunta a una base gestionada — fallaba duro en vez de
  degradar. Corregido para seguir el mismo patrón que el resto de la
  sesión.
- **Sin runbook, sin checklist de implementación, sin página comercial.**
  Creados: `docs/runbooks/iso-37001-support.md`,
  `docs/iso-37001-implementation-checklist.md`, `/iso37001`.
- **Sin pruebas live cross-tenant.** `tests-live/antibribery-tenant.spec.ts`
  (nuevo, nombre exacto solicitado): riesgo de soborno (CHECK de
  aprobación atribuida), debida diligencia (CHECK de aprobación
  atribuida), beneficiario final (acceso sensible, con regresión directa
  de la reclasificación), regalos (CHECK de decisión de compliance
  atribuida), segregación en aprobaciones de alto riesgo, tenant A/B,
  RLS, AuditLog append-only, reportes.
- **Sin e2e.** `/app/antibribery` no aparecía en `tests/app.spec.ts`.
  Añadido, verificado en verde.

Resultado: **31/32 (97%)** — mismo nivel que los otros doce packs, solo
falta `acceptance_approved`. A diferencia de los otros doce, esta
aprobación se gestiona por separado porque el cierre de este pack llegó
después de la aprobación en bloque de la auditoría independiente.

**Actualización — firma comercial aprobada (2026-07-25).** El propietario
del producto aprobó explícitamente `acceptance_approved` para
PACK_ISO_37001 en esta misma sesión, en su propia ronda de aprobación
(distinta de la aprobación en bloque de los otros doce). `evaluatePackReadiness`
pasa a **32/32 (100%)**. Verificado en Postgres desechable: intento real
de `promotePackLifecycle(iso37001Pack, {toStatus: "LIVE"})` promocionado
con éxito DEVELOPMENT → LIVE, con `StandardPackLifecycleEvent` atribuido
y `PackReadinessAssessment` (32/32) persistidos como evidencia. Cierran
así los **13/13 packs** con firma comercial concedida.

Con los 13 packs ya aprobados en código, lo único pendiente para que
production refleje `LIVE` es infraestructura, no negocio: production
tiene 4 migraciones sin aplicar (`20260725050000_food_safety_chain_communication`,
`20260725060000_itsm_incident_cross_link`,
`20260725070000_medical_devices_retention_privacy`,
`20260725080000_antibribery_sensitive_privacy`), verificado read-only con
`prisma migrate status` — bloquean la promoción real de PACK_ISO_22000,
PACK_ISO_20000, PACK_ISO_13485 y PACK_ISO_37001 (mismo motivo que ya
bloqueaba a los tres primeros: código que referencia columnas/tablas que
aún no existen en production). Los otros 9 packs (incluyendo 9001/27001
ya LIVE) no dependen de estas 4 migraciones.

Dos scripts de un solo uso quedan en el repo, listos para que el
propietario los ejecute con sus propias credenciales de producción
(bloqueados para el asistente por el clasificador de modo automático al
tratarse de escritura directa en producción):

- `scripts/promote-approved-packs-2026-07-25.ts` — promociona los 9 packs
  sin dependencia de las 4 migraciones pendientes (9001, 27001, 14001,
  45001, SIG, 22301, 42001, 37301, 50001).
- `scripts/promote-batch-2-2026-07-25.ts` — promociona los 4 packs
  restantes (22000, 20000, 13485, 37001). Verifica por sí mismo, contra
  `_prisma_migrations`, que las 4 migraciones requeridas estén aplicadas
  antes de tocar el lifecycle — aborta si falta alguna. Verificado en
  Postgres desechable con las 4 migraciones aplicadas: los 4 packs
  promocionan a LIVE sin error.

Orden recomendado en production: `prisma migrate deploy` → confirmar con
`prisma migrate status` → `promote-approved-packs-2026-07-25.ts` →
`promote-batch-2-2026-07-25.ts`.

## Orden de ejecución (obligatorio)

1. **Fase 0** — fundamentos (completa: lifecycle 3 estados, entitlements,
   readiness/lifecycle persistidos, ediciones inmutables por trigger, AuditLog
   atómico en el camino de referencia, Zod comunes, fábrica de tests).
2. **Fase 1** — cerrar P0/P1 seguridad: speakup live tenant, md-sensitive live tenant, AuditLog MD (migrar el resto de `logAuditEvent` no-atómico).
3. **Fase 2** — promover PILOT → LIVE: 14001, 45001, SIG, 22301, 42001, 37301 (checklist 32/32).
4. **Fase 3** — promover DEVELOPMENT → LIVE: 37001, 50001, 22000, 20000, 13485.
5. **Fase 4** — marketing + pricing por pack LIVE; retirar claims prematuros.

## Reglas de promoción a LIVE

```text
evaluatePackReadiness(pack).ready === true
  AND sin P0/P1 abiertos en el dominio
  AND test:packs + test:<dominio> + live tenant del dominio en verde
  AND docs usuario + runbook + página comercial publicados
  AND marketing revisado
THEN promoteStandardPack({ packCode, toStatus: "LIVE" })
```

La promoción real corre `promotePackLifecycle()`: persiste el
`PackReadinessAssessment` (32 checks) y, solo si `checklistComplete`, escribe el
`StandardPackLifecycleEvent` + el nuevo `lifecycleStatus` en una transacción. No
es editar el manifest a mano — el manifest declara el estado *deseado* al
instalar; el estado *real* en `StandardPack.lifecycleStatus` solo cambia por esa
función (server action `promoteStandardPack`, permiso `packs:install`). No muta
ediciones ACTIVE.

## Anti-promesas (todas las páginas comerciales)

- No certificación automática.
- No cumplimiento sin intervención humana.
- No texto normativo protegido.
- Dispositivos médicos / inocuidad: no sustituyen requisitos regulatorios nacionales.
