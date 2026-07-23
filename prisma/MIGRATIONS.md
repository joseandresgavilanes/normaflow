# Migraciones y RLS

`prisma/migrations` es el historial canónico del esquema. No se debe volver a
usar `prisma db push` ni ejecutar SQL de módulos manualmente en producción.

## Base nueva

```bash
npm run db:deploy
npm run db:seed        # opcional
```

El orden reproducible es:

1. `20260404000000_baseline`: esquema inicial completo.
2. Migraciones incrementales de autenticación e ISOTech.
3. `20260619010000_training_management`: capacitación persistente.
4. `20260619015000_schema_alignment`: elimina el drift de la migración manual
   ISOTech (FKs, defaults e índices), sin eliminar datos.
5. `20260619020000_row_level_security`: funciones y políticas RLS.
6. `20260619030000_operational_module_links`: relaciones persistentes entre
   procesos, documentos, riesgos e indicadores, con `ON DELETE SET NULL`.
7. `20260619031000_operational_link_integrity`: impide vínculos cruzados entre
   organizaciones, incluso en escrituras directas vía Supabase.
8. `20260619040000_change_supplier_integration_models`: persistencia completa
   para cambios, proveedores e integraciones; incluye relaciones, evaluaciones,
   ejecuciones de sincronización, RLS y validación de vínculos entre tenants.
9. `20260619041000_document_record_field_integrity`: recupera los metadatos
   completos de documentos y registros, añade el nombre real de los adjuntos,
   enlaza registros con procesos y valida todos sus catálogos por tenant.
10. `20260619042000_notification_billing_account_reporting`: persiste lectura
    de notificaciones, facturas Stripe e historial de exportaciones, con RLS y
    validación de relaciones entre organizaciones.
11. `20260619043000_authenticated_schema_usage`: permite que PostgREST alcance
    las tablas del esquema `public`; RLS sigue decidiendo cada fila y acción.
12. `20260619044000_post_rls_table_grants`: concede lectura de relación a las
   tablas creadas después del baseline RLS; sus políticas continúan filtrando
   por tenant y permiso.
13. `20260722140000_live_roles`: añade los roles canónicos `OWNER`, `ADMIN`
   y `MANAGER`, manteniendo los valores legacy para una migración gradual.
14. `20260722141000_permission_contract`: alinea RLS con las acciones `view`,
   `create`, `update`, `approve`, `delete` y `export`, manteniendo `read` como
   alias retrocompatible.
15. `20260722160000_document_control_hardening`: añade índices tenant para los
   filtros del control documental y una restricción única por documento/versión.
16. `20260722170000_evidence_repository`: completa el repositorio de evidencias
   con metadatos, estados, fechas, relaciones many-to-many, índices y RLS.
17. `20260722180000_records_live_control`: completa el control live de registros
    con códigos de tipo, cláusulas ISO, entradas controladas, estados y fechas.
18. `20260722190000_acpm_capa_live`: crea el agregado CAPA multi-tenant con sus
    seis etapas, causa raíz aprobable, evidencias por etapa, verificación de
    eficacia, cierre bloqueado, comentarios, RLS y validación de referencias.
19. `20260722200000_audit_program_internal_audits`: completa el programa anual
    y auditorías internas con proceso, fechas de ejecución, participantes,
    checklist vinculado a cláusulas, evidencias revisadas, informe de cierre,
    exportación PDF/XLSX, conversión de hallazgos críticos a CAPA y validación
    multi-tenant/RLS.
20. `20260722210000_management_review_live`: amplía la revisión por la dirección
    con normas, participantes internos, entradas vinculadas a auditorías/KPIs/
    riesgos/NC/acciones/CAPA, acciones derivadas en Plan de Acción, evidencias,
    acta PDF, validaciones tenant-safe y RLS.
21. `20260722220000_reporting_audit_pack`: añade artefactos persistidos de
   informes con MIME, título, filtros, contenido descargable e índice por tipo
   para re-descarga e historial de paquetes de auditoría.
