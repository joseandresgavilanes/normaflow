# Paquete de Gestión Antisoborno (ISO 37001)

Módulo `/app/antibribery`: **extensión del SGC ISO 37301**. No duplica
obligaciones, canal de denuncias, investigaciones genéricas, riesgos de
compliance ni CAPA. Reutiliza esos artefactos por id escalar validado por
organización y añade solo lo que la norma exige de forma especializada.

```
Compliance (37301)          Antisoborno (37001)
─────────────────           ───────────────────
Obligaciones  ────────────► obligationId en DD / regalos / controles
ComplianceRisk ───────────► complianceRiskId + BriberyRiskAssessment
SpeakUpReport ────────────► speakUpReportId (facilitación / investigación)
Investigation ────────────► AntiBriberyInvestigation.investigationId
RemediationPlan / CAPA ───► remediationPlanId / capaId
ConflictOfInterestDecl. ──► conflictOfInterestDeclarationId (opcional)
Supplier ─────────────────► BusinessAssociate.supplierId
OrganizationControl ──────► pruebas financieras / no financieras
```

## Modelos (13)

1. `BriberyRiskAssessment` — mapa de riesgo de soborno (uplift país/sector/PEP/tercero)
2. `BusinessAssociate` — socios de negocio / terceros
3. `DueDiligenceCase` — debida diligencia
4. `BeneficialOwner` — beneficiario final (UBO)
5. `GiftHospitalityRecord` — regalos y hospitalidad
6. `DonationSponsorshipRecord` — donaciones y patrocinios
7. `ConflictDeclaration` (`abms_conflict_declarations`) — conflicto ABMS (no sustituye COI del SGC)
8. `FacilitationPaymentReport` — pagos de facilitación
9. `FinancialControlTest` — prueba de controles financieros
10. `NonFinancialControlTest` — prueba de controles no financieros
11. `HighRiskTransactionApproval` — aprobaciones de operaciones de alto riesgo
12. `AntiBriberyCommitment` — compromisos antisoborno
13. `AntiBriberyInvestigation` — puente tipificado a `Investigation`

## Workflows

### Debida diligencia (§8.2)

```
DRAFT → SCREENING → REVIEW → ENHANCED_REVIEW → APPROVED | REJECTED
APPROVED → PERIODIC_REVIEW → REVIEW | ENHANCED_REVIEW | APPROVED
REJECTED → DRAFT
```

La revisión reforzada es obligatoria cuando el socio es HIGH/CRITICAL, PEP,
funcionario público o el screening no está limpio (`requiresEnhancedReview`).

### Regalos / hospitalidad (§8.7)

```
SUBMITTED → MANAGER_REVIEW → COMPLIANCE_REVIEW → APPROVED | REJECTED
```

Por encima del umbral de política o con funcionario público, compliance no se
salta (`mustReachComplianceReview`). APPROVED/REJECTED exige revisor de
compliance atribuido (CHECK).

### Operaciones de alto riesgo (§5.3.3)

```
REQUESTED → UNDER_REVIEW → APPROVED | REJECTED | CANCELLED
```

Quien solicita no puede aprobar (`requiresIndependentApproval`).

## Permisos

Reutiliza el módulo `compliance:*` (sin un segundo motor de autorización) para
el grueso del dominio. El acceso a denuncias sigue en `speakup` + necesidad de
conocer. La UI se expone como módulo de plan `antibribery` (Growth+) y ruta
`/app/antibribery`.

`BeneficialOwner` (nombre legal completo y condición PEP de terceros reales)
es la excepción: detrás de `antibribery-sensitive:*` desde esta entrega, no de
`compliance:read` general — no otorgado a CONTRIBUTOR/VIEWER, mismo patrón que
`safety-sensitive` (salud ocupacional) y `md-sensitive` (vigilancia de
dispositivos médicos). `verifyBeneficialOwner` y `createBeneficialOwner`
exigen el permiso sensible, no el genérico de compliance.

## AuditLog

Las 22 acciones de `antibribery.ts` escriben su `AuditLog` dentro de la misma
`prisma.$transaction` que el registro de negocio (`writeAuditLog`). Corregido
esta entrega: `createBeneficialOwner` marcaba `businessAssociate.ownershipKnown`
en una escritura separada de la creación del UBO — ahora comparten transacción.

## Pack y cobertura

- Pack: `PACK_ISO_37001` (`src/lib/standard-packs/iso-37001-2016.pack.ts`)
- Familia: `ISO_37001` / edición `2016`
- Mapeos a ISO 37301 (speak-up, investigación, remediación), 9001, 27001, 42001
- Satisfacción compartida vía `RequirementCoverage`

## Reportes (`abms-*`)

| Id | Contenido |
|---|---|
| `abms-risk-map` | Mapa de riesgo de soborno |
| `abms-third-parties` | Socios de negocio |
| `abms-due-diligence` | Debidas diligencias |
| `abms-beneficial-owners` | Beneficiarios finales |
| `abms-gifts` | Regalos y hospitalidad |
| `abms-donations` | Donaciones y patrocinios |
| `abms-conflicts` | Conflictos ABMS |
| `abms-high-risk-ops` | Operaciones de alto riesgo |
| `abms-controls` | Controles financieros y no financieros |
| `abms-investigations` | Puentes a Investigation |
| `abms-audit-package` | Paquete de auditoría (nuevo esta entrega) — bundle de las 9 secciones no sensibles; excluye deliberadamente `abms-beneficial-owners` (`antibribery-sensitive`, exportable por separado con ese permiso) |

## Lógica de dominio (`src/lib/antibribery/*`, pura)

| Archivo | Rol |
|---|---|
| `due-diligence.ts` | Grafo DD + revisión reforzada |
| `gifts.ts` | Grafo regalos + umbral compliance |
| `risk.ts` | Valoración con uplift sobre `computeComplianceRisk` |
| `approvals.ts` | Aprobaciones de alto riesgo + segregación |
| `queries.ts` | Payload live |
| `report-data.ts` | Filas exportables |

## Migración y garantías

Migración `20260724190000_anti_bribery_management_system`:

- CHECK de aprobación/rechazo de DD, decisión de regalos, donaciones, conflictos,
  evaluaciones de riesgo, aprobaciones de alto riesgo, rangos de eficacia,
  cierre de investigación ABMS y % UBO
- Trigger `nf_validate_abms_tenant` para hijos ligados a `BusinessAssociate`
- RLS sobre permisos `compliance:*`
- SELECT restrictivo en `abms_conflict_declarations` (propia o `compliance:approve`)

## Tests

```bash
DATABASE_URL=postgres://…disposable… npm run test:antibribery
```
