# Runbook — ISO 37301 (compliance) customer support

Product support playbook for customers running `PACK_ISO_37301`. Not an
infra runbook — see [security-incident.md](security-incident.md) for that.
**symptoms → immediate actions → resolution → verification**, per
[README.md](README.md).

## Activation & entitlement

**Symptom:** customer can't activate ISO 37301 / sees "no incluye los
módulos requeridos" or lands on `/app/billing?upgrade=...`.
- Confirm the org has an `OrganizationPackEntitlement` row for
  `PACK_ISO_37301` (`enabled: true`, not expired) — grant via
  `grantPackEntitlement`. Never bypass via plan `modules`.
- Confirm the plan includes the pack's `requiredModules`
  (`src/lib/standard-packs/iso-37301-2021.pack.ts`) — `compliance` and
  `speakup` in particular are Growth+ only.

## Clause coverage — where each function lives

| Función | Módulo |
|---|---|
| Contexto, partes interesadas, alcance, política | `/app/context` |
| Función de compliance, roles | `/app/settings/users` (asignar `COMPLIANCE_MANAGER`) |
| Obligaciones, fuentes regulatorias, jurisdicciones, aplicabilidad | `/app/compliance` → Obligaciones, Fuentes y jurisdicciones |
| Riesgos, controles | `/app/compliance` → Risks, Controles |
| Objetivos | `/app/context` → Objetivos |
| Calendario | `/app/compliance` → Calendario |
| Evaluaciones | `/app/compliance` → Evaluaciones |
| Cambios regulatorios | `/app/compliance` → Cambios regulatorios |
| Formación | `/app/compliance` → Formación |
| Comunicación | notificaciones automáticas (intake, acuse, respuesta, cierre, cambio con impacto) |
| Conflictos de interés | `/app/compliance` → Conflictos de interés |
| Canal de denuncias, reportes anónimos | `/app/compliance` → Canal de denuncias |
| Investigaciones, evidencias protegidas | `/app/compliance` → Investigaciones (evidencia dentro de cada caso) |
| Incumplimientos, remediación | `/app/compliance` → Incumplimientos, Remediación |
| Sanciones configurables | `ComplianceObligation.sanctionDescription`/`maxSanctionAmount`, `ComplianceBreach.sanctionAmount` |
| Informes al órgano de gobierno | `/app/compliance` → Órgano de gobierno |
| Auditoría | `/app/audit-program`, `/app/audits` |
| Revisión por dirección | `/app/management-review` |
| Mejora | `/app/compliance` → Remediación, `/app/nonconformities` |

## Common issues

**Cliente no ve ningún caso en el canal de denuncias aunque tiene
`COMPLIANCE_MANAGER`.** Es intencional: `speakup:read` abre la bandeja del
módulo, no un caso concreto. Cada expediente exige una fila viva en
`SpeakUpCaseAccess` (sin `revokedAt`), reforzada por una política RLS
RESTRICTIVE — ni siquiera el comodín `*` la salta. Autorizar el caso con
`grantCaseAccess`, o confirmar que el receptor por defecto del canal está
bien configurado (`configureSpeakUpChannel`).

**Nadie recibe las denuncias nuevas.** Confirma `defaultHandlerId` en la
configuración del canal (`/app/compliance` → Canal de denuncias). Si no hay
titular ni suplente configurados, el sistema recurre a los miembros con rol
`COMPLIANCE_MANAGER`, `ORG_ADMIN` u `OWNER` — si ninguno existe y no hay
`externalChannelUrl` configurada, la presentación de la denuncia se
rechaza explícitamente en lugar de perderse en silencio.

**Cliente pregunta por qué una denuncia anónima no puede admitirse.**
Confirma que `allowAnonymous` está activo en la configuración del canal
(`configureSpeakUpChannel`, requiere `speakup:approve`) — mientras esté
desactivado, la propia base de datos rechaza el INSERT anónimo con un
trigger (`nf_speakup_mode_allowed`), no solo la interfaz.

**Un investigador no puede asignarse a un caso.** Si es la persona señalada
en la denuncia, la base lo rechaza siempre (CHECK
`investigations_lead_is_not_the_subject`). Si tiene una declaración de
conflicto de interés con recusación obligatoria (`ConflictOfInterestDeclaration.recusalRequired`),
la independencia falla igualmente — usar `recuseInvestigator` para
reasignar.

**Un caso no se puede cerrar.** Un caso con investigaciones sin concluir no
se cierra: primero `setInvestigationStatus(..., { to: "CONCLUDED" })`, luego
`closeSpeakUpCase`. El cierre exige resultado y resumen (CHECK
`speak_up_reports_closure_requires_outcome`).

**Un caso no se puede purgar.** La purga solo procede tras vencer el plazo
de retención del caso cerrado (`retentionUntil`, fijado al cerrar según
`retentionMonths` del canal) — reforzado por CHECK
(`speak_up_reports_purge_after_retention`). No hay atajo administrativo.

**"Dato ilegible — verifica SPEAKUP_DATA_ENCRYPTION_KEY".** El nombre,
correo o teléfono del informante se cifran en reposo (AES-256-GCM). Este
mensaje aparece si la clave configurada no coincide con la usada para
cifrar el registro — normalmente tras rotar
`SPEAKUP_DATA_ENCRYPTION_KEY` sin re-cifrar los registros existentes
primero. No afecta a denuncias anónimas: nunca tienen identidad que cifrar.

**Reporte "paquete de auditoría de compliance" no incluye una sección
nueva.** `compliance-audit-package` agrega manualmente una lista de
secciones en `src/lib/actions/reporting.ts` — si se agrega un nuevo tipo de
reporte de compliance, hay que añadirlo a esa lista explícitamente.

## Verification after any fix

- `DATABASE_URL=…disposable… npm run test:compliance` against a disposable
  DB (never prod).
- `tests-live/compliance-tenant.spec.ts` (instalación del pack, tenant A/B,
  denuncias, anonimato, acceso restringido por necesidad de conocer,
  investigaciones, AuditLog, reportes, permisos) — requires `TEST_*`
  Supabase credentials, never the production project.

## Escalation

Data-integrity or cross-tenant leakage suspicion, a need-to-know boundary
bypass on the speak-up channel, or any suspected exposure of a reporter's
identity → treat as P0 ([support-sla.md](../support-sla.md)), open a
`SecurityIncident`, follow [security-incident.md](security-incident.md).
