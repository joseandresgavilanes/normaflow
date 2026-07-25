# Standard Pack Engine

The Standard Pack Engine lets NormaFlow add new ISO norms as **data** — a versioned
"pack" — instead of rewriting the application. A pack describes a norm family, its
editions, the requirement (clause) tree, and companion artifacts (evidence rules,
GAP questions, audit checklists, templates) plus cross-standard correspondences.

## Data model

```
StandardFamily ──1:N──> StandardEdition ──1:N──> StandardRequirement
   (ISO_9001)              (2015, 2026)              (4, 4.1, 6.1.2 …)

StandardPack ──N:M──> StandardEdition            (installable bundle)
RequirementMapping    (requirement ⇄ requirement, cross-standard)
RequirementEvidenceRule / GapQuestionTemplate / AuditChecklistTemplate / StandardTemplate
OrganizationStandard  (an org activates an edition: scope, responsable, cert, next audit)
RequirementCoverage   (shared-satisfaction: one entity → many requirements, any norm)
```

Key rename from the previous single-standard model: `Standard → StandardEdition`,
`Clause → StandardRequirement`. FK **column** names (`standardId`, `clauseId`) were
intentionally retained as compatibility aliases; the relations now point to the new
models. **`StandardEdition.code` equals the family code** (e.g. `ISO_9001`) so every
existing `.standard.code` reader keeps working; editions are distinguished by
`editionCode`/`version` and uniqueness is `(familyId, editionCode)`.

## Manifest format

A manifest is a plain object validated by `standardPackSchema`
(`src/lib/standard-packs/pack-schema.ts`). Authored packs live in
`src/lib/standard-packs/*.pack.ts` and are typed `StandardPackInput`.

```ts
{
  code: "PACK_ISO_9001",            // globally unique pack code
  name: "ISO 9001 — Calidad",
  version: "2015.1",
  description?: string,
  requiredModules: ["gap", "documents", …],   // gated against the org plan on activation
  featureFlags: { qualityManagement: true },  // stored on the pack; per-plan checks
  editions: [{
    familyCode: "ISO_9001",         // StandardFamily.code
    familyName: "ISO 9001",
    category?: "Calidad",
    familyDescription?: string,
    editionCode: "2015",            // unique within the family
    name: "ISO 9001",
    version: "2015",
    year?: 2015,
    catalogVersion?: "2015.1",
    status?: "ACTIVE",              // DRAFT | ACTIVE | SUPERSEDED | WITHDRAWN
    requirements: [                 // the clause tree
      { code: "4",   title: "Contexto de la organización" },
      { code: "4.1", title: "…", parent: "4", mandatory?: true, summary?: "own summary", level?: 2 },
    ],
    evidenceRules?:   [{ requirementCode, expectedType, mandatory?, frequency?, retentionMonths?, note? }],
    gapQuestions?:    [{ requirementCode, question, guidance?, weight?, options?, version? }],
    auditChecklist?:  [{ requirementCode, question, expectedEvidence?, criterion?, version? }],
    templates?:       [{ requirementCode?, templateType, name, content, version? }],
  }],
  mappings?: [                      // cross-standard correspondence (Annex SL, etc.)
    { sourceFamily: "ISO_9001", sourceCode: "9.2", targetFamily: "ISO_27001", targetCode: "9.2",
      relationType: "EQUIVALENT", equivalencePercent?: 100, notes?: string },
  ],
}
```

### Deterministic ids

`requirementIdFor(familyCode, code)` produces stable ids so installs are idempotent
and never duplicate:

- `ISO_9001` → `cl-9001-<code>`   (preserves ids already in production)
- `ISO_27001` → `cl-27001-<code>`
- any other family → `req-<family-slug>-<code>`

> **Multi-edition note:** because the legacy scheme keys requirement ids by *family*,
> a second concurrent edition of the *same* family must use edition-aware ids (the
> `req-…` form) to avoid colliding with the legacy edition's requirements.

## Lifecycle

1. **Install** (platform / `packs:install`) — `installPack(manifest)` upserts the
   pack, families, editions and requirements by deterministic key, and *replaces*
   the catalog-only artifacts (evidence rules, GAP/audit templates, standard
   templates) per edition. It **never** touches organization data. Idempotent.
   Server action: `installStandardPack(code)` / `installAllStandardPacks()`.
2. **Activate** (`standards:activate`) — `activateStandard({ familyCode, editionCode?, scope, responsibleId, nextAuditDate })`
   installs the pack if needed, creates the `OrganizationStandard` link with its
   metadata, and seeds the initial GAP assessment. Plan gating checks the pack's
   `requiredModules` against the org plan.
3. **Cover** (`standards:activate`) — `linkRequirementCoverage({ requirementId, entityType, entityId })`
   attaches a document / risk / evidence / indicator / audit / CAPA / record /
   process to a requirement. One entity can satisfy requirements across **several**
   norms at once (`RequirementCoverage`, unique per org+requirement+entity).
