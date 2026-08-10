# Paquete de Seguridad y Salud en el Trabajo (ISO 45001)

Módulo `/app/safety`: peligros → evaluación de riesgo (W.T. Fine) → consulta y
participación de trabajadores → inspecciones → EPP → permisos de trabajo →
incidentes (investigación estricta) → vigilancia de la salud → simulacros →
contratistas.

## Modelos (11)

`OccupationalHazard` · `OccupationalRiskAssessment` · `WorkerConsultation` ·
`SafetyInspection` · `PPEItem` · `PPEAssignment` · `PermitToWork` ·
`OccupationalIncident` · `OccupationalHealthSurveillance` · `EmergencyDrill` ·
`ContractorSafetyAssessment`

### Reutilización (sin duplicar)

| Existente | Uso en SST |
|---|---|
| `/app/context` (`InterestedParty` / `IntegratedObjective`) | partes interesadas y objetivos SST (§4.2/§6.2) — no requiere el Sistema Integrado |
| `/app/quality-ops` (`CommunicationRecord`) | comunicación de SST interna/externa (§7.4) |
| `Risk` / `Control` | vínculo opcional desde una evaluación de riesgo ocupacional |
| `CAPA` | acciones correctivas derivadas de incidentes e inspecciones |
| `Document` / `EvidenceFile` | evidencia de consulta, inspección, permiso, simulacro |
| `TrainingCourse` | competencia y concienciación (§7.2/§7.3) |
| `Supplier` (`ContractorSafetyAssessment.supplierId`) | contratistas y tercerización (§8.1.4) |
| `ManagementReview` (`standards: ["ISO_45001"]`) | revisión por la dirección (§9.3) |

## Metodología de evaluación de riesgo (W.T. Fine, versionada)

Cálculo puro en `src/lib/safety/risk.ts` (`computeOccupationalRisk`):
magnitud = probabilidad × consecuencia × exposición, con `controlEffectiveness`
(0-100) mitigando el valor antes de clasificar el nivel inherente/residual y
la aceptabilidad (`ACCEPTABLE` / `TOLERABLE` / `NOT_ACCEPTABLE`). Jerarquía de
controles: campo `existingControls` en `OccupationalHazard` y `controls` en
cada evaluación — vínculo opcional a `Control` (`controlId`) cuando el
control ya existe en el catálogo de la organización.

## Investigación de incidentes — workflow estricto

```
REPORTED → CLASSIFIED → INVESTIGATING → ROOT_CAUSE → ACTION_PLAN
         → IMPLEMENTED → EFFECTIVENESS_VERIFIED → CLOSED
```

Sin saltos ni retrocesos — **enforced en dos capas**: `assertIncidentTransition`
(`src/lib/safety/incident-workflow.ts`) en el server action, y un trigger de
Postgres (`nf_enforce_incident_workflow`) que rechaza la misma escritura
directa a Supabase. `CLOSED` es un cierre condicionado: solo alcanzable tras
pasar por las siete etapas previas, nunca directo desde `REPORTED`.

Permisos de trabajo (`PermitToWork`) tienen su propio grafo, también
DB-enforced (`nf_enforce_permit_workflow`):
`DRAFT → ACTIVE → {SUSPENDED, CLOSED, EXPIRED}`, `SUSPENDED → {ACTIVE, CLOSED}`.

## Privacidad — vigilancia de la salud

`OccupationalHealthSurveillance` es información médica sobre trabajadores
identificados. Protegida en varias capas, no solo el permiso genérico
`safety:*`:

- **Permiso reforzado** `safety-sensitive:*` (mismo patrón que `md-sensitive`
  de ISO 13485): nunca concedido a `CONTRIBUTOR` ni `VIEWER`; `AUDITOR` solo
  lectura/exportación; roles de gestión (`MANAGER`, `COMPLIANCE_MANAGER`,
  `ORG_ADMIN`/`ADMIN`) con acceso completo.
- **RLS dedicada** en `occupational_health_surveillance` (no la política
  compartida `safety:*` del resto de tablas).
