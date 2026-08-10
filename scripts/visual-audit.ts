/**
 * Visual + structural audit sweep for NormaFlow.
 * Reuses the repo's own demo fixture account (same one tests/global-setup.ts uses).
 *
 * Usage: npx tsx <this file> [outDir]
 */
import { chromium, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
const OUT = process.argv[2] ?? path.join(process.cwd(), "audit-out");

/**
 * Anchos del contrato responsive.
 *
 * Los seis llevan el barrido de 249 a 498 cargas (35-45 min), así que
 * `AUDIT_VIEWPORTS` permite acotarlos por nombre; sin la variable se recorren
 * todos. Los tres añadidos son los que faltaban: 360 es el móvil pequeño real,
 * 1024 la tablet horizontal y 1280 el portátil corriente.
 */
const TODOS_LOS_VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 780 },
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "tablet-1024", width: 1024, height: 768 },
  { name: "laptop-1280", width: 1280, height: 800 },
  { name: "desktop", width: 1440, height: 900 },
];

const SOLICITADOS = (process.env.AUDIT_VIEWPORTS ?? "").split(",").map((v) => v.trim()).filter(Boolean);
const VIEWPORTS = SOLICITADOS.length
  ? TODOS_LOS_VIEWPORTS.filter((v) => SOLICITADOS.includes(v.name))
  : TODOS_LOS_VIEWPORTS;

const PUBLIC_ROUTES = [
  "/home", "/pricing", "/features", "/login", "/signup", "/forgot-password",
  "/iso9001", "/iso27001", "/iso14001", "/iso45001", "/sig", "/iso22301",
  "/iso42001", "/iso37301", "/iso37001", "/iso50001", "/iso22000", "/iso20000", "/iso13485",
  "/blog", "/cases", "/demo", "/legal/privacy", "/legal/terms", "/legal/security",
  "/solutions/gap-assessment",
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
  "/app/catalogs/record-type",
  "/app/continuity", "/app/environment", "/app/energy", "/app/food-safety", "/app/itsm",
  "/app/medical-devices", "/app/safety", "/app/aims", "/app/compliance", "/app/antibribery",
  "/app/integrated",
];

type Diag = {
  route: string;
  viewport: string;
  status: number | null;
  horizontalOverflow: boolean;
  scrollWidth: number;
  clientWidth: number;
  overflowingSelectors: string[];
  h1Count: number;
  headingSkips: string[];
  landmarks: { main: number; nav: number; header: number };
  imagesNoAlt: number;
  buttonsNoName: number;
  inputsNoLabel: number;
  tinyTapTargets: number;
  lowContrastSamples: { text: string; fg: string; bg: string; ratio: number }[];
  consoleErrors: string[];
  distinctFontSizes: number;
  hardcodedColorCount: number;
};

/** Forma que devuelve PROBE (se evalúa como string en el navegador). */
type ProbeResult = {
  scrollWidth: number;
  clientWidth: number;
  horizontalOverflow: boolean;
  overflowingSelectors: string[];
  h1Count: number;
  headingSkips: string[];
  landmarks: { main: number; nav: number; header: number };
  imagesNoAlt: number;
  buttonsNoName: number;
  inputsNoLabel: number;
  tinyTapTargets: number;
  lowContrastSamples: { text: string; fg: string; bg: string; ratio: number }[];
  distinctFontSizes: number;
};

