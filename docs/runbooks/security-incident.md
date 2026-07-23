# Runbook — Security incident

Covers suspected or confirmed security events (leaked credential/secret,
unauthorized access, data exposure, malware, DoS). Mirrors the in-product
incident workflow (`/app/incidents`): **DETECTED → TRIAGED → INVESTIGATING →
CONTAINED → ERADICATED → RECOVERED → CLOSED** (no skipping states).

## 1. DETECTED / TRIAGED (first 15 min)
- Open a `SecurityIncident` record; set severity + category; assign a responsible.
- Assess **notification requirements** (e.g. GDPR: authority within 72h; affected data subjects). Record them on the incident.
- Preserve evidence: capture logs (structured JSON drain), do NOT destroy state.

## 2. CONTAINED
- **Leaked secret** (`STRIPE_*`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `NEXTAUTH_SECRET`, DB creds): rotate immediately in the provider + Vercel env, redeploy. Rotating `NEXTAUTH_SECRET`/`DEMO_SESSION_SECRET` invalidates sessions.
- **Unauthorized account access:** deactivate the membership/user; force re-login by rotating session secret; review `AuditLog` (append-only) for the actor's actions and blast radius.
- **Data exposure via API:** RLS is the primary control; verify the tenant-isolation live tests still pass and that no policy regressed in the last release.

## 3. ERADICATED / RECOVERED
- Remove the root cause (patch, revoke, fix policy). Deploy the fix.
- Restore any affected data from backups if integrity is in question ([backup-restore.md](backup-restore.md)).
- Verify: `/api/health` ok, tenant-isolation suite green, affected flows validated.

## 4. CLOSED + follow-up
- Complete external notifications if required; attach evidence to the incident.
- Record **lessons learned**; create `ImprovementAction`s / link Annex A controls.
- Post-incident review within 5 business days.

## Escalation
Sev-1 security → notify the security owner + founder immediately; treat as P0 ([support-sla.md](../support-sla.md)).
