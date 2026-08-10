# QA visual del modo oscuro — NormaFlow

Verificación posterior a la corrección. Los números salen de
`scripts/dark-mode-audit.ts` sobre las 83 rutas en las dos apariencias, y las
capturas de `scripts/dark-mode-shots.ts`.

```bash
# barrido: 166 cargas, ~30 min en desarrollo
AUDIT_BASE=http://localhost:3000 npx tsx scripts/dark-mode-audit.ts ./dark-audit-out

# capturas: 10 rutas × 2 temas × 4 anchos
AUDIT_BASE=http://localhost:3000 npx tsx scripts/dark-mode-shots.ts ./dark-shots
```

## 1. Antes y después

| Métrica | Línea base | Después |
|---|---:|---:|
| Superficies claras sobre tema oscuro | 105 | **2** — los dos son la excepción del hero, ver sección 6 |
| Texto prácticamente invisible | 50 | **0** |
| Pares de contraste bajo el mínimo (oscuro) | 155 | **0** |
| Pares de contraste bajo el mínimo (claro) | 42 | **0** |
| Bordes de control bajo 3:1 | 225 | **0** |
| Anillos de foco ausentes o bajo 3:1 | 166 | **0** |
| SVG con color fijo en atributo | 3 | **0** |
| Clases Tailwind con color fijo | 34 | **0** |
| Respaldos `var(--token, #hex)` muertos | 124 | **0** |
| Causas distintas | 144 | **1** — `#febc2e`, en dos elementos |
| No medibles por la sonda | sin medir | **1** — degradado de los avatares de `/cases` |

El «2» de la primera fila no es un pendiente disimulado: son los dos puntos
`#febc2e` del semáforo de la ventana de macOS dibujada en el hero de `/home`, y
siguen contándose a propósito. Silenciarlos con una lista de excepciones dentro
de la sonda haría que una regresión futura en ese mismo sitio pasara inadvertida;
es preferible un dos explicado que un cero cómodo.

## 2. Ocho causas explicaban la mayoría

El trabajo no fue ruta por ruta. De los 1.187 hallazgos, ocho orígenes
concentraban la mayor parte:

| Causa | Casos | Corrección |
|---|---:|---|
| `.nf-skeleton` con `#EBEBEB` fijo | 42 | Una regla. Cubre todos los estados de carga |
| `outline: none` en 12 hojas | 114 | Anulaban el foco visible universal de `tokens.css` |
| `--nf-line` como borde de control | 133 | Es el borde decorativo (1.8:1 en oscuro); los controles necesitan 3:1 |
| Anillo de foco sobre relleno propio | 114 | Separación + halo en la regla global |
| `header.nf-nav` translúcida clara | 23 | Marketing no tenía oscuro |
| `.nf-grad-text` desde `#1a1a1a` | 22 | `background-clip: text` dejaba el titular en negro sobre negro |
| `ProgressBar` con carril `#F0F0F0` | 7 consumidores | Valor por defecto del componente |
| `#64748b` en mapas de tono | 12 | Es el neutro del par, no un color propio |

### Segunda pasada: lo que quedó tras la primera

La primera pasada se cerró con números tomados de un barrido en el que el
servidor se había caído. Repetido sobre un servidor sano, quedaban 53 hallazgos
que la primera vez no se habían visto, más dos que la sonda no sabía medir. Sus
causas:

