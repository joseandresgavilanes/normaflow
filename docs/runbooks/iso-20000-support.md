# Runbook — ISO/IEC 20000 (ITSM) customer support

Product support playbook for customers running `PACK_ISO_20000`. Not an
infra runbook — see [security-incident.md](security-incident.md) for that.
**symptoms → immediate actions → resolution → verification**, per
[README.md](README.md).

## Activation & entitlement

**Symptom:** customer can't activate ISO/IEC 20000 / sees "no incluye los
módulos requeridos" or lands on `/app/billing?upgrade=...`.
- Confirm the org has an `OrganizationPackEntitlement` row for
  `PACK_ISO_20000` (`enabled: true`, not expired) — grant via
  `grantPackEntitlement`. Never bypass via plan `modules`.
- Confirm the plan includes the pack's `requiredModules`
  (`src/lib/standard-packs/iso-20000-2018.pack.ts`) — `itsm` in
  particular is Growth+ only.

## Clause coverage — where each function lives

| Función | Módulo |
|---|---|
| Contexto, alcance, política, roles | `/app/context` |
| Portafolio, catálogo de servicios, propietarios | `/app/itsm` → Catálogo |
| SLA, OLA | `/app/itsm` → SLA / OLA |
| Solicitudes | `/app/itsm` → Solicitudes |
| Incidentes ITSM | `/app/itsm` → Incidentes |
| Problemas, errores conocidos | `/app/itsm` → Problemas |
| Cambios, releases, despliegues | `/app/itsm` → Cambios / Releases |
| Activos, configuración, CMDB | `/app/itsm` → CMDB |
| Disponibilidad, capacidad, continuidad | `/app/itsm` → Disp. / Cap. / Cont. |
| Seguridad del servicio | `/app/security-controls` (enlace opcional, no fusiona) |
| Proveedores | `/app/itsm` → Proveedores |
| Conocimiento | `/app/itsm` → Conocimiento |
| Reportes | `/app/itsm` → Panel, `/app/reporting` |
| Auditoría | `/app/audit-program`, `/app/audits` |
| Revisión por dirección | `/app/management-review` |

## Common issues

**Un incidente de servicio se confunde con un incidente de seguridad.**
Son modelos y tablas completamente separados: `ITSMIncident`
(`itsm_incidents`) vs `SecurityIncident` (`security_incidents`), con
enums de estado distintos (`ITSMIncidentStatus` vs `IncidentStatus`). Si
el cliente necesita relacionarlos (p. ej. una caída de servicio causada
por un incidente de seguridad), usar el vínculo cruzado descrito abajo —
nunca reclasificar uno como el otro.

**No puedo relacionar un incidente ITSM con uno de seguridad/IA/laboral.**
Usar `linkItsmIncidentCrossDomain` (`/app/itsm` → pestaña Incidentes →
"Vínculos con otros dominios"). Crea una fila en `incident_cross_links`
que solo señala la relación — no toca el estado de ninguno de los dos
incidentes. Cada uno se sigue gestionando en su propio módulo con su
propio workflow.

**Un cambio no se puede aprobar.** Exige `itsm:approve` y queda con
`approvedById` — reforzado por CHECK de base de datos
(`itsm_changes_approved_attributed`, cualquier estado desde `APPROVED`
en adelante requiere aprobador).

**Un CI no se puede relacionar consigo mismo.** Es intencional — CHECK
`itsm_cmdb_no_self_link`. Si el cliente ve el error al intentar crear una
relación reflexiva, es un error de captura, no un bug.

**Un problema se documenta como error conocido pero no cambia de
estado.** Si estaba en `ANALYSIS` o `IDENTIFIED`, crear el `KnownError`
avanza automáticamente el `Problem` a `KNOWN_ERROR` en la misma
operación — si ya estaba en otro estado (p. ej. `REMEDIATION`), no se
toca automáticamente y debe transicionarse manualmente.

**Un SLA no se puede crear con tiempos en cero.** CHECK
`itsm_sla_times_positive` exige `responseTimeMinutes > 0 AND
resolutionTimeMinutes > 0`.

**Reporte "paquete de auditoría de servicios TI" no incluye una sección
nueva.** `itsm-audit-package` agrega manualmente una lista de secciones
en `src/lib/actions/reporting.ts` — si se agrega un nuevo tipo de
reporte ITSM, hay que añadirlo a esa lista explícitamente.

## Verification after any fix

- `DATABASE_URL=…disposable… npm run test:itsm` against a disposable DB
  (never prod).
- `tests-live/itsm-tenant.spec.ts` (instalación del pack, SLA,
  incidentes, problemas, cambios, CMDB, vínculo cruzado con AIIncident,
  tenant A/B, RLS, AuditLog, reportes) — requires `TEST_*` Supabase
  credentials, never the production project.

## Escalation

Data-integrity or cross-tenant leakage suspicion, an incident closed
without a recorded confirmer, a change approved without an approver
slipping through, or an incident cross-link that appears to alter the
linked incident's own status → treat as P0
([support-sla.md](../support-sla.md)), open a `SecurityIncident`, follow
[security-incident.md](security-incident.md).
