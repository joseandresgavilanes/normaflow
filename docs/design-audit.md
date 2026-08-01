# Auditoría de diseño — NormaFlow

**Fecha:** 2026-08-01
**Alcance:** aplicación completa (marketing público, autenticación, workspace `/app`, 13 paquetes normativos)
**Versión auditada:** `main` @ `f5fe858`

---

## 1. Método y evidencia

La auditoría combina tres fuentes. Ninguna conclusión de este documento es una impresión subjetiva: todas tienen una medición o una captura detrás.

| Fuente | Herramienta | Cobertura |
|---|---|---|
| Análisis estático de estilos | `grep`/`wc` sobre `globals.css`, `tailwind.config.ts`, 225 ficheros `.tsx` | 100 % del código de UI |
| Barrido instrumentado | `scripts/visual-audit.ts` (Playwright) — nuevo | 83 rutas × 3 viewports (1440 / 768 / 390) |
| Inspección visual dirigida | Browser pane sobre servidor demo `:3100` | Dashboard, Documentos, Landing, mobile |

El script `scripts/visual-audit.ts` queda en el repositorio como herramienta permanente. Por cada ruta y viewport mide: desbordamiento horizontal y elementos culpables, jerarquía de encabezados, landmarks, imágenes sin `alt`, botones sin nombre accesible, campos sin etiqueta, áreas táctiles < 24 px, muestreo de contraste calculado (WCAG relative luminance), número de tamaños tipográficos distintos y errores de consola.

```bash
npx tsx scripts/visual-audit.ts ./audit-out
```

---

## 2. Skills de diseño utilizadas

| Skill | Para qué se usó aquí |
|---|---|
| `ui-ux-pro-max` | Base de conocimiento de diseño (67 estilos, 161 paletas, 99 reglas UX). Se usó su checklist priorizado (Accesibilidad → Interacción → Layout → Tipografía/Color → Formularios → Navegación → Datos) como rúbrica de la auditoría, y su motor `--design-system` con dials `variance 3 / motion 2 / density 8` para validar la escala de espaciado densa y la estrategia de color de estado. **Se rechazó su recomendación de estilo** (“Exaggerated Minimalism” + Fira Code): es apropiada para editorial/lujo, no para un SaaS de cumplimiento denso, y contradice la restricción de identidad de NormaFlow. |
| `a11y-audit` | Rúbrica WCAG 2.2 AA: criterios de contraste, nombre accesible, orden de foco, landmarks, `prefers-reduced-motion`, tamaño de objetivo táctil (2.5.8). |
| `senior-frontend` / `design-system` | Criterio de arquitectura de tokens, variantes de componentes y consolidación de duplicados. |
| `dataviz` | Reglas de gráficos: ejes etiquetados, leyenda, alternativa tabular, color no como único canal. |
| Skills consideradas y **no** aplicables | `apple-hig-expert` (producto web, no Apple), `banner-design`, `ad-creative`, `landing-page-generator` (la landing se rediseña sobre el código existente, no se genera de cero). |

---

## 3. Resumen ejecutivo

NormaFlow tiene funcionalidad de producto maduro sobre una capa visual que creció por acumulación. El síntoma no es “feo”: es **incoherente**. Cada módulo se diseñó en un momento distinto y la aplicación no comparte un vocabulario visual.

Los seis problemas sistémicos, en orden de impacto:

**S1 — Dos sistemas de color en conflicto, ninguno es la fuente de verdad.**
`tailwind.config.ts` define `primary: #123C66` (azul marino) y `accent: #2E8B57` (verde). `globals.css` define `--primary: #5266F6` (índigo). Son dos identidades declaradas a la vez. El conflicto está **latente, no activo**: la medición encuentra 0 usos de utilidades de color de Tailwind (`bg-primary`, `text-primary`…), porque la app se estiliza con clases `.nf-*` y estilo inline. Es decir, la config de Tailwind es una marca fantasma que habría pintado el color equivocado la primera vez que alguien escribiera `bg-primary`.