| Causa | Casos | Corrección |
|---|---:|---|
| `--nf-line` / `--nf-border` como borde de control | 50 | 6 clases (`.nf-chip`, `.nf-app-btn-outline`, `.nfm-input`…) y 4 sitios con estilo en línea, todas a `--nf-input-border` |
| `--nf-c-neutral-500` en el `:hover` de los controles | 5 reglas | Solo estaba declarado en `:root`: en oscuro entraba un valor de la paleta clara. Token nuevo `--nf-input-border-hover` en las tres apariencias |
| `#d9e1eb` y `#dbe3ee` con `!important` | 3 reglas | Bordes de control con hex fijo: en oscuro pintaban una línea clara sobre superficie oscura |
| `chip("#eef2ff", "#4338ca")` en clientes de módulo | 22 | Fondo índigo-50 fijo: garantía de rotura en oscuro. Al par `primary` de `tone.ts` |
| `accent: "#ea580c"` como color de valor | 23 | Naranja-600 da 3.60:1 sobre blanco; el token de texto es `--nf-warning-text` (5.02:1) |
| `--nf-warn` como color de texto | 1 | El de relleno (3.19:1) donde iba el de texto. La barra de la línea siguiente sí lo usa bien |
| Degradado de los avatares de `/cases` | 2 | 2.74:1 con las iniciales blancas. Ver la nota de la sección 6 |
| `#9f1239` en `/app/antibribery` | 2 | Un borde de control y el trazo de un icono, a `--nf-danger` y `--nf-danger-text` |
| `var(--nf-ink-3, #8794a5)` | 18 | Respaldo muerto: el token existe en las tres apariencias |
| `OnboardingWizard` con `#fff`, `#f7fcf8`, `#b8e4c4`, `#9aa6b5` | 4 | Blancos y verdes claros en la lista de activación |

Dos patrones se repiten en esta tabla y merecen nombrarse, porque son los que
volverán a aparecer:

**El token de relleno usado como color de texto.** Ya iba por la quinta
aparición antes de esta pasada, y aquí sumó dos más (`--nf-warn`, `#ea580c`).
`--nf-success`, `--nf-warn` y `--nf-danger` están calculados para 3:1 —barras,
iconos, fondos—; el texto necesita 4.5:1 y para eso existe el sufijo `-text`.

**El borde decorativo usado como borde de control.** `--nf-line` agrupa; no
delimita nada pulsable. WCAG 1.4.11 pide 3:1 para el límite de un componente de
interfaz, y `--nf-input-border` es el token que lo cumple en las dos
apariencias. La diferencia no se ve leyendo el código: `border: 1px solid
var(--nf-line)` parece correcto en un campo de búsqueda hasta que se mide.

## 3. Tabla de verificación por ruta

Barrido completo, 1440 px, ambas apariencias. `sup` = superficies claras,
`inv` = texto invisible, `con` = contraste, `bor` = bordes, `foco` = anillos.

83 rutas × 2 apariencias = **166 cargas**. Todas dieron 200 salvo tres, y esas
se repitieron aparte (más abajo). La sonda funcionó en las 166 —`sondaOk`— y en
las 83 cargas oscuras el atributo `data-theme` llegó aplicado desde el servidor.

| Apariencia | Rutas | sup | inv | con | bor | foco | svg |
|---|---:|---:|---:|---:|---:|---:|---:|
| Claro | 83 | 0 | 0 | 0 | 0 | 0 | 0 |
| Oscuro | 83 | 2 | 0 | 0 | 0 | 0 | 0 |

De esas 83, **82 están verificadas de verdad**. La que falta es
`/app/documents`, y el motivo está justo debajo.

Una sola ruta aparece con hallazgos, `/home` en oscuro, y son los dos puntos del
semáforo del hero descritos en la sección 6.

**Tres cargas devolvieron estado nulo** —`/app/documents` en las dos apariencias
y `/iso45001` en claro— y por eso no se dieron por buenas. `/iso45001` no
reprodujo el problema. `/app/documents` sí, y al mirar la captura se vio por qué.

### `/app/documents` NO está verificada, y conviene decirlo

Los ceros de esa ruta son ciertos y no significan nada: **la pantalla nunca
carga**. A los 5, 20, 45 y 75 segundos sigue mostrando 82 esqueletos y cero
filas; `document.readyState` no pasa de `loading` y la única petición sin
terminar es el propio documento. La sonda midió una pantalla de carga.

