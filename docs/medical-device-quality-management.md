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

## Modelos (24)

`DeviceFamily` · `MedicalDevice` · `DeviceMasterRecord` · `DesignHistoryFile` ·
`DesignInput` · `DesignOutput` · `DesignReview` · `DesignVerification` ·
`DesignValidation` · `DesignTransfer` · `DeviceRiskFile` · `CriticalSupplier` ·
`SupplierQualification` · `ProcessValidation` · `SterilizationValidation` ·
`ProductionBatch` · `DeviceTraceability` · `Complaint` · `AdverseEvent` ·
`PostMarketSurveillance` · `FieldSafetyAction` · `ProductRecall` ·
`RegulatoryRequirement` · `RegulatorySubmission`

## Privacidad

- No almacenar información clínica personal innecesaria.
- Usar `anonymizedSubjectRef` / `customerAccountRef` opacos (p. ej. `CASE-0001`).
- Validación en dominio + CHECKs SQL (sin `@`, sin secuencias de 8+ dígitos).

## Permisos reforzados

| Módulo | Alcance |
|---|---|
| `medical-devices:*` | Expedientes, diseño, riesgos, proveedores, validaciones, lotes, PMS, requisitos |
| `md-sensitive:*` | Quejas, eventos adversos, FSCA, retiros |

CONTRIBUTOR/VIEWER tienen QMS general pero **no** `md-sensitive` (salvo grants
explícitos). AUDITOR y roles de gestión sí pueden leer vigilancia sensible.

## Workflows

```
DMR/DHF:   DRAFT → UNDER_REVIEW → APPROVED → SUPERSEDED
Queja:     RECEIVED → TRIAGED → INVESTIGATING → CAPA_LINKED → CLOSED
Retiro:    DRAFT → INITIATED → NOTIFYING → IN_PROGRESS → COMPLETED → CLOSED
```

Implementados en `src/lib/medical-devices/workflows.ts` (+ CHECKs de atribución).

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
