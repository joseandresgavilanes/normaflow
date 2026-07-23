# NormaFlow — Product Status

> **Nota de actualización (2026-07-22):** este documento conserva el histórico de fases iniciales. Para el estado comercial ejecutable y los criterios de primera venta, usar [`docs/commercial-launch-plan.md`](docs/commercial-launch-plan.md). El núcleo live, Server Actions, RLS, Storage, billing y E2E avanzaron desde la fotografía histórica de las secciones siguientes.

Honest snapshot of the codebase against the **ISOTech Manual del Usuario** functional reference.

> **Reference:** ISOTech is used **only** for functional scope. The visual design of NormaFlow is preserved and is much better; do not regress to ISOTech's UI.

---

## 1. Baseline architecture (what already exists and works)

- **Framework:** Next.js 15 (App Router), React 18, TypeScript strict, Tailwind 3, Prisma 5 / Postgres (Supabase).
- **Auth:** Supabase Auth (live) **+ demo-mode cookie session** (`AUTH_DEMO_MODE=true`) — both supported by `src/lib/app-context.ts`. Login / logout / bootstrap (org creation) routes work: `src/app/api/auth/{login,logout,bootstrap,set-org}/route.ts`.
- **Multi-tenancy:** every business model in `prisma/schema.prisma` already FK's to `Organization` and cascades on delete. Membership-based switching via `nf_org` cookie.
- **Roles:** 6-role matrix `SUPER_ADMIN / ORG_ADMIN / COMPLIANCE_MANAGER / AUDITOR / CONTRIBUTOR / VIEWER` with a permission map at `src/lib/constants.ts` and helpers in `src/lib/permissions/frontend.ts`. Enforcement today is **frontend-only** (gating UI, not server routes).
- **Database schema:** `prisma/schema.prisma` (~700 lines) already covers: Organization, User, Membership, Standard/Clause, Assessment + AssessmentAnswer (GAP), Document + DocumentVersion + Approval, Process, Risk + Control, Audit + AuditFinding, Nonconformity, Action + ActionComment, Indicator + IndicatorValue, EvidenceFile, Notification, Subscription, **AuditLog** (model exists but is not written to anywhere).
- **App shell:** `src/app/app/layout.tsx` + sidebar/topbar; 21 module routes wired.
- **Module UIs:** 22 large React modules under `src/components/modules/*` (~5,800 LOC). They read from a **client-side reducer store** at `src/context/WorkspaceStore.tsx` seeded by `src/lib/demo/*` — **none of them persist to Postgres yet**. Only `dashboard/gap` use the real DB via `src/lib/server-queries.ts`.
- **Marketing site:** fully rebuilt in the new dark `nf-` design system (`src/components/marketing/nf/*`), 15 marketing pages converted.

## 2. Gap analysis (manual → codebase)

Legend: ✅ done · 🟡 partial · ❌ missing

### Phase-1 sellable core

| Manual section | Existing | Gap |
|---|---|---|
| § 1 Acceso (login) | ✅ `/login` + demo + Supabase | — |
| § 10 Administración / Usuarios | 🟡 `Membership` model + role enum exist | ❌ Admin UI for CRUD users, invite, deactivate; ❌ org-settings page (`src/app/app/settings` is 7-line placeholder) |
| § 10 Grupos / Permisos a grupo | 🟡 Role enum + permission map | ❌ No `Group` entity (uses role enum only); ❌ no per-org override of permissions; ❌ no server-side permission guard |
| § 11 Cargos | ❌ | `Position` model + CRUD + permissions |
| § 11 Procesos | ✅ `Process` model | 🟡 Wired only to client store; no DB-backed CRUD UI |
| § 11 Datos Personal | ❌ | `Personnel` entity (distinct from `User` — a personnel record can exist without a system login) |
| § 12 Catálogos doc control (Lugar) | ❌ | `Location` catalog model |
| § 12 Control Documentos Internos | 🟡 `Document` + `DocumentVersion` + `Approval` models exist; rich UI exists | ❌ persistence to DB; ❌ distribution list field; ❌ change description per version; ❌ separate `responsibleElaborationId` / `responsibleApprovalId`; ❌ physical-location FK to `Location` catalog; ❌ server-side approval workflow |
| § 12 Control Documentos Externos | 🟡 `DocumentType.OTHER` reuse possible | ❌ no `ExternalDocument` distinct entity, custodian field, external link field |
| § 12 Flujo de Documentos | 🟡 `Approval` table | ❌ no audit-trail view of the full document history (created → reviewed → approved → published) |
| § 13 Catálogos registros (retención, disposición, método archivo, tipo registro) | ❌ | 4 new catalog models |
| § 13 Control de Registros | ❌ | `Record` + `RecordEntry` models with retention/disposition/archive/custody fields |
| § 14 ACPM workflow | 🟡 `Action` + `ActionStatus` exists | ❌ manual mandates 6 stages (Solicitud → Aprobación solicitud → Análisis → Aprobación solución → Implementación → Verificación) — current enum only has 5 generic statuses; ❌ no request-approval / solution-approval gates |
| § 14 ACPM dashboard | 🟡 `dashboard/page.tsx` has overdueCritical | ❌ open / overdue / closed / pending breakdown per type |
| § 15 Auditorías — Programa | 🟡 individual `Audit` model | ❌ no `AuditProgram` (annual program grouping multiple audits) |
| § 15 Auditorías — Plan + Checklist | 🟡 audit fields exist | ❌ no `AuditChecklistItem` model |
| § 15 Auditorías — Informe | 🟡 `reportUrl` field | ❌ no generation flow |
| § 16 Revisión por la Dirección | ❌ | `ManagementReview` + `ManagementReviewInput` + `ManagementReviewDecision` entities + linkage to actions |