La causa está localizada y es ajena al tema: `getDocumentsPayload()` llama a
`ensureDocumentTemplates()` antes de leer nada, y esa función recorre el
catálogo de normas llamando a `installPack` una por una. `installPack` no tiene
cortocircuito: reescribe pack, ediciones, requisitos, reglas de evidencia,
preguntas GAP, checklist y mapeos, con `await` secuencial. Cada visita a la
pantalla de documentos reinstala el catálogo ISO entero antes de pintar la
primera fila.

Tres consecuencias, todas anotadas y ninguna disimulada:

1. `/app/documents` queda **pendiente de verificar** en las dos apariencias.
   Habrá que volver a medirla cuando cargue.
2. `tests/theme.spec.ts` comprobaba la legibilidad de la tabla de datos en esa
   misma ruta, así que **aprobaba mirando esqueletos**. Se repuntó a
   `/app/records`, que sí renderiza una tabla real, y ahora el caso exige ver
   una fila antes de medir: sin filas, el bucle recorría un conjunto vacío.
3. `scripts/dark-mode-shots.ts` navegaba con `domcontentloaded`, evento que en
   esa ruta no llega nunca. Se cambió a `commit` + espera del landmark.

## 4. Capturas

`scripts/dark-mode-shots.ts` produce 80 imágenes: 10 rutas representativas ×
2 apariencias × 4 anchos (390, 768, 1280, 1440). Las 80 están generadas.

El tema se fija por la **misma cookie** que usa el producto, no con un
`setAttribute`. Eso importa: significa que la captura muestra lo que pinta el
servidor en el HTML inicial, así que una captura sin destello es prueba de que
no lo hay.

| Ruta | Por qué está en el conjunto |
|---|---|
| `/home` | Marketing, hero ilustrado, el peor caso de la línea base |
| `/pricing` | Conmutador de modo y tarjetas de plan |
| `/login` | Autenticación, fuera del shell de la aplicación |
| `/app/dashboard` | Métricas, gráfico con ejes, actividad |
| `/app/documents` | Estaba por la tabla de datos con filtros e insignias. Sus 8 capturas muestran la pantalla de carga: ver el apartado de la sección 3 |
| `/app/risks` | Chips de puntuación y matrices |
| `/app/actions` | Kanban, riel de flujo, modal de detalle |
| `/app/standards` | Matriz de correspondencias y pestañas |
| `/app/settings/organization` | Formulario denso |
| `/app/reporting` | Vista previa imprimible |

## 5. Lo que se comprueba solo

| Comprobación | Dónde | Falla si |
|---|---|---|
| Paridad de los dos bloques oscuros | `scripts/check-css.cjs`, encadenado a `npm run build` | Un token difiere o falta en uno de los dos |
| Sintaxis de las 25 hojas | Igual | El minificador de producción rechazaría el selector |
| Contraste en las dos apariencias | `tests/contrast.spec.ts` | Un par baja del mínimo WCAG en 18 rutas × 2 temas |
| Persistencia, `system`, sin destello, portales, tablas, formularios, impresión | `tests/theme.spec.ts` | 10 casos |
| Nombre accesible de los campos | `tests/forms-a11y.spec.ts` | Un campo se queda sin nombre |

## 6. Excepciones justificadas

| Color | Dónde | Por qué se queda |
|---|---|---|
| `#ff5f57`, `#febc2e`, `#28c840` | Hero de `/home` | Reproducen los botones de una ventana de macOS dentro de la maqueta ilustrada. Son dibujo, no superficie |
| `#16a34a`, `#dc2626`, `#e11d48`, `#d97706`, `#7c3aed` | `.nf-chaos--* .ic` | Identifican el tipo de archivo en la misma ilustración: son color de DATOS |
| `#ffffff` en `@media print` | `14-armonizacion.css` | El blanco es el papel |
| Sombras `rgba(0,0,0,α)` | Elevaciones | La sombra es negra en los dos temas; lo que cambia es la opacidad, ya tokenizada |