4. **Transition** (`standards:activate`) — `transitionEdition({ familyCode, fromEditionCode, toEditionCode })`
   activates the target edition and carries GAP answers forward through
   `RequirementMapping`, archiving the prior assessment as history (no deletion).

## Licensing

Packs carry **only** codes, structure, NormaFlow's **own** titles/summaries and
metadata — never the protected full text of a standard. The `content` fields on
`StandardTemplate` are empty by default and are the designated slot for licensed or
customer-provided content, imported once authorized. Do not paste normative text
from an ISO document into a manifest.

## Security

- Global catalog tables: `GRANT SELECT` to `authenticated`; writes go through the
  Prisma owner / service role (pack install is platform-gated).
- `requirement_coverage` is org-scoped with RLS: `SELECT` requires `standards:read`,
  writes require `standards:activate`, both bound to the row's `organizationId`.
- Every server action enforces `requirePermission` + `tenantWhere`/`tenantData` +
  Zod validation + `AuditLog`. Cross-tenant isolation is covered by
  `tests-live/standards-engine-tenant.spec.ts`.

## Adding a new norm

1. Create `src/lib/standard-packs/<iso-xxxxx-yyyy>.pack.ts` exporting a
   `StandardPackInput`.
2. Register it in `STANDARD_PACKS` (`src/lib/standard-packs/index.ts`).
3. (Optional) add cross-mappings to/from existing families.
4. Install it: `npm run db:seed` (dev) or `installStandardPack("PACK_…")` (platform).
5. Verify: `DATABASE_URL=<disposable> npm run test:packs`.

