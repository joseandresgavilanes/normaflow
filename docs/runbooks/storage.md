# Runbook — Supabase Storage

Two private buckets: `documents` and `evidence`. Objects live under
`org-<organizationId>/…` and RLS policies scope every SELECT/INSERT/UPDATE/DELETE
by that prefix + org permission. A per-org byte counter reserves quota atomically.

## Symptoms
- Uploads/downloads 403 or fail; signed URLs expired/invalid.
- Quota errors on upload; storage byte counter drift.
- Orphaned objects (rows deleted but files remain, or vice-versa).

## Diagnose
1. Confirm buckets exist and are **private** (dashboard). The storage RLS migration fails loudly if a bucket is missing.
2. Check the object path is under `org-<id>/` — a wrong prefix will be denied by policy.
3. Logs around the failing upload/download; `storage.*` events.

## Resolution
- **403 on legitimate access:** verify the user's org membership/permission and that the path prefix matches their org. Re-issue a fresh signed URL (they are short-lived by design).
- **Quota exhausted:** confirm the org's plan storage limit; the reservation counter is initialized from persisted metadata. If drifted, run `npm run storage:reconcile-documents` to reconcile document storage/state.
- **Orphaned objects after tenant deletion:** offboarding does NOT remove Storage — delete `org-<id>/` objects in the dashboard/API as the final offboarding step (see [../data-governance.md](../data-governance.md)).

## Verification
- Upload + download a test file in each bucket for a test org.
- Cross-tenant access denied (covered by `tests-live/supabase-isolation.spec.ts`).
