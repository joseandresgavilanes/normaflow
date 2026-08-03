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

if (fallos) {
  console.error(`\n${fallos} problema(s) de sintaxis CSS. El build de producción fallaría.`);
  process.exit(1);
}
console.log(`${hojas.length} hojas parsean correctamente.`);
