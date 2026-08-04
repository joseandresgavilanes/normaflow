# Runbook — ISO 50001 (energía) customer support

Product support playbook for customers running `PACK_ISO_50001`. Not an
infra runbook — see [security-incident.md](security-incident.md) for that.
**symptoms → immediate actions → resolution → verification**, per
[README.md](README.md).

## Activation & entitlement

**Symptom:** customer can't activate ISO 50001 / sees "no incluye los
módulos requeridos" or lands on `/app/billing?upgrade=...`.
- Confirm the org has an `OrganizationPackEntitlement` row for
  `PACK_ISO_50001` (`enabled: true`, not expired) — grant via
  `grantPackEntitlement`. Never bypass via plan `modules`.
- Confirm the plan includes the pack's `requiredModules`
  (`src/lib/standard-packs/iso-50001-2018.pack.ts`) — `energy` in
  particular is Growth+ only.

## Clause coverage — where each function lives

| Función | Módulo |
|---|---|
| Contexto, alcance, política, roles | `/app/context` |
| Revisión energética | `/app/energy` → Revisión energética |
| Fuentes de energía, consumos | `/app/energy` → Fuentes y usos |
| Usos significativos | `/app/energy` → Usos significativos |
| Líneas base | `/app/energy` → Línea base |
| EnPI | `/app/energy` → EnPI |
| Medidores, lecturas | `/app/energy` → Medidores y lecturas |
| Variables relevantes, factores estáticos, normalización | `/app/energy` → Variables y factores |
| Oportunidades, objetivos, planes | `/app/energy` → Opportunities, Acciones; `/app/context` → Objetivos |
| Diseño | `/app/energy` → Diseño |
| Compras, proveedores | `/app/energy` → Compras |
| Medición, verificación de ahorros | `/app/energy` → Ahorros |
| Indicadores | `/app/indicators`, `/app/energy` → EnPI |
| Auditoría | `/app/audit-program`, `/app/audits` |
| Revisión por dirección | `/app/management-review` |
| Mejora | `/app/energy` → Acciones, `/app/nonconformities` |

## Common issues

**Cliente no puede aprobar una revisión energética.** El flujo es
`DRAFT → IN_PROGRESS → UNDER_REVIEW → APPROVED`, sin saltos. Aprobar exige
`energy:approve` y queda con nombre y fecha del aprobador — reforzado por
CHECK de base de datos (`status <> 'APPROVED' OR (approvedById IS NOT NULL
AND approvedAt IS NOT NULL)`).

**Cliente crea una nueva línea base o EnPI con el mismo código y no ve la
anterior.** Es intencional: usar el mismo código versiona — la fila anterior
queda `SUPERSEDED` (línea base) o `superseded: true` (EnPI) automáticamente,
dentro de la misma transacción que crea la nueva versión. Nada se sobrescribe;
la versión previa sigue existiendo con su propio `formulaVersion`. Confirmar
con el cliente si de verdad quería una versión nueva o un registro
independiente (código distinto).

**Dos personas versionan la misma línea base/EnPI a la vez y una falla.**
Es el comportamiento esperado: `unique(organizationId, code, formulaVersion)`
garantiza que solo una escritura concurrente gane esa versión — la otra debe
reintentar (normalmente obtendrá la versión siguiente). No es un error de la
plataforma; es la base de datos rechazando una duplicación silenciosa.

**Una verificación de ahorro no puede cerrarse como verificada.** Exige
`energy:approve` y queda con verificador y fecha — reforzado por CHECK
(`status <> 'VERIFIED' OR (verifiedById IS NOT NULL AND verifiedAt IS NOT
NULL)`).

**El coste o las emisiones de una lectura salen vacíos.** Solo se calculan
si la fuente del medidor tiene `costPerUnit`/`emissionFactor` configurados.
Sin esos datos en `EnergySource`, la lectura se guarda igualmente pero sin
coste ni emisiones — pedir al cliente que complete la fuente.

**Reporte "paquete de auditoría energética" no incluye una sección nueva.**
`enms-audit-package` agrega manualmente una lista de secciones en
`src/lib/actions/reporting.ts` — si se agrega un nuevo tipo de reporte EnMS,
hay que añadirlo a esa lista explícitamente.

## Verification after any fix

- `DATABASE_URL=…disposable… npm run test:energy` against a disposable DB
  (never prod).
- `tests-live/energy-tenant.spec.ts` (instalación del pack, fórmulas,
  líneas base, EnPI, datos concurrentes, tenant A/B, AuditLog, reportes,
  permisos) — requires `TEST_*` Supabase credentials, never the production
  project.

## Escalation

Data-integrity or cross-tenant leakage suspicion, a duplicated
`(code, formulaVersion)` slipping through, or a saving verification closed
without a recorded verifier → treat as P0
([support-sla.md](../support-sla.md)), open a `SecurityIncident`, follow
[security-incident.md](security-incident.md).
