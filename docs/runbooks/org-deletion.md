# Runbook — Organization deletion (offboarding / erasure)

Hard-deletes a tenant's data after an authorized offboarding/erasure request.
Backed by `scripts/org-offboarding.ts`. See [../data-governance.md](../data-governance.md).

## Preconditions
- Request authorized by the account owner / legal.
- Stripe subscription cancelled (or will be, step 3).

## Procedure
1. **Export first (retained record):**
   ```bash
   MODE=export ORG_ID=<orgId> npm run org:offboard
   ```
   Delivers `exports/org-<orgId>-<ts>.json` to the customer; keep the retained copy in encrypted storage.
2. **Take a backup** (pre-destructive): `pg_dump` per [../backup-restore.md](../backup-restore.md).
3. Cancel the Stripe subscription for the org.
4. **Delete (cascade):**
   ```bash
   MODE=delete ORG_ID=<orgId> OFFBOARDING_CONFIRM=delete-<orgId> \
     ALLOW_PRODUCTION_OFFBOARDING=true npm run org:offboard
   ```
   Runs export again, then `organization.delete` (all tenant rows cascade via `ON DELETE CASCADE`).
5. **Provider-side cleanup (not done by the script):**
   - Supabase Storage: delete all objects under `documents/org-<orgId>/` and `evidence/org-<orgId>/`.
   - Supabase Auth: delete users that belonged only to this org.
6. Record completion (date, operator, export location) in the audit trail.

## Verification
- `select count(*) from organizations where id='<orgId>'` → 0.
- Storage prefix `org-<orgId>/` returns no objects.

## Rollback
Data persists only in the pre-deletion backup + Supabase PITR window; restore from there if the deletion was in error.
