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

Barrido de 83 rutas en escritorio (1440 px), con el probe corregido.
`docs` recoge aquí los números; las capturas quedan en el directorio de salida.

| Métrica | App (57 rutas) | Públicas (26) |
|---|---:|---:|
| Rutas sin `<h1>` | **0** | 1 (`/pricing`) |
| Rutas con varios `<h1>` | **0** | 0 |
| Rutas sin landmark `main` | **0** | 3 |
| Desbordamiento horizontal | **0** | 1 (`/home`) |
| Saltos de jerarquía de encabezado | 23 | 23 |
| Botones sin nombre accesible | 9 | 0 |
| Campos sin etiqueta | 26 | 1 |
| Objetivos táctiles < 24 px | 454 | 643 |
| Tamaños de fuente distintos por página | máx. 11, media 8.2 | — |

Los tres primeros bloques del rediseño se ven en la columna de la app: cero
rutas sin `<h1>`, cero sin `main` y cero con desbordamiento. Las públicas
siguen sin tocar (bloque 12).

### Contraste: lo que el barrido midió

77 de 83 rutas tenían al menos un par por debajo del mínimo. Los más
frecuentes, y su causa real:

| Par | Ratio | Veces | Causa |
|---|---:|---:|---|
| `#ffffff` sobre `#6366f1` | 4.47 | 130 | Índigo heredado, no es token del sistema |
| `#16a34a` sobre `#f0fdf4` | 3.15 | 89 | **`Badge` usaba el token de relleno como color de texto** |
| `#5266f6` sobre `#f0f2ff` | 4.11 | 79 | Ídem con la marca |
| `#6e7480` sobre `#f2f2f0` | 4.19 | 57 | **`--nf-text-subtle` sobre superficie rehundida** |
| `#d97706` sobre `#fffbeb` | 3.07 | 27 | Ídem con el ámbar |

Dos de esas causas eran **errores propios**, y el barrido los destapó:

1. **Los ratios documentados se verificaron contra blanco, no contra las
   superficies rehundidas.** `--nf-text-subtle` daba 4.69:1 sobre blanco pero
   4.19:1 sobre `--nf-surface-sunken`. Corregido a `#63697a`: 5.48:1 sobre
   blanco, 5.11:1 sobre el lienzo y 4.89:1 sobre la superficie rehundida.
2. **`Badge` pintaba texto con el token de relleno.** El sistema distingue
   `--nf-success` (relleno, 3.3:1, válido para barras e iconos) de
   `--nf-success-text` (5.0:1, para texto), pero el mapa de `Badge` tenía los
   hex del relleno escritos a mano. Migrado: aprobado 4.79, en revisión 4.84,
   borrador 5.90, abierta 5.91.

Comprobado que el resto de tonos `-text` sí pasan sobre su superficie sutil:
éxito 4.79, aviso 4.84, peligro 5.91, marca 5.92, información 5.15.

### Lo que sigue abierto

- **23 saltos de jerarquía** dentro de la app (por ejemplo `h1 → h3`): quedan
  para cuando se unifiquen los encabezados de sección.
- **26 campos sin etiqueta** y **9 botones sin nombre**: bloque 9 (formularios).
- **454 objetivos táctiles < 24 px** en la app: la mayoría son acciones de
  tabla y iconos; entra en el bloque de responsive/accesibilidad final.
- **`/pricing` sin `<h1>`** y **`/home` con desbordamiento**: bloque 12.


## 4. Comprobaciones ejecutadas

| Comprobación | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ limpio |
| `npx next lint` | ✅ sin errores (7 warnings preexistentes de `react-hooks/exhaustive-deps`) |
| `npm run validate:i18n` | ✅ 266 claves × 3 locales |
| `npm run build` | ✅ limpio (`rm -rf .next && npm run build`) |
| Playwright `tests/navigation.spec.ts` | ✅ **12/12** |
| Playwright `tests/app.spec.ts` | ✅ 17/18 — ver abajo |
| Playwright `tests/critical-flows.spec.ts` | ⬜ 2 fallos por confirmar |

