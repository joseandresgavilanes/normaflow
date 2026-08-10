# Runbook — Sistema Integrado de Gestión (SIG) customer support

Product support playbook for customers running `PACK_SIG_9001_14001_45001`
on top of ISO 9001 + ISO 14001 + ISO 45001. Not an infra runbook — see
[security-incident.md](security-incident.md) for that. **symptoms →
immediate actions → resolution → verification**, per [README.md](README.md).

## Activation & entitlement

**Symptom:** customer can't activate the SIG pack / sees "no incluye los
módulos requeridos".
- Confirm the org has an `OrganizationPackEntitlement` row for
  `PACK_SIG_9001_14001_45001` (`enabled: true`, not expired) — grant via
  `grantPackEntitlement`. This is independent of the entitlement for each
  individual norm — a customer needs all four rows (9001, 14001, 45001, SIG)
  for the full commercial offering.
- Commercially the SIG bundle assumes ISO 9001, 14001 and 45001 are already
  active — this isn't enforced in code (each pack's entitlement is
  independent), so sales/onboarding must sequence it: activate the three
  norms first, then the SIG layer.

## Where each SIG function lives

| Función | Módulo |
|---|---|
| Alcance y política integrados | `/app/integrated` → Alcance y política |
| Partes interesadas / contexto común | `/app/context` (standalone) o `/app/integrated` → Partes interesadas |
| Procesos comunes | `/app/processes` (ya compartido entre normas) |
| Riesgos por disciplina / integrados | `/app/risks` + `/app/integrated` → Auditoría integrada (asignación de disciplinas) |
| Objetivos compartidos | `/app/integrated` → Objetivos |
| Documentos / evidencias multirrequisito | `/app/documents`, `/app/evidence` + matriz de correspondencia (`RequirementCoverage`) |
| Competencias comunes | `/app/training` |
| Proveedores integrados | `/app/integrated` → Auditoría integrada → Proveedores |
| Cambios con impacto múltiple | `/app/changes` + `/app/integrated` → Auditoría integrada → Cambios |
| Auditoría integrada / hallazgos multinorma | `/app/audits` + `/app/integrated` → Auditoría integrada |
| CAPA única | `/app/nonconformities` + `/app/integrated` → Auditoría integrada → CAPA |
| Revisión por la dirección integrada | `/app/management-review` + `/app/integrated` → Auditoría integrada → Revisión |
| Indicadores por norma y globales / Dashboard SIG | `/app/integrated` → Panel integrado |

## Common issues

**Cliente no ve la correspondencia entre 14001 y 45001 (solo ve hacia 9001).**
La matriz completa 3-vías (`SIG_CROSSWALK`) solo se instala cuando el
cliente activa una de las tres normas o el propio pack SIG
(`installCrosswalk()` corre dentro de `activateStandard`). Si activó las
normas en un orden extraño o hay datos antiguos, correr
`installStandardPack("PACK_SIG_9001_14001_45001")` (permiso `packs:install`,
solo OWNER/SUPER_ADMIN) para forzar la reinstalación — es idempotente.

**Requisito "específico" que el cliente cree que debería ser "compartible".**
Es intencional: un requisito específico solo se marca compartible cuando
existe evidencia real de reutilización (un documento/evidencia que también
cubre un requisito de otra norma), no solo porque conceptualmente se
_podría_ compartir. Guiar al cliente a vincular el mismo documento/evidencia
a ambos requisitos desde la matriz de correspondencia.

**"No se puede editar este requisito/norma" al intentar corregir un error de
catálogo.** Las ediciones ACTIVE son inmutables a nivel de base de datos
(`nf_standard_requirements_lock`/`nf_standard_editions_lock`) — ni el equipo
de soporte puede editarlas directamente en Supabase. Un cambio de contenido
real exige publicar una nueva `editionCode` en el manifest del pack; escalar
a ingeniería, no intentar un `UPDATE` manual (fallará con excepción).

**El factor de reutilización es menor a 1 / no sube.** Solo aumenta cuando
un mismo documento o evidencia se vincula a más de un requisito vía
`RequirementCoverage` — recuerda al cliente que necesita `standards:activate`
(no solo `integrated:read`) para crear esos vínculos.

**Auditoría/CAPA/revisión no se marca como "integrada".** Se calcula
automáticamente: `Audit.integrated = standards.length > 1`, lo mismo para
`shared`/`integrated` en CAPA/revisión — basta con seleccionar más de una
norma en el control correspondiente de la pestaña "Auditoría integrada".

## Verification after any fix

- `DATABASE_URL=…disposable… npm run test:sig` against a disposable DB
  (never prod).
- `tests-live/integrated-tenant.spec.ts` (tenant A/B, documento/evidencia
  multirrequisito, auditoría integrada, CAPA compartida, inmutabilidad
  histórica, AuditLog, reportes, permisos) — requires `TEST_*` Supabase
  credentials, never the production project.

## Escalation

Data-integrity or cross-tenant leakage suspicion, or any attempt to bypass
edition immutability → treat as P0 ([support-sla.md](../support-sla.md)),
open a `SecurityIncident`, follow [security-incident.md](security-incident.md).
