# Runbook — Data export (portability / DSAR)

Produces a full export of a tenant's data (GDPR portability / data-subject
access support). Backed by `scripts/org-offboarding.ts`. See
[../data-governance.md](../data-governance.md).

## Procedure
1. Confirm the request is authorized (account owner / legal).
2. Run:
   ```bash
   MODE=export ORG_ID=<orgId> npm run org:offboard
   ```
   Produces `exports/org-<orgId>-<ts>.json`: the organization row + every tenant
   table (documents, records, evidence metadata, risks, audits, CAPA, indicators,
   controls, SoA, risk treatment, assets, incidents, vulnerabilities, continuity,
   billing, notifications, audit log) with per-table counts.
3. **Deliver over an encrypted channel** (the file contains personal data —
   treat as confidential). Do not email it in the clear.
4. Delete the working copy after delivery; keep only the retained record if
   required by contract.

## Notes
- Evidence *files* live in Supabase Storage under `org-<orgId>/`; if the customer
  needs the binaries too, generate signed URLs or export the objects from Storage.
- `exports/` is git-ignored — never commit an export.

## Verification
- Open the JSON; confirm `counts` are non-zero for the tenant's active modules
  and that `organizationId` in the file matches the requested org.
