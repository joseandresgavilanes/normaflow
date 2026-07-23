# Pruebas E2E de NormaFlow

La suite usa Playwright y está separada en dos capas:

- `tests/`: smoke E2E reproducibles en modo demo. Cada test inicia sesión con el usuario demo y limpia las claves de workspace antes de arrancar.
- `tests-live/`: journey E2E contra una instancia real de Next.js, Supabase Auth, Postgres/Prisma y Supabase Storage. El `globalSetup` crea datos con un `runId` único y el `globalTeardown` elimina el fixture completo.

## Ejecución local

```bash
npm run test:e2e
npx playwright test tests/critical-flows.spec.ts --project=chromium
npm run test:ui
```

La suite demo no requiere credenciales, archivos preparados ni datos manuales. Los archivos se crean en memoria con `setInputFiles`.

## Suite live

Configura en el entorno de ejecución:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
```

Ejecuta únicamente contra un proyecto de pruebas:

```bash
LIVE_TEST_ALLOW_MUTATIONS=true npm run test:live
```

La variable de seguridad es obligatoria porque la suite crea usuarios, organizaciones, registros y archivos temporales. No se deben usar credenciales de producción.

## Cobertura

Los journeys cubren registro y bootstrap, organización, invitación/roles, procesos, documentos y aprobación, evidencias/Storage, riesgos, auditorías, hallazgos, conversión a CAPA, KPIs, reportes, billing y aislamiento multi-tenant. Las reglas de transición que no dependen del navegador tienen además tests de contrato en `tests/*-workflow.spec.ts`.

Los artefactos se guardan en:

- `playwright-report/` y `test-results/` para demo.
- `playwright-report-live/` y `test-results-live/` para live.

En un fallo CI, abrir el HTML report o inspeccionar el trace retenido en `test-results*/` muestra la URL, el paso `test.step`, screenshot y error de red/locator. La configuración live ejecuta un solo worker y modo serial para evitar carreras sobre el fixture compartido.

## CI

El job debe instalar dependencias, ejecutar `npx playwright install --with-deps chromium` y luego `npm run test:e2e`. El job live debe usar un proyecto Supabase efímero o dedicado, inyectar las variables anteriores como secretos y ejecutar `npm run test:e2e:live`.
