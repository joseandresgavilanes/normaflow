# Sistema de diseño — NormaFlow

Contrato visual del producto. Todo lo que se construya a partir de aquí debe
apoyarse en esta capa; nada debe declarar un color, un tamaño o una sombra por
su cuenta.

> **Estado.** Los tokens y el shell de navegación están implementados y en uso.
> Las primitivas de componente están **especificadas pero no implementadas**:
> la sección 8 dice exactamente qué existe hoy y qué no. Ver
> [design-audit.md](design-audit.md) para el diagnóstico que motiva cada
> decisión.

---

## 1. Principios

1. **Un token, un sitio.** Los componentes no conocen hex. Consultan tokens
   semánticos. Si un valor hay que cambiarlo en dos ficheros, el sistema está
   mal.
2. **El color nunca es el único canal.** Todo estado lleva además icono, texto
   o forma. Es un requisito de accesibilidad y también de imprimibilidad: los
   informes de auditoría se imprimen.
3. **Densidad alta, no apretada.** Es un producto de datos: la escala de
   espaciado es densa, pero el ritmo de 4 px es innegociable.
4. **La restricción es la característica.** 4 radios, 4 elevaciones, 9 tamaños
   de texto. Un valor nuevo requiere justificarlo, no inventarlo.
5. **Lo que el backend no permite, la UI no lo ofrece.** Las transiciones de
   estado que se muestran son las que el dominio acepta.

---

## 2. Tokens

Fuente única: [`src/styles/tokens.css`](../src/styles/tokens.css). Siete capas.

| Capa | Contenido | Se usa en componentes |
|---|---|---|
| 1 — Primitivas | `--nf-c-*`: escalas crudas de color | **No** |
| 2 — Semántica | superficies, bordes, texto, primario, estados, foco, disabled | **Sí** |
| 3 — Tipografía | familias, 9 tamaños, interlineados, pesos, tracking | **Sí** |
| 4 — Espacio y forma | espaciado, radios, elevación, motion, z-index, densidad | **Sí** |
| 5 — Dark mode | mismos nombres bajo `:root[data-theme="dark"]` | automático |
| 6 — Alias legacy | nombres heredados → capa 2 | solo migración |
| 7 — Base | foco visible, skip link, cifras tabulares, reduced-motion | global |

### 2.1 Color semántico

| Token | Valor claro | Uso |
|---|---|---|
| `--nf-background` | `#f7f7f5` | lienzo de la aplicación |
| `--nf-surface` | `#ffffff` | tarjetas, tablas, modales |
| `--nf-surface-muted` | `#fafafa` | cabecera de tabla, fila alterna |
| `--nf-surface-sunken` | `#f2f2f0` | fondos rehundidos, chips neutros |
| `--nf-border` | `#e4e4e2` | separadores (decorativos) |
| `--nf-border-strong` | `#8f8f8f` | borde de control de formulario |
| `--nf-text-primary` | `#1a1a1a` | texto principal |
| `--nf-text-secondary` | `#525252` | texto de apoyo |
| `--nf-text-muted` | `#6a6a6a` | metadatos |
| `--nf-text-subtle` | `#6e7480` | el nivel más tenue admisible |
| `--nf-primary` | `#5266f6` | marca, acción primaria |
| `--nf-primary-hover` | `#4355e8` | hover |
| `--nf-primary-active` | `#3b4bd8` | pulsado, texto de marca sobre claro |
| `--nf-primary-subtle` | `#f0f2ff` | fondo seleccionado |
| `--nf-focus-ring` | `#3b4bd8` | anillo de foco |

### 2.2 Contraste — verificado, no estimado

Cada valor está calculado con la fórmula de luminancia relativa de WCAG sobre
el fondo previsto.

