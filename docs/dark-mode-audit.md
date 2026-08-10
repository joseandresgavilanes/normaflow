# Auditoría de modo oscuro — NormaFlow

Medición sobre las **83 rutas** del producto (57 privadas + 26 públicas) en las
**dos apariencias**, 166 cargas, con `scripts/dark-mode-audit.ts`.

```bash
# el servidor de desarrollo debe estar levantado y NO debe correr `npm run build` a la vez
AUDIT_BASE=http://localhost:3000 npx tsx scripts/dark-mode-audit.ts ./dark-audit-out
```

## 1. Por qué se mide el navegador y no el repositorio

El modo oscuro no es un problema de código fuente sino de **valor computado**.
Un `bg-white` de Tailwind, un `#fff` en un estilo en línea y un
`background: var(--nf-surface)` que resuelve mal se leen distinto en el código
y producen exactamente el mismo síntoma en pantalla. Un `grep` los clasifica en
tres cajas; el navegador los ve como uno.

La sonda compone además el alfa de las capas: sin eso un
`rgba(82, 102, 246, 0.06)` —que a la vista es blanco— se mide como azul opaco y
reporta 1.18:1 contra un texto gris. Ese fallo era de la medición, no del
producto, y ya costó una ronda de correcciones falsas.

## 2. Arquitectura del tema encontrada

**Existe y es correcta.** No hace falta rehacerla, y no se ha creado un segundo
sistema en paralelo.

| Pieza | Dónde | Estado |
|---|---|---|
| Preferencia | cookie `nf_theme`, un año, `sameSite: lax` | ✅ |
| Lectura en servidor | `src/lib/theme/server.ts` | ✅ |
| Aplicación | `data-theme` en `<html>` desde `src/app/layout.tsx` | ✅ |
| LIGHT / DARK / SYSTEM | `src/components/ui/ThemeSwitcher.tsx` | ✅ |
| Preferencia del sistema | `@media (prefers-color-scheme: dark)` en `tokens.css` | ✅ |
| Sin destello | el atributo se pinta en el HTML inicial, sin script en `<head>` | ✅ |
| Tailwind | `darkMode: ["class", '[data-theme="dark"]']` | ✅ |
| Portales | `#nf-modal-root` vive DENTRO de `.nf-app-shell`, bajo `<html>` | ✅ hereda |

Con la preferencia en `system` **no** se escribe el atributo, que es lo que
permite que actúe la media query. Escribir `data-theme="light"` por defecto la
habría anulado por especificidad.

### El defecto estructural, y ya se había materializado

El oscuro se declara **dos veces**: una para `[data-theme="dark"]` (la elección
del usuario) y otra dentro de `@media (prefers-color-scheme: dark)` (la del
sistema). En CSS plano no hay forma de compartir un bloque entre un selector y
una media query.

Esa duplicación ya había derivado:

```
--nf-disabled-border   atributo #2e3238   sistema #41464f
--nf-disabled-text     atributo #7d848f   sistema #8a919c
```

Quien **elegía** oscuro recibía los valores viejos; quien lo heredaba del
sistema, los corregidos. Invisible salvo comparando los dos bloques a mano.

**Corrección:** los dos bloques se generan desde una sola tabla, y
`scripts/check-css.cjs` —encadenado a `npm run build`— falla si divergen.

## 3. Línea base medida

| Métrica | Claro | Oscuro |
|---|---:|---:|
| Superficies claras sobre tema oscuro | 0 | **105** |
| Texto prácticamente invisible | 1 | **50** |
| Pares de contraste bajo el mínimo | 42 | **155** |
| Bordes de control bajo 3:1 | 229 | 225 |
| Anillos de foco ausentes o bajo 3:1 | 166 | 166 |
| Rutas sin el tema aplicado | 0 | 0 |
| SVG con color fijo en atributo | — | 52 |

**144 causas distintas.** Y están muy concentradas: ocho explican la mayoría de
los 1.187 hallazgos.

## 4. Tabla de hallazgos