El problema real y activo es el otro: **242 apariciones literales de `#5266F6`** y ~1.500 hex hardcodeados en `.tsx`. No existe token semántico: no hay forma de cambiar un color sin buscar y reemplazar.

Un tercer conflicto sí era activo: `nf.css` declara su propio `:root` con **valores distintos para los mismos nombres** que `globals.css` (`--nf-radius-lg` = 16px aquí, 12px allí; `--nf-radius-xl` = 20px vs 16px). El valor efectivo dependía del orden de carga de las hojas.

**S2 — No hay escala. Hay valores sueltos.**
Medido sobre `globals.css`: **19 tamaños de fuente** (9, 10, 10.5, 11, 12, 12.5, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 32, 36 px), **23 valores de padding** (2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 40, 48), **17 valores de gap**, **14 radios de borde** y **58 declaraciones distintas de `box-shadow`**. No existe ritmo de 4/8 px. Los tamaños de 9–11 px están por debajo del mínimo legible.

**S3 — CSS monolítico de 7.125 líneas con 992 clases `.nf-*`.**
Un único `globals.css` contiene todo: primitivas, layout, y estilos específicos de módulo (`.nf-continuity-detail-hero`, `.nf-acpm-verification-box`, `.nf-energy-table-actions`…). Los tokens `--nf-ink*`, `--nf-line`, `--nf-app-accent` están **duplicados literalmente en tres bloques** (`:root` L6, `.nf-app-shell` L332, `.nf-modal-overlay` L3002) porque el modal se renderiza en un portal fuera del shell. Cambiar un token exige editar tres sitios o el modal se desincroniza.

**S4 — Componentes duplicados sin razón funcional.**
7 sistemas de tarjeta (`nf-card`, `nf-dash-card`, `nf-iso-dashboard-card`, `nf-kpi-card`, `nf-audit-card`, `nf-price-card`, `nf-auth-card`), 2 sistemas de botón completos (`nf-btn*` marketing / `nf-app-btn*` app) más 8 botones ad-hoc, 4 componentes de métrica (`StatCard`, `MetricCell`, `IsoMetricCard`, `nf-kpi-card`), 3 cabeceras de sección (`SectionTitle`, `PanelHeader`, `IsoSectionHeader`). Hay **4.475 usos de `style={{…}}` inline en 121 ficheros**: el estilo vive en los componentes, no en el sistema.

**S5 — La navegación no escala al catálogo de producto.**
El sidebar muestra **35 enlaces planos sin agrupar**, seguidos de 11 grupos colapsables de norma (con hasta 15 subitems cada uno) y 3 grupos de administración. Son ~180 destinos en una sola columna con scroll, y con varias normas desplegadas conviven ~143 subitems de sección compitiendo entre sí. No hay agrupación semántica, ni favoritos, ni búsqueda de navegación, ni breadcrumbs (0 en toda la app), ni paleta de comandos. El estado de los grupos no persiste entre navegaciones.

> **Corrección.** Una versión anterior de este documento afirmaba que esos ~143 subitems eran enlaces muertos, basándose en que `useSearchParams` no aparece en ninguno de los 11 clientes de norma. **Es falso.** Los clientes leen `?section=` a través del hook `useModuleSection` (`src/hooks/useModuleSection.ts`), que sí usa `useSearchParams` y además escucha `popstate`. Los enlaces funcionan y son la **única** forma de llegar a las secciones: los módulos no renderizan una barra de pestañas propia. El problema real es de densidad y de nivel: la sub-navegación de un módulo no debería vivir en la columna global.

**S6 — El puente de i18n corrompe datos de cliente.**
`I18nDomBridge` recorre el DOM completo con un `TreeWalker` y aplica `tx()` a **cada nodo de texto**, incluidos los datos del usuario. Efecto observado en `/app/documents`: el documento *“Política de Información”* se renderiza como **“Política de Information Información”**. Además, la traducción de módulos está incompleta: con locale EN el sidebar aparece en inglés y el contenido en español en la misma pantalla (ver §5, F-DASH-01).

