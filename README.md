# NormaFlow — Software B2B de Gestión ISO

Software SaaS para digitalizar sistemas de gestión ISO 9001 e ISO 27001. Auditorías, riesgos, documentos, no conformidades, indicadores y mejora continua en una plataforma profesional.

---

## 🔑 Credenciales de acceso demo

```
URL:       http://localhost:3000
Email:     demo@normaflow.io
Password:  NormaFlow2025!
```

---

## 🚀 Setup local (5 minutos)

### Prerrequisitos
- Node.js 18+
- npm 9+
- Cuenta Supabase (gratis en supabase.com)
- Cuenta Stripe (gratis en stripe.com)
- API key Anthropic (console.anthropic.com)

### 1. Clonar e instalar

```bash
git clone https://github.com/tu-org/normaflow.git
cd normaflow
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env.local
# Edita .env.local con tus credenciales
```

Variables mínimas para desarrollo:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres
ANTHROPIC_API_KEY=sk-ant-api03-...
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_SECRET=genera-un-secreto-largo-para-firmar-sesiones-demo
```

**Sin Supabase (solo local / e2e):** define `AUTH_DEMO_MODE=true` y `NEXT_PUBLIC_AUTH_DEMO_MODE=true` además de `NEXTAUTH_SECRET`. El login demo (`demo@normaflow.io` / `NormaFlow2025!`) usará una cookie firmada; la firma completa se valida en el servidor al cargar `/app/*`.

### 3. Base de datos

```bash
# Genera el cliente Prisma
npm run db:generate

# Aplica las migraciones
npm run db:migrate

# Carga datos demo
npm run db:seed
```

### 4. Ejecutar

```bash
npm run dev
# → http://localhost:3000
```

---

## 📁 Estructura del proyecto

```
normaflow/
├── prisma/
│   └── schema.prisma          # 25+ modelos de datos
├── scripts/
│   └── seed.ts                # Script de datos demo
├── src/
│   ├── app/
│   │   ├── home/              # Página principal marketing
│   │   ├── features/          # Página de funcionalidades
│   │   ├── iso9001/           # Landing ISO 9001
│   │   ├── iso27001/          # Landing ISO 27001
│   │   ├── pricing/           # Precios
│   │   ├── cases/             # Casos de éxito
│   │   ├── login/             # Autenticación
│   │   ├── signup/            # Registro
│   │   ├── app/               # Aplicación SaaS
│   │   │   ├── dashboard/     # Panel principal
│   │   │   ├── gap/           # GAP Assessment
│   │   │   ├── documents/     # Control documental
│   │   │   ├── risks/         # Gestión de riesgos
│   │   │   ├── audits/        # Auditorías
│   │   │   ├── nonconformities/ # NC y CAPA
│   │   │   ├── actions/       # Plan de acción
│   │   │   ├── indicators/    # KPIs
│   │   │   └── billing/       # Facturación
│   │   └── api/
│   │       ├── ai/            # Endpoint IA (Claude)
│   │       └── webhooks/stripe/ # Webhook Stripe
│   ├── components/
│   │   ├── ui/                # Badge, Card, Modal, Table, Avatar...
│   │   ├── layout/            # Sidebar, Topbar, MarketingLayout
│   │   ├── modules/           # Un componente por módulo SaaS
│   │   └── marketing/         # Secciones del sitio comercial
│   ├── lib/
│   │   ├── prisma.ts          # Cliente Prisma
│   │   ├── supabase.ts        # Cliente Supabase
│   │   ├── stripe.ts          # Cliente Stripe + planes
│   │   ├── resend.ts          # Cliente Resend + templates
│   │   ├── demo-data.ts       # Datos demo Tecnoserv Industrial
│   │   ├── constants.ts       # Roles, permisos, colores
│   │   └── utils.ts           # cn(), formatDate(), slugify()...
│   └── types/
│       └── index.ts           # Tipos TypeScript
└── .env.example               # Variables documentadas
```

---

## 🏗️ Arquitectura

### Stack
| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router) |
| UI | Tailwind CSS + shadcn/ui |
| Base de datos | Supabase Postgres (Prisma ORM) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Billing | Stripe |
| Email | Resend |
| IA | Anthropic Claude (API) |
| Validación | Zod + React Hook Form |

### Multi-tenant
- Cada `Organization` tiene sus propios datos
- Row Level Security (RLS) en Supabase para aislamiento fuerte
- Los usuarios pertenecen a organizaciones vía `Membership`
- Roles granulares: SUPER_ADMIN, ORG_ADMIN, COMPLIANCE_MANAGER, AUDITOR, CONTRIBUTOR, VIEWER

### Seguridad
- RLS activado en todas las tablas
- Validación server-side en todas las rutas API
- Archivos servidos a través de Supabase Storage (URLs firmadas)
- Webhook de Stripe con verificación de firma
- Audit logs en tabla `audit_logs`

---

## 🚀 Deploy en producción

### Vercel (recomendado)

```bash
npm install -g vercel
vercel --prod
```

Configura las variables de entorno en el dashboard de Vercel.

### Variables adicionales para producción
```env
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://tu-dominio.com
```

### Configurar Stripe webhooks en producción
```bash
# En dashboard.stripe.com → Webhooks → Add endpoint
# URL: https://tu-dominio.com/api/webhooks/stripe
# Eventos: customer.subscription.created, customer.subscription.updated, customer.subscription.deleted
```

---

## 📋 Checklist de funcionalidades entregadas

### Sitio comercial
- [x] Página Home con hero, trust strip, problemas, módulos, PDCA, normas, caso de éxito, precios, CTA, footer
- [x] Página Funcionalidades (incl. Indicadores, Evidencias, IA)
- [x] Landing ISO 9001:2015
- [x] Landing ISO 27001:2022
- [x] Página Precios con 3 planes
- [x] Casos de éxito (listado + detalle por slug)
- [x] Blog / recursos (listado + artículos + JSON-LD básico)
- [x] Landing GAP Assessment (`/solutions/gap-assessment`)
- [x] Demo / contacto con React Hook Form + Zod
- [x] Legales: privacidad, términos, seguridad
- [x] Login (API `/api/auth/login`) y Signup (Supabase + bootstrap de organización)

### Aplicación SaaS
- [x] Middleware: rutas `/app/*` protegidas (Supabase y/o modo demo)
- [x] Contexto multi-tenant: `getAppContext`, selector de organización (`nf_org`), API `set-org`
- [x] Onboarding: creación de organización tras registro (`/api/auth/bootstrap`)
- [x] Dashboard con datos reales desde Prisma cuando hay org en BD; fallback coherente en modo demo
- [x] GAP con datos desde evaluaciones y respuestas en BD (seed incluido)
- [x] Procesos, Evidencias, Notificaciones (páginas + datos demo/BD)
- [x] Control de Documentos, Riesgos, Auditorías, NC, Acciones, Indicadores, Billing (existentes)
- [x] Asistente IA (Claude / `@anthropic-ai/sdk`) con confirmación humana obligatoria

### Infraestructura
- [x] Schema Prisma con 25+ modelos
- [x] Seed script con datos demo de Tecnoserv Industrial S.A.
- [x] API route IA (/api/ai)
- [x] Webhook Stripe (/api/webhooks/stripe)
- [x] Multi-tenant con Memberships
- [x] Roles y permisos definidos
- [x] .env.example documentado
- [x] README completo

---

## 🎨 Design System

**Colores**
- Primary: `#123C66`
- Accent: `#2E8B57`
- Background: `#F7F9FC`
- Border: `#E5EAF2`
- Danger: `#C93C37`
- Warning: `#D68A1A`

**Tipografía**
- Headings: Manrope (Google Fonts)
- Body: Inter (Google Fonts)

---

## 🧪 Tests e2e (Playwright)

Tras `npm install`, instala los navegadores una vez:

```bash
npx playwright install chromium
npm run test
```

El `playwright.config` arranca `npm run dev` con `AUTH_DEMO_MODE` y `NEXT_PUBLIC_AUTH_DEMO_MODE` para el login demo sin Supabase.

## 📞 Soporte

Para dudas técnicas: soporte@normaflow.io  
Documentación: docs.normaflow.io