| Ruta/componente | Problema | Severidad | Causa | Solución | Estado |
|---|---|---|---|---|---|
| `.nf-skeleton*` · 42 casos | Esqueleto de carga blanco sobre lienzo oscuro | **P0** | `#ebebeb` fijo en `09-esqueletos.css` | Token `--nf-surface-muted` + brillo del barrido por tema | ✅ |
| `header.nf-nav` · 23 rutas públicas | Barra de navegación clara en oscuro | **P0** | `#f7f7f5` fijo en `nf.css` | `var(--nf-surface)` | ✅ |
| `a.nf-logo` · 23 rutas | Logotipo invisible: texto con degradado `#1a1a1a` | **P0** | `background-clip: text` con hex fijo | Degradado desde tokens | ✅ |
| `.nf-grad-text` / `--cool` · 22 casos | Titular del hero invisible (fg `rgb(0,0,0)`) | **P0** | Igual | Igual | ✅ |
| Campos sin anillo de foco · 114 | `outline: none` sin sustituto | **P0** | Reglas heredadas | `:focus-visible` con `--nf-focus-ring` | ✅ |
| `.nf-iso-metric-icon` · 8 | Chip de icono claro en oscuro | **P1** | `#fff8e6` fijo | `--nf-warning-subtle` | ✅ |
| `.nf-iso-subsection-mark`, `.nf-iso-table-card-mark` · 7 | Marca clara en oscuro | **P1** | `#f1f3ff` fijo | `--nf-primary-subtle` | ✅ |
| `button.nf-sidenav__ai` · 114 | Borde bajo 3:1 | **P1** | `--nf-border` (decorativo) en un control | `--nf-border-strong` | ✅ |
| `input.nf-topbar-search-input` · 114 | Borde bajo 3:1 | **P1** | Igual | Igual | ✅ |
| `button.nf-app-btn-ghost` · 133 | Borde bajo 3:1 | **P1** | Igual | Igual | ✅ |
| `button.nf-dt__tool` · 34 | Borde bajo 3:1 | **P1** | Igual | Igual | ✅ |
| `a.nf-sidenav__brand` · 114 | Anillo de foco bajo 3:1 | **P1** | Hereda color decorativo | `--nf-focus-ring` | ✅ |
| `.nf-lang-switcher-btn` · 52 | Anillo de foco bajo 3:1 | **P1** | Igual | Igual | ✅ |
| `.nf-btn--primary` (marketing) · 46 | Anillo de foco bajo 3:1 | **P1** | Igual | Igual | ✅ |
| Alertas de `nf.css` | `#fef2f2/#fecaca/#b91c1c` y `#edf8f1/#bbf7d0/#15803d` fijos | **P1** | Sin token | Pares `subtle`/`border`/`text` | ✅ |
| `STANDARDS` y `COLORS` en `constants.ts` | Paleta por norma con ΔE 4.7 entre ISO 37001 y 37301, y `#0F766E` duplicado | **P1** | Paleta nunca validada | **Borrados**: 0 consumidores | ✅ |
| Gráficos | Sin tokens de rejilla, eje ni tooltip | **P1** | No existían | `--nf-chart-*` + `--nf-series-1..8` validados | ✅ |
| 52 SVG con `fill`/`stroke` fijo | No heredan el tema | **P2** | Atributo de presentación | `currentColor` donde procede | ✅ |
| ~800 colores a fuego en componentes | No responden al tema | **P2** | Sin token | Codemod por rol de propiedad | ✅ |
| Separación entre superficies oscuras 1.04–1.11 | — | **no es defecto** | — | En oscuro las superficies se distinguen por borde y elevación, no por luminancia. Por eso se subió `--nf-border` | — |

### Severidades

- **P0** — contenido imposible de utilizar: texto invisible, superficie que
  oculta el contenido.
- **P1** — contraste o componente roto: por debajo del mínimo WCAG, o control
  que no se puede identificar.
- **P2** — inconsistencia visual: el elemento se ve, pero no sigue el tema.
- **P3** — mejora estética.

## 5. Tokens: nombres del brief y nombres reales

El brief pide `--background`, `--surface`, `--primary`… sin prefijo. **Se
mantiene el prefijo `--nf-`** por una razón medida: el repositorio ya tenía un
alias sin prefijo, `var(--success)`, y resultaba apuntar al token de **relleno**
en vez del de **texto** — 3.30:1 donde hacían falta 4.5:1. Un segundo juego de
nombres sin prefijo sería exactamente el «sistema paralelo» que el propio brief
prohíbe.

| Nombre del brief | Token real | Nuevo |
|---|---|---|
| `--background` | `--nf-background` | |
| `--foreground` / `--text-primary` | `--nf-text-primary` | |
| `--surface` | `--nf-surface` | |
| `--surface-raised` | `--nf-surface-raised` | ✅ |
| `--surface-muted` / `--surface-subtle` | `--nf-surface-muted` / `--nf-surface-sunken` | |
| `--surface-hover` / `--surface-selected` | `--nf-surface-hover` / `--nf-surface-selected` | |
| `--border` / `--border-subtle` / `--border-strong` | `--nf-border*` | |
| `--text-secondary` / `--text-muted` | `--nf-text-secondary` / `--nf-text-muted` | |
| `--text-disabled` | `--nf-text-disabled` | ✅ |
| `--primary*` / `--primary-foreground` | `--nf-primary*` / `--nf-on-primary` | |
| `--success/warning/danger/info` + `-foreground` + `-subtle` | `--nf-*` / `--nf-*-text` / `--nf-*-subtle` | |
| `--focus-ring` / `--overlay` | `--nf-focus-ring` / `--nf-overlay` | |
| `--shadow` | `--nf-shadow` | ✅ |
| `--input-background` / `--input-border` | `--nf-input-bg` / `--nf-input-border` | ✅ |
| `--table-header` / `--table-row-hover` | `--nf-table-header` / `--nf-table-row-hover` | ✅ / |
| `--sidebar-background` / `-active` / `-hover` | `--nf-sidebar-bg` / `-active` / `-hover` | ✅ |
| `--chart-grid` / `--chart-axis` / `--chart-tooltip` | `--nf-chart-*` | ✅ |