### Cross-cutting gaps

| Concern | Status |
|---|---|
| Audit trail (created/updated by, old→new, IP, user-agent) | 🟡 `AuditLog` model exists. **Zero writes** in the codebase. |
| Server-side permission enforcement | ❌ permission checks only run in client components |
| File upload / storage | 🟡 mocked via blob URLs in `WorkspaceStore`. No Supabase Storage wiring, no MIME/size validation, no per-tenant path scoping |
| Email notifications | 🟡 Resend dep installed + `src/lib/resend.ts` exists. ❌ No notification pipeline wired to events |
| Excel/PDF exports | 🟡 buttons exist in UI | ❌ no generation backend |
| End-to-end tests | 🟡 Playwright config + `tests/` dir | check coverage manually; auth/CAPA/document tests likely thin |
| Demo seed data | 🟡 large client-side seed in `src/lib/demo/*`. ❌ no `scripts/seed.ts` against the real DB for the new entities |
| Console errors / dead routes | many placeholder routes (`page.tsx` is 3–7 lines for half the app); 22 module pages render large client stores |

---

## 3. What this turn shipped (Phase 1.0 — foundations)

**Goal:** unblock every later phase by closing the schema gap and laying server-side rails.

1. **`PRODUCT_STATUS.md`** — this file.
2. **Schema extensions** (`prisma/schema.prisma`) — additive, non-breaking. Adds:
   - `Group` + `GroupMembership` + `GroupPermission` (manual § 10).
   - `Position` (Cargo, § 11.1).
   - `Personnel` (Datos Personal, § 11.3) — distinct from `User`.
   - `Location` (Lugar, § 12.1.1).
   - `RetentionTime`, `Disposition`, `ArchiveMethod`, `RecordType` catalogs (§ 13.1).
   - `Record` + `RecordEntry` (§ 13.2).
   - `AuditProgram` (§ 15) and `AuditChecklistItem`.
   - `ManagementReview` + `ManagementReviewInput` + `ManagementReviewDecision` (§ 16).
   - `Document`: added `distributionList String[]`, `locationId`, `responsibleElaborationId`, `responsibleApprovalId`, `physicalLocation`, `isExternal Boolean`, `externalLink`, `custodianId` for external docs.
   - `DocumentVersion`: `changeDescription String?` already covered by `changeLog`; added `oldVersion String?` for delta clarity.
   - `Action`: added `ACPMStage` enum + `stage` field for the 6-step manual workflow (kept existing `status` for backward compat).
3. **Permission matrix expanded** (`src/lib/permissions/matrix.ts`) — every new module is wired into the role permission map. New permission keys: `positions:*`, `personnel:*`, `locations:*`, `records:*`, `groups:*`, `mgmt-review:*`, `audit-program:*`.
4. **Server-side permission guard** (`src/lib/permissions/server.ts`) — `requirePermission(ctx, perm)` for server actions and route handlers.
5. **Audit-trail helper** (`src/lib/audit-log.ts`) — `logAuditEvent({ ctx, action, module, recordId, before, after })`. Writes to the existing `AuditLog` table. Drop-in for any server action.
6. **SQL migration** (`prisma/migrations/<timestamp>_isotech_alignment/migration.sql`) — committed so anyone can `prisma migrate deploy` without needing live DB introspection.