| Par | Ratio | AA texto normal (4.5) | AA gráficos (3.0) |
|---|---|---|---|
| `text-primary` sobre `background` | 16.0 : 1 | ✅ | ✅ |
| `text-secondary` sobre `surface` | 7.82 : 1 | ✅ | ✅ |
| `text-muted` sobre `background` | 5.04 : 1 | ✅ | ✅ |
| `text-subtle` sobre `surface` | 4.69 : 1 | ✅ | ✅ |
| `primary` sobre `surface` | 4.57 : 1 | ✅ | ✅ |
| `on-primary` sobre `primary` | 4.57 : 1 | ✅ | ✅ |
| `focus-ring` sobre `surface` | 6.61 : 1 | ✅ | ✅ |
| `border-strong` sobre `surface` | 3.23 : 1 | n/a | ✅ |
| `success-text` sobre `surface` | 5.01 : 1 | ✅ | ✅ |
| `warning-text` sobre `surface` | 5.02 : 1 | ✅ | ✅ |
| `danger` sobre `surface` | 4.83 : 1 | ✅ | ✅ |
| `info` sobre `surface` | 5.35 : 1 | ✅ | ✅ |

Los tokens de relleno (`--nf-success`, `--nf-warning`) rondan 3.2–3.3 : 1: son
válidos para barras, puntos e iconos, **no para texto**. Para texto de estado
se usa siempre el token `-text`. Esta es la razón de que cada estado tenga
trío `relleno / borde / texto` en lugar de un solo color.

Dos valores heredados se corrigieron: `--nf-ink-4` pasó de `#9ca3af`
(2.54 : 1 — fallaba incluso el mínimo de gráficos) a `#6e7480`, y se añadió
`--nf-border-strong` porque `#e8e8e8` (1.24 : 1) no puede identificar un
control de formulario.

### 2.3 Tipografía

Inter para todo; Manrope disponible como display. Escala de 9 pasos.

| Token | px | Uso |
|---|---|---|
| `--nf-text-2xs` | 11 | **solo** versalitas con tracking |
| `--nf-text-xs` | 12 | badges, metadatos |
| `--nf-text-sm` | 13 | cuerpo de tabla, controles pequeños |
| `--nf-text-base` | 14 | cuerpo de la app |
| `--nf-text-md` | 16 | lectura larga, marketing |
| `--nf-text-lg` | 18 | título de tarjeta |
| `--nf-text-xl` | 22 | título de sección |
| `--nf-text-2xl` | 28 | título de página (`<h1>`) |
| `--nf-text-3xl` | 36 | hero de marketing |

Sustituye a los 19 tamaños sueltos que había, incluidos 9, 10, 10.5 y 12.5 px.
**Mínimo absoluto para texto: 12 px.** El paso de 11 px solo se admite en
mayúsculas con `--nf-tracking-wide`.

### 2.4 Espaciado, radios, elevación

Ritmo de 4 px: `0 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`.
Sustituye a 23 valores de padding y 17 de gap sin ritmo.

Radios: `xs 4` (chips, foco) · `s 6` (controles pequeños) · `m 8` (**base**:
botones, inputs, tarjetas) · `l 12` (paneles, modales) · `full` (píldoras).

Elevación, 4 niveles, sustituyendo 58 sombras distintas:
`1` tarjeta en reposo · `2` tarjeta elevada / dropdown pequeño ·
`3` popover, dropdown · `4` modal, cajón.

### 2.5 Motion

`instant 80ms` · `fast 140ms` · `base 200ms` · `slow 280ms`, con
`--nf-ease-standard`. Nada por encima de 280 ms en la aplicación. Solo se
animan `transform` y `opacity`. `prefers-reduced-motion` reduce todas las
duraciones a 1 ms globalmente.

### 2.6 Capas

`sticky 100 · sidebar 200 · topbar 300 · drawer 400 · overlay 500 · modal 600
· popover 700 · toast 800 · tooltip 900`. Sin números mágicos: el modal usaba
`z-index: 5000`.

---

## 3. Cuadrícula, contenedores y breakpoints

| Breakpoint | Ancho | Comportamiento |
|---|---|---|
| `xs` | 390 | una columna; tablas → tarjetas |
| `sm` | 640 | una columna, gutter mayor |
| `md` | 768 | dos columnas; sidebar sigue en cajón |
| `lg` | 1024 | **sidebar fija**; layout de escritorio |
| `xl` | 1280 | sidebar 264 px |
| `2xl` | 1440 | ancho máximo de contenido |

