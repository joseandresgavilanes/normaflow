# NormaFlow — plan de lanzamiento comercial en 30 días

## Objetivo de venta

Cerrar el primer contrato con una empresa que necesite operar ISO 9001, ISO 27001 o ambas, con un tenant real, datos persistentes, control de permisos y un paquete de auditoría descargable. El primer contrato no depende de IA, personalizaciones visuales ni integraciones externas.

## Definition of Ready para vender

- Supabase Auth, Postgres y Storage configurados en staging.
- Migraciones aplicadas con `prisma migrate deploy`.
- Buckets `documents`, `evidence` y `logos` privados salvo el logo público definido por producto.
- Owner, Compliance Manager, Auditor, Contributor y Viewer probados con acciones permitidas y denegadas.
- Golden path validado: documento → versión → revisión/aprobación; evidencia → vínculo; auditoría → hallazgo → CAPA → evidencia/verificación/cierre.
- PDF/XLSX con organización, generador, fecha y filtros.
- Trial de 14 días y Stripe webhook verificados en modo test.
- No hay datos de prueba manuales requeridos para demo ni E2E.

## Backlog priorizado

Las prioridades combinan valor comercial, riesgo y esfuerzo. Ninguna historia supera 8 puntos.

| ID | Historia | Pts | Prioridad | Estado | Criterio de aceptación resumido |
|---|---|---:|---|---|---|
| NF-COM-01 | Como responsable de seguridad, quiero aislamiento tenant en DB, acciones y Storage para no exponer información de otra empresa. | 5 | P0 | Hecho | Un usuario no puede leer, firmar, modificar ni borrar un recurso de otro tenant; CI prueba RLS, acciones y prefijos de Storage. |
| NF-COM-02 | Como administrador, quiero crear usuarios, procesos y datos desde la aplicación live para implementar un cliente real. | 8 | P0 | Hecho | CRUD live persiste en Postgres, valida referencias del mismo tenant y registra audit trail. |
| NF-COM-03 | Como auditor, quiero completar el flujo documental y de evidencia con trazabilidad. | 8 | P0 | Hecho | Crear/versionar/revisar/aprobar documento; cargar/vincular/revisar evidencia; cada cambio queda auditado. |
| NF-COM-04 | Como responsable de calidad, quiero ejecutar una auditoría y cerrar CAPA con eficacia demostrada. | 8 | P0 | Hecho | Checklist revisado, hallazgos, conversión CAPA, evidencia de implementación/eficacia y cierre bloqueado si falta cualquiera. |
| NF-COM-05 | Como dirección, quiero entregar un paquete PDF/XLSX reutilizable. | 5 | P0 | Hecho | Exportación server-side con tenant, logo, fecha, usuario, filtros, historial y permisos. |
| NF-COM-06 | Como prospecto, quiero probar un workspace guiado en menos de 10 minutos. | 5 | P1 | Hecho | Registro, organización, normas, objetivo, checklist y trial de 14 días persistidos. |
| NF-COM-07 | Como comprador, quiero pagar y cambiar de plan sin intervención manual. | 5 | P1 | Parcial | Checkout, portal, webhooks idempotentes, límites y estado visible; falta validar claves/precios de producción. |
| NF-COM-08 | Como equipo de ventas, quiero una demo estable y repetible. | 3 | P1 | Hecho | Demo local sin Supabase, datos aislados por test y rutas comerciales navegables. |
| NF-COM-09 | Como equipo de operaciones, quiero alertas de vencimiento y errores observables. | 5 | P1 | Parcial | Cron de recordatorios y Resend existen; falta instrumentación de entrega, reintentos y dashboard de fallos. |
| NF-COM-10 | Como CTO, quiero operar backups, límites de abuso y soporte de piloto. | 8 | P2 | Pendiente | Runbook probado, rate limiting, alertas Sentry/telemetría, backup restore drill y soporte documentado. |
| NF-COM-11 | Como cliente Enterprise, quiero SSO, API y multi-organización administrable. | 8 | P3 | Fuera de primera venta | Se entrega solo con contrato Enterprise y después de validar demanda. |

## Sprint 1 — primera venta (días 1–10)

### Comprometido

1. NF-COM-01: tenant boundary y permisos server-side.
2. NF-COM-02: persistencia live del núcleo.
3. NF-COM-03: documentos y evidencias.
4. NF-COM-04: auditoría y CAPA.
5. NF-COM-05: exportes.
6. NF-COM-08: demo comercial.

