# Paquete de Gestión de Compliance (ISO 37301)

Módulo `/app/compliance`: sistema de gestión de compliance — registro de
obligaciones → jurisdicciones y fuentes → aplicabilidad → riesgos → controles →
calendario y alertas → evaluación del cumplimiento → cambios regulatorios →
conflictos de interés → canal de denuncias → investigaciones → incumplimientos →
remediación → informes al órgano de gobierno.

La pieza que no se puede tratar como un módulo más es el **canal de denuncias**:
acceso por necesidad de conocer, anonimato real cuando está habilitado, e
investigación independiente.

## Canal de denuncias (§8.3, §8.4)

```
IDENTIFIED | CONFIDENTIAL | ANONYMOUS (si la config lo permite)
     │
     ▼
RECEIVED → ACKNOWLEDGED → UNDER_TRIAGE → ADMISSIBLE | INADMISSIBLE
     │                         │
     │                         ▼
     │              UNDER_INVESTIGATION → RESOLVED → CLOSED
     │                                              (retención → purga)
```

| Capacidad | Cómo se garantiza |
|---|---|
| Reporte identificado / confidencial / anónimo | Modo en `SpeakUpReport.identificationMode`; anónimo solo si `SpeakUpChannelConfig.allowAnonymous` (trigger + CHECK) |
| Anonimato real | `identityForMode()` borra identidad; CHECK `speak_up_reports_anonymous_has_no_identity` |
| Asignación restringida | `SpeakUpCaseAccess` caso a caso; RLS `AS RESTRICTIVE` con `nf_speakup_case_accessible` |
| Investigación independiente | CHECK instructor ≠ señalado; `checkIndependence()` + recusación obligatoria si hay conflicto |
| Evidencia protegida | `SpeakUpEvidence` con custody/sealed; solo visible con acceso al caso |
| Conflicto de interés | Declaraciones alimentan la recusación del investigador |
| Cierre | Outcome + resumen + quien cierra (CHECK); plazos de acuse/respuesta |
| Retención | `retentionUntil` desde el cierre; purga solo después (CHECK) |

### Defensa en capas (información sensible)

1. **Módulo de permisos aparte** — `speakup` ≠ `compliance`. Tener `compliance:*`
   no abre expedientes. ADMIN/MANAGER solo reciben `speakup:create` (pueden
   denunciar, no leer el canal).
2. **Server Actions** — `requireCaseAccess()` en cada mutación del expediente.
3. **RLS restrictiva** — las políticas `AS RESTRICTIVE` se combinan con AND: ni
   siquiera el comodín `*` salta la necesidad de conocer.
4. **CHECK constraints** — anonimato, admisibilidad motivada, cierre completo,
   purga tras retención, independencia de la investigación.

El informe exportable del canal (`compliance-speak-up`) sale **solo agregado**:
categoría, estado, modo, severidad y contadores. Sin códigos de caso, sin
relatos, sin identidades.

## Modelos (16 + soporte del canal)

Pedidos:

`ComplianceObligation` · `RegulatorySource` · `Jurisdiction` ·
`ObligationApplicability` · `ComplianceRisk` · `ComplianceControl` ·
`ComplianceEvaluation` · `ComplianceCalendar` · `ConflictOfInterestDeclaration` ·
`RegulatoryChange` · `SpeakUpReport` · `Investigation` · `ComplianceBreach` ·
`RemediationPlan` · `ComplianceTraining` · `GoverningBodyReport`

Soporte del canal (necesarios para necesidad de conocer, evidencia y config):

`SpeakUpChannelConfig` · `SpeakUpCaseAccess` · `SpeakUpEvidence`

### Reutilización (no duplicación)

Referencias por **id escalar validado por organización** en las Server Actions:

| Módulo existente | Uso en compliance |
|---|---|
| `Process` / `Document` / `EvidenceFile` | contexto, política, evidencia de obligación/control |
| `Risk` / `OrganizationControl` | riesgo corporativo y control ISO 27001 reutilizado |
| `Nonconformity` (CAPA) / `ChangeRequest` | acción correctiva y cambio corporativo |
| `TrainingCourse` | curso reutilizado por `ComplianceTraining` |
| `ManagementReview` | revisión corporativa enlazada al informe al órgano |
| `StandardRequirement` | requisito satisfecho vía `RequirementCoverage` |
| `Supplier` | parte relacionada en conflictos de interés |

## Lógica de dominio (`src/lib/compliance/*`, pura)

- `applicability.ts` — decisión motivada y rollup por jurisdicción
- `risk.ts` — probabilidad × impacto, residual, aceptación atribuida
- `calendar.ts` — estado, alertas, recurrencia
- `evaluation.ts` — revisión `DRAFT → UNDER_REVIEW → APPROVED|REJECTED`
- `speak-up.ts` — modos, flujo, plazos, retención, asignación, integridad
- `investigation.ts` — independencia y recusación
- `breach.ts` — flujo, notificación a la autoridad, cierre
- `remediation.ts` — aprobación, avance, verificación por tercero
- `governing-body.ts` — digest despersonalizado + escalaciones

## UI — `/app/compliance`

15 pestañas: Panel, Obligaciones, Fuentes y jurisdicciones, Riesgos, Controles,
Evaluaciones, Calendario, Cambios regulatorios, Conflictos de interés, Canal de
denuncias, Investigaciones, Incumplimientos, Remediación, Formación, Órgano de
gobierno.

## Reportes (`compliance-*`)

| ID | Contenido |
|---|---|
| `compliance-obligations` | Registro con jurisdicción, fuente, aplicabilidad y estado |
| `compliance-risks` | Inherente/residual, aceptabilidad, exposición |
| `compliance-evaluations` | Resultado, periodo, revisor |
| `compliance-calendar` | Vencimientos, alertas, retrasos |
| `compliance-speak-up` | **Solo agregados** del canal |
| `compliance-investigations` | Estado, independencia, conflictos (sin informante) |
| `compliance-breaches` | Severidad, causa raíz, notificación |
| `compliance-remediation` | Avance y verificación de eficacia |
| `compliance-management-review` | Digest + informes al órgano de gobierno |

## Permisos

| Módulo | Quién |
|---|---|
| `compliance:*` | OWNER, ADMIN, MANAGER, COMPLIANCE_MANAGER |
| `compliance:read/export` | AUDITOR; `read` también CONTRIBUTOR/VIEWER |
| `speakup:create` | Todos los roles operativos (cualquiera puede denunciar) |
| `speakup:read/update/approve/export` | Solo `COMPLIANCE_MANAGER` (y OWNER vía `*`) — y aun así cada caso exige `SpeakUpCaseAccess` |

## Pack normativo

`PACK_ISO_37301` / familia `ISO_37301` / edición 2021. Mapeos a ISO 9001, 14001,
45001, 27001 y al canal de preocupaciones de ISO 42001 (`A.3.3`).

Migración: `20260724180000_compliance_management_system`.

## Tests

```bash
DATABASE_URL=<postgres desechable> npm run test:compliance
```

El script se niega a correr contra Supabase/pooler/AWS. Incluye aserciones de
lógica pura y CHECKs de base (anonimato, independencia, revisión, verificador ≠
responsable).
