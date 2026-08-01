# QA visual — NormaFlow

Registro de la verificación visual y de accesibilidad. Se actualiza en cada
bloque de rediseño.

---

## 1. Herramienta

[`scripts/visual-audit.ts`](../scripts/visual-audit.ts) recorre las rutas
públicas y privadas en tres viewports, captura la página completa y ejecuta un
probe en el DOM.

```bash
# el servidor de desarrollo debe estar en :3100 y NO debe correr `npm run build`
# a la vez: comparten el directorio .next
npx tsx scripts/visual-audit.ts ./audit-out
```

Se autentica igual que `tests/global-setup.ts`, con la cuenta fixture demo del
repositorio.

### Qué mide por ruta y viewport

| Métrica | Criterio |
|---|---|
| `horizontalOverflow` + `overflowingSelectors` | `scrollWidth > clientWidth`; identifica hasta 12 elementos culpables |
| `h1Count` | exactamente 1 por página |
| `headingSkips` | sin saltos de nivel (h2 → h4) |
| `landmarks` | `main`, `nav`, `header` presentes |
| `imagesNoAlt` | 0 |
| `buttonsNoName` | 0 — botones sin texto, `aria-label` ni `title` |
| `inputsNoLabel` | 0 — sin `label`, `aria-label`, `aria-labelledby` ni `placeholder` |
| `tinyTapTargets` | objetivos < 24 px (WCAG 2.5.8) |
| `lowContrastSamples` | contraste calculado con luminancia relativa WCAG sobre el fondo pintado real; marca < 4.5:1 (< 3:1 en texto grande) |
| `distinctFontSizes` | número de tamaños tipográficos distintos renderizados |
| `consoleErrors` | errores de consola por ruta |

### Cobertura

83 rutas × 3 viewports = 249 capturas por barrido.

- **Públicas (26):** `/home`, `/pricing`, `/features`, `/login`, `/signup`,
  `/forgot-password`, las 13 páginas de norma, `/blog`, `/cases`, `/demo`,
  `/legal/*`, `/solutions/gap-assessment`.
- **Privadas (57):** las 8 secciones de navegación completas, incluidos los 11
  paquetes normativos.

| Viewport | Tamaño | Representa |
|---|---|---|
| desktop | 1440 × 900 | portátil de trabajo |
| tablet | 768 × 1024 | tablet vertical / ventana estrecha |
| mobile | 390 × 844 | teléfono |

Los tamaños de 360, 1024, 1280 y "pantalla grande" que pide el plan de
responsive todavía no están en el barrido; se añaden en el bloque de responsive.

---

## 2. Hallazgos verificados por inspección directa

Contrastados a mano sobre el servidor demo, con la evidencia que motivó cada
corrección.

### Antes → después (bloques 1–3)

| Hallazgo | Estado | Evidencia |
|---|---|---|
| Móvil 390 px: el sidebar se pintaba abierto y el contenido desplazado en cada navegación | ✅ corregido | El layout responsive pasó de `useMatchMedia` a CSS; primer render ya muestra el cajón cerrado con el botón de menú |
| Cajón móvil sin salida por teclado ni `Esc` | ✅ corregido | `visibility` escalonada saca la barra cerrada del orden de tabulación; `Esc` cierra |
| Cajón móvil tapado por la cabecera | ✅ corregido | Cajón elevado a `--nf-z-drawer` (400) sobre `--nf-z-topbar` (300) |
| Botón "Crear" desbordaba la píldora en móvil | ✅ corregido | Medido: los dos SVG se comprimían a 3.1 × 15 px dentro de un botón de 36 px con 28 px de padding. Ahora 40 × 40 con icono de 15 px |
| Sidebar: ~180 destinos en una columna plana | ✅ corregido | 8 grupos colapsables con filtro y fijados |
| ~143 secciones de norma compitiendo en la columna global | ✅ corregido | Una norma = un destino; sus secciones se anidan solo cuando esa norma es la ruta activa (máx. 15 visibles en vez de 143) |
| Selector de organización duplicado | ✅ corregido | Un solo `OrgSwitcher` en la cabecera |
| Sin `<h1>` en ninguna ruta | 🟡 parcial | `PageHeader` creado y adoptado en el Dashboard; faltan 82 rutas |
| Sin migas de pan | 🟡 parcial | `Breadcrumb` creado, se deriva de la ruta; se adopta con `PageHeader` |
| Sin enlace de salto al contenido | ✅ corregido | `.nf-skip-link` + `<main id="nf-main">` |
| `--nf-ink-4` a 2.54:1 (fallaba incluso 3:1) | ✅ corregido | `#9ca3af` → `#6e7480`, 4.69:1 |
| Bordes de control a 1.24:1 | ✅ corregido | Nuevo `--nf-border-strong` a 3.23:1 |
| Tokens desincronizados en modales (portal fuera del shell) | ✅ corregido | Declaración única en `:root` |
| `--nf-radius-lg/xl` con dos valores según orden de carga | ✅ corregido | `:root` en conflicto de `nf.css` eliminado |
| Marca duplicada en el título ("Dashboard \| NormaFlow \| NormaFlow") | ✅ corregido | 35 páginas |
| Tabla recortada horizontalmente sin scroll | ⬜ pendiente | Bloque de tablas |
| Filtros apilados a ancho completo (~200 px antes del primer dato) | ⬜ pendiente | Bloque de tablas |
| Tabla sin adaptar en móvil (2 columnas visibles) | ⬜ pendiente | Bloque de tablas |
| Mezcla de idiomas en la misma pantalla | ⬜ pendiente | Bloque de i18n |
| `I18nDomBridge` corrompe datos ("Política de Information Información") | ⬜ pendiente | Bloque de i18n |
| Gráfico principal sin ejes, leyenda ni unidades | ⬜ pendiente | Bloque de dashboard |
| 0 regiones `aria-live` | ⬜ pendiente | Bloque de formularios |
| Modales sin trampa de foco | ⬜ pendiente | Bloque de diálogos |

