# Separación de ambientes NormaFlow

NormaFlow usa cuatro ambientes independientes:

| Ambiente | Base | Supabase | Stripe | Mutaciones live |
|---|---|---|---|---|
| development | `.env.local` | proyecto de desarrollo o demo | test | no destructivas fuera del tenant local |
| testing | `TEST_DATABASE_URL` / `TEST_DIRECT_URL` | `TEST_SUPABASE_*` | test | sí, solo fixtures efímeros |
| staging | `STAGING_DATABASE_URL` / `STAGING_DIRECT_URL` | proyecto Supabase de staging | test | sí, datos de aceptación |
| production | `PRODUCTION_DATABASE_URL` / `PRODUCTION_DIRECT_URL` | proyecto productivo | live | solo despliegue aprobado |

No se debe usar `DATABASE_URL` del entorno local para tests live. La suite live
rechaza targets cuyo host/base coincida con el entorno normal.

## Migraciones seguras

Antes de aplicar migraciones en testing o staging:

```bash
export NORMAFLOW_DB_ENV=staging
export NORMAFLOW_MIGRATION_CONFIRM=apply-staging
npm run db:deploy:safe
```

El comando exige URLs explícitas, crea un `pg_dump` en `backups/<ambiente>/` y
solo después ejecuta `prisma migrate deploy` y `prisma migrate status`. Para
producción exige además `NORMAFLOW_ALLOW_PRODUCTION_MIGRATIONS=true`.

Después de aplicar migraciones en testing o staging, ejecutar:

```bash
export NORMAFLOW_DB_ENV=staging
npm run db:smoke
```

El smoke test verifica tablas nuevas, `storage.objects` y las ocho policies
operativas de Storage.

El repositorio no contiene credenciales ni provisiona proyectos Supabase.
Configurar staging y testing es una operación de infraestructura y debe hacerse
en el proveedor, con secretos del entorno correspondiente.

## Build

El build usa `NORMAFLOW_ENV`:

```bash
NORMAFLOW_ENV=staging npm run build
```

Staging requiere Stripe test, URL HTTPS, Supabase, Postgres, Resend y secretos
fuertes. Anthropic solo es obligatorio cuando `NORMAFLOW_AI_ENABLED=true`.