const PROBE = `() => {
  const q = (s) => Array.from(document.querySelectorAll(s));
  const doc = document.documentElement;

  // horizontal overflow + culprits
  const clientWidth = doc.clientWidth;
  const overflowing = [];
  for (const el of q('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > clientWidth + 2 || r.left < -2) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
      const sel = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0,2).join('.') : '');
      if (!overflowing.includes(sel)) overflowing.push(sel);
      if (overflowing.length > 12) break;
    }
  }

  // headings
  const headings = q('h1,h2,h3,h4,h5,h6').map(h => ({ level: +h.tagName[1], text: (h.textContent||'').trim().slice(0,40) }));
  const skips = [];
  let prev = 0;
  for (const h of headings) {
    if (prev && h.level > prev + 1) skips.push('h' + prev + ' -> h' + h.level + ' @ "' + h.text + '"');
    prev = h.level;
  }

  // a11y probes
  const imagesNoAlt = q('img:not([alt])').length;
  const buttonsNoName = q('button, [role="button"]').filter(b => {
    const label = (b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent || '').trim();
    return label.length === 0;
  }).length;
  const inputsNoLabel = q('input:not([type=hidden]), select, textarea').filter(i => {
    if (i.getAttribute('aria-label') || i.getAttribute('aria-labelledby') || i.getAttribute('title')) return false;
    if (i.id && document.querySelector('label[for="' + CSS.escape(i.id) + '"]')) return false;
    if (i.closest('label')) return false;
    if (i.getAttribute('placeholder')) return false;
    return true;
  }).length;

  const tinyTapTargets = q('a, button, [role="button"], input[type=checkbox], input[type=radio], select').filter(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    return r.height < 24 || r.width < 24;
  }).length;

  // contrast sampling
  function parse(c) {
    const m = c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(',').map(x => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function lum({r,g,b}) {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
    return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b);
  }
  function bgOf(el) {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.5) return c;
      n = n.parentElement;
    }
    return { r:255,g:255,b:255,a:1 };
  }
  const low = [];
  const fontSizes = new Set();
  const textNodes = q('p, span, div, td, th, a, label, li, h1, h2, h3, h4, h5, h6, button')
    .filter(el => el.children.length === 0 && (el.textContent||'').trim().length > 1);
  for (const el of textNodes.slice(0, 500)) {
    const cs = getComputedStyle(el);
    fontSizes.add(cs.fontSize);
    const fg = parse(cs.color);
    if (!fg) continue;
    const bg = bgOf(el);
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1,L2) + 0.05) / (Math.min(L1,L2) + 0.05);
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    if (ratio < need) {
      low.push({ text: (el.textContent||'').trim().slice(0,32), fg: cs.color, bg: 'rgb('+bg.r+','+bg.g+','+bg.b+')', ratio: Math.round(ratio*100)/100 });
    }
    if (low.length > 15) break;
  }

  return {
    scrollWidth: doc.scrollWidth,
    clientWidth,
    horizontalOverflow: doc.scrollWidth > clientWidth + 2,
    overflowingSelectors: overflowing,
    h1Count: q('h1').length,
    headingSkips: skips.slice(0, 6),
    landmarks: { main: q('main').length, nav: q('nav').length, header: q('header').length },
    imagesNoAlt, buttonsNoName, inputsNoLabel, tinyTapTargets,
    lowContrastSamples: low,
    distinctFontSizes: fontSizes.size,
  };
}`;

async function shoot(page: Page, route: string, vp: string, dir: string): Promise<Diag> {
  const errors: string[] = [];
  const onErr = (m: any) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); };
  page.on("console", onErr);
  let status: number | null = null;
  try {
    const resp = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 45000 });
    status = resp?.status() ?? null;
    await page.waitForTimeout(1400);
  } catch {
    /* keep going */
  }
  // `page.evaluate` con un string lo trata como EXPRESIÓN, así que hay que
  // invocar la función: pasar `"() => {…}"` a secas devuelve la función, no
  // su resultado, y falla al serializar.
  const probe = (await page
    .evaluate(`(${PROBE})()`)
    .catch(() => null)) as ProbeResult | null;
  const file = path.join(dir, `${route.replace(/\//g, "_").replace(/^_/, "") || "root"}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  page.off("console", onErr);

  const hardcoded = 0;
  return {
    route, viewport: vp, status,
    horizontalOverflow: probe?.horizontalOverflow ?? false,
    scrollWidth: probe?.scrollWidth ?? 0,
    clientWidth: probe?.clientWidth ?? 0,
    overflowingSelectors: probe?.overflowingSelectors ?? [],
    h1Count: probe?.h1Count ?? 0,
    headingSkips: probe?.headingSkips ?? [],
    landmarks: probe?.landmarks ?? { main: 0, nav: 0, header: 0 },
    imagesNoAlt: probe?.imagesNoAlt ?? 0,
    buttonsNoName: probe?.buttonsNoName ?? 0,
    inputsNoLabel: probe?.inputsNoLabel ?? 0,
    tinyTapTargets: probe?.tinyTapTargets ?? 0,
    lowContrastSamples: probe?.lowContrastSamples ?? [],
    consoleErrors: errors.slice(0, 5),
    distinctFontSizes: probe?.distinctFontSizes ?? 0,
    hardcodedColorCount: hardcoded,
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const results: Diag[] = [];

  for (const vp of VIEWPORTS) {
    const dir = path.join(OUT, vp.name);
    fs.mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      locale: "es-ES",
      extraHTTPHeaders: { "Accept-Language": "es-ES,es;q=0.9" },
    });
    // authenticate using the repo's own demo fixture (same as tests/global-setup.ts)
    await ctx.request.post(BASE + "/api/auth/login", {
      data: { email: "demo@normaflow.io", password: "NormaFlow2025!" },
    });
    const page = await ctx.newPage();
    const routes = process.env.AUDIT_ONLY_APP ? APP_ROUTES : [...PUBLIC_ROUTES, ...APP_ROUTES];
    for (const route of routes) {
      const d = await shoot(page, route, vp.name, dir);
      results.push(d);
      const flag = d.horizontalOverflow ? " ⚠ OVERFLOW" : "";
      process.stdout.write(`[${vp.name}] ${route} ${d.status}${flag}\n`);
    }
    await ctx.close();
    // Se vuelca en cada viewport: una interrupción a mitad de barrido deja
    // igualmente utilizable lo ya medido.
    fs.writeFileSync(path.join(OUT, "diagnostics.json"), JSON.stringify(results, null, 2));
  }
  await browser.close();
  console.log("\nWrote", path.join(OUT, "diagnostics.json"));
}

main().catch((e) => { console.error(e); process.exit(1); });
