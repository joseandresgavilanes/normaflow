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

## Modelos (21)

`ITService` · `ServiceCatalogEntry` · `ServiceOwner` · `ServiceLevelAgreement` ·
`OperationalLevelAgreement` · `ServiceRequest` · `ITSMIncident` · `Problem` ·
`KnownError` · `ITSMChange` · `Release` · `Deployment` · `ConfigurationItem` ·
`CMDBRelationship` · `AvailabilityPlan` · `CapacityPlan` · `ServiceContinuityPlan` ·
`ServiceSupplier` · `ServiceReport` · `KnowledgeArticle` · `IncidentCrossLink`

### Integración entre dominios de incidente (sin fusionar)

`IncidentCrossLink` relaciona un `ITSMIncident` con un incidente de otro
dominio — `SecurityIncident` (ISO 27001), `AIIncident` (ISO/IEC 42001) u
`OccupationalIncident` (ISO 45001) — sin tocar el estado de ninguno de
los dos. `targetId` se valida en la capa de aplicación
(`linkItsmIncidentCrossDomain`) contra la tabla del dominio
correspondiente; no hay FK real cross-tabla porque el destino puede
pertenecer a cualquiera de las tres. Cada dominio conserva su propio
enum de estado (`ITSMIncidentStatus`, `IncidentStatus`, `AIIncidentStatus`,
`OccupationalIncidentStatus`) — el vínculo es solo trazabilidad.

## Workflows

```
Incidente:  NEW → ASSIGNED → INVESTIGATING → RESOLVED → CONFIRMED → CLOSED
Problema:   IDENTIFIED → ANALYSIS → KNOWN_ERROR → REMEDIATION → RESOLVED → CLOSED
Cambio:     REQUESTED → ASSESSED → APPROVED → SCHEDULED → IMPLEMENTED → REVIEWED → CLOSED
Solicitud:  NEW → IN_PROGRESS → FULFILLED → CLOSED (o CANCELLED)
Release:    PLANNED → BUILDING → READY → RELEASED (o ROLLED_BACK)
Despliegue: PENDING → IN_PROGRESS → SUCCESS (o FAILED / ROLLED_BACK)
```

Implementados en `src/lib/itsm/workflows.ts` (+ CHECKs de atribución en BD).

## Atomicidad

Las acciones de `itsm.ts` escriben su `AuditLog` dentro de la misma
`prisma.$transaction` que el registro de negocio (`writeAuditLog`, no el
patrón `logAuditEvent` no atómico). `createKnownError` además comparte
transacción con el avance automático del `Problem` padre a
`KNOWN_ERROR` cuando corresponde — antes esa segunda escritura ocurría
fuera de la transacción.

## UI y ciclo de vida

Las 21 entidades están visibles en las 11 pestañas de `ItsmClient.tsx`.
Cada tabla de configuración u operación expone `Editar` para actualizar sus
atributos mediante `updateItsmRecord`, con validación de referencias dentro de
la organización y `AuditLog` atómico. Los registros que representan catálogo,
acuerdos, CIs, planes, proveedores o conocimiento se retiran/reactivan usando
sus estados (`RETIRED`, `INACTIVE`, `ARCHIVED`, `SUPERSEDED`, etc.); no se
ofrece borrado físico porque rompería trazabilidad o relaciones históricas.

Incidentes, problemas y cambios mantienen sus workflows controlados. Además,
solicitudes, releases y despliegues tienen sus transiciones visibles en la
tabla y validadas por `transitionItsmRecord`. Reportes y vínculos conservan
su registro, pero permiten corregir sus atributos descriptivos.

## Notificaciones

`createServiceOwner`, `createServiceRequest`, `createItsmIncident`,
`createItsmProblem` y `createConfigurationItem` notifican al
responsable/asignado cuando se especifica uno.

## Permisos

Módulo `itsm` (`read|create|update|approve|delete|export|*`).
RLS en migración `20260724220000_itsm_service_management` (más
`20260725060000_itsm_incident_cross_link` para `incident_cross_links`).

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
| `itsm-audit-package` | Paquete: SLA, incidentes, problemas, cambios, disponibilidad, capacidad, continuidad y proveedores |

## Tests

```bash
npm run test:itsm
```
