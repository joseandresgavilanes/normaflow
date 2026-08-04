/**
 * Auditoría de modo oscuro de NormaFlow.
 *
 * El modo oscuro no es un problema de código fuente sino de valor COMPUTADO:
 * un `bg-white` de Tailwind, un `#fff` en un estilo en línea y un
 * `background: var(--nf-surface)` mal resuelto se leen distinto en el código y
 * producen el mismo síntoma en pantalla. Por eso esto mide el navegador, no
 * grepea el repositorio.
 *
 * Recorre todas las rutas en las DOS apariencias y por cada una reporta:
 *
 *  · superficies claras sobre tema oscuro (el «modal blanco»);
 *  · texto oscuro sobre fondo oscuro y viceversa;
 *  · pares de contraste por debajo del mínimo, componiendo el alfa;
 *  · bordes de control por debajo de 3:1 (WCAG 1.4.11);
 *  · anillos de foco invisibles;
 *  · SVG con fill/stroke fijo.
 *
 * De cada culpable guarda `className` y el `style` en línea, que es lo único
 * que permite volver al fichero de origen.
 *
 * Uso:  npx tsx scripts/dark-mode-audit.ts [outDir]
 *       DARK_AUDIT_ROUTES=/app/documents,/app/risks  (acota)
 *       DARK_AUDIT_THEMES=dark                        (acota)
 */
import { chromium, type Page, type BrowserContext } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
const OUT = process.argv[2] ?? path.join(process.cwd(), "dark-audit-out");

const PUBLIC_ROUTES = [
  "/home", "/pricing", "/features", "/login", "/signup", "/forgot-password",
  "/iso9001", "/iso27001", "/iso14001", "/iso45001", "/sig", "/iso22301",
  "/iso42001", "/iso37301", "/iso37001", "/iso50001", "/iso22000", "/iso20000",
  "/iso13485", "/blog", "/cases", "/demo", "/legal/privacy", "/legal/terms",
  "/legal/security", "/solutions/gap-assessment",
];

const APP_ROUTES = [
  "/app/dashboard", "/app/setup", "/app/standards", "/app/context", "/app/quality-ops",
  "/app/design-dev", "/app/gap", "/app/documents", "/app/records", "/app/training",
  "/app/changes", "/app/processes", "/app/risks", "/app/opportunities", "/app/suppliers",
  "/app/audit-program", "/app/audits", "/app/management-review", "/app/nonconformities",
  "/app/actions", "/app/indicators", "/app/evidence", "/app/security-controls",
  "/app/assets", "/app/soa", "/app/risk-treatment", "/app/incidents", "/app/vulnerabilities",
  "/app/suppliers/security", "/app/integrations", "/app/reporting", "/app/activity",
  "/app/notifications", "/app/billing", "/app/settings", "/app/settings/organization",
  "/app/settings/users", "/app/settings/groups", "/app/settings/catalogs",
  "/app/info/positions", "/app/info/personnel", "/app/catalogs/locations",
  "/app/catalogs/retention", "/app/catalogs/disposition", "/app/catalogs/archive-method",
  "/app/catalogs/record-type", "/app/continuity", "/app/environment", "/app/energy",
  "/app/food-safety", "/app/itsm", "/app/medical-devices", "/app/safety", "/app/aims",
  "/app/compliance", "/app/antibribery", "/app/integrated",
];

const acotadas = (process.env.DARK_AUDIT_ROUTES ?? "").split(",").map((r) => r.trim()).filter(Boolean);
const TEMAS = ((process.env.DARK_AUDIT_THEMES ?? "light,dark").split(",").map((t) => t.trim()) as ("light" | "dark")[]);

export type Culpable = {
  /** Qué se detectó. */
  clase: string;
  /** Ratio o luminancia medidos. */
  valor: number;
  fg: string;
  bg: string;
  /** Primeras palabras del texto, para localizarlo en pantalla. */
  texto: string;
  /** Pista para volver al código: className y style en línea. */
  origen: string;
};