---

## 4. Inventario de secciones

61 secciones auditadas. Estado: ✅ correcto · ⚠️ problemas menores · ❌ requiere rediseño.

| # | Sección | Ruta | Estado |
|---|---|---|---|
| 1 | Landing pública | `/home` | ⚠️ |
| 2 | Pricing | `/pricing` | ⚠️ |
| 3 | Login | `/login` | ⚠️ |
| 4 | Registro | `/signup` | ⚠️ |
| 5 | Recuperación | `/forgot-password` | ⚠️ |
| 6 | Onboarding | `/app/onboarding` | ❌ |
| 7 | Dashboard | `/app/dashboard` | ❌ |
| 8 | Navegación lateral | `AppSidebar` | ❌ |
| 9 | Header | `AppTopbar` | ❌ |
| 10 | Selector de organización | `AppSidebar` | ❌ |
| 11 | Usuarios | `/app/settings/users` | ⚠️ |
| 12 | Roles | `/app/settings/users` | ⚠️ |
| 13 | Grupos | `/app/settings/groups` | ⚠️ |
| 14 | Personal | `/app/info/personnel` | ⚠️ |
| 15 | Procesos | `/app/processes` | ⚠️ |
| 16 | Documentos | `/app/documents` | ❌ |
| 17 | Evidencias | `/app/evidence` | ⚠️ |
| 18 | Registros | `/app/records` | ❌ |
| 19 | Riesgos | `/app/risks` | ❌ |
| 20 | Oportunidades | `/app/opportunities` | ⚠️ |
| 21 | Controles | `/app/security-controls` | ⚠️ |
| 22 | GAP | `/app/gap` | ⚠️ |
| 23 | Auditorías | `/app/audits` | ❌ |
| 24 | Programa anual | `/app/audit-program` | ⚠️ |
| 25 | Checklists | `/app/audits` | ⚠️ |
| 26 | Hallazgos | `/app/audits` | ⚠️ |
| 27 | No conformidades | `/app/nonconformities` | ❌ |
| 28 | CAPA/ACPM | `/app/actions` | ❌ |
| 29 | Acciones | `/app/actions` | ⚠️ |
| 30 | Indicadores | `/app/indicators` | ❌ |
| 31 | Proveedores | `/app/suppliers` | ⚠️ |
| 32 | Capacitación | `/app/training` | ⚠️ |
| 33 | Control de cambios | `/app/changes` | ⚠️ |
| 34 | Revisión por la dirección | `/app/management-review` | ⚠️ |
| 35 | Reportes | `/app/reporting` | ⚠️ |
| 36 | Notificaciones | `/app/notifications` | ⚠️ |
| 37 | Billing | `/app/billing` | ⚠️ |
| 38 | Configuración | `/app/settings` | ⚠️ |
| 39 | Standard Pack Engine | `/app/standards` | ⚠️ |
| 40 | ISO 9001 | `/app/quality-ops` | ⚠️ |
| 41 | ISO 27001 | `/app/soa`, `/app/assets` | ⚠️ |
| 42 | ISO 14001 | `/app/environment` | ❌ |
| 43 | ISO 45001 | `/app/safety` | ❌ |
| 44 | SIG | `/app/integrated` | ❌ |
| 45 | ISO 22301 | `/app/continuity` | ❌ |
| 46 | ISO 42001 | `/app/aims` | ❌ |
| 47 | ISO 37301 | `/app/compliance` | ❌ |
| 48 | ISO 37001 | `/app/antibribery` | ❌ |
| 49 | ISO 50001 | `/app/energy` | ❌ |
| 50 | ISO 22000 | `/app/food-safety` | ❌ |
| 51 | ISO 20000 | `/app/itsm` | ❌ |
| 52 | ISO 13485 | `/app/medical-devices` | ❌ |
| 53 | Estados vacíos | transversal | ❌ |
| 54 | Estados de error | transversal | ❌ |
| 55 | Loading states | transversal | ⚠️ |
| 56 | Dialogs | `Modal`, `ModalForm` | ❌ |
| 57 | Drawers | — | ❌ (no existen) |
| 58 | Toasts | `WorkspaceToast` | ❌ |
| 59 | Tablas | `Table`, `IsoTableCard` | ❌ |
| 60 | Formularios | transversal | ❌ |
| 61 | Reportes imprimibles | transversal | ❌ |