### Ejecutado en este release

- Endurecimiento de URLs firmadas: el path debe empezar por `org-{organizationId}/` y no puede contener traversal.
- Bootstrap de organización serializable con retry ante `P2034`, para que dos pestañas de signup no creen tenants duplicados.
- Test de contrato de Storage para paths del tenant activo y rechazo cross-tenant.
- Suite Chromium completa: 57 tests pasando.
- Suite E2E live preparada con fixture, cleanup y 14 tests listables; requiere Supabase de staging para ejecución real.

### Gate de aceptación

```bash
npx tsc --noEmit
npx playwright test --project=chromium --workers=1
LIVE_TEST_ALLOW_MUTATIONS=true npm run test:e2e:live
```

El gate live debe ejecutarse antes de mostrar el producto a un cliente con datos reales.

## Sprint 2 — implementación real (días 11–20)

1. Activar staging con dominio, Supabase Auth, buckets y Stripe test.
2. Ejecutar el journey live completo con dos tenants y al menos tres roles.
3. Validar onboarding real desde signup hasta organización creada y adopción de normas.
4. Configurar Resend y probar invitación, bienvenida y vencimientos.
5. Validar historial de audit trail desde UI para documentos, evidencias, CAPA y exportes.
6. Ejecutar un piloto con una empresa y registrar incidencias bloqueantes.

### Criterios de aceptación

- No existen acciones de negocio accesibles por un rol sin permiso server-side.
- Un tenant B nunca aparece en payload, exporte, URL firmada o historial del tenant A.
- Un usuario nuevo puede completar el golden path con datos persistentes después de refrescar y cerrar sesión.
- Los PDFs/XLSX generados en staging se abren correctamente y contienen metadata comercial.
- El webhook Stripe procesa eventos duplicados sin duplicar suscripciones ni facturas.

## Sprint 3 — escalabilidad y automatización (días 21–30)

1. Rate limiting en login, signup, bootstrap, IA y exportes.
2. Observabilidad: errores de Server Actions, webhook, Storage, email y cron con alertas.
3. Job idempotente de vencimientos con reintentos y dead-letter operativo.
4. Backup/restore drill de Postgres y política de retención de Storage.
5. Playbook de soporte: onboarding asistido, recuperación de acceso, exportación completa y baja.
6. API/SSO solo si un prospecto con capacidad de compra lo exige.

### Criterios de aceptación

- Un fallo de proveedor no deja una entidad creada sin su audit trail o archivo huérfano sin cleanup.
- El equipo recibe alerta accionable en menos de 5 minutos para errores de webhook, cron o Storage.
- Se puede restaurar un tenant de staging y verificar conteos/documentos/evidencias en menos de 60 minutos.

## Paquetes de PR

### PR-COM-001 — Storage tenant boundary

- **Resumen:** endurece la firma de URLs para exigir organización activa.
- **Cambios:** `assertTenantStoragePath`, nuevas firmas de helpers Storage, actualización de acciones de documentos, evidencias, CAPA y registros, test de contrato.
- **Riesgos:** cambio interno de firma; cualquier nuevo consumidor de Storage debe pasar el tenant explícitamente.
- **Pruebas:** `npx tsc --noEmit`; `npx playwright test tests/storage-security.spec.ts --project=chromium`.

### PR-COM-002 — Comercial E2E gate

- **Resumen:** mantiene demo reproducible y journey live aislado.
- **Cambios:** fixtures, seed/cleanup run-scoped, tests críticos, configuración CI y documentación E2E.
- **Riesgos:** la suite live modifica un proyecto Supabase; solo usar staging.
- **Pruebas:** Chromium completo; `--list` live; ejecución live obligatoria antes de producción.

### PR-COM-003 — Onboarding idempotente

- **Resumen:** evita duplicar organizaciones cuando el bootstrap recibe solicitudes concurrentes.
- **Cambios:** transacción Prisma `Serializable` con un retry controlado ante conflicto de serialización.
- **Riesgos:** una base que no soporte el nivel de aislamiento configurado fallará explícitamente; validar en staging antes del piloto.
- **Pruebas:** `npx tsc --noEmit`; prueba live de signup/bootstrap con dos solicitudes concurrentes en staging.

## Fuera de alcance de la primera venta

IA avanzada, SSO, API pública, integraciones con Jira/ERP, personalizaciones visuales por cliente, mobile app y marketplace. Se venden después de validar el workflow núcleo y no deben competir con seguridad, persistencia o auditoría.
