# Support, severity & incident response

## Ticket classification
| Type | Examples | Default queue |
|---|---|---|
| Incident | Outage, errors, data issue, security | On-call |
| Bug | Wrong behavior, non-blocking | Engineering backlog |
| How-to / question | Usage, configuration | Support |
| Feature request | New capability | Product backlog |
| Billing | Invoices, plan changes | Ops/Finance |
| Security report | Vuln disclosure, suspected breach | Security owner ([runbooks/security-incident.md](runbooks/security-incident.md)) |

## Severity & internal SLA
Business hours unless stated; P0/P1 are 24/7.

| Sev | Definition | Ack | Mitigation target | Updates |
|---|---|---|---|---|
| **P0** | Full outage, data loss, active security breach, billing broken for all | 15 min | 4 h | every 30 min |
| **P1** | Major feature down / severe degradation for many; failed restore drill | 30 min | 1 business day | hourly |
| **P2** | Single feature degraded; worker backlog; workaround exists | 4 business h | 3 business days | daily |
| **P3** | Minor bug, cosmetic, isolated | 1 business day | next release | on change |

## Escalation
1. On-call acknowledges within the Ack SLA.
2. **P0/P1:** page the engineering owner; if security, also the security owner + founder. Open a `SecurityIncident`/incident record.
3. No mitigation within target → escalate one level and widen comms.
4. Provider-caused (Supabase/Stripe/Resend/Vercel): open a provider ticket in parallel and follow the matching runbook.

## Incident response loop
`DETECT → TRIAGE → CONTAIN → ERADICATE → RECOVER → REVIEW` — mirrors the in-app
incident workflow (no state skipping).
- **Declare** severity + owner; single incident channel.
- **Communicate** per the update cadence; status page for customer-facing P0/P1.
- **Resolve** using the runbook; verify with `/api/health` + `/api/internal/ops-metrics`.
- **Review:** post-incident review within 5 business days — timeline, root cause, corrective/preventive actions (link Annex A controls / `ImprovementAction`s). P0 always gets a written post-mortem.

## Relationship to CI/CD
A `P0`/`do-not-merge` label blocks merges (CI `p0-gate` job) — no shipping over an open P0.