## 4. Roadmap (phases 1.1 → 2.x)

These are queued, not coded in this turn:

### Phase 1.1 — Admin & Catalogs UI

- `/app/settings/users` — list, invite, role assign (uses existing `Membership` + new `Group`)
- `/app/settings/groups` — CRUD + permission assignment
- `/app/settings/organization` — name, logo, default standards
- `/app/info/positions`, `/app/info/personnel` — CRUD with the new models
- `/app/catalogs/{locations,retention,disposition,archive-method,record-type}` — generic catalog table component reused 5×

### Phase 1.2 — Document control DB-backed

- Convert `DocumentsModule.tsx` consumers from `WorkspaceStore` to server actions hitting Prisma
- Wire the approval workflow as real server actions emitting `AuditLog` events
- Supabase Storage for file versions (per-tenant path `org-{id}/documents/{docId}/v{n}.{ext}`)
- Distribution list → triggers `Notification` rows + Resend emails
- New `/app/documents/external` page using the `isExternal=true` filter
- New `/app/documents/[id]/flow` page rendering the full audit trail

### Phase 1.3 — Records control

- `/app/records` master list + `/app/records/[id]` detail
- Catalog dropdowns from § 13 entities
- Retention countdown + disposition reminders

### Phase 1.4 — ACPM 6-stage workflow

- Update `ActionsModule` to render the new `ACPMStage` instead of just status
- Two approval gates (request, solution) with notifications
- Effectiveness verification step → reopen flow

### Phase 1.5 — Audit trail surfacing

- `/app/activity` page consuming the `AuditLog` table with filters

### Phase 2 — Audits, Management Review, exports, emails

- `AuditProgram` planner + checklist editor
- `ManagementReview` meeting tool + linkage to actions
- PDF report generator (react-pdf or puppeteer)
- Excel exports (sheetjs)
- Wire Resend for notification emails

### Phase 2.x — Productization polish

- Replace 21 placeholder pages with real routes or hide them
- Server-side permission enforcement on every action
- E2E tests for auth, documents, approval, CAPA, audit trail
- Pricing → checkout via existing Stripe webhook

---

## 5. How to manually validate Phase 1.0

```bash
# 1. Ensure DB env is set in .env.local
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# 2. Apply migrations
npx prisma migrate deploy

# 3. Regenerate client
npx prisma generate

# 4. Inspect the new schema
npx prisma studio
# → confirm new tables: groups, positions, personnel, locations,
#   retention_times, dispositions, archive_methods, record_types,
#   records, record_entries, audit_programs, audit_checklist_items,
#   management_reviews, management_review_inputs, management_review_decisions

# 5. Build still passes
npx tsc --noEmit
```

The Phase-1.0 deliverables are **schema + helpers only** — no UI for the new entities yet. UI wiring is Phase 1.1+.

## 6. Mapping summary — ISOTech manual → NormaFlow

| Manual § | Module | Schema | Helpers | UI |
|---|---|---|---|---|
| 1 Acceso | Auth | ✅ User/Membership | ✅ app-context | ✅ /login |
| 10 Administración | Admin | ✅ +Group, GroupPermission | ✅ permission matrix | ❌ Phase 1.1 |
| 11 Cargo | Positions | ✅ +Position | ✅ | ❌ Phase 1.1 |
| 11 Procesos | Processes | ✅ Process | — | 🟡 client-only |
| 11 Datos Personal | Personnel | ✅ +Personnel | — | ❌ Phase 1.1 |
| 12 Doc Control | Documents | ✅ +distrib, location, resp | ✅ audit-log | 🟡 client-only |
| 12 Catálogos | Locations | ✅ +Location | — | ❌ Phase 1.1 |
| 12 Flujo Doc | Audit trail | ✅ AuditLog | ✅ logAuditEvent | ❌ Phase 1.5 |
| 13 Records | Records | ✅ +Record, +catalogs | ✅ audit-log | ❌ Phase 1.3 |
| 14 ACPM | Actions | ✅ +ACPMStage | ✅ | 🟡 client-only |
| 15 Auditorías | Audits | ✅ +AuditProgram, checklist | ✅ | 🟡 client-only |
| 16 Revisión Dirección | Mgmt review | ✅ +ManagementReview | ✅ | ❌ Phase 2 |
