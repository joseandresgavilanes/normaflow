# Catálogo operativo de controles ISO 27001

NormaFlow incorpora una versión operativa del catálogo de controles del Anexo A para ISO/IEC 27001:2022. El seed contiene únicamente identificadores, dominios, títulos resumidos y metadatos de trabajo propios de NormaFlow. No reproduce el texto normativo completo.

## Versionado y carga autorizada

`ControlCatalogVersion` identifica la norma, versión, fecha, estado y versión activa. `SecurityControl` pertenece siempre a una versión concreta. Para añadir contenido licenciado o autorizado, el propietario del producto debe crear una nueva versión y cargarlo mediante un proceso controlado, con revisión y audit trail; no se debe editar una versión publicada en producción.

El seed es idempotente y crea exactamente 93 controles activos para ISO 27001:2022:

- A.5 Organizacionales: 37
- A.6 Personas: 8
- A.7 Físicos: 14
- A.8 Tecnológicos: 34

## Operación por organización

Al adoptar ISO 27001, `OrganizationControl` crea una fila por control activo. Esta fila conserva la aplicabilidad, estado, nivel de implementación, responsable y fechas de revisión de la organización. Evidencias y riesgos se vinculan mediante `ControlEvidence` y `RiskControlLink`; `ControlReview` conserva el historial de eficacia.

Todas las filas operativas llevan `organizationId`, se validan en Server Actions y tienen políticas RLS directas. Los triggers SQL rechazan referencias cruzadas a evidencias, riesgos, controles o responsables de otro tenant.

## Migración y despliegue

La migración es `20260723170000_iso27001_control_catalog`. Debe aplicarse primero en una base de staging identificada y respaldada. No se debe ejecutar `prisma migrate deploy` contra una URL desconocida. Después de aplicar:

1. `npx prisma migrate status`
2. `npm run db:seed`
3. `npx playwright test tests/security-controls.spec.ts`
4. ejecutar la suite live únicamente con `TEST_DATABASE_URL` y credenciales Supabase de testing aisladas.

El worker de reportes usa `ReportArtifact` para exportar el catálogo a PDF/XLSX; no devuelve archivos como base64.