Una de las excepciones de esta lista **no lo era**. El degradado `oklch(...)` de
los avatares de `/cases` figuraba aquí con el argumento de que las iniciales
blancas contrastan con el degradado y no con el tema. El argumento es correcto;
los valores no lo eran. Convertido a sRGB, el extremo claro
`oklch(0.7 0.06 30)` es `rgb(193, 145, 136)`: **2.74:1** contra blanco, por
debajo del 4.5:1 que necesitan unas iniciales de 15 px en negrita. El degradado
ahora va de `oklch(0.55 0.04 30)` a `oklch(0.45 0.06 30)` — 4.94:1 y 7.65:1 —
conservando el tono cálido.

Merece quedar escrito porque el mecanismo del error es el de esta clase de
trabajo: la sonda no sabe leer un degradado, así que subió por el árbol hasta el
lienzo y midió 1.04:1, un número que era falso. Descartar el número por falso
casi hizo descartar también el problema, que era real.

## 7. Notas de método

**La sonda tenía dos falsos positivos propios**, y conviene dejarlo escrito
porque cualquier herramienta de este tipo los tiene:

1. Leía `color: transparent` como negro. Ese valor es **obligatorio** en el
   patrón de texto con degradado recortado (`background-clip: text`), así que
   marcaba invisible cada titular del hero.
2. Medía el anillo de foco contra el relleno del **propio** elemento. Con
   `outline-offset` positivo el anillo cae fuera, sobre la superficie de
   alrededor, que es contra la que WCAG 2.4.13 lo compara.
3. No sabe leer un `background-image`. Cuando un elemento se pinta con un
   degradado, `backgroundColor` vale `transparent` y la sonda sigue subiendo
   hasta el primer fondo opaco, que no es el que se ve. Es el caso de los
   avatares de `/cases`, descrito arriba.
4. Contaba los SVG con color fijo pero no decía cuál. Un número sin culpable no
   se puede arreglar: ahora registra etiqueta, atributo y contenedor.
5. Pedía subir el contraste del borde de un botón **deshabilitado**. WCAG 1.4.11
   exime literalmente los componentes inactivos, y ese borde apagado es lo que
   comunica que no se puede pulsar. Era el botón del plan actual en
   `/app/billing`, que va `disabled` a propósito.

**Una sonda rota parece un barrido perfecto**, y eso es lo más peligroso de
medir con una herramienta propia. Las dos sondas viajan al navegador como
cadena, así que TypeScript no las revisa: un `as`, una anotación de tipo o un
acento grave las rompen. Cuando eso pasaba, `page.evaluate` lanzaba, el error se
guardaba en un campo que nadie miraba y **todos los contadores salían a cero**.
Un barrido con 166 ceros es indistinguible de un producto impecable.

Ahora hay tres defensas, en este orden:

1. Antes de abrir el navegador, las dos plantillas se compilan con
   `new Function`. Si no son JavaScript válido, el proceso muere en el segundo
   uno en vez de tardar media hora en no medir nada.
2. Cada ruta guarda `sondaOk`. Si es falso, la línea sale marcada `✗✗ SONDA
   ROTA: los ceros no valen`.
3. Al final, si alguna sonda falló, el proceso termina con código distinto de
   cero y lo dice con estas palabras: «Los totales de arriba NO son una
   medición: son el valor por defecto».

**Un barrido con el servidor caído miente.** Durante la primera pasada el
servidor de desarrollo se cayó y `/app/indicators` salió con estado nulo, más
varias lecturas tardías con valores del tema claro. Se reejecutaron esas rutas
sobre un servidor sano antes de tocar nada: ninguna reprodujo el problema.

**La separación entre superficies oscuras es de 1.04–1.11 y eso es correcto.**
En oscuro las superficies no se distinguen por luminancia sino por borde y
elevación. Por eso importaba subir `--nf-border` y `--nf-border-strong`, y por
eso `--nf-surface-raised` existe.
