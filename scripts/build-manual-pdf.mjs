import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const sourcePath = path.join(root, "docs/manual-usuario-normaflow.md");
const htmlPath = path.join(root, "docs/manual-usuario-normaflow.html");
const pdfPath = path.join(root, "docs/manual-usuario-normaflow.pdf");
const markdown = await fs.readFile(sourcePath, "utf8");

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inline(value) {
  let html = escapeHtml(value);
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    const absolute = path.resolve(root, "docs", src);
    return '<figure><img src="file://' + absolute + '" alt="' + alt + '"><figcaption>' + alt + "</figcaption></figure>";
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/&gt; /g, "> ");
  return html;
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function tableCells(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function renderTable(lines, start) {
  const headers = tableCells(lines[start]);
  const body = [];
  let index = start + 2;
  while (index < lines.length && lines[index].trim().startsWith("|")) {
    body.push(tableCells(lines[index]));
    index += 1;
  }
  let html = "<table><thead><tr>" + headers.map((cell) => "<th>" + inline(cell) + "</th>").join("") + "</tr></thead><tbody>";
  for (const row of body) {
    html += "<tr>" + row.map((cell) => "<td>" + inline(cell) + "</td>").join("") + "</tr>";
  }
  return { html: html + "</tbody></table>", next: index };
}

function renderMarkdown(source) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let paragraph = [];
  let listType = null;

  function flushParagraph() {
    if (paragraph.length) {
      html += "<p>" + inline(paragraph.join(" ")) + "</p>";
      paragraph = [];
    }
  }

  function closeList() {
    if (listType) {
      html += "</" + listType + ">";
      listType = null;
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }

    if (index + 1 < lines.length && trimmed.startsWith("|") && isTableSeparator(lines[index + 1])) {
      flushParagraph();
      closeList();
      const table = renderTable(lines, index);
      html += table.html;
      index = table.next - 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      html += "<h" + level + ">" + inline(heading[2]) + "</h" + level + ">";
      continue;
    }

    const imageOnly = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageOnly) {
      flushParagraph();
      closeList();
      html += inline(trimmed);
      continue;
    }

    if (trimmed.startsWith("> ")) {
      flushParagraph();
      closeList();
      html += "<blockquote>" + inline(trimmed.slice(2)) + "</blockquote>";
      continue;
    }

    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const nextType = unordered ? "ul" : "ol";
      if (listType !== nextType) {
        closeList();
        listType = nextType;
        html += "<" + listType + ">";
      }
      let item = (unordered || ordered)[1];
      item = item.replace(/^\[ \]\s*/, "□ ");
      html += "<li>" + inline(item) + "</li>";
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  closeList();
  return html;
}

const body = renderMarkdown(markdown);
const documentHtml = "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><title>Manual de usuario de NormaFlow</title><style>" +
  "@page{size:A4;margin:16mm 15mm 18mm}" +
  ":root{--ink:#142033;--muted:#5e6b7a;--blue:#5266f6;--line:#e5eaf2;--soft:#f7f9fc}" +
  "*{box-sizing:border-box}" +
  "html{font-family:Arial,Helvetica,sans-serif;color:var(--ink);font-size:10.5pt;line-height:1.5}" +
  "body{margin:0}" +
  "h1{font-size:29pt;line-height:1.1;margin:0 0 8pt;color:#123c66;page-break-before:avoid}" +
  "h2{font-size:18pt;line-height:1.2;margin:24pt 0 8pt;padding-bottom:4pt;border-bottom:1px solid var(--line);color:#123c66;page-break-after:avoid}" +
  "h3{font-size:13pt;line-height:1.25;margin:16pt 0 5pt;color:#253b5d;page-break-after:avoid}" +
  "p{margin:0 0 8pt}ul,ol{margin:4pt 0 10pt 20pt;padding:0}li{margin:2pt 0}.check{color:#5266f6;font-weight:700}" +
  "strong{font-weight:700}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em;background:#f1f3f8;padding:1pt 3pt;border-radius:3pt}" +
  "blockquote{margin:10pt 0;padding:8pt 10pt;border-left:3pt solid var(--blue);background:#f1f3ff;color:#384563}" +
  "table{border-collapse:collapse;width:100%;margin:10pt 0 14pt;font-size:9.4pt}th,td{border:1px solid var(--line);padding:6pt 7pt;vertical-align:top}th{background:#eef1ff;color:#253b5d;text-align:left}" +
  "figure{margin:12pt 0 16pt;page-break-inside:avoid;text-align:center}figure img{max-width:100%;max-height:220mm;border:1px solid var(--line);border-radius:5pt}figcaption{font-size:8.5pt;color:var(--muted);margin-top:3pt}" +
  "h1:first-of-type{margin-top:14pt}.cover{padding:32mm 0 10mm;page-break-after:always}.cover:before{content:'NORMAFLOW';display:block;color:var(--blue);font-size:11pt;font-weight:700;letter-spacing:2pt;margin-bottom:18pt}" +
  "</style></head><body><div class=\"cover\">" + body + "</div></body></html>";

await fs.writeFile(htmlPath, documentHtml, "utf8");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
await page.goto("file://" + htmlPath, { waitUntil: "load" });
await page.pdf({
  path: pdfPath,
  format: "A4",
  printBackground: true,
  margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
});
await browser.close();
console.log(pdfPath);
