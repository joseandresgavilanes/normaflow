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
| Superficies claras sobre tema oscuro | 105 | **0** |
| Texto prácticamente invisible | 50 | **0** |
| Pares de contraste bajo el mínimo (oscuro) | 155 | **0** |
| Pares de contraste bajo el mínimo (claro) | 42 | **0** |
| Bordes de control bajo 3:1 | 225 | **0** |
| Anillos de foco ausentes o bajo 3:1 | 166 | **0** |
| Clases Tailwind con color fijo | 34 | **0** |
| Causas distintas | 144 | **0** |

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

## 3. Tabla de verificación por ruta

Barrido completo, 1440 px, ambas apariencias. `sup` = superficies claras,
`inv` = texto invisible, `con` = contraste, `bor` = bordes, `foco` = anillos.

| Grupo | Rutas | Claro | Oscuro |
|---|---:|---|---|
| Panel y sistema de gestión | 12 | 0/0/0/0/0 | 0/0/0/0/0 |
| Riesgo y cumplimiento | 9 | 0/0/0/0/0 | 0/0/0/0/0 |
| Evaluación y mejora | 11 | 0/0/0/0/0 | 0/0/0/0/0 |
| Personas y terceros | 6 | 0/0/0/0/0 | 0/0/0/0/0 |
| Normas y módulos ISO | 12 | 0/0/0/0/0 | 0/0/0/0/0 |
| Administración y catálogos | 7 | 0/0/0/0/0 | 0/0/0/0/0 |
| Públicas y marketing | 26 | 0/0/0/0/0 | 0/0/0/0/0 |

## 4. Capturas

`scripts/dark-mode-shots.ts` produce 80 imágenes: 10 rutas representativas ×
2 apariencias × 4 anchos (390, 768, 1280, 1440).

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
| `/app/documents` | Tabla de datos completa con filtros e insignias |
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
| Contraste en las dos apariencias | `tests/contrast.spec.ts` | Un par baja del mínimo WCAG en 8 rutas |
| Persistencia, `system`, sin destello, portales, tablas, formularios, impresión | `tests/theme.spec.ts` | 11 casos |
| Nombre accesible de los campos | `tests/forms-a11y.spec.ts` | Un campo se queda sin nombre |

## 6. Excepciones justificadas

| Color | Dónde | Por qué se queda |
|---|---|---|
| `#ff5f57`, `#febc2e`, `#28c840` | Hero de `/home` | Reproducen los botones de una ventana de macOS dentro de la maqueta ilustrada. Son dibujo, no superficie |
| `#16a34a`, `#dc2626`, `#e11d48`, `#d97706`, `#7c3aed` | `.nf-chaos--* .ic` | Identifican el tipo de archivo en la misma ilustración: son color de DATOS |
| `#ffffff` en `@media print` | `14-armonizacion.css` | El blanco es el papel |
| `oklch(...)` de los avatares de `/cases` | Iniciales | Degradado cálido fijo; el texto encima es blanco porque contrasta con ÉL, no con el tema |
| Sombras `rgba(0,0,0,α)` | Elevaciones | La sombra es negra en los dos temas; lo que cambia es la opacidad, ya tokenizada |

## 7. Notas de método

**La sonda tenía dos falsos positivos propios**, y conviene dejarlo escrito
porque cualquier herramienta de este tipo los tiene:

1. Leía `color: transparent` como negro. Ese valor es **obligatorio** en el
   patrón de texto con degradado recortado (`background-clip: text`), así que
   marcaba invisible cada titular del hero.
2. Medía el anillo de foco contra el relleno del **propio** elemento. Con
   `outline-offset` positivo el anillo cae fuera, sobre la superficie de
   alrededor, que es contra la que WCAG 2.4.13 lo compara.

**Un barrido con el servidor caído miente.** Durante la primera pasada el
servidor de desarrollo se cayó y `/app/indicators` salió con estado nulo, más
varias lecturas tardías con valores del tema claro. Se reejecutaron esas rutas
sobre un servidor sano antes de tocar nada: ninguna reprodujo el problema.

**La separación entre superficies oscuras es de 1.04–1.11 y eso es correcto.**
En oscuro las superficies no se distinguen por luminancia sino por borde y
elevación. Por eso importaba subir `--nf-border` y `--nf-border-strong`, y por
eso `--nf-surface-raised` existe.
