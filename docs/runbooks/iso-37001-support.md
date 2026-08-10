# Runbook — ISO 37001 (anti-bribery) customer support

Product support playbook for customers running `PACK_ISO_37001`. Not an
infra runbook — see [security-incident.md](security-incident.md) for that.
**symptoms → immediate actions → resolution → verification**, per
[README.md](README.md).

## Activation & entitlement

**Symptom:** customer can't activate ISO 37001 / sees "no incluye los
módulos requeridos" or lands on `/app/billing?upgrade=...`.
- Confirm the org has an `OrganizationPackEntitlement` row for
  `PACK_ISO_37001` (`enabled: true`, not expired) — grant via
  `grantPackEntitlement`. Never bypass via plan `modules`.
- Confirm the plan includes the pack's `requiredModules`
  (`src/lib/standard-packs/iso-37001-2016.pack.ts`) — `compliance`,
  `speakup` and `antibribery` are all required; a customer with
  `antibribery` but not `compliance` cannot use this pack at all, since
  every action is gated on `compliance:*`.

## Clause coverage — where each function lives

| Función | Módulo |
|---|---|
| Contexto, alcance, política, roles | `/app/context` |
| Función de cumplimiento, riesgo de soborno | `/app/antibribery` → Riesgo de soborno |
| Debida diligencia de terceros | `/app/antibribery` → Socios de negocio, Debida diligencia |
| Beneficiario final (UBO) | `/app/antibribery` → Beneficiarios (requiere `antibribery-sensitive`) |
| Controles financieros/no financieros | `/app/antibribery` → Controles |
| Compromisos antisoborno | `/app/antibribery` → Compromisos |
| Regalos, hospitalidad, donaciones | `/app/antibribery` → Regalos, Donaciones |
| Planteamiento de preocupaciones | `/app/compliance` → Canal de denuncias (reutilizado, no duplicado) |
| Investigación y tratamiento del soborno | `/app/antibribery` → Investigaciones (puente a `Investigation` del SGC) |
| Auditoría | `/app/audit-program`, `/app/audits` |
| Revisión por dirección y por la función de cumplimiento | `/app/management-review` |

## Common issues

**Un cliente con rol CONTRIBUTOR o VIEWER no ve beneficiarios finales
(UBO).** Es intencional — esa tabla está detrás de
`antibribery-sensitive:*`, un permiso deliberadamente distinto de
`compliance:*` y no otorgado a CONTRIBUTOR/VIEWER por defecto (igual que
`safety-sensitive`/`md-sensitive` en otros packs). Otorgar el permiso
solo a roles de gestión/auditoría que realmente necesiten ver nombre
legal y condición PEP de terceros.

**Una debida diligencia no se puede aprobar aunque tenga aprobador.**
Si el socio es de riesgo alto/crítico, funcionario público, interactúa
con PEP, o el screening dio `POTENTIAL_MATCH`/`CONFIRMED_HIT`, el caso
debe pasar primero por `ENHANCED_REVIEW` — la plataforma lo bloquea
(`requiresEnhancedReview`), no es un error.

**Un regalo no se puede aprobar directamente desde `MANAGER_REVIEW`.**
El flujo es `SUBMITTED → MANAGER_REVIEW → COMPLIANCE_REVIEW →
APPROVED|REJECTED`, sin saltos — reforzado por
`gift_hospitality_compliance_decision_attributed` (CHECK: APPROVED o
REJECTED exige revisor de compliance atribuido).

**Una operación de alto riesgo no se puede aprobar.** Quien la solicitó
no puede aprobarla — `requiresIndependentApproval` lo bloquea en el
dominio, no solo en la interfaz. Si además involucra a un funcionario
público, exige aprobador explícito.

**Reporte "paquete de auditoría antisoborno" no incluye
beneficiarios finales.** Es intencional — `abms-audit-package` excluye
deliberadamente `abms-beneficial-owners` (`antibribery-sensitive`,
minimización de datos: un compendio pedido con `compliance:export` no
debe llevar UBO/PEP sin más). Exportarlo por separado con
`antibribery-sensitive:read`.

**No puedo relacionar un caso de soborno con una investigación.**
`linkAntiBriberyInvestigation` exige el id de una `Investigation` ya
abierta en el SGC — este pack nunca crea una investigación nueva, solo
la tipifica (`allegationType`) y la enlaza. Abrir primero la
investigación en `/app/compliance`.

## Verification after any fix

- `DATABASE_URL=…disposable… npm run test:antibribery` against a
  disposable DB (never prod).
- `tests-live/antibribery-tenant.spec.ts` (instalación del pack, riesgo
  de soborno, debida diligencia, beneficiario final con acceso sensible,
  regalos, segregación en aprobaciones de alto riesgo, tenant A/B, RLS,
  AuditLog, reportes) — requires `TEST_*` Supabase credentials, never
  the production project.

## Escalation

Data-integrity or cross-tenant leakage suspicion, a CONTRIBUTOR/VIEWER
account that can read `beneficial_owners`, a high-risk approval where
requester equals approver, or a gift approved/rejected without a
compliance reviewer attributed → treat as P0
([support-sla.md](../support-sla.md)), open a `SecurityIncident`, follow
[security-incident.md](security-incident.md).