export type Diagnostico = {
  ruta: string;
  tema: "light" | "dark";
  estado: number | null;
  temaAplicado: string | null;
  superficiesClaras: Culpable[];
  textoInvisible: Culpable[];
  contrasteBajo: Culpable[];
  bordesDebiles: Culpable[];
  focoInvisible: Culpable[];
  svgFijo: number;
  erroresConsola: string[];
};

/**
 * Sonda que corre en el navegador.
 *
 * Se envía como cadena porque `page.evaluate` con una función referenciaría el
 * ámbito de Node. La lógica de composición de alfa es la misma que usa
 * `tests/contrast.spec.ts`: sin ella un `rgba(...,0.06)` se mide como opaco.
 */
const SONDA = `() => {
  const UMBRAL_CLARO = 0.55;   // luminancia por encima de la cual una superficie "es blanca"
  const UMBRAL_OSCURO = 0.12;  // por debajo de la cual un texto "es negro"

  function canal(c) {
    const m = String(c).match(/[\\d.]+/g);
    if (!m) return null;
    const [r, g, b] = m.slice(0, 3).map(Number);
    return { r, g, b, a: m.length > 3 ? Number(m[3]) : 1 };
  }
  function lumRGB(c) {
    const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function fondoEfectivo(el) {
    const capas = [];
    let n = el;
    while (n) {
      const c = canal(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) { capas.push(c); if (c.a >= 0.999) break; }
      n = n.parentElement;
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = capas.length - 1; i >= 0; i--) {
      const c = capas[i];
      base = {
        r: c.r * c.a + base.r * (1 - c.a),
        g: c.g * c.a + base.g * (1 - c.a),
        b: c.b * c.a + base.b * (1 - c.a),
        a: 1,
      };
    }
    return base;
  }
  function texto(el) {
    return [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim())
      .map((n) => n.textContent.trim()).join(' ').slice(0, 40);
  }
  function origen(el) {
    const cls = (el.className && el.className.toString ? el.className.toString() : '').slice(0, 90);
    const st = (el.getAttribute('style') || '').slice(0, 110);
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '') + (st ? ' [style: ' + st + ']' : '');
  }
  function rgbStr(c) { return 'rgb(' + Math.round(c.r) + ', ' + Math.round(c.g) + ', ' + Math.round(c.b) + ')'; }
  function visible(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.15) return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  }

  const oscuro = document.documentElement.dataset.theme === 'dark'
    || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);

  const superficiesClaras = [];
  const textoInvisible = [];
  const contrasteBajo = [];
  const bordesDebiles = [];
  const vistos = new Set();

  const lienzo = fondoEfectivo(document.body);
  const lumLienzo = lumRGB(lienzo);

  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);

    // 1. Superficie clara con el tema oscuro. Solo se reporta cuando el propio
    //    elemento declara el fondo: heredarlo no es su culpa.
    const propio = canal(cs.backgroundColor);
    if (oscuro && propio && propio.a > 0.5) {
      const l = lumRGB(propio);
      if (l > UMBRAL_CLARO) {
        const k = 'sup|' + origen(el);
        if (!vistos.has(k)) {
          vistos.add(k);
          superficiesClaras.push({ clase: 'superficie clara en oscuro', valor: +l.toFixed(3),
            fg: '', bg: rgbStr(propio), texto: texto(el), origen: origen(el) });
        }
      }
    }

    const t = texto(el);
    if (t) {
      // El patrón de texto con degradado recortado (background-clip: text)
      // EXIGE color: transparent, porque lo pinta el fondo y no la propiedad
      // color. Medirlo como negro marcaba invisible cada titular del hero.
      // Sin acentos graves: este comentario vive dentro de una plantilla.
      const recortado = (cs.webkitBackgroundClip || cs.backgroundClip) === 'text';
      const fg = recortado ? null : canal(cs.color);
      if (fg && fg.a < 0.05) continue;
      const bg = fondoEfectivo(el);
      if (fg) {
        const lf = lumRGB(fg), lb = lumRGB(bg);
        const ratio = (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05);

        // 2. Texto oscuro sobre fondo oscuro (o claro sobre claro): el síntoma
        //    de mezclar los dos temas en el mismo elemento.
        if (ratio < 1.9 && ((lf < UMBRAL_OSCURO && lb < 0.25) || (lf > UMBRAL_CLARO && lb > 0.5))) {
          const k = 'inv|' + origen(el);
          if (!vistos.has(k)) {
            vistos.add(k);
            textoInvisible.push({ clase: 'texto casi invisible', valor: +ratio.toFixed(2),
              fg: rgbStr(fg), bg: rgbStr(bg), texto: t, origen: origen(el) });
          }
        }

        // 3. Contraste WCAG 1.4.3.
        const px = parseFloat(cs.fontSize);
        const grande = px >= 24 || (px >= 18.66 && parseInt(cs.fontWeight) >= 700);
        const minimo = grande ? 3 : 4.5;
        if (ratio < minimo) {
          const k = 'con|' + origen(el) + '|' + cs.color;
          if (!vistos.has(k)) {
            vistos.add(k);
            contrasteBajo.push({ clase: 'contraste bajo el mínimo', valor: +ratio.toFixed(2),
              fg: cs.color, bg: rgbStr(bg), texto: t, origen: origen(el) });
          }
        }
      }
    }

    // 4. Borde de un control: WCAG 1.4.11 pide 3:1 cuando identifica el
    //    componente. Solo se miran los controles reales.
    if (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(el.tagName)) {
      const bw = parseFloat(cs.borderTopWidth) || 0;
      if (bw > 0) {
        const bc = canal(cs.borderTopColor);
        if (bc && bc.a > 0.4) {
          const bg = fondoEfectivo(el.parentElement || el);
          const lbo = lumRGB(bc), lbg = lumRGB(bg);
          const r = (Math.max(lbo, lbg) + 0.05) / (Math.min(lbo, lbg) + 0.05);
          if (r < 3) {
            const k = 'bor|' + origen(el);
            if (!vistos.has(k)) {
              vistos.add(k);
              bordesDebiles.push({ clase: 'borde de control bajo 3:1', valor: +r.toFixed(2),
                fg: cs.borderTopColor, bg: rgbStr(bg), texto: el.tagName.toLowerCase(), origen: origen(el) });
            }
          }
        }
      }
    }
  }

  // 5. SVG con color fijo en atributo: no hereda currentColor ni el tema.
  const svgFijo = [...document.querySelectorAll('[fill],[stroke]')]
    .filter((e) => /^#|^rgb/.test(e.getAttribute('fill') || '') || /^#|^rgb/.test(e.getAttribute('stroke') || ''))
    .length;

  return {
    temaAplicado: document.documentElement.dataset.theme || null,
    lumLienzo: +lumLienzo.toFixed(3),
    superficiesClaras: superficiesClaras.slice(0, 40),
    textoInvisible: textoInvisible.slice(0, 40),
    contrasteBajo: contrasteBajo.slice(0, 40),
    bordesDebiles: bordesDebiles.slice(0, 20),
    svgFijo,
  };
}`;

