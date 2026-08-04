# Sistema Integrado de Gestión (SIG)

Capa de integración sobre el [Standard Pack Engine](standard-packs.md) que permite
gestionar **ISO 9001 (calidad) + ISO 14001 (ambiente) + ISO 45001 (SST)** como un
solo sistema.

> **Objetivo:** evitar la duplicación de documentos, auditorías, riesgos,
> objetivos, acciones y evidencias entre las tres normas.

## Cómo se evita la duplicación

Dos mecanismos, ninguno de los cuales crea copias por norma:

1. **`RequirementCoverage`** (del Standard Pack Engine) — un elemento
   (documento, evidencia, riesgo, indicador, auditoría, CAPA, registro, proceso)
   se asocia a *N* requisitos de *N* normas. Único por
   `(organización, requisito, tipo, elemento)`.
2. **Campos `standards[]` / `disciplines[]`** sobre los modelos que ya existían,
   siguiendo el precedente de `ManagementReview.standards` y
   `AuditProgram.standards`:

| Modelo | Campo añadido | Función SIG |
|---|---|---|
| `Audit` | `standards[]`, `integrated` | Una auditoría cubre varias normas |
| `AuditFinding` | `standards[]` | Un hallazgo afecta a varias normas |
| `CAPA` | `standards[]` | CAPA común |
| `Risk` | `disciplines[]`, `standards[]` | Riesgos integrados |
| `ChangeRequest` | `disciplines[]`, `standards[]` | Cambio con impacto múltiple |
| `SupplierEvaluation` | `qualityScore`, `environmentScore`, `safetyScore`, `disciplines[]` | Un proveedor evaluado en las tres dimensiones |

**Métrica de control:** el *factor de reutilización* (`reuseFactor`) = requisitos
cubiertos ÷ elementos distintos. Un valor > 1 demuestra que no hay duplicación;
se muestra en el panel y se exporta en el reporte de elementos compartidos.

## Modelos nuevos

Solo para conceptos que no existían en la aplicación:

- **`IntegratedSystem`** (uno por organización) — alcance integrado, exclusiones,
  límites, contexto común (4.1) y **política integrada** con versión y aprobación.
- **`IntegratedSystemStandard`** — cada norma dentro del alcance, con su nota,
  exclusiones y responsable.
- **`InterestedParty`** — partes interesadas **comunes** (4.2), con las
  disciplinas para las que son pertinentes.
- **`IntegratedObjective`** — objetivos por disciplina o **compartidos**
  (`disciplines.length > 1`), enlazables a un indicador existente.
- **`RequirementAssignment`** — responsable y notas por requisito (completa el
  crosswalk: documento y evidencia compartidos salen de `RequirementCoverage`).

Enum `Discipline` = `QUALITY | ENVIRONMENT | SAFETY | SECURITY`.

Migración: `prisma/migrations/20260724150000_integrated_management_system`
(tablas + índices + FKs + GRANTs + RLS `integrated:*` + reescritura de
`nf_role_permissions`).

## Matriz de correspondencia (crosswalk)

`src/lib/standard-packs/sig-crosswalk.ts` declara la correspondencia **3 vías**
basada en la estructura de alto nivel (Anexo SL): 19 cláusulas comunes por cada
par de normas + 14 pares específicos (aspectos ⇄ peligros, requisitos legales,
emergencias, evaluación del cumplimiento…). Se instala con `installCrosswalk()`
al final de `installAllPacks()`, cuando ya existen ambos extremos.

Cada requisito se clasifica (`src/lib/integrated/crosswalk.ts`, lógica pura):

| Clasificación | Significado |
|---|---|
| `EQUIVALENT` | Tiene al menos una correspondencia equivalente en otra norma activa |
| `PARTIAL` | Solo correspondencias parciales/relacionadas |
| `SPECIFIC` | Sin correspondencia — requisito propio de esa norma (p. ej. ISO 45001 §5.4) |

La matriz muestra, por requisito: requisito equivalente · parcialmente
equivalente · específico · **documento compartido** · **evidencia compartida** ·
**responsable**.

### Compartibilidad (5 categorías)

Además del tipo (`EQUIVALENT`/`PARTIAL`/`SPECIFIC`), cada fila lleva una
segunda dimensión — `shareable` (`isShareable()` en `crosswalk.ts`) — que
cruza las cinco categorías que pide el negocio: **equivalente**,
**parcialmente equivalente**, **específico**, **compartible** y **no
compartible**:

- Un requisito **equivalente** o **parcialmente equivalente** siempre es
  **compartible**: la estructura de cláusula (Anexo SL) ya lo garantiza.
- Un requisito **específico** solo es **compartible** si, en la práctica, un
  elemento (documento/evidencia) que lo cubre también cubre un requisito de
  otra norma (evidencia real de reutilización); si no, es **no compartible**
  y necesita su propio documento/evidencia por norma.

Se muestra como columna/chip en la pestaña *Matriz de correspondencia*, con
filtro "solo no compartibles", y como columna `compartible` (SI/NO) en el
reporte `sig-crosswalk`.

## Funciones cubiertas