`--nf-content-max: 1440px`, gutter `--nf-space-6`. El corte de navegación es
1024 px y está definido **en CSS**, no en JavaScript.

---

## 4. Navegación

[`src/lib/navigation.ts`](../src/lib/navigation.ts) es el modelo único.

Ocho grupos: Inicio · Sistema de gestión · Riesgo y cumplimiento · Evaluación ·
Mejora · Personas y terceros · Normas · Administración.

Reglas:

- **Una norma, un destino.** Sus secciones se anidan bajo la norma **activa**,
  nunca todas a la vez. Estado final previsto: una barra de pestañas dentro del
  módulo, alimentada por `useModuleSection`; la sub-navegación de un módulo no
  pertenece a la columna global. Hoy los módulos no renderizan pestañas, así
  que el sidebar sigue siendo la vía y no puede retirarse hasta que existan.
- El estado activo se marca con color, peso y barra lateral. Nunca solo color.
- El bloqueo por plan se expresa con un badge textual, no con un icono mudo.
- Grupos colapsables con estado persistido por navegador.
- El filtro de navegación abre todos los grupos mientras hay consulta.
- Ningún elemento sin permiso o fuera del rol llega al DOM.

Añadir un módulo = añadir una entrada a `NAV_GROUPS`. Nada más.

---

## 5. Cabecera de página

`PageHeader` es obligatorio en toda ruta de `/app`. Renderiza el único `<h1>`
de la página.

```tsx
<PageHeader
  eyebrow="ISO 50001:2018"
  title="Gestión energética"
  subtitle="Revisión energética, SEU, línea base, EnPI y mejora."
  meta={<StatusBadge status="ACTIVE" />}
  actions={<Button variant="primary">Nueva fuente</Button>}
/>
```

El `Breadcrumb` se deriva de la ruta y del modelo de navegación; se puede
sobreescribir con `items` en páginas de detalle.

---

## 6. Patrones de componente

### 6.1 Botón — 4 variantes, 2 tamaños

`primary` (una por pantalla) · `secondary` (contorno) · `ghost` (terciario) ·
`danger` (destructivo, siempre separado de la acción primaria).
Tamaños `sm` (32 px) y `md` (40 px). Estados: reposo, hover, activo, foco,
deshabilitado, cargando. Un botón en carga se deshabilita y muestra progreso.

Consolida `nf-btn*`, `nf-app-btn*` y 8 botones ad-hoc.

### 6.2 Campo de formulario

Todo control se envuelve en `Field`: etiqueta visible, control, ayuda
persistente y error. Nunca etiqueta solo por `placeholder`.

- Obligatoriedad marcada en la etiqueta y en `aria-required`.
- Validación en `blur`, no en cada pulsación.
- El error va **debajo** del campo, con `role="alert"`.
- Con varios errores, resumen arriba con anclas y foco al primer campo inválido.
- Borde `--nf-border-strong` (3.23 : 1), no el borde decorativo.
- Alto mínimo 40 px; 44 px en móvil.

### 6.3 DataTable

Contrato obligatorio: búsqueda, filtros, ordenación con `aria-sort`, columnas
configurables, densidad (36/44/56 px), selección, acciones masivas,
paginación, cabecera fija, contenedor con scroll propio, exportación y vistas
guardadas.

- La fila no es clicable por `onClick` en el `<tr>`: la primera celda lleva un
  enlace real, alcanzable por teclado.
- Los números usan `.nf-tabular`.
- El desbordamiento se resuelve con scroll **dentro** del contenedor. La página
  nunca desplaza horizontalmente.
- Por debajo de 768 px la tabla se convierte en tarjetas resumidas y el detalle
  se abre en `Drawer`.
- Estado vacío = `EmptyState`, no la cadena "Sin registros".

### 6.4 StatusBadge

Un mapa único `estado → { icono, tono, etiqueta }`. Tres tonos de estado
(`success`, `warning`, `danger`) más `info` y `neutral`, cada uno con su trío
relleno/borde/texto. **Siempre icono + texto.** Sustituye al mapa de 30 hex
literales de `Badge.tsx`.

### 6.5 EmptyState