---

## 5. Hallazgos por ruta / módulo

Prioridad: **P0** bloqueante (rompe uso o accesibilidad legal) · **P1** alta · **P2** media · **P3** baja.

### 5.1 Fundamentos (transversal)

| Ruta/módulo | Problema | Impacto | Prioridad | Solución propuesta |
|---|---|---|---|---|
| `tailwind.config.ts` + `globals.css` | Dos paletas primarias en conflicto (`#123C66` vs `#5266F6`); utilidades Tailwind renderizan la identidad antigua | Incoherencia visible entre módulos según qué API de estilo usó cada autor | **P0** | Fuente única de verdad en tokens CSS; `tailwind.config` consume `var(--nf-*)` en lugar de definir hex |
| `globals.css` | Tokens `--nf-ink*`, `--nf-line`, `--nf-app-accent` duplicados en 3 bloques (`:root`, `.nf-app-shell`, `.nf-modal-overlay`) | Un cambio de token desincroniza los modales | **P0** | Declarar todos los tokens una vez en `:root`; eliminar redeclaraciones de portal |
| Todo `.tsx` | ~1.500 hex hardcodeados (242 × `#5266F6`), 4.475 `style={{}}` inline en 121 ficheros | Imposible rediseñar, imposible dark mode, imposible auditar contraste | **P0** | Tokens semánticos + utilidades; migración por módulo |
| `globals.css` | 19 tamaños de fuente, 23 paddings, 17 gaps, 14 radios, 58 sombras | Sin ritmo vertical; densidad aleatoria entre módulos | **P1** | Escala tipográfica de 8 pasos, espaciado 4/8 px, 4 radios, 4 niveles de elevación |
| `globals.css` | Texto a 9, 10, 10.5 y 11 px en badges, metadatos y celdas | Ilegible; incumple mínimos de legibilidad | **P1** | Mínimo 12 px en UI, 13 px en cuerpo de tabla |
| Componentes | 7 sistemas de tarjeta, 2+8 sistemas de botón, 4 componentes de métrica, 3 cabeceras de sección | Cada módulo se ve de una empresa distinta | **P1** | Consolidar en `Card`, `Button`, `MetricCard`, `PageHeader`/`SectionHeader` con variantes |
| `globals.css` (7.125 líneas) | Estilos de módulo mezclados con primitivas en un solo fichero | Nadie puede modificar sin riesgo de regresión global | **P2** | Partir en capas: `tokens.css`, `base.css`, `components.css`, `modules/*.css` |

### 5.2 Navegación e IA

