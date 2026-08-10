# Runbook — ISO 9001 customer support

Product support playbook for customers running `PACK_ISO_9001` (LIVE). Not an
infra runbook — see [security-incident.md](security-incident.md) or
[supabase-outage.md](supabase-outage.md) for that. **symptoms → immediate
actions → resolution → verification**, per [README.md](README.md).

## Activation & entitlement

**Symptom:** customer can't activate ISO 9001 / sees "no incluye los módulos
requeridos" or lands on `/app/billing?upgrade=...`.
- Confirm the org has an `OrganizationPackEntitlement` row for `PACK_ISO_9001`
  (`enabled: true`, not expired) — grant one via `grantPackEntitlement`
  (`src/lib/actions/standard-packs.ts`) if missing. Never work around this by
  editing the plan's `modules` array — entitlements are the real gate
  (see `docs/standard-packs.md`).
- Confirm the plan includes the pack's `requiredModules`
  (`src/lib/standard-packs/iso-9001-2015.pack.ts`): `gap`, `documents`,
  `audits`, `nonconformities`, `actions`, `indicators`, `management-review`.

## Clause coverage — where each requirement lives

| Clause | Module |
|---|---|
| 4.1 Contexto | `/app/setup`, `/app/gap` |
| 4.2 Partes interesadas | `/app/context` (standalone — no need to adopt SIG) |
| 4.3 Alcance | `OrganizationStandard.scope` (set on activation, `/app/standards`) |
| 5.2 Política de calidad | `/app/documents` (tipo POLICY) |
| 5.3 Roles y responsabilidades | `/app/info/positions`, `/app/info/personnel` |
| 6.1 Riesgos y oportunidades | `/app/risks`, `/app/opportunities` |
| 6.2 Objetivos de calidad | `/app/context` |
| 7.1.2 Competencia | `/app/training` |
| 7.2 Requisitos del cliente | `/app/quality-ops` (pestaña Requisitos del cliente) |
| 7.4 Comunicación | `/app/quality-ops` (pestaña Comunicación) |
| 7.5 Control documental | `/app/documents` |
| 8.1 Procesos | `/app/processes` |
| 8.3 Diseño y desarrollo | `/app/design-dev` |
| 8.4 Proveedores | `/app/suppliers` |
| 8.5.2 Identificación y trazabilidad | `/app/records` |
| 8.5.3 Propiedad del cliente | `/app/quality-ops` (pestaña Propiedad del cliente) |
| 8.5.4 Preservación | `/app/quality-ops` (pestaña Preservación) |
| 8.5.6 Control de cambios | `/app/changes` |
| 8.7 Salidas no conformes | `/app/nonconformities` |
| 9.1.1 Seguimiento y medición | `/app/indicators` |
| 9.1.2 Satisfacción del cliente | `/app/quality-ops` (pestaña Satisfacción del cliente) |
| 9.2 Auditorías internas | `/app/audit-program`, `/app/audits` |
| 9.3 Revisión por la dirección | `/app/management-review` |
| 10.2 No conformidad y acción correctiva | `/app/nonconformities` → CAPA |
| 10.3 Mejora continua | `/app/actions` |

## Common issues

**GAP score looks stuck / wrong.** GAP answers live per `Assessment` +
`AssessmentAnswer` (one assessment per organization+edition). Check
`/app/gap`; if the customer transitioned editions, verify
`transitionEdition` carried answers forward via `RequirementMapping`
(archives the prior assessment, never deletes).

**"Customer can't find X" where X used to be a free-text field.** As of this
pack-completeness pass, 7.2/7.4/8.5.3/8.5.4/9.1.2 are structured in
`/app/quality-ops`, not embedded in Documents anymore — point the customer
there instead of telling them to write a document.

**Audit package export missing a section.** `ReportExport` with
`reportType: "audit-package"` aggregates GAP, documents, NC/CAPA, audits,
indicators — check `src/lib/actions/reporting.ts`. If a new quality-ops or
design-dev record type should appear in the package and doesn't yet, that's
a product gap — file it, don't hand-edit the export.

## Verification after any fix

- `npm run test:packs` against a disposable DB (never prod).
- Confirm the customer's org still passes tenant isolation:
  `tests-live/standards-engine-tenant.spec.ts`.

## Escalation

Data-integrity or cross-tenant leakage suspicion → treat as P0
([support-sla.md](../support-sla.md)), open a `SecurityIncident`, follow
[security-incident.md](security-incident.md).