| # | Función | Dónde |
|---|---|---|
| 1 | Alcance integrado | `IntegratedSystem.scope` · pestaña *Alcance y política* |
| 2 | Política integrada | `IntegratedSystem.policy` + `approveIntegratedPolicy()` |
| 3 | Mapa de procesos común | `Process` (ya era org-wide, compartido por diseño) |
| 4 | Partes interesadas comunes | `InterestedParty` |
| 5 | Riesgos y oportunidades integrados | `Risk.disciplines[]` + `setRiskDisciplines()` |
| 6 | Objetivos por disciplina y compartidos | `IntegratedObjective` |
| 7 | Documentos multirrequisito | `RequirementCoverage` (DOCUMENT) |
| 8 | Auditoría integrada | `Audit.standards[]`/`integrated`, `AuditFinding.standards[]` |
| 9 | CAPA común | `CAPA.standards[]` + `setCapaStandards()` |
| 10 | Revisión por la dirección integrada | `ManagementReview.standards[]` |
| 11 | Competencias y formación común | `TrainingCourse.standardTags[]` (ya existía) |
| 12 | Proveedores Q/A/SST | `SupplierEvaluation` + `evaluateSupplierIntegrated()` |
| 13 | Cambios con impacto múltiple | `ChangeRequest.disciplines[]` |

## UI — `/app/integrated`

Siete pestañas: **Panel integrado** (cumplimiento global y por norma, requisitos
comunes, brechas, acciones, auditorías, evidencias faltantes, riesgos críticos
por disciplina) · **Alcance y política** (incluye edición por norma —
`upsertSystemStandard`: nota de alcance, exclusiones y responsable de cada
norma dentro del sistema) · **Partes interesadas** · **Objetivos** ·
**Matriz de correspondencia** (filtrable por norma / tipo / compartibilidad /
sin evidencia, con asignación de responsable en línea) · **Auditoría
integrada** (editable: marcar normas en auditorías, hallazgos, CAPA y
revisiones por la dirección; riesgos por disciplina; cambios con impacto
múltiple; proveedores integrados con evaluación de las tres dimensiones) ·
**Elementos compartidos** (la prueba visible de no-duplicación).

Las 8 acciones de asignación multi-norma (`setAuditStandards`,
`setFindingStandards`, `setCapaStandards`, `setRiskDisciplines`,
`setChangeDisciplines`, `setReviewStandards`, `evaluateSupplierIntegrated`,
`upsertSystemStandard`) están cableadas a controles reales de la UI — no son
solo funciones de backend sin interfaz.

## Reportes

`sig-crosswalk` (matriz integrada, con compartibilidad) ·
`sig-compliance-by-standard` (cumplimiento por norma) · `sig-common-requirements`
(solo los requisitos equivalentes/parciales — lo que no hay que duplicar) ·
`sig-scope-policy` · `sig-interested-parties` · `sig-objectives` ·
`sig-shared-elements` · `sig-integrated-audit` · `sig-integrated-capa` ·
`sig-management-review` · `sig-system-package` (paquete completo del sistema
integrado, incluye todos los anteriores). Exportables a PDF/XLSX por el
pipeline existente.

## Seguridad

RLS org-scoped en las cinco tablas propias del SIG (`integrated:read` para
lectura, `integrated:create|update|delete` para escritura). La tabla de
cobertura multirrequisito (`RequirementCoverage`) usa un permiso distinto —
`standards:read`/`standards:activate` — porque también la usan otros módulos
(no es exclusiva del SIG); un `VIEWER`/`CONTRIBUTOR`/`AUDITOR` con
`integrated:read` no puede crear vínculos de cobertura sin `standards:activate`.
Todas las Server Actions usan `requirePermission` + `tenantWhere`/`tenantData`
+ Zod + `writeAuditLog` **atómico** (misma transacción que la escritura de
negocio — antes usaban `logAuditEvent`, transacción separada; corregido).
`AuditFinding` no tiene `organizationId`: su tenencia se valida a través de
`audit.organizationId`.

**Inmutabilidad histórica:** las ediciones ACTIVE (incluida la del propio
pack SIG) son de solo lectura a nivel de base de datos
(`nf_standard_requirements_lock`, `nf_standard_editions_lock`) — ni la
aplicación ni una escritura directa a Supabase pueden reescribir
retroactivamente un requisito o la `catalogVersion` de una edición ya
publicada.

## Pack

`PACK_SIG_9001_14001_45001` (`src/lib/standard-packs/sig-9001-14001-45001.pack.ts`)
— capa de integración registrada como `StandardPack` propio (familia
`SIG_9001_14001_45001`, edición `1.0`, 20 requisitos de gobierno: alcance,
política, partes interesadas, contexto, procesos, riesgos, objetivos,
documentos/evidencias multirrequisito, competencias, proveedores, cambios,
auditoría integrada, hallazgos multinorma, CAPA única, revisión por
dirección integrada, indicadores, dashboard, paquete de auditoría). Se
vende comercialmente como bundle sobre ISO 9001 + 14001 + 45001 ya activas;
tiene su propio entitlement (`OrganizationPackEntitlement`), independiente
del de cada norma. Activar cualquiera de las tres normas o el pack SIG
(re)instala automáticamente la matriz de correspondencia
(`installCrosswalk()` en `activateStandard`).

## Runbook y metodología

- Soporte: [runbooks/sig-support.md](runbooks/sig-support.md)
- Metodología de implementación: [sig-implementation-checklist.md](sig-implementation-checklist.md)

## Pruebas

```bash
DATABASE_URL=<postgres desechable> npm run test:sig
```

Incluyen la prueba central de que **un mismo registro cubre varias normas
sin duplicarse** (documento, evidencia, auditoría, hallazgo, CAPA, riesgo,
objetivo, parte interesada, proveedor, revisión y cambio), además del
crosswalk, las métricas, los reportes y el aislamiento multi-tenant. El
script se niega a ejecutarse contra una base gestionada.

Live cross-tenant: `tests-live/integrated-tenant.spec.ts` (tenant A/B,
documento/evidencia multirrequisito, auditoría integrada, CAPA compartida,
inmutabilidad histórica, AuditLog, reportes, permisos) — requiere
credenciales `TEST_*` de un proyecto Supabase de pruebas.