| Ruta/módulo | Problema | Impacto | Prioridad | Solución propuesta |
|---|---|---|---|---|
| `AppSidebar` | 35 enlaces planos + 11 grupos ISO + 3 de admin ≈ 180 destinos en una columna | El usuario no encuentra nada; la curva de aprendizaje es el mayor coste de adopción | **P0** | 8 grupos semánticos (Inicio, Sistema de gestión, Riesgo y cumplimiento, Evaluación, Mejora, Personas y terceros, Normas, Administración) |
| `AppSidebar` | Las ~143 secciones de norma conviven en la columna global cuando hay varias normas desplegadas | Sub-navegación de módulo mezclada con navegación de producto | **P1** | Anidarlas bajo la norma **activa** (máx. 15 visibles). Destino final: barra de pestañas dentro del módulo |
| Módulos de norma | Ningún cliente de norma renderiza una barra de pestañas: la única vía a sus secciones es el sidebar | La sub-navegación de un módulo depende de la navegación global | **P1** | `ModuleTabs` alimentado por `useModuleSection` |
| `AppSidebar` | Estado de grupos colapsables no persiste (`useState` local) | Se re-colapsa en cada navegación | **P1** | Persistir en `localStorage` por organización |
| `AppSidebar` | Cabecera de marca es un `<Link>` a dashboard **con chevron de desplegable** que no despliega nada | Afordancia falsa | **P1** | Convertir en selector real de organización, o quitar el chevron |
| `AppSidebar` | Selector de organización duplicado: marca truncada arriba + caja “Organization” con `<select>` nativo debajo | ~90 px de altura desperdiciados; dos controles para lo mismo | **P1** | Un único `OrgSwitcher` en la cabecera del sidebar |
| `AppSidebar` | Módulos bloqueados por plan se marcan solo con un icono de candado y `title` | El `title` no es accesible por teclado ni lectores; no explica el porqué | **P1** | Badge textual “Growth” + `aria-describedby`; estado explicado, no oculto |
| `AppSidebar` | Sin favoritos, sin búsqueda de navegación, sin modo compacto en escritorio | No escala a 13 normas | **P1** | Filtro de navegación + fijados + `CommandPalette` (⌘K) |
| Toda la app | **0 breadcrumbs**. `/app/energy?section=enpi` no indica dónde está el usuario | Sin orientación en jerarquías de 3 niveles | **P1** | `Breadcrumb` en `PageHeader`, derivado de ruta + `section` |
| `AppTopbar` | La búsqueda es falsa: `Enter` redirige a `/app/activity` sin pasar la consulta | Rompe la confianza; ⌘K promete algo que no existe | **P0** | Paleta de comandos real (navegación + entidades) o retirar el campo |
| `AppTopbar` | El placeholder dice “Buscar en {página}” pero el ámbito real es global/inexistente | Ámbito engañoso | **P1** | Ámbito explícito y consistente |
| `AppTopbar` | Sin `<h1>` ni título de página en el header; el título vive dentro de cada módulo, cuando existe | Jerarquía de documento rota | **P1** | `PageHeader` obligatorio con `<h1>` |
| `app/app/layout.tsx` | `title.template` = `"%s | NormaFlow"` sobre títulos que ya incluyen la marca → **“Dashboard \| NormaFlow \| NormaFlow”** | Marca duplicada en pestaña y resultados | **P2** | Normalizar títulos de página sin marca |
| `AppRoot` | El layout móvil depende de `useMatchMedia` en cliente: en SSR se pinta el layout de escritorio y tras hidratar salta al de móvil | Flash del sidebar abierto y desplazamiento del contenido en **cada** navegación móvil | **P0** | Layout responsive por CSS (media queries), JS solo para el estado abierto/cerrado |

### 5.3 Dashboard

