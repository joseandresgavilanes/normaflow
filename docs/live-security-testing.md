# Pruebas live de seguridad

La suite `tests-live` crea fixtures efímeros exclusivamente en el proyecto Supabase y la base PostgreSQL de testing. Nunca toma las credenciales normales de desarrollo o producción.

## Variables obligatorias

```bash
export LIVE_TEST_ALLOW_MUTATIONS=true
export NORMAFLOW_TEST_ENV=isolated
export TEST_DATABASE_URL='postgresql://.../testing'
export TEST_DIRECT_URL='postgresql://.../testing'
export TEST_SUPABASE_URL='https://<proyecto-testing>.supabase.co'
export TEST_SUPABASE_ANON_KEY='...'
export TEST_SUPABASE_SERVICE_ROLE_KEY='...'
```

La suite compara el target de `TEST_DATABASE_URL` y `TEST_DIRECT_URL` con las
conexiones normales y aborta si comparten target. No exportes las variables
`TEST_*` con valores de producción.

El proyecto de testing debe tener las migraciones y las políticas RLS de producción aplicadas, además de los buckets privados `documents` y `evidence`. La configuración falla antes de crear datos si falta una variable `TEST_*` o la doble confirmación.

## Ejecución

```bash
export NORMAFLOW_DB_ENV=testing
export NORMAFLOW_MIGRATION_CONFIRM=apply-testing
npm run db:deploy:safe
npm run test:security-live
```

La suite crea Organización A/B, un ORG_ADMIN por organización, y en A además un VIEWER y un AUDITOR. Al finalizar elimina organizaciones, usuarios de aplicación, usuarios de Supabase y objetos Storage temporales.

## Cobertura y resultado esperado

La especificación `tests-live/security-tenant.spec.ts` verifica aislamiento de lectura/escritura para documentos, evidencias, riesgos, auditorías, CAPA y reportes; mutación de `organizationId`; ruta directa de cambio de organización; Storage; UI directa por rol; y minimización de payload de miembros. Un resultado correcto es cero tests fallidos. El informe HTML queda en `playwright-report-live/`.

## CI

Guarda las seis variables `TEST_*` como secretos exclusivos del entorno `testing` y ejecuta:

```yaml
- run: npm ci
- run: npx prisma migrate deploy
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
    DIRECT_URL: ${{ secrets.TEST_DIRECT_URL }}
- run: npm run test:security-live
  env:
    LIVE_TEST_ALLOW_MUTATIONS: 'true'
    NORMAFLOW_TEST_ENV: isolated
    TEST_DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
    TEST_DIRECT_URL: ${{ secrets.TEST_DIRECT_URL }}
    TEST_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
    TEST_SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}
    TEST_SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.TEST_SUPABASE_SERVICE_ROLE_KEY }}
```
