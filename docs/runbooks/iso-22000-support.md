# Runbook — ISO 22000 (inocuidad alimentaria / HACCP) customer support

Product support playbook for customers running `PACK_ISO_22000`. Not an
infra runbook — see [security-incident.md](security-incident.md) for that.
**symptoms → immediate actions → resolution → verification**, per
[README.md](README.md).

## Activation & entitlement

**Symptom:** customer can't activate ISO 22000 / sees "no incluye los
módulos requeridos" or lands on `/app/billing?upgrade=...`.
- Confirm the org has an `OrganizationPackEntitlement` row for
  `PACK_ISO_22000` (`enabled: true`, not expired) — grant via
  `grantPackEntitlement`. Never bypass via plan `modules`.
- Confirm the plan includes the pack's `requiredModules`
  (`src/lib/standard-packs/iso-22000-2018.pack.ts`) — `food-safety` in
  particular is Growth+ only.

## Clause coverage — where each function lives

| Función | Módulo |
|---|---|
| Contexto, alcance, política, equipo de inocuidad | `/app/context` |
| Productos, materias primas, uso previsto | `/app/food-safety` → Productos y MP |
| Diagramas de flujo, etapas de proceso | `/app/food-safety` → Flujos |
| Peligros (biológicos, químicos, físicos, alérgenos) | `/app/food-safety` → Peligros |
| Evaluación de peligros, medidas de control | `/app/food-safety` → Peligros |
| PRP, OPRP | `/app/food-safety` → PRP / OPRP |
| CCP, límites críticos, validación, verificación | `/app/food-safety` → PCC |
| Monitoreo | `/app/food-safety` → Monitoreo |
| Desviaciones, correcciones, acciones correctivas | `/app/food-safety` → Desviaciones, `/app/nonconformities` |
| Trazabilidad, lotes | `/app/food-safety` → Trazabilidad |
| Retiro, recall | `/app/food-safety` → Retiros |
| Alérgenos | `/app/food-safety` → Alérgenos |
| Emergencias | `/app/food-safety` → Emergencias |
| Comunicación de cadena | `/app/food-safety` → Comunicación de cadena |
| Auditoría | `/app/audit-program`, `/app/audits` |
| Revisión por dirección | `/app/management-review` |

## Common issues

**Una lectura de monitoreo fuera de límite no abre una desviación.** Solo
ocurre automáticamente si al registrar la lectura se marca la casilla
"abrir desviación automáticamente" (`autoOpenDeviation`) — es opcional
porque no todo fuera-de-límite amerita una desviación formal (depende del
criterio del equipo de inocuidad). Cuando se marca, la lectura y la
desviación se crean en la misma transacción: nunca hay una lectura
fuera de límite sin su desviación si el cliente pidió que se abriera.

**El puntaje de una evaluación de peligro no coincide con severidad ×
probabilidad.** Es un CHECK de base de datos
(`hazard_assessments_score_consistent`) — la plataforma rechaza cualquier
intento de guardar un puntaje inconsistente, incluso vía API directa. Si
el cliente ve un error al editar, confirmar que el puntaje enviado sea
exactamente el producto de los dos valores.

**Un límite crítico "entre" (BETWEEN) no se puede guardar.** Exige
`minValue <= maxValue` y ambos presentes — reforzado por CHECK
(`critical_limits_between_order`). Si el cliente quiere un límite de un
solo lado, debe usar `GTE`/`LTE`/`GT`/`LT`, no `BETWEEN`.

**Un retiro no incluye todos los lotes esperados.** El campo `lotCodes`
al crear el retiro ya debe incluir todos los lotes de la cadena, hacia
atrás (materia prima, proveedor) y hacia adelante (producto terminado,
distribución) — la UI ofrece un selector de casillas que expande la
cadena real, pero si se creó vía API directamente hay que expandirla
primero (`lotsAffectedByRecall` en `src/lib/food-safety/traceability.ts`)
antes de enviarla.

**Un retiro no se puede cerrar.** Exige `closedAt` — reforzado por CHECK
(`withdrawal_recalls_closed_attributed`, `status <> 'CLOSED' OR closedAt
IS NOT NULL`).

**Comunicación de cadena da error de permisos aunque el usuario tiene
`food-safety:create`.** Ya resuelto: la política RLS de
`communication_records` acepta `food-safety:read`/`food-safety:create`
como alternativa a `quality-ops:*` desde la migración
`20260725050000_food_safety_chain_communication`. Si el error persiste,
confirmar que esa migración está aplicada (`npx prisma migrate status`).

**La prueba de trazabilidad da "incompleta".** Significa que algún
`previousLotIds` apunta a un lote que no existe o pertenece a otra
organización — revisar el lote referenciado, la trazabilidad nunca cruza
el límite de tenant.

**Reporte "paquete de auditoría HACCP" no incluye una sección nueva.**
`fsms-audit-package` agrega manualmente una lista de secciones en
`src/lib/actions/reporting.ts` — si se agrega un nuevo tipo de reporte
FSMS, hay que añadirlo a esa lista explícitamente.

## Verification after any fix

- `DATABASE_URL=…disposable… npm run test:food-safety` against a
  disposable DB (never prod).
- `tests-live/food-safety-tenant.spec.ts` (instalación del pack,
  peligros, PCC, OPRP, límites, monitoreo, trazabilidad adelante/atrás,
  recall, tenant A/B, RLS, AuditLog, comunicación de cadena) — requires
  `TEST_*` Supabase credentials, never the production project.

## Escalation

Data-integrity or cross-tenant leakage suspicion, a monitoring record
marked out-of-limit without its expected deviation, a recall that misses
lots in the real chain, or trazabilidad returning an incomplete chain
unexpectedly → treat as P0 ([support-sla.md](../support-sla.md)), open a
`SecurityIncident`, follow [security-incident.md](security-incident.md).