| Ruta/módulo | Problema | Impacto | Prioridad | Solución propuesta |
|---|---|---|---|---|
| `/app/dashboard` | **Idiomas mezclados en la misma pantalla**: sidebar y CTAs en inglés, contenido en español (“Cumplimiento global”, “3 NC abiertas”, “Al día”) | Parece producto sin terminar | **P0** | Completar cobertura i18n de módulos; prohibir literales fuera del catálogo |
| `/app/dashboard` | Sin `<h1>`, sin breadcrumb, sin contexto de norma ni de periodo global | El usuario aterriza sin saber qué está mirando | **P1** | `PageHeader` con título, alcance y filtros de periodo/norma/proceso/responsable |
| `/app/dashboard` | Fila de 4 acciones rápidas heterogéneas (“GAP Assessment”, “Documents”, “Nonconformity”, “Informe”) por encima del contenido, con estilos y idioma distintos | Ruido antes de la información | **P2** | Mover a `PageHeader` como acción primaria + menú “Crear” |
| `/app/dashboard` | El gráfico principal es un sparkline **sin ejes, sin etiquetas, sin leyenda, sin tooltip y sin unidades** | No permite decidir nada; incumple reglas de dataviz | **P1** | Gráfico con eje temporal, meta, valores y alternativa tabular accesible |
| `/app/dashboard` | La tarjeta “Modules” mezcla porcentajes de conformidad (84 %) con conteos (2 documentos, 6 acciones) en una misma lista | Métricas no comparables presentadas como comparables | **P1** | Separar “Progreso por norma” de “Pendientes accionables” |
| `/app/dashboard` | “Estado del sistema” repite datos de “Modules” (Training 25 % = Formación completada 25 %) | Redundancia que infla la página | **P2** | Deduplicar; una métrica, un sitio |
| `/app/dashboard` | Métricas numéricas coloreadas (verde/naranja/azul) **sin icono ni texto de estado** | Color como único canal — falla WCAG 1.4.1 | **P1** | Añadir icono + etiqueta a cada estado |
| `/app/dashboard` | Faltan bloques que el usuario de cumplimiento necesita: CAPA vencidas, auditorías próximas, evidencias faltantes, obligaciones próximas, tareas propias | El dashboard informa pero no acciona | **P1** | Sección “Requiere tu atención” priorizada, con enlace al detalle en cada métrica |

### 5.4 Tablas y listados

| Ruta/módulo | Problema | Impacto | Prioridad | Solución propuesta |
|---|---|---|---|---|
| `/app/documents` y todos los listados | La tabla **se corta horizontalmente** (columna “Propietario” invisible a 1440 px) sin scroll ni indicación | Datos inaccesibles sin que el usuario lo sepa | **P0** | `DataTable` con contenedor de scroll, cabecera fija y sombra de borde |
| `ui/Table.tsx` | Sin ordenación, sin selección, sin acciones masivas, sin paginación, sin columnas configurables, sin densidad, sin exportación | No es una tabla empresarial | **P0** | `DataTable` con el contrato completo |
| `/app/documents` | Columna “Código” demasiado estrecha: `SGSI-MAN-002` se parte en 3 líneas | Rompe el ritmo de fila y triplica su altura | **P1** | Anchos mínimos por tipo de columna + `tabular-nums` + `white-space: nowrap` |
| Listados | Filtros apilados en vertical a ancho completo (~200 px antes del primer dato) | Empuja los datos fuera de la vista | **P1** | `FilterBar` horizontal con desbordamiento a “Más filtros” |
| Listados | Panel de filtros = tarjeta blanca dentro de fondo blanco, y la tabla otra tarjeta | Tarjetas dentro de tarjetas sin jerarquía | **P2** | Un solo contenedor: filtros como barra de la tabla |
| Listados | Chips de estado con iconos arbitrarios (✓ en “Aprobado”, lupa en “En revisión”) y idioma mezclado (“Obsoletos” entre etiquetas en inglés) | Incoherencia semántica | **P2** | `StatusBadge` con mapa único icono+color+etiqueta traducida |
| Listados en móvil | La tabla se renderiza tal cual y se corta; solo se ven 2 columnas | Inutilizable en 390 px | **P0** | Colapsar a tarjetas resumidas + detalle en `Drawer` |
| `ui/Table.tsx` | Filas clicables son `<tr onClick>` sin `role`, sin `tabIndex`, sin foco | No operable por teclado — falla WCAG 2.1.1 | **P0** | Fila con acción explícita accesible o celda con enlace real |
| `ui/Table.tsx` | Estado vacío = cadena “Sin registros” | No explica ni orienta | **P1** | `EmptyState` con propósito del módulo y acción primaria |

### 5.5 Formularios y diálogos

