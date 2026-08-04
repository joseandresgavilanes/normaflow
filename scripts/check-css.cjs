/**
 * Comprueba que todas las hojas parsean con el mismo parser que usa el
 * minificador de producción.
 *
 * Existe porque el modo desarrollo NO valida los selectores: un `a) {`
 * huérfano —dejado por una poda de selectores que partió una lista por la coma
 * de dentro de un `:is(...)`— sirvió sin queja en desarrollo durante todo un
 * bloque de trabajo y tumbó `npm run build` con «Expected an opening
 * parenthesis», sin decir en qué fichero.
 *
 *   node scripts/check-css.cjs
 */
const fs = require("fs");
const path = require("path");
const postcss = require("postcss");
const selectorParser = require("postcss-selector-parser");

const hojas = [];
(function recoger(dir) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entrada.name);
    if (entrada.isDirectory()) recoger(p);
    else if (entrada.name.endsWith(".css")) hojas.push(p);
  }
})("src");

let fallos = 0;
for (const hoja of hojas) {
  const css = fs.readFileSync(hoja, "utf8");
  let root;
  try {
    root = postcss.parse(css, { from: hoja });
  } catch (error) {
    console.error(`✗ ${hoja}: ${error.message}`);
    fallos++;
    continue;
  }
  root.walkRules((regla) => {
    try {
      selectorParser().processSync(regla.selector);
    } catch (error) {
      const linea = regla.source?.start?.line ?? "?";
      console.error(`✗ ${hoja}:${linea}  ${error.message}`);
      console.error(`    ${regla.selector.replace(/\s+/g, " ").slice(0, 160)}`);
      fallos++;
    }
  });
}

/* ---------------------------------------------------------------------------
 * Paridad de los dos bloques de tema oscuro
 *
 * El oscuro se declara dos veces por una limitación de CSS plano: una para el
 * atributo `data-theme="dark"` (la elección del usuario) y otra dentro de
 * `@media (prefers-color-scheme: dark)` (la del sistema operativo). No hay
 * forma de compartir un bloque entre un selector y una media query sin un
 * preprocesador.
 *
 * Esa duplicación ya derivó una vez: `--nf-disabled-border` y
 * `--nf-disabled-text` tenían valores distintos, así que quien ELEGÍA oscuro
 * recibía los valores viejos y quien lo heredaba del sistema los corregidos.
 * Un fallo invisible salvo que alguien compare los dos bloques a mano.
 * ------------------------------------------------------------------------ */
function tokensDeBloque(css, patronSelector) {
  const m = css.match(new RegExp(patronSelector + "\\s*\\{([\\s\\S]*?)\\n\\}"));
  if (!m) return null;
  const tokens = new Map();
  for (const [, nombre, valor] of m[1].matchAll(/(--nf-[a-z0-9-]+):\s*([^;]+);/g)) {
    tokens.set(nombre, valor.trim());
  }
  return tokens;
}

const tokensCss = fs.readFileSync(path.join("src", "styles", "tokens.css"), "utf8");
const porAtributo = tokensDeBloque(tokensCss, ':root\\[data-theme="dark"\\]');
const porSistema = tokensDeBloque(tokensCss, ':root:not\\(\\[data-theme="light"\\]\\)');

if (!porAtributo || !porSistema) {
  console.error("✗ tokens.css: falta uno de los dos bloques de tema oscuro.");
  console.error("    Se esperan `:root[data-theme=\"dark\"]` y `@media (prefers-color-scheme: dark)`.");
  fallos++;
} else {
  const soloAtributo = [...porAtributo.keys()].filter((k) => !porSistema.has(k));
  const soloSistema = [...porSistema.keys()].filter((k) => !porAtributo.has(k));
  const divergentes = [...porAtributo.keys()]
    .filter((k) => porSistema.has(k) && porSistema.get(k) !== porAtributo.get(k));

  for (const k of soloAtributo) {
    console.error(`✗ ${k} solo está en el bloque del atributo: el tema del sistema no lo aplicaría.`);
    fallos++;
  }
  for (const k of soloSistema) {
    console.error(`✗ ${k} solo está en la media query: elegir oscuro a mano no lo aplicaría.`);
    fallos++;
  }
  for (const k of divergentes) {
    console.error(`✗ ${k} difiere entre los dos bloques oscuros:`);
    console.error(`    atributo=${porAtributo.get(k)}   sistema=${porSistema.get(k)}`);
    fallos++;
  }
  if (!soloAtributo.length && !soloSistema.length && !divergentes.length) {
    console.log(`Los dos bloques de tema oscuro declaran los mismos ${porAtributo.size} tokens con los mismos valores.`);
  }
}

if (fallos) {
  console.error(`\n${fallos} problema(s) de integridad CSS.`);
  process.exit(1);
}
console.log(`${hojas.length} hojas parsean correctamente.`);