- **Minimización**: `getSafetyPayload()` (pagina general, `safety:read`) nunca
  devuelve filas de vigilancia — como máximo un conteo, y solo si el usuario
  ya tiene `safety-sensitive:read`. Los datos completos viven en
  `getHealthSurveillancePayload()`, con su propio gate.
- **Cifrado de campo** (`src/lib/crypto/field-encryption.ts`, AES-256-GCM)
  sobre `exposure`, `protocol` y `restrictions` — el contenido médico en sí,
  no los metadatos (código, aptitud, fechas). Requiere
  `HEALTH_DATA_ENCRYPTION_KEY`; defensa en profundidad sobre RLS + permisos,
  no un sustituto. TLS en tránsito y cifrado de disco en reposo ya los
  provee el proveedor de Postgres gestionado.
- **AuditLog**: el metadato nunca incluye el contenido de salud, solo que un
  registro se creó/actualizó y su aptitud.
- **Reportes**: `safety-surveillance` exige `safety-sensitive:read` además de
  `reporting:export` al encolarse, y **nunca** se incluye en
  `safety-audit-package` (minimización: el compendio general no debe cargar
  datos médicos por defecto).

## Reportes (`safety-*`)

Matriz de peligros · riesgos críticos · inspecciones · EPP · permisos ·
contratistas · accidentes/incidentes · investigación · vigilancia de la salud
(sensible, ver arriba) · emergencias · indicadores · `safety-audit-package`.

## Cobertura de UI y CRUD

La pantalla `/app/safety` expone los 11 modelos, no solo la matriz de
peligros. Cada registro no sensible tiene alta y edición con `safety:create` /
`safety:update`; las relaciones internas y referencias a evidencias, CAPA,
documentos, personas, puestos, ubicaciones, proveedores, cursos y riesgos se
validan server-side contra la organización.

| Modelo | UI | Operación especial |
|---|---|---|
| `OccupationalHazard` | matriz | edición; archivado/activación reversible |
| `OccupationalRiskAssessment` | matriz y tabla de evaluaciones | recalcula W.T. Fine al editar |
| `WorkerConsultation` | pestaña Consulta y participación | alta y edición |
| `SafetyInspection` | pestaña Inspecciones | alta y edición |
| `PPEItem` / `PPEAssignment` | pestaña EPP, dos tablas | alta y edición de catálogo y entrega |
| `PermitToWork` | pestaña Permisos | alta, edición y transiciones de estado |
| `OccupationalIncident` | pestaña Incidentes | alta, edición y workflow estricto de investigación |
| `EmergencyDrill` | pestaña Simulacros | alta y edición |
| `ContractorSafetyAssessment` | pestaña Contratistas | alta y edición |
| `OccupationalHealthSurveillance` | pestaña restringida | alta/edición/eliminación solo con `safety-sensitive:*`; campos clínicos cifrados |

La UI oculta las acciones según permiso: crear usa `safety:create`, editar y
transicionar usa `safety:update`, y vigilancia de salud conserva sus permisos
reforzados de crear/editar/eliminar. Los registros médicos nunca se mezclan
con el payload general de SST.

## Permisos

Módulo `safety:*` para todo lo no sensible; `safety-sensitive:*` solo para
vigilancia de la salud. Triggers de integridad de tenant rechazan referencias
cruzadas a proceso, evidencia, trabajador o documento de otra organización.

## Pack

`PACK_ISO_45001` — familia `ISO_45001` / 2018. Mapeos de correspondencia
hacia ISO 9001 y 14001 (crosswalk del Sistema Integrado, `/app/integrated`).

## Runbook y checklist comercial

- Soporte: [runbooks/iso-45001-support.md](runbooks/iso-45001-support.md)
- Checklist de implementación: [iso-45001-implementation-checklist.md](iso-45001-implementation-checklist.md)

## Tests

```bash
npm run test:safety                           # checks puros + DB si hay DATABASE_URL disposable
DATABASE_URL=postgres://…disposable… npm run test:safety
```

Live cross-tenant: `tests-live/occupational-safety-tenant.spec.ts` (tenant
A/B, salud sensible, workflows DB-enforced, RLS, AuditLog, reportes,
permisos) — requiere credenciales `TEST_*` de un proyecto Supabase de
pruebas.