### Errores propios corregidos durante el trabajo

- **“143 enlaces muertos”.** Se afirmó que los subitems `?section=` de las
  normas no navegaban, porque `useSearchParams` no aparece en ninguno de los 11
  clientes de norma. Era falso: lo consumen a través del hook
  `useModuleSection`. Los enlaces funcionaban y eran la **única** vía a esas
  secciones. Al eliminarlos se dejaron 143 secciones inalcanzables; se
  restauraron como sub-navegación contextual de la norma activa. La lección
  operativa: buscar el símbolo directo no basta cuando el consumo es indirecto
  a través de un hook.

### Falsos positivos descartados

- **Círculo oscuro flotante abajo a la izquierda:** es el indicador de
  desarrollo de Next.js, no un elemento de la aplicación. No se reporta.
- **Conflicto de paletas Tailwind:** real pero **latente**. Hay 0 usos de
  utilidades de color de Tailwind en el código, así que la paleta fantasma
  (#123C66 / #2E8B57) nunca llegó a pintarse. Corregido igualmente.
- **Transición del cajón "atascada" en `translateX(-300px)`:** artefacto de
  medición. El panel del navegador tenía `document.visibilityState === "hidden"`
  y el motor congela las transiciones en pestañas en segundo plano
  (`currentTime: 0`). Confirmado abriendo el cajón con captura de pantalla.

---

## 3. Baseline instrumentado

**Estado: pendiente de re-ejecución.**

El barrido con el probe corregido capturó 224 de 249 pantallas (desktop 83/83,
tablet 83/83, mobile 58/83) antes de interrumpirse: se lanzó `npm run build` en
paralelo y el build y el servidor de desarrollo comparten el directorio
`.next`, lo que tiró el servidor a mitad de barrido.

Correcciones aplicadas para que no vuelva a ocurrir:

1. `scripts/visual-audit.ts` vuelca `diagnostics.json` **al terminar cada
   viewport**, de modo que una interrupción deja utilizable lo ya medido.
2. Queda documentado arriba que no debe ejecutarse `npm run build` mientras el
   servidor de desarrollo esté levantado.

Un barrido previo devolvió todo a cero por un fallo del propio probe:
`page.evaluate` trata un string como **expresión**, así que pasarle
`"() => {…}"` devolvía la función en lugar de invocarla y fallaba al
serializar. Corregido con `page.evaluate(\`(${PROBE})()\`)`. Los ceros de aquel
barrido no eran un resultado limpio: eran ausencia de resultado.

---

## 4. Comprobaciones ejecutadas

| Comprobación | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ limpio |
| `npx next lint` | ✅ sin errores (7 warnings preexistentes de `react-hooks/exhaustive-deps`) |
| `npm run validate:i18n` | ✅ 266 claves × 3 locales |
| `npm run build` | ver §5 |
| Playwright `tests/` | ⬜ pendiente |

---

## 5. Pendiente

- Re-ejecutar el barrido completo con el probe corregido y publicar la tabla
  numérica por viewport.
- Añadir 360, 1024, 1280 y pantalla grande al conjunto de viewports.
- Capturas comparativas antes/después por ruta.
- Suite E2E de Playwright sobre la navegación nueva (grupos, filtro, fijados,
  cajón móvil, skip link).