22. `20260722230000_onboarding_activation`: persiste el estado del onboarding,
    objetivo, trial, fecha de activación y eventos de conversión por tenant.
23. `20260723000000_stripe_billing_hardening`: registra eventos de webhook de
   forma idempotente y cambia el valor por defecto de facturas a USD.
24. `20260723010000_document_templates`: crea el catálogo global de plantillas
   ISO 9001/27001 y enlaza documentos controlados con su plantilla y contenido
   versionable.
25. `20260723150000_storage_rls_org_scoped`: exige buckets privados `documents`
   y `evidence`, y aplica policies SELECT/INSERT/UPDATE/DELETE por prefijo
   `org-{organizationId}/` y permiso de la organización.

La migración `20260723150000_storage_rls_org_scoped` requiere que los buckets
privados `documents` y `evidence` ya existan. Falla explícitamente si
`storage.objects` o cualquiera de los buckets no está disponible.

26. `20260723160000_p1_report_workers_billing_audit`: convierte reportes en
   trabajos persistentes con lease, reintentos e idempotencia; añade grace
   period/suspensión de billing y vuelve append-only el audit trail.
27. `20260723161000_p1_storage_quota_reservations`: añade el contador de bytes
   por organización y lo inicializa desde los metadatos persistidos para que
   las cargas concurrentes reserven cuota atómicamente.
28. `20260723170000_iso27001_control_catalog`: crea el catálogo versionado de
   93 controles ISO 27001, estados por organización, vínculos de evidencia y
   riesgo, revisiones, checks de referencias tenant y políticas RLS.

## Base existente creada con db push o SQL manual

Haz un backup antes de reconciliar el historial. La baseline **no debe
ejecutarse** sobre tablas existentes; se marca como aplicada:

```bash
npx prisma migrate resolve --applied 20260404000000_baseline
```

Marca también como aplicadas, en orden, las migraciones cuyos objetos ya
existan en esa base:

```bash
npx prisma migrate resolve --applied 20260404120000_add_auth_user_id
npx prisma migrate resolve --applied 20260512190255_isotech_alignment
npx prisma migrate resolve --applied 20260602011500_credentials_auth
npx prisma migrate resolve --applied 20260619010000_training_management
```

Si alguna de esas piezas no existe, no la marques: `migrate deploy` debe
ejecutarla. Comprueba el resultado antes de continuar:

```bash
npm run db:status
npm run db:deploy
```

Las migraciones `schema_alignment` y RLS se ejecutan, no se marcan manualmente.
RLS es idempotente respecto a los nombres de políticas legacy y los elimina
antes de instalar las nuevas.

## Modelo de seguridad

- `authUserId` enlaza `auth.users.id` con `public.users`.
- `nf_current_user_id()` resuelve el usuario de aplicación desde el JWT.
- `nf_has_org_permission()` combina rol, organización y permisos de grupos.
- Las tablas hijas heredan el tenant a través de su padre.
- Cambios, proveedores e integraciones tienen políticas propias; sus tablas
  hijas validan el permiso sobre la raíz y los vínculos cruzados se rechazan.
- Las notificaciones sólo son visibles/modificables por su destinatario.
- `standards` y `clauses` son catálogos globales de sólo lectura.
- No se usa `FORCE ROW LEVEL SECURITY`: Prisma y `service_role` son roles de
  confianza y la capa Next.js aplica autorización server-side adicional.
- Los objetos de Storage deben vivir bajo `org-{organizationId}/...`.

## Comprobación manual de aislamiento

En Supabase SQL Editor, dentro de una transacción, prueba dos UUID reales de
`auth.users`. El rol `authenticated` sólo debe ver organizaciones compartidas:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<AUTH_USER_UUID>', true);
select id, name from public.organizations;
select "organizationId", code, title from public.documents;
rollback;
```

Repite con un usuario de otra organización y verifica que no se cruzan filas.
