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

Después, para un proyecto Supabase, se aplican las migraciones de `supabase/`
para crear los buckets y proteger `storage.objects`.

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