Identidad conservada: marca `#5266F6`, éxito `#16A34A`, aviso `#D97706`,
peligro `#DC2626` en claro. En oscuro **se re-escalonan**, no se invierten:
marca `#7b8bff`, éxito `#3fbf6d`, aviso `#e0952f`, peligro `#f0574f`. Usar el
mismo valor en los dos temas daría 3.0:1 o menos.

## 6. Paleta de gráficos, validada y no elegida a ojo

`--nf-series-1..8` sale del sistema de visualización y **pasa el validador** en
ambos temas contra las superficies reales de NormaFlow:

| Comprobación | Claro (`#ffffff`) | Oscuro (`#1a1c20`) |
|---|---|---|
| Banda de luminosidad | ✅ 8/8 | ✅ 8/8 |
| Suelo de croma | ✅ 8/8 | ✅ 8/8 |
| Separación para daltonismo | ✅ ΔE 9.1 peor par | ✅ ΔE 8.4 |
| Suelo de visión normal | ✅ ΔE 19.6 | ✅ ΔE 19.3 |
| Contraste con la superficie | ⚠ 3 bajo 3:1 | ✅ 8/8 |

El aviso de contraste en claro **obliga** a etiqueta visible o tabla
equivalente, y no es descartable. Los gráficos del panel ya tienen las dos
cosas: etiquetas directas y una tabla en `.nf-sr-only`.

La paleta anterior por norma **no pasaba**: `#9F1239` (ISO 37001) y `#8C2F39`
(ISO 37301) daban ΔE 4.7 con visión normal —indistinguibles incluso sin
daltonismo— y `#0F766E` estaba asignado a dos normas a la vez.

## 7. Excepciones justificadas

| Color | Dónde | Por qué se queda |
|---|---|---|
| `#ffffff` en `@media print` | `14-armonizacion.css` | El blanco es el papel, no una superficie del tema |
| Degradados decorativos (39) | hero, tarjetas de marketing | Son ilustración, no superficie; se recortan con `overflow-x: clip` |
| Sombras `rgba(0,0,0,α)` (19) | elevaciones | La sombra es negra en los dos temas; lo que cambia es la opacidad, ya tokenizada |
| `fill`/`stroke` con hex (3) | SVG de marca servidos como fichero | `var()` no resuelve en un atributo de presentación cuando el SVG no está en el documento. **La excepción acaba ahí:** un icono renderizado en línea sí hereda la cascada, y `<ShieldBan color="#9f1239">` en `/app/antibribery` se estaba amparando en esta fila sin derecho — ahora usa `var(--nf-danger-text)` |
| Semáforo del mockup `#ff5f57 #febc2e #28c840` | hero de `/home` | Reproducen los botones de una ventana de macOS: son parte de la ilustración |

## 8. Lo que sigue abierto

Se documenta en [`docs/dark-mode-visual-qa.md`](dark-mode-visual-qa.md) con la
medición posterior. No quedan TODOs genéricos del tipo «dark mode later» en el
código.

Dos cosas encontradas al cerrar la verificación quedan **fuera** del alcance del
tema, y se anotan aquí para que no se pierdan:

1. **`/app/documents` no cierra su respuesta HTML.** El contenido se pinta, pero
   `document.readyState` se queda en `loading` indefinidamente y la única
   petición sin terminar es el propio documento: el stream de RSC nunca se
   cierra. Ninguna de las otras 82 rutas se comporta así. Rompe cualquier
   herramienta que espere `load` o `domcontentloaded`.
   `scripts/dark-mode-shots.ts` se cambió a `commit` + espera del landmark para
   poder capturarla, pero eso es un parche de la herramienta, no del defecto.
2. **La CSP bloqueaba el websocket de recarga en caliente en desarrollo.**
   `connect-src` permitía `wss:` pero no `ws:`, y el socket de Next va sin
   cifrar contra localhost. Corregido en `src/middleware.ts` con el mismo
   criterio que ya se usaba para `'unsafe-eval'`: la excepción existe solo
   cuando `NODE_ENV === "development"`; en producción sigue exigiéndose `wss:`.
