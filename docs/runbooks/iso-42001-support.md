# Runbook — ISO/IEC 42001 (AIMS) customer support

Product support playbook for customers running `PACK_ISO_42001`. Not an
infra runbook — see [security-incident.md](security-incident.md) for that.
**symptoms → immediate actions → resolution → verification**, per
[README.md](README.md).

## Activation & entitlement

**Symptom:** customer can't activate ISO/IEC 42001 / sees "no incluye los
módulos requeridos" or lands on `/app/billing?upgrade=...`.
- Confirm the org has an `OrganizationPackEntitlement` row for
  `PACK_ISO_42001` (`enabled: true`, not expired) — grant via
  `grantPackEntitlement`. Never bypass via plan `modules`.
- Confirm the plan includes the pack's `requiredModules`
  (`src/lib/standard-packs/iso-42001-2023.pack.ts`) — `aims` in particular is
  Growth+ only.

## Clause coverage — where each function lives

| Función | Módulo |
|---|---|
| Inventario de sistemas de IA, propietarios, proveedores | `/app/aims` → Inventario IA |
| Casos de uso | `/app/aims` → Inventario IA → Casos de uso |
| Personas afectadas, clasificación e impacto | `/app/aims` → Inventario IA (autonomía/criticidad), Evaluación de impacto |
| Evaluación de impacto (7 dimensiones) | `/app/aims` → Evaluación de impacto |
| Riesgos de IA | `/app/aims` → Riesgos |
| Privacidad, seguridad, sesgo, discriminación | `/app/aims` → Datos (dataset, revisión de sesgo), Riesgos |
| Transparencia, explicabilidad | `/app/aims` → Transparencia, `ModelVersion.explainabilityMethod` |
| Supervisión humana | `/app/aims` → Supervisión |
| Datasets, procedencia, calidad, linaje | `/app/aims` → Datos |
| Modelos, versiones, evaluaciones, validación | `/app/aims` → Modelos |
| Monitoreo | `/app/aims` → Monitoreo |
| Cambios | `/app/aims` → Cambios |
| Incidentes | `/app/aims` → Incidentes |
| Proveedores externos | `/app/aims` → Proveedores |
| Retiro de sistemas | `/app/aims` → Inventario IA (cambiar estado a Retirado) |
| Objetivos | `/app/context` → Objetivos |
| Auditoría | `/app/audit-program`, `/app/audits` |
| Revisión por dirección | `/app/management-review` |
| Mejora | `/app/aims` → acciones de mejora derivadas de incidentes/evaluaciones, `/app/nonconformities` |

## Common issues

**Cliente no puede aprobar un sistema para producción.** Requiere: (1) una
evaluación de impacto **aprobada** por una persona, (2) que la clasificación
resultante no sea `UNACCEPTABLE`, (3) si la clase es `HIGH`, al menos un
control de supervisión humana activo. Todo forzado por `approveAISystem` y
respaldado por un CHECK de base de datos (`ai_systems_production_requires_approval`)
— ni siquiera una escritura directa a Supabase puede saltárselo.

**Un modelo no puede pasar a producción.** Requiere aprobación humana
(`reviewStatus = APPROVED`), una evaluación no fallida, y si tiene dataset de
entrenamiento, que esté revisado de sesgo y con calidad suficiente
(`model_versions_production_requires_approval`, CHECK de base de datos).

**Una salida de IA no se puede promover a registro oficial.** Solo se puede
promover una salida en `APPROVED` — nunca `DRAFT`, `HUMAN_REVIEW` ni
`REJECTED`. Es la regla humana central del pack, reforzada por CHECK
(`ai_generated_outputs_promotion_requires_approval`). Guiar al cliente a
enviar la salida a revisión y conseguir la aprobación primero.

**El asistente de IA del producto rechaza un mensaje.** Si contiene una
credencial o clave (patrón de API key, clave AWS, clave privada, JWT), la
llamada se rechaza *antes* de enviarse al proveedor externo — es
intencional, no un error. Pedir al cliente que retire la credencial del
mensaje.

**Cliente pregunta por qué el asistente de IA aparece en el inventario sin
que él lo haya registrado.** Es intencional desde esta entrega: la primera
vez que se usa el asistente general (`/api/ai`), se autoregistra como
`AISystem` (`código IA-ASSISTANT`) en estado `PLANNED` — nunca aprobado para
producción automáticamente, eso sigue siendo una decisión humana con su
propio CHECK. El objetivo es que el inventario refleje el uso real, no solo
lo que alguien recuerda registrar a mano.

**Reporte "auditoría de IA completa" no incluye una sección nueva.**
`ai-audit-package` agrega manualmente una lista de secciones en
`src/lib/actions/reporting.ts` — si se agrega un nuevo tipo de reporte AIMS,
hay que añadirlo a esa lista explícitamente.

## Verification after any fix

- `DATABASE_URL=…disposable… npm run test:aims` against a disposable DB
  (never prod).
- `tests-live/aims-tenant.spec.ts` (instalación del pack, tenant A/B,
  sistemas, datasets, modelos, salidas, supervisión, incidentes, AuditLog,
  reportes, permisos) — requires `TEST_*` Supabase credentials, never the
  production project.

## Escalation

Data-integrity or cross-tenant leakage suspicion, a human-rule violation
(`s.humanRuleViolations > 0` on the AIMS panel), or any suspected prompt
injection / secret leakage → treat as P0
([support-sla.md](../support-sla.md)), open a `SecurityIncident`, follow
[security-incident.md](security-incident.md).