> `npm run build` y el servidor de desarrollo **no pueden correr a la vez**:
> comparten `.next` y el build deja al servidor sirviendo 500.

### `tests/navigation.spec.ts` (nuevo, 12 casos)

Los ocho grupos, apertura automática del grupo activo, persistencia del estado,
filtro con estado vacío, fijados, secciones visibles solo para la norma activa
(13 para ISO 50001, 0 para el resto) y navegación real por `?section=`, skip
link como primer tabulable que mueve el foco a `#nf-main`, `<h1>` único, cajón
móvil cerrado y fuera del orden de tabulación, apertura por botón y cierre con
`Escape`, y ausencia de scroll horizontal en tres rutas a 390 px.

### Fallos abiertos

| Test | Causa | ¿Lo introdujo el rediseño? |
|---|---|---|
| `app.spec.ts` › ISO 37001 (antisoborno) | El elemento se filtra por `permissions.can("antibribery:read")`, pero la matriz de permisos declara el recurso como `antibribery-sensitive`. La cadena es **idéntica** a la del sidebar anterior, así que el filtrado ya ocurría. | No — preexistente (verificado por comparación de la cadena, no reejecutando el código antiguo) |
| `critical-flows.spec.ts` › cambio de organización | La primera fila de documentos no cambia tras conmutar de organización | Sin confirmar |
| `critical-flows.spec.ts` › auditoría → CAPA | Estado esperado no visible en `/app/actions` | Sin confirmar |

### Regresiones propias detectadas por los tests y corregidas

1. **Nombre accesible contaminado.** El badge de plan dentro del `<a>` hacía que
   el enlace se llamara “Compliance Growth”. Movido fuera y asociado con
   `aria-describedby`.
2. **Gating de plan extendido de más.** Se aplicó `planHasModule` a los módulos
   normativos, que nunca lo tuvieron en el sidebar: los habría redirigido a
   billing. Restringido a los módulos que ya lo tenían.
3. **Localizadores frágiles.** `I18nDomBridge` reescribe el DOM renderizado
   (“Compliance” → “Conformidad”), así que los tests de norma pasan a localizar
   por `href`. Es otra manifestación del problema S6 de la auditoría.

---

## 5. Pendiente

- Re-ejecutar el barrido completo con el probe corregido y publicar la tabla
  numérica por viewport.
- Añadir 360, 1024, 1280 y pantalla grande al conjunto de viewports.
- Capturas comparativas antes/después por ruta.
- Suite E2E de Playwright sobre la navegación nueva (grupos, filtro, fijados,
  cajón móvil, skip link).

---

## 4. Bloques 9 a 15

### Lo que la medición corrigió del plan

| Lo que decía el plan | Lo que había |
|---|---|
| «Field con label visible» | 1.210 campos sin nombre accesible ninguno en 46 ficheros: 652 sin nada y 555 con solo placeholder |
| «Páginas de detalle» | 0 rutas dinámicas en las 58 del workspace; 154 modales en 35 ficheros y 3 rieles de etapa incompatibles |
| «Cobertura por requisito» | `RequirementCoverage` con 0 filas y sus dos server actions con 0 consumidores: no había pantalla que las llamara |
| «Revisión de claims» | Un testimonio firmado con nombre y empresa de los datos demo, y cinco «logos de clientes» que eran cuadrados de degradado |
| «Tokens de oscuro ya listos» | `:root[data-theme="dark"]` existía y era código muerto: sin media query, sin conmutador, sin persistencia. Jamás había renderizado |

### Contraste: de 77 rutas con fallos a 0 en dos temas

`tests/contrast.spec.ts` mide el par texto/fondo **pintado**, componiendo las
capas semitransparentes, en las dos apariencias. No existía ninguna
comprobación de contraste, y por eso se colaron tres errores del mismo tipo:

1. Los ratios se verificaron contra blanco, no contra las superficies
   rehundidas donde el texto se pinta.
2. `Badge` usaba el token de RELLENO (3:1, válido para barras e iconos) como
   color de TEXTO, que necesita 4.5:1 — 89 apariciones.