/** Enfoca los primeros focusables y comprueba que el anillo se ve. */
const SONDA_FOCO = `async () => {
  function canal(c) {
    const m = String(c).match(/[\\d.]+/g);
    if (!m) return null;
    const [r, g, b] = m.slice(0, 3).map(Number);
    return { r, g, b, a: m.length > 3 ? Number(m[3]) : 1 };
  }
  function lum(c) {
    const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function fondo(el) {
    let n = el;
    while (n) {
      const c = canal(getComputedStyle(n).backgroundColor);
      if (c && c.a >= 0.999) return c;
      n = n.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }
  const focusables = [...document.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex="0"]')]
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; })
    .slice(0, 12);
  const malos = [];
  for (const el of focusables) {
    el.focus();
    const cs = getComputedStyle(el);
    const w = parseFloat(cs.outlineWidth) || 0;
    const estilo = cs.outlineStyle;
    // Sin outline puede haber box-shadow como anillo: se acepta si existe.
    const sombra = cs.boxShadow && cs.boxShadow !== 'none';
    if ((w < 1 || estilo === 'none') && !sombra) {
      malos.push({ clase: 'sin anillo de foco', valor: w, fg: cs.outlineColor, bg: '',
        texto: (el.textContent || el.tagName).trim().slice(0, 30),
        origen: el.tagName.toLowerCase() + '.' + (el.className || '').toString().slice(0, 60) });
      continue;
    }
    if (w >= 1 && estilo !== 'none') {
      const oc = canal(cs.outlineColor);
      if (oc) {
        // Con separacion positiva el anillo se pinta FUERA del elemento, sobre
        // la superficie de alrededor: es contra esa contra la que WCAG 2.4.13
        // mide el indicador, no contra el relleno propio del control.
        const sep = parseFloat(cs.outlineOffset) || 0;
        const bg = fondo(sep > 0 && el.parentElement ? el.parentElement : el);
        const lo = lum(oc), lb = lum(bg);
        const r = (Math.max(lo, lb) + 0.05) / (Math.min(lo, lb) + 0.05);
        // WCAG 2.4.13: el indicador de foco necesita 3:1 contra lo adyacente.
        if (r < 3) {
          malos.push({ clase: 'anillo de foco bajo 3:1', valor: +r.toFixed(2), fg: cs.outlineColor,
            bg: 'rgb(' + bg.r + ', ' + bg.g + ', ' + bg.b + ')',
            texto: (el.textContent || el.tagName).trim().slice(0, 30),
            origen: el.tagName.toLowerCase() + '.' + (el.className || '').toString().slice(0, 60) });
        }
      }
    }
  }
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  return malos;
}`;