Cuatro partes obligatorias: qué es el módulo, para qué sirve, qué hacer ahora
(acción primaria) y enlace de ayuda. Variantes: primer uso, sin resultados,
sin permisos, pack no contratado, error de red, error de servidor,
procesándose.

### 6.6 Dialog y Drawer

Un solo `Dialog`: `role="dialog"`, `aria-modal`, trampa de foco, cierre con
`Esc`, restauración del foco al disparador y confirmación al descartar con
cambios sin guardar. Los formularios largos van a página o a `Drawer`, nunca a
modal.

### 6.7 WorkflowStepper

Muestra etapa actual, completadas y bloqueadas, con responsable, fecha,
evidencia y motivo de rechazo. **Las transiciones ofrecidas son exactamente
las que el backend permite**; el componente recibe la lista, no la infiere.

### 6.8 Página de detalle

Patrón común: breadcrumb → título + código + estado → acciones → resumen y
metadatos → tabs (General · Evidencias · Relaciones · Historial · Auditoría) →
timeline y comentarios.

---

## 7. Accesibilidad — reglas no negociables

1. Contraste AA verificado por token (§2.2).
2. Foco visible universal: `:focus-visible` con anillo de 2 px y offset de
   2 px. **Prohibido `outline: none` sin sustituto.**
3. Skip link en todas las vistas de `/app`.
4. Un `<h1>` por página, jerarquía sin saltos.
5. Landmarks: `<nav aria-label>`, `<main id="nf-main">`, `<header>`.
6. Todo icono accionable tiene nombre accesible.
7. El estado nunca se comunica solo por color.
8. Errores con `role="alert"`; toasts con `aria-live="polite"` y sin robar foco.
9. Objetivo táctil ≥ 24 px (WCAG 2.5.8), 44 px recomendado en móvil.
10. `prefers-reduced-motion` y `prefers-contrast` respetados globalmente.
11. Las capas superpuestas tienen trampa de foco y salida por `Esc`.

---

## 8. Estado de implementación

| Elemento | Estado |
|---|---|
| Tokens (7 capas) | ✅ implementado |
| Tailwind consumiendo tokens | ✅ implementado |
| Foco visible universal | ✅ implementado |
| Skip link + `<main>` | ✅ implementado |
| `prefers-reduced-motion` / `prefers-contrast` | ✅ implementado |
| Hoja de impresión base | ✅ implementado |
| Modelo de navegación (8 grupos) | ✅ implementado |
| Sidebar (grupos, filtro, fijados, cajón) | ✅ implementado |
| Responsive del shell por CSS | ✅ implementado |
| `PageHeader` + `Breadcrumb` | ✅ implementado (falta adoptarlo en las 83 rutas) |
| Tokens de dark mode | ✅ definidos, **no activados** |
| `Button`, `Field`, `Input`, `Select`, `Checkbox`, `Switch` | ⬜ especificado |
| `DataTable`, `FilterBar`, `Pagination` | ⬜ especificado |
| `StatusBadge` unificado | ⬜ especificado |
| `EmptyState` y familia de estados | ⬜ especificado |
| `Dialog` accesible, `Drawer` | ⬜ especificado |
| `WorkflowStepper` | ⬜ especificado |
| Patrón de página de detalle | ⬜ especificado |
| `CommandPalette` (⌘K real) | ⬜ especificado |
| `ModuleTabs` (pestañas dentro de cada módulo normativo) | ⬜ especificado |
| Consolidación de las 7 tarjetas y 10 botones | ⬜ pendiente |
| Migración de los 4.475 `style={{}}` inline | ⬜ pendiente |
| Partición de `globals.css` (7.125 líneas) | ⬜ pendiente |

---

## 9. Reglas de contribución

- Un color nuevo → token semántico, con su ratio de contraste anotado.
- Un tamaño fuera de escala → justificar o encajarlo en la escala.
- CSS de módulo nuevo → fichero propio en `src/styles/`, no `globals.css`.
- Componente nuevo → variante de uno existente antes que un componente nuevo.
- Todo cambio visual pasa por `npx tsx scripts/visual-audit.ts` y se compara
  contra el baseline en [visual-qa.md](visual-qa.md).