3. Al tokenizar los hex se repitió el mismo error: `color: var(--nf-primary)`
   da 4.11:1 sobre su propio fondo sutil — 79 apariciones.

El patrón más extendido era `chip(color + "22", color)`: un solo color de texto
y, con alfa, de fondo. Ese par no puede cumplir, porque el fondo hereda el tono
del texto. Medido entre 1.00:1 y 4.36:1, en 34 sitios. `src/lib/tone.ts`
traduce cualquier valor al par correcto.

La sonda también tenía un fallo propio: trataba `rgba(82,102,246,0.06)` —que a
la vista es blanco— como azul opaco, y daba 1.18:1 contra un texto gris. Ahora
compone el alfa.

| Ruta | Fallos antes (claro) | Después (claro) | Después (oscuro) |
|---|---:|---:|---:|
| /app/documents | 32 | **0** | **0** |
| 8 rutas del test | — | **0** | **0** |

### Objetivos táctiles y botones sin nombre

Los 9 botones sin nombre accesible eran **un solo defecto**:
`src/components/ui/Table.tsx` daba `sortValue` a todas las columnas, incluida la
de acciones con etiqueta vacía, y `DataTable` la volvía ordenable — un botón
cuyo único contenido es un icono `aria-hidden`. Corregido en el adaptador,
desaparece en los 9 listados.

De los 454 objetivos táctiles por debajo de 24 px, tres componentes concentraban
el 79%, y a dos les faltaba **un píxel**: el conmutador de idioma (171 casos a
29.1 × 23), el botón de orden de DataTable (131 a 60 × 18) y el enlace de migas
(56 a 34.2 × 20). Tres reglas CSS en el componente, no ruta por ruta.

### Barrido y CI

`scripts/visual-audit.ts` pasa de 3 a 6 anchos —360, 390, 768, 1024, 1280,
1440— con `AUDIT_VIEWPORTS` para acotarlos, porque los seis llevan el barrido de
249 a 498 cargas.

El paso de CI `npm test -- --project=chromium` no hacía lo que aparentaba: npm
anexa el argumento al FINAL de la cadena de cuatro comandos, así que corría
también los dos shards de firefox con solo chromium instalado. Separado en
`test:chromium` y `test:firefox`.

## 5. Lo que sigue abierto, medido

- **161 valores hex sin token equivalente**, con ~830 apariciones. Revelan dos
  paletas conviviendo: la neutra cálida de `tokens.css` y una slate azulada
  (#64748B, #E5EAF2, #94A3B8). Es un problema de definición, no de sustitución:
  elegir «el token más parecido» cambiaría el aspecto.
- **23 saltos de jerarquía de encabezado**, todos el mismo par h1→h3. Falta el
  nivel 2: nueve vienen del literal `<h3 style={{ marginTop: 0 }}>` copiado 34
  veces en los clientes de norma.
- **~4.400 estilos en línea**. Solo el 24% son mono-intención; el 32% mezcla
  espaciado y layout. No son convertibles en bloque. Y hay un acoplamiento
  duro: 39 selectores `[style*="display: grid"]` de `globals` estilan los
  modales leyendo el atributo inline, así que convertir esos inline a clases
  desactiva las reglas — van en el mismo commit o no van.
- **`surfaces.css` y `controls.css` con pocos consumidores**: `Surface`,
  `Dialog` y `FilterBar` siguen sin adoptarse. `FilterBar` existe y los
  listados migrados conservan sus barras de filtro propias.
- **`Modal` frente a `Dialog`**: 154 usos del primero, 0 del segundo, y el
  propio `Modal.tsx` se declara heredado en su cabecera.
- **13 páginas públicas de norma con 45% de duplicación literal** (34 líneas
  idénticas en las 13).
- **Divergencia de precio con Stripe**: el importe que ve el cliente vive en
  `constants.ts`; el que se cobra lo define el Price de Stripe.
  `assertStripePlanConfiguration` valida el FORMATO del id, nunca el importe.