| Ruta/módulo | Problema | Impacto | Prioridad | Solución propuesta |
|---|---|---|---|---|
| Transversal | **0 regiones `aria-live` en toda la app** | Errores de validación y toasts no se anuncian a lectores de pantalla — falla WCAG 4.1.3 | **P0** | `role="alert"` en errores; `aria-live="polite"` en toasts |
| `globals.css` L3184-3197 | Las etiquetas de formulario se infieren con selectores `:has()` sobre el DOM del modal | El estilo depende de la estructura; cualquier envoltorio rompe la etiqueta | **P1** | Componente `Field` explícito (label + control + hint + error) |
| Modales | Formularios largos dentro de `Modal` con `maxHeight: 90vh; overflow:auto` | Contexto perdido, sin autoguardado, sin aviso al cerrar con cambios | **P1** | Formularios largos a página o `Drawer`; confirmación de descarte |
| Modales | Solo 3 de los modales declaran `role="dialog"`/`aria-modal`; no hay trampa de foco ni retorno de foco | Falla WCAG 2.4.3 | **P0** | `Dialog` único con trampa de foco, `Esc`, y restauración de foco |
| Transversal | **0 “skip links”** | El usuario de teclado atraviesa ~180 enlaces de navegación antes del contenido | **P0** | “Saltar al contenido” + `<main id="main">` |
| Formularios | Sin indicador de campos obligatorios consistente, sin texto de ayuda persistente, sin validación en `blur` | Errores tardíos y frustrantes | **P1** | Contrato de `Field` con `required`, `hint`, `error`, validación en `blur` |
| Formularios largos | Sin secciones, sin stepper, sin resumen lateral, sin autoguardado | Abandono en registros de riesgo, CAPA e investigaciones | **P1** | `FormSection` + `Stepper` + autoguardado de borrador |

### 5.6 Paquetes normativos (ISO 14001 / 45001 / 22301 / 42001 / 37301 / 37001 / 50001 / 22000 / 20000 / 13485 / SIG)

Los 11 paquetes comparten el mismo patrón de deuda; se listan agregados.

| Ruta/módulo | Problema | Impacto | Prioridad | Solución propuesta |
|---|---|---|---|---|
| `/app/{norma}` | Cada paquete tiene su propio CSS de módulo (p. ej. `.nf-continuity-detail-*`, `.nf-energy-table-actions`) con radios, sombras y densidades distintos | 11 dialectos visuales dentro del mismo producto | **P1** | Plantilla única de módulo normativo sobre el design system |
| `/app/{norma}` | Navegación por `?section=` sin breadcrumb ni indicación de nivel; hasta 15 subsecciones por norma | El usuario se pierde dentro de la norma | **P1** | `PageHeader` con breadcrumb + `Tabs` de sección con desbordamiento |
| `/app/{norma}` | Sin patrón común de página de detalle (documentos, riesgos, incidentes, dispositivos, sistemas IA…) | Cada entidad se lee distinto | **P1** | `DetailPage`: breadcrumb, título, código, estado, acciones, resumen, tabs (General/Evidencias/Relaciones/Historial/Auditoría), timeline |
| `/app/{norma}` | Los flujos de estado (aprobación, investigación, recall, activación de plan) se muestran como badges sueltos | No se ve la etapa actual, ni responsables, ni la siguiente acción | **P1** | `WorkflowStepper` alimentado por las transiciones que el backend permite |
| `/app/integrated` | La experiencia multinorma no muestra qué requisitos cubre cada evidencia/documento | Se pierde el argumento de venta del SIG | **P1** | Panel de cobertura “Este documento cubre: 9001 §X, 14001 §Y, 45001 §Z” |
| `IsoMetricCard` | El icono y el color de cada métrica se eligen por **regex sobre el texto de la etiqueta** | Semántica frágil e impredecible al traducir | **P2** | Tipo de métrica explícito en el modelo de datos |

### 5.7 Estados, accesibilidad y responsive

