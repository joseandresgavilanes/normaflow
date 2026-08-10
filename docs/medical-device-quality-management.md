# Paquete de calidad de dispositivos médicos (ISO 13485)

Módulo `/app/medical-devices`: gestión de calidad configurable para dispositivos
médicos — expediente maestro (DMR), historial de diseño (DHF), controles de
diseño, riesgos, proveedores críticos, validación de procesos/esterilización,
lotes, trazabilidad, quejas, eventos adversos, vigilancia post-comercialización,
acciones de seguridad en campo, retiros y requisitos regulatorios configurables.

## Aviso importante

**NormaFlow no sustituye los requisitos regulatorios nacionales** (MDR, FDA
QSR/QMSR, MDSAP u otros). Es una herramienta de gestión y evidencia. La
conformidad regulatoria sigue siendo responsabilidad de la organización y de
sus asesores / organismos notificados.

## Namespace (evitar colisiones)

| Concepto | Modelo MD | No confundir con |
|---|---|---|
| Retiro de dispositivo | `ProductRecall` (`md_product_recalls`) | `WithdrawalRecall` (inocuidad alimentaria) |
| Proveedor crítico MD | `CriticalSupplier` | `Supplier` / `ServiceSupplier` (enlace opcional) |
| Riesgo de dispositivo | `DeviceRiskFile` | `Risk` corporativo (enlace por `linkedRiskIds`) |
| Queja de producto | `Complaint` (`md_complaints`) | NC / CAPA genéricos |

## Modelos (25)

`DeviceFamily` · `MedicalDevice` · `DeviceMasterRecord` · `DesignHistoryFile` ·
`DesignInput` · `DesignOutput` · `DesignReview` · `DesignVerification` ·
`DesignValidation` · `DesignTransfer` · `DeviceRiskFile` · `CriticalSupplier` ·
`SupplierQualification` · `ProcessValidation` · `SterilizationValidation` ·
`ProductionBatch` · `DeviceTraceability` · `Complaint` · `AdverseEvent` ·
`PostMarketSurveillance` · `FieldSafetyAction` · `ProductRecall` ·
`RegulatoryRequirement` · `RegulatorySubmission` · `MdRetentionPolicy` (nuevo)

## Privacidad

- No almacenar información clínica personal innecesaria.
- Usar `anonymizedSubjectRef` / `customerAccountRef` opacos (p. ej. `CASE-0001`)
  — permanecen en claro, protegidos por CHECK (sin `@`, sin secuencias de
  8+ dígitos), porque cifrarlos ocultaría el texto que ese CHECK inspecciona.
- El texto libre de vigilancia (`Complaint.description`/`investigationSummary`,
  `AdverseEvent.description`, `PostMarketSurveillance.findings`,
  `FieldSafetyAction.reason`, `ProductRecall.reason`) se cifra en reposo
  con `MD_SENSITIVE_DATA_ENCRYPTION_KEY` — capa adicional para el caso en
  que texto narrativo contenga PII más sutil que el heurístico no detecte.
- Retención configurable por organización (`MdRetentionPolicy.retentionYears`,
  por defecto 15) para quejas y eventos adversos cerrados; la purga
  (`purgeComplaint`/`purgeAdverseEvent`) exige `closedAt` + retención vencida,
  reforzado por CHECK.

## Permisos reforzados

| Módulo | Alcance |
|---|---|
| `medical-devices:*` | Expedientes, diseño, riesgos, proveedores, validaciones, lotes, requisitos |
| `md-sensitive:*` | Quejas, eventos adversos, PMS, FSCA, retiros |