async function autenticar(ctx: BrowserContext) {
  // En desarrollo la primera llamada compila la ruta: 30 s no bastan en frío.
  const res = await ctx.request.post(BASE + "/api/auth/login", {
    data: { email: "demo@normaflow.io", password: "NormaFlow2025!" },
    timeout: 120000,
  });
  if (!res.ok()) throw new Error(`login falló: ${res.status()}`);
}

async function auditarRuta(page: Page, ruta: string, tema: "light" | "dark"): Promise<Diagnostico> {
  const errores: string[] = [];
  const onError = (m: { type(): string; text(): string }) => {
    if (m.type() === "error") errores.push(m.text().slice(0, 160));
  };
  page.on("console", onError);

  let estado: number | null = null;
  try {
    const r = await page.goto(BASE + ruta, { waitUntil: "domcontentloaded", timeout: 60000 });
    estado = r?.status() ?? null;
    // Da tiempo a que hidrate y a que los efectos pinten estados.
    await page.waitForTimeout(700);
  } catch {
    estado = null;
  }

  let sonda: Record<string, unknown> = {};
  let foco: Culpable[] = [];
  try {
    sonda = (await page.evaluate(`(${SONDA})()`)) as Record<string, unknown>;
    foco = (await page.evaluate(`(${SONDA_FOCO})()`)) as Culpable[];
  } catch (e) {
    errores.push(`sonda falló: ${(e as Error).message.slice(0, 120)}`);
  }

  page.off("console", onError);

  return {
    ruta,
    tema,
    estado,
    temaAplicado: (sonda.temaAplicado as string) ?? null,
    superficiesClaras: (sonda.superficiesClaras as Culpable[]) ?? [],
    textoInvisible: (sonda.textoInvisible as Culpable[]) ?? [],
    contrasteBajo: (sonda.contrasteBajo as Culpable[]) ?? [],
    bordesDebiles: (sonda.bordesDebiles as Culpable[]) ?? [],
    focoInvisible: foco ?? [],
    svgFijo: (sonda.svgFijo as number) ?? 0,
    erroresConsola: errores,
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const navegador = await chromium.launch();
  const resultados: Diagnostico[] = [];

  const rutas = acotadas.length ? acotadas : [...APP_ROUTES, ...PUBLIC_ROUTES];

  for (const tema of TEMAS) {
    const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
    await autenticar(ctx);
    // El tema se fija por la MISMA cookie que usa el producto, para auditar el
    // camino real y no un `setAttribute` que el servidor nunca ve.
    await ctx.addCookies([{ name: "nf_theme", value: tema, url: BASE }]);
    const page = await ctx.newPage();

    for (const ruta of rutas) {
      const d = await auditarRuta(page, ruta, tema);
      resultados.push(d);
      const total = d.superficiesClaras.length + d.textoInvisible.length + d.contrasteBajo.length
        + d.bordesDebiles.length + d.focoInvisible.length;
      const marca = total === 0 ? "·" : total > 10 ? "✗" : "!";
      console.log(
        `${marca} [${tema}] ${ruta.padEnd(34)} sup=${String(d.superficiesClaras.length).padStart(3)}` +
        ` inv=${String(d.textoInvisible.length).padStart(3)}` +
        ` con=${String(d.contrasteBajo.length).padStart(3)}` +
        ` bor=${String(d.bordesDebiles.length).padStart(2)}` +
        ` foco=${String(d.focoInvisible.length).padStart(2)}` +
        ` svg=${d.svgFijo}` +
        (d.temaAplicado !== tema && tema === "dark" ? "  ⚠ tema no aplicado" : ""),
      );
    }
    await ctx.close();
  }

  await navegador.close();
  fs.writeFileSync(path.join(OUT, "dark-mode.json"), JSON.stringify(resultados, null, 2));

  // Agregado por causa: es lo que dice qué arreglar primero.
  const porOrigen = new Map<string, { n: number; clase: string; ejemplo: Culpable; rutas: Set<string> }>();
  for (const d of resultados) {
    for (const c of [...d.superficiesClaras, ...d.textoInvisible, ...d.contrasteBajo, ...d.bordesDebiles, ...d.focoInvisible]) {
      const k = `${c.clase}|${c.origen}`;
      const e = porOrigen.get(k) ?? { n: 0, clase: c.clase, ejemplo: c, rutas: new Set<string>() };
      e.n += 1;
      e.rutas.add(d.ruta);
      porOrigen.set(k, e);
    }
  }
  const ranking = [...porOrigen.values()].sort((a, b) => b.n - a.n);
  fs.writeFileSync(
    path.join(OUT, "por-origen.json"),
    JSON.stringify(ranking.map((r) => ({ ...r, rutas: [...r.rutas].slice(0, 8), nRutas: r.rutas.size })), null, 2),
  );

  const suma = (f: (d: Diagnostico) => number) => resultados.reduce((a, d) => a + f(d), 0);
  console.log("\n=== TOTALES ===");
  for (const tema of TEMAS) {
    const t = resultados.filter((d) => d.tema === tema);
    const s = (f: (d: Diagnostico) => number) => t.reduce((a, d) => a + f(d), 0);
    console.log(
      `${tema}: superficies claras=${s((d) => d.superficiesClaras.length)}` +
      ` texto invisible=${s((d) => d.textoInvisible.length)}` +
      ` contraste=${s((d) => d.contrasteBajo.length)}` +
      ` bordes=${s((d) => d.bordesDebiles.length)}` +
      ` foco=${s((d) => d.focoInvisible.length)}`,
    );
  }
  console.log(`rutas sin tema aplicado en oscuro: ${resultados.filter((d) => d.tema === "dark" && d.temaAplicado !== "dark").length}`);
  console.log(`SVG con color fijo: ${suma((d) => d.svgFijo)}`);
  console.log(`\ncausas distintas: ${ranking.length} → ${path.join(OUT, "por-origen.json")}`);
  console.log("top 15 causas:");
  for (const r of ranking.slice(0, 15)) {
    console.log(`  ${String(r.n).padStart(4)}×  ${r.clase.padEnd(28)} ${r.ejemplo.origen.slice(0, 96)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
