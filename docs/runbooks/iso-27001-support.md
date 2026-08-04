# Runbook — ISO 27001 customer support

Product support playbook for customers running `PACK_ISO_27001` (LIVE). Not
an infra runbook — see [security-incident.md](security-incident.md) for an
actual security event against NormaFlow itself. **symptoms → immediate
actions → resolution → verification**, per [README.md](README.md).

## Activation & entitlement

**Symptom:** customer can't activate ISO 27001 or the 93-control catalog
looks empty.
- Confirm `OrganizationPackEntitlement` for `PACK_ISO_27001` (`enabled: true`)
  — grant via `grantPackEntitlement`. Never bypass via plan `modules`.
- Confirm the control catalog seeded: `SecurityControl` should have 93 active
  rows for the active `ControlCatalogVersion` (37 organizational / 8 people /
  14 physical / 34 technological — see `docs/security-controls-catalog.md`).
  If empty, the seed (`npm run db:seed`) didn't run for this environment —
  do **not** hand-author controls; re-run the seed.
- Confirm `OrganizationControl` rows exist per activated control (one per
  org per active control) — created on activation, never touched by pack
  reinstall.

## Clause coverage — where each requirement lives

| Area | Module |
|---|---|
| 4.2 Partes interesadas | `/app/context` (standalone — no need to adopt SIG) |
| 6.2 Objetivos de seguridad | `/app/context` |
| 7.4 Comunicación | `/app/quality-ops` (pestaña Comunicación — shared clause number with 9001) |
| Catálogo de controles / SoA | `/app/security-controls`, `/app/soa` |
| Activos, propietarios, clasificación | `/app/assets` |
| Riesgos, tratamiento, residual, aceptación | `/app/risk-treatment` |
| Evidencias y revisiones por control | `ControlEvidence` / `ControlReview` (from `/app/security-controls`) |
| Incidentes | `/app/incidents` |
| Vulnerabilidades | `/app/vulnerabilities` |
| Continuidad | `/app/continuity` |
| Proveedores | `/app/suppliers/security` |
| Cambios | `/app/changes` |
| Auditoría interna | `/app/audit-program`, `/app/audits` |
| Revisión por la dirección SGSI | `/app/management-review` (filter by `ISO_27001` in `standards`) |

## Common issues

**"Where do I document legal/regulatory requirements (A.5.31)?"** Through
that specific control's evidence + `OrganizationControl` status, not a
separate legal register — the control catalog *is* the mechanism. If the
customer also runs ISO 37301 (`PACK_ISO_37301`), the fuller obligation
register lives there instead; don't duplicate.

**SoA percentage doesn't match expectations.** `StatementOfApplicability` is
versioned (`SoAControlEntry` per version); confirm the customer is looking at
the current `ACTIVE` version, not a superseded one — `supersededById` chains
history, nothing is deleted.

**Access-control questions (A.5.15–A.5.18).** These are controls in the
catalog like any other — evidence + `OrganizationControl` status. There is no
separate "Accesos" page; that's by design (avoids duplicating the same
control twice).

## Verification after any fix

- `npm run test:packs` against a disposable DB (never prod).
- `tests-live/security-tenant.spec.ts`, `security-controls-tenant.spec.ts`,
  `soa-tenant.spec.ts`, `risk-treatment-tenant.spec.ts` still green.

## Escalation

Any suspected cross-tenant read/write on security-controls, SoA, assets, or
risk data is P0 by default — treat as an actual security incident on
NormaFlow, not just a support ticket: follow
[security-incident.md](security-incident.md).