| Ruta/módulo | Problema | Impacto | Prioridad | Solución propuesta |
|---|---|---|---|---|
| Transversal | Estados vacíos inconsistentes: 8 implementaciones distintas, la genérica es solo “Sin registros” | Primer uso sin orientación | **P1** | `EmptyState` único: qué es, para qué sirve, qué hacer, acción, ayuda |
| Transversal | Sin estados diferenciados para: sin permisos, pack no contratado, feature no habilitada, error de red, error de servidor, informe procesándose, sin coincidencias | Todos los fallos se ven igual | **P1** | Familia de estados con causa y vía de recuperación |
| `globals.css` | 15 `outline: none` frente a 22 reglas `:focus-visible` | Elementos sin foco visible — falla WCAG 2.4.7 | **P0** | Token `--nf-focus-ring` aplicado globalmente; prohibir `outline:none` sin sustituto |
| Barrido a 390 px | Botón “Create” del topbar: el texto desborda la píldora | Defecto visible en la primera pantalla móvil | **P1** | Botón a icono con etiqueta accesible en móvil |
| Transversal | `darkMode: ["class"]` configurado en Tailwind pero **0 usos de `dark:`** y todos los colores hardcodeados | Dark mode imposible sin refactor de tokens | **P2** | Preparar tokens con capa semántica; activar en fase posterior |
| Transversal | **1 sola regla `@media print`** para una app cuyo entregable son informes de auditoría | Informes imprimibles no controlados | **P2** | Hoja de impresión: sin navegación, tablas repitiendo cabecera, saltos controlados |
| Transversal | Objetivos táctiles < 24 px en acciones de tabla e iconos | Falla WCAG 2.5.8 (AA en 2.2) | **P1** | Mínimo 24 px de objetivo, 44 px recomendado en móvil |

### 5.8 i18n (bloqueante para la calidad percibida)

| Ruta/módulo | Problema | Impacto | Prioridad | Solución propuesta |
|---|---|---|---|---|
| `I18nDomBridge` | Recorre todo el DOM y aplica `tx()` a cada nodo de texto, **incluidos los datos del cliente**. Observado: “Política de Información” → **“Política de Information Información”** | Corrupción visible de datos de cliente en pantalla | **P0** | Restringir la traducción a nodos marcados (`data-i18n`); nunca tocar contenido de datos |
| Módulos | Cobertura incompleta: sidebar traducido, contenido de módulo no | Pantallas bilingües | **P0** | Completar catálogo y validar con `npm run validate:i18n` en CI |

---

## 6. Priorización

| Bloque | Hallazgos P0 | Justificación de orden |
|---|---|---|
| 1. Tokens semánticos y escalas | S1, S2, tokens duplicados | Todo lo demás depende de esto |
| 2. Design system (primitivas) | Tablas, diálogos, focus, aria-live | Desbloquea los módulos |
| 3. Shell: layout, sidebar, topbar | IA de navegación, responsive SSR, búsqueda | Es la superficie que el usuario ve siempre |
| 4. Dashboard | i18n, jerarquía, accionabilidad | Primera impresión del producto |
| 5. Tablas y formularios | Overflow, teclado, estados | Donde se hace el trabajo real |
| 6. Páginas de detalle y workflows | Patrón común | Consistencia entre módulos |
| 7. Paquetes normativos | 11 dialectos → 1 plantilla | Volumen mayor, riesgo menor tras 1–6 |
| 8. Landing y comerciales | Overflow del hero, claims | Independiente del workspace |
| 9. Responsive, a11y, QA visual | Barrido completo | Verificación final |

---

## 7. Restricciones respetadas

El rediseño **no** modifica: Server Actions, permisos, RLS, multi-tenancy, workflows de dominio, validaciones Zod, billing, generación de reportes, Storage, lifecycle de packs, entitlements ni AuditLog. No se renombran rutas, modelos ni acciones. Los componentes funcionales se conservan; se sustituye su capa de estilo.
