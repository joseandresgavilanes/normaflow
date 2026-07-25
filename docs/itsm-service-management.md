# Paquete de Gestión de Servicios TI (ISO/IEC 20000 / ITSM)

Módulo `/app/itsm`: sistema de gestión de servicios — catálogo → SLA/OLA →
solicitudes → incidentes de servicio → problemas / errores conocidos → cambios →
releases / despliegues → CMDB → disponibilidad / capacidad / continuidad →
proveedores → conocimiento → informes de desempeño.

## Namespace (evitar colisiones)

| Concepto | Modelo ITSM | No confundir con |
|---|---|---|
| Incidente de servicio | `ITSMIncident` (`itsm_incidents`) | `SecurityIncident` (ISO 27001) |
| Cambio de servicio | `ITSMChange` (`itsm_changes`) | `ChangeRequest` (gestión del cambio) |
| Continuidad de servicio | `ServiceContinuityPlan` | `BusinessContinuityPlan` (ISO 22301) |
| Proveedor de servicio | `ServiceSupplier` | `Supplier` (maestro; enlace opcional) |
| CI | `ConfigurationItem` | `InformationAsset` (enlace opcional `assetId`) |

Estados de incidente de seguridad (`IncidentStatus`) y de servicio (`ITSMIncidentStatus`) son enums distintos.

## Modelos (20)

`ITService` · `ServiceCatalogEntry` · `ServiceOwner` · `ServiceLevelAgreement` ·
`OperationalLevelAgreement` · `ServiceRequest` · `ITSMIncident` · `Problem` ·
`KnownError` · `ITSMChange` · `Release` · `Deployment` · `ConfigurationItem` ·
`CMDBRelationship` · `AvailabilityPlan` · `CapacityPlan` · `ServiceContinuityPlan` ·
`ServiceSupplier` · `ServiceReport` · `KnowledgeArticle`

## Workflows

```
Incidente:  NEW → ASSIGNED → INVESTIGATING → RESOLVED → CONFIRMED → CLOSED
Problema:   IDENTIFIED → ANALYSIS → KNOWN_ERROR → REMEDIATION → RESOLVED → CLOSED
Cambio:     REQUESTED → ASSESSED → APPROVED → SCHEDULED → IMPLEMENTED → REVIEWED → CLOSED
```

Implementados en `src/lib/itsm/workflows.ts` (+ CHECKs de atribución en BD).

## Permisos

Módulo `itsm` (`read|create|update|approve|delete|export|*`).
RLS en migración `20260724220000_itsm_service_management`.

## Pack

`PACK_ISO_20000` — familia `ISO_20000`, foco §8.2–8.7 y §9.1.
Mapeos a ISO 9001 e ISO 27001 (sin fusionar incidentes de seguridad).

## Reportes (`itsm-*`)

| Id | Contenido |
|---|---|
| `itsm-sla` | Acuerdos de nivel de servicio |
| `itsm-incidents` | Incidentes ITSM + cumplimiento SLA |
| `itsm-problems` | Problemas y errores conocidos |
| `itsm-changes` | Cambios de servicio |
| `itsm-availability` | Disponibilidad |
| `itsm-capacity` | Capacidad |
| `itsm-continuity` | Continuidad de servicio |
| `itsm-suppliers` | Proveedores de servicio |
| `itsm-service-performance` | Desempeño por servicio (MTTR, SLA, disp.) |

## Tests

```bash
npm run test:itsm
```