CONTRIBUTOR/VIEWER tienen QMS general pero **no** `md-sensitive` (salvo grants
explícitos). AUDITOR y roles de gestión sí pueden leer vigilancia sensible.
Corregido esta entrega: `PostMarketSurveillance` estaba en el grupo
`medical-devices:*` (legible por CONTRIBUTOR/VIEWER) pese a llevar la misma
minimización de PII que las otras tres tablas de vigilancia — reclasificada
a `md-sensitive:*` (migración `20260725070000_medical_devices_retention_privacy`).
`md-audit-package` excluye deliberadamente las cuatro secciones sensibles
(mismo patrón que `safety-audit-package` excluyendo `safety-surveillance`);
se exportan por separado, con un guard `md-sensitive:read` explícito en
`exportReport`.

## Workflows

```
DMR/DHF:         DRAFT → UNDER_REVIEW → APPROVED → SUPERSEDED
Queja:           RECEIVED → TRIAGED → INVESTIGATING → CAPA_LINKED → CLOSED
Evento adverso:  REPORTED → UNDER_REVIEW → (REPORTED_TO_AUTHORITY) → CLOSED
PMS:             PLANNED → IN_PROGRESS → (OVERDUE) → COMPLETED
FSCA:            DRAFT → INITIATED → IN_PROGRESS → COMPLETED → CLOSED
Retiro:          DRAFT → INITIATED → NOTIFYING → IN_PROGRESS → COMPLETED → CLOSED
```

Implementados en `src/lib/medical-devices/workflows.ts` (+ CHECKs de
atribución). Los workflows de evento adverso, PMS y FSCA son nuevos esta
entrega — antes el esquema tenía los estados pero ninguna función podía
transicionarlos.

## UI y ciclo de vida

Los 25 modelos del módulo están representados en las 10 pestañas de
`MedicalDevicesClient.tsx`. Las tablas de familias, dispositivos, DMR/DHF,
inputs/outputs, revisiones, verificaciones, validaciones, transferencias,
riesgos, proveedores, cualificaciones, lotes, trazabilidad, vigilancia y
regulación tienen `Editar` cuando el permiso correspondiente está disponible.

`updateMedicalDeviceRecord` valida referencias dentro de la organización,
registra `AuditLog` dentro de la misma transacción y conserva las reglas de
atribución para resultados de verificación/validación. La edición de quejas,
eventos adversos, PMS, acciones de campo y retiros exige `md-sensitive:update`,
vuelve a aplicar los controles de privacidad y cifra los textos sensibles.
Los estados permiten retirar/desactivar cuando el modelo lo contempla; no se
ofrece borrado físico de expedientes regulatorios. La purga de quejas y eventos
adversos sigue siendo excepcional y solo está disponible después del cierre y
del vencimiento de la retención configurada.

## AuditLog

Las 33 acciones de `medical-devices.ts` escriben su `AuditLog` dentro de la
misma `prisma.$transaction` que el registro de negocio (`writeAuditLog`).
Cerrado esta entrega: 15 de las 26 acciones preexistentes (todo el diseño,
lotes, trazabilidad, transición de queja, PMS, FSCA y ambos regulatorios) no
dejaban ningún rastro de auditoría.

## Pack

`PACK_ISO_13485` — familia `ISO_13485`, foco §4.2, §7.3–7.5, §8.2–8.3.
Mapeos a ISO 9001 (y notas hacia ISO 14971 cuando exista en catálogo).

## Reportes (`md-*`)

| Id | Contenido |
|---|---|
| `md-design-history` | Historial de diseño (DHF) |
| `md-master-record` | Expediente maestro (DMR) |
| `md-risks` | Archivos de riesgo |
| `md-validations` | Validaciones (proceso, esterilización, diseño) |
| `md-suppliers` | Proveedores críticos |
| `md-batches` | Lotes |
| `md-complaints` | Quejas |
| `md-surveillance` | Vigilancia post-comercialización |
| `md-events` | Eventos adversos |
| `md-recalls` | Retiros y acciones de campo |
| `md-audit-package` | Paquete de auditoría (todos los anteriores) |

## Tests

```bash
npm run test:medical-devices
```
