# Data governance — export, deletion, offboarding, retention

## Export (portability)
```bash
MODE=export ORG_ID=<orgId> npm run org:offboard
```
Writes `exports/org-<orgId>-<ts>.json` with the organization row plus every
tenant table (documents, records, evidence metadata, risks, incidents,
vulnerabilities, continuity, assets, SoA, billing, audit log, …) and per-table
counts. This is the customer's data-portability deliverable and the retained
record when offboarding.

> The JSON contains personal data — handle as confidential, deliver over an
> encrypted channel, and delete the working copy afterward.

## Deletion / erasure
```bash
MODE=delete ORG_ID=<orgId> OFFBOARDING_CONFIRM=delete-<orgId> npm run org:offboard
# production also requires: ALLOW_PRODUCTION_OFFBOARDING=true
```
Runs the export first, then `organization.delete` — all tenant rows cascade
(FKs are `ON DELETE CASCADE`). The `AuditLog` is append-only during operation but
is removed with the org on hard-delete; keep the export as the erasure record.
The delete runs inside a transaction that sets `normaflow.audit_log_purge` — the
only sanctioned way past the append-only trigger, see [audit-log-policy.md](audit-log-policy.md).

**Not covered by the DB delete (do these in the provider consoles as the final steps):**
- **Supabase Storage:** delete all objects under `org-<orgId>/` in `documents` and `evidence` ([runbooks/storage.md](runbooks/storage.md)).
- **Supabase Auth:** delete users that belonged only to this org.
- **Stripe:** cancel the subscription and, if requested, delete/anonymize the customer.
- **Log/observability platform & backups:** covered by retention windows below.

## Offboarding checklist
1. Confirm the request is authorized (account owner / legal).
2. `MODE=export` → deliver the export to the customer; store the retained copy in encrypted storage.
3. Cancel Stripe subscription.
4. `MODE=delete` with the confirmation token.
5. Delete Storage objects + Auth users for the org.
6. Record completion (date, operator, export location) for the audit trail.

## Retention
| Data | Retention | Basis |
|---|---|---|
| Live tenant data | Life of the contract | Service provision |
| Offboarding export (retained copy) | Per contract / legal minimum, then destroy | Evidence of erasure |
| Pre-migration & on-demand dumps | 90 days | Recoverability |
| Supabase PITR / snapshots | ≥ 7 days PITR + 30 days snapshots | Backup ([backup-restore.md](backup-restore.md)) |
| Structured logs | 30–90 days (platform config) | Security/ops investigation |
| Audit log (active tenant) | Life of tenant (append-only) | ISO 27001 A.8.15 |

After a hard-delete, data persists only in backups until those windows expire —
document this in the customer's erasure confirmation.