No schema change, migration, or module rewrite is required to add a norm.
```

## Specialized modules on top of a pack (ISO 14001)

A pack supplies the clause tree, GAP/audit/evidence catalog and cross-standard
mappings. When a norm needs **domain-specific data** beyond generic coverage, a
pack is paired with specialized models and a module page. ISO 14001:2015 is the
reference example (`PACK_ISO_14001`, family `ISO_14001`):

- **Models** (`prisma/schema.prisma`, migration `..._environmental_management`):
  `EnvironmentalAspect`/`EnvironmentalImpact` (matriz de aspectos e impactos),
  `EnvironmentalSignificanceMethod` (versioned methodology), `Environmental­Compliance­Obligation`/`…Evaluation`,
  `EnvironmentalObjective`/`EnvironmentalProgram`, `EnvironmentalMetric`,
  `WasteStream`, `EnvironmentalEmergencyScenario`. All org-scoped with RLS gated
  on the `environment` module; person/process/entity links are scalar ids
  validated org-scoped in the actions (cross-standard requirement satisfaction
  still flows through `RequirementCoverage`).
- **Logic** (`src/lib/environmental/*`): `significance.ts` (pure, testable
  significance calc — weighted-sum/product/sum, control mitigation, threshold →
  level + significant flag), `compliance.ts` (overdue / non-compliant state),
  `queries.ts` (`getEnvironmentPayload`).
- **Actions**: `src/lib/actions/environment.ts` (`environment:read|create|update|delete`).
- **Reports**: `env-aspects-impacts`, `env-significant-aspects`,
  `env-legal-obligations`, `env-compliance-evaluation`, `env-objectives`,
  `env-resource-consumption`, `env-waste`, `env-emissions`, `env-emergencies`,
  `env-audit-package` — via `ReportArtifact`/`reportRows` + `reporting-contract.ts`.
- **UI**: `/app/environment`. **Tests**: `npm run test:env`
  (`scripts/test-environmental.ts`, disposable DB).

ISO 45001:2018 (`PACK_ISO_45001`, family `ISO_45001`, module `safety`) follows
the same shape — occupational hazards + risk assessment (W.T. Fine, `src/lib/safety/risk.ts`),
worker consultation, inspections, PPE items/assignments, permits to work,
occupational incidents with a **strict linear investigation workflow**
(`src/lib/safety/incident-workflow.ts`: REPORTED→CLASSIFIED→INVESTIGATING→ROOT_CAUSE→ACTION_PLAN→IMPLEMENTED→EFFECTIVENESS_VERIFIED→CLOSED,
no jumps), health surveillance, emergency drills, contractor safety. Safety
indicators (frequency/severity/accident rate) in `src/lib/safety/indicators.ts`;
incident transitions emit `notifyUser` notifications. Reports `safety-*` incl.
`safety-audit-package`. UI `/app/safety`. **Tests**: `npm run test:safety`.

ISO/IEC 42001:2023 (`PACK_ISO_42001`, family `ISO_42001`, module `aims`) adds AI
governance: AI system inventory and risk classification, seven-dimension impact
assessment, datasets with provenance/quality/bias, model versions and
evaluations, human oversight controls, transparency records, AI incidents,
supplier assessments, change requests and monitoring metrics
(`src/lib/aims/*`, all pure). Its defining rule is that **no AI output becomes an
official record automatically**: `AIGeneratedOutput` runs
DRAFT→HUMAN_REVIEW→APPROVED|REJECTED and DB `CHECK` constraints refuse any
approval without a named reviewer or any promotion without approval. Reports
`ai-*` incl. `ai-human-review` and `ai-audit-package`. UI `/app/aims`.
**Tests**: `npm run test:aims`. See `docs/ai-management-system.md`.

ISO 37301:2021 (`PACK_ISO_37301`, family `ISO_37301`, modules `compliance` +
`speakup`) adds the compliance management system: obligation register with
jurisdictions/sources, applicability, compliance risks/controls, calendar and
alerts, compliance evaluations, regulatory change monitoring, conflict-of-interest
declarations, whistleblower channel, investigations, breaches, remediation,
training and governing-body reports (`src/lib/compliance/*`, all pure). The
speak-up channel is a **separate permission module** with need-to-know RLS
(`SpeakUpCaseAccess` + restrictive policies): holding `speakup:read` or even `*`
does not open a case. Anonymous reports store no identity (CHECK + trigger).
Investigations refuse a conflicted lead (CHECK + `checkIndependence()`). Reports
`compliance-*` (speak-up export is aggregates only). UI `/app/compliance`.
**Tests**: `npm run test:compliance`. See `docs/compliance-management-system.md`.

ISO 50001:2018 (`PACK_ISO_50001`, family `ISO_50001`, module `energy`) adds the
energy management system: sources, uses, energy review, SEUs, baselines, EnPIs
with **configurable versioned formulas**, meters/readings, relevant variables,
static factors, opportunities, action plans, saving verification, procurement
and design reviews (`src/lib/energy/*`, all pure). Reports `enms-*` incl.
`enms-audit-package`. UI `/app/energy`. **Tests**: `npm run test:energy`.
See `docs/energy-management-system.md`.

ISO 22000:2018 (`PACK_ISO_22000`, family `ISO_22000`, module `food-safety`) adds
the food safety / HACCP system: products, raw materials, intended use, process
flows/steps, hazards, assessments, PRP, OPRP, CCP, critical limits, monitoring,
deviations, corrections, validation, verification, traceability lots (forward +
backward), withdrawal/recall, allergens and emergencies (`src/lib/food-safety/*`,
all pure). Reports `fsms-*` incl. `fsms-audit-package`. UI `/app/food-safety`.
**Tests**: `npm run test:food-safety`. See `docs/food-safety-management-system.md`.

ISO/IEC 20000-1:2018 (`PACK_ISO_20000`, family `ISO_20000`, module `itsm`) adds
IT service management: service catalog, SLA/OLA, requests, **ITSMIncident**
(separate from SecurityIncident), problems, known errors, changes, releases,
deployments, CMDB, availability/capacity/service continuity, suppliers and
knowledge (`src/lib/itsm/*`, all pure). Reports `itsm-*`. UI `/app/itsm`.
**Tests**: `npm run test:itsm`. See `docs/itsm-service-management.md`.

ISO 13485:2016 (`PACK_ISO_13485`, family `ISO_13485`, module `medical-devices`)
adds medical device QMS: DMR/DHF, design controls, device risk files, critical
suppliers, process/sterilization validation, batches, traceability, complaints,
adverse events, PMS, field safety actions and product recalls (`src/lib/medical-devices/*`,
pure privacy + workflows). **Does not replace national regulatory requirements.**
Sensitive vigilance uses `md-sensitive:*`. Reports `md-*` incl. `md-audit-package`.
UI `/app/medical-devices`. **Tests**: `npm run test:medical-devices`.
See `docs/medical-device-quality-management.md`.

ISO 37001:2016 (`PACK_ISO_37001`, family `ISO_37001`, modules `compliance` +
`speakup` + `antibribery`) extends the compliance pack with anti-bribery
specialization: bribery risk assessments, business associates, due diligence,
beneficial owners, gifts/hospitality, donations/sponsorships, ABMS conflict
declarations, facilitation payments, financial/non-financial control tests,
high-risk transaction approvals, anti-bribery commitments and investigation
bridges (`src/lib/antibribery/*`, all pure). **Does not duplicate** obligations,
speak-up, `Investigation`, compliance risks or CAPA — links by org-scoped IDs.
Due diligence: `DRAFT→SCREENING→REVIEW→ENHANCED_REVIEW→APPROVED|REJECTED→PERIODIC_REVIEW`.
Gifts: `SUBMITTED→MANAGER_REVIEW→COMPLIANCE_REVIEW→APPROVED|REJECTED`. Reports
`abms-*`. UI `/app/antibribery` (gated by `compliance:read`). **Tests**:
`npm run test:antibribery`. See `docs/anti-bribery-management-system.md`.
