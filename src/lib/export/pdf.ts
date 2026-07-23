import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * Generador PDF corporativo compartido (pdf-lib).
 *
 * Mantiene una composición A4 estable para informes tabulares:
 * - encabezado de marca repetido en todas las páginas;
 * - resumen visual en la portada;
 * - tabla con encabezado contrastado, zebra, líneas y filas variables;
 * - pie de página con fecha, confidencialidad y numeración.
 */

export type PdfColumn<T> = {
  key: keyof T & string;
  label: string;
  /** Ancho relativo (se normaliza sobre el ancho útil). */
  width: number;
  align?: "left" | "right";
  /** Color RGB 0-1 opcional por celda. */
  color?: (row: T) => [number, number, number] | null;
};

export type TablePdfInput<T> = {
  orgName: string;
  title: string;
  subtitle?: string;
  /** Líneas de resumen bajo el título (solo primera página). */
  summary?: string[];
  columns: PdfColumn<T>[];
  rows: T[];
  footerNote?: string;
  generatedAt?: Date;
  logoUrl?: string | null;
  generatedBy?: string | null;
  filters?: string[];
};

const PAGE = { width: 595.28, height: 841.89 }; // A4
const MARGIN = { top: 70, bottom: 60, left: 44, right: 44 };
const BRAND = rgb(0.32, 0.4, 0.96);
const BRAND_DARK = rgb(0.12, 0.17, 0.31);
const BRAND_PALE = rgb(0.95, 0.96, 1);
const INK = rgb(0.08, 0.13, 0.2);
const MUTED = rgb(0.4, 0.46, 0.55);
const LINE = rgb(0.86, 0.89, 0.94);
const ZEBRA = rgb(0.975, 0.98, 0.99);
const WHITE = rgb(1, 1, 1);

/** pdf-lib lanza si un carácter no existe en WinAnsi; normalizamos a texto estable. */
function sanitizeWinAnsi(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF€•]/g, "?");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const clean = sanitizeWinAnsi(text ?? "");
  if (!clean) return [""];

  const lines: string[] = [];
  for (const paragraph of clean.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);

      // Palabra más larga que la columna: cortar por caracteres.
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        let chunk = "";
        for (const char of word) {
          if (chunk && font.widthOfTextAtSize(chunk + char, size) > maxWidth) {
            lines.push(chunk);
            chunk = char;
          } else {
            chunk += char;
          }
        }
        current = chunk;
      } else {
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}

function drawRightText(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color: ReturnType<typeof rgb>) {
  page.drawText(text, { x: x - font.widthOfTextAtSize(text, size), y, size, font, color });
}

export async function buildTablePdf<T>(input: TablePdfInput<T>): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let logo: Awaited<ReturnType<typeof doc.embedPng>> | Awaited<ReturnType<typeof doc.embedJpg>> | null = null;
  if (input.logoUrl) {
    try {
      const response = await fetch(input.logoUrl, { cache: "no-store" });
      if (response.ok) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        const mime = response.headers.get("content-type") ?? "";
        logo = mime.includes("png") ? await doc.embedPng(bytes) : mime.includes("jpeg") || mime.includes("jpg") ? await doc.embedJpg(bytes) : null;
      }
    } catch {
      // A broken/expired logo must never prevent a compliance report export.
    }
  }

  const usableWidth = PAGE.width - MARGIN.left - MARGIN.right;
  const totalWeight = Math.max(input.columns.reduce((sum, col) => sum + col.width, 0), 1);
  const colWidths = input.columns.map((col) => (col.width / totalWeight) * usableWidth);
  const generatedAt = input.generatedAt ?? new Date();
  const dateStr = generatedAt.toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });

  const BODY_SIZE = 8.7;
  const HEADER_SIZE = 7.4;
  const LINE_HEIGHT = 11.2;
  const CELL_PAD = 7;
  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;

  function drawTableHeader(cursor: number) {
    page.drawRectangle({
      x: MARGIN.left,
      y: cursor - 18,
      width: usableWidth,
      height: 24,
      color: BRAND_DARK,
    });

    let x = MARGIN.left;
    input.columns.forEach((col, index) => {
      const label = sanitizeWinAnsi(col.label.toUpperCase());
      const tx = col.align === "right"
        ? x + colWidths[index] - CELL_PAD - bold.widthOfTextAtSize(label, HEADER_SIZE)
        : x + CELL_PAD;
      page.drawText(label, { x: tx, y: cursor - 9, size: HEADER_SIZE, font: bold, color: WHITE });
      x += colWidths[index];
    });
    return cursor - 28;
  }

  function drawPageHeader(first: boolean) {
    page = doc.addPage([PAGE.width, PAGE.height]);
    pages.push(page);

    // Accent bar and compact brand line.
    page.drawRectangle({ x: 0, y: PAGE.height - 8, width: PAGE.width, height: 8, color: BRAND });
    const top = PAGE.height - 32;
    if (logo) {
      const scale = Math.min(26 / logo.height, 34 / logo.width);
      page.drawImage(logo, { x: MARGIN.left, y: top - 8, width: logo.width * scale, height: logo.height * scale });
    }
    page.drawText("NORMAFLOW", { x: MARGIN.left + (logo ? 42 : 0), y: top, size: 8, font: bold, color: BRAND });
    drawRightText(page, sanitizeWinAnsi(input.orgName), PAGE.width - MARGIN.right, top, font, 8, MUTED);

    let cursor = PAGE.height - MARGIN.top;
    const titleLines = wrapText(input.title, bold, 16, usableWidth);
    titleLines.forEach((line) => {
      page.drawText(line, { x: MARGIN.left, y: cursor, size: 16, font: bold, color: INK });
      cursor -= 19;
    });

    const subtitle = [input.subtitle, `Generado el ${dateStr}`, input.generatedBy ? `Usuario: ${input.generatedBy}` : null, input.filters?.length ? `Filtros: ${input.filters.join(" · ")}` : null].filter(Boolean).join("  |  ");
    if (subtitle) {
      const subtitleLines = wrapText(subtitle, font, 8.5, usableWidth);
      subtitleLines.forEach((line) => {
        page.drawText(line, { x: MARGIN.left, y: cursor - 1, size: 8.5, font, color: MUTED });
        cursor -= 12;
      });
    }

    cursor -= 7;
    page.drawLine({
      start: { x: MARGIN.left, y: cursor },
      end: { x: PAGE.width - MARGIN.right, y: cursor },
      thickness: 1,
      color: LINE,
    });
    cursor -= 18;

    if (first && input.summary?.length) {
      const summaryLines = input.summary.flatMap((line) => wrapText(line, font, 8.6, usableWidth - 24));
      const summaryHeight = Math.max(40, summaryLines.length * 12 + 25);
      page.drawRectangle({
        x: MARGIN.left,
        y: cursor - summaryHeight + 5,
        width: usableWidth,
        height: summaryHeight,
        color: BRAND_PALE,
        borderColor: rgb(0.85, 0.88, 0.98),
        borderWidth: 0.8,
      });
      page.drawText("RESUMEN EJECUTIVO", { x: MARGIN.left + 12, y: cursor - 10, size: 7.2, font: bold, color: BRAND });
      summaryLines.forEach((line, index) => {
        page.drawText(line, { x: MARGIN.left + 12, y: cursor - 25 - index * 12, size: 8.6, font: index === 0 ? bold : font, color: INK });
      });
      cursor -= summaryHeight + 14;
    }

    y = drawTableHeader(cursor);
  }

  drawPageHeader(true);

  input.rows.forEach((row, rowIndex) => {
    const cells = input.columns.map((col, index) => {
      const raw = row[col.key];
      const text = raw == null ? "" : String(raw);
      return wrapText(text, font, BODY_SIZE, Math.max(colWidths[index] - CELL_PAD * 2, 8));
    });
    const rowLines = Math.max(...cells.map((cell) => cell.length), 1);
    const rowHeight = Math.max(27, rowLines * LINE_HEIGHT + 12);

    if (y - rowHeight < MARGIN.bottom) drawPageHeader(false);

    const rowBottom = y - rowHeight;
    if (rowIndex % 2 === 1) {
      page.drawRectangle({ x: MARGIN.left, y: rowBottom, width: usableWidth, height: rowHeight, color: ZEBRA });
    }
    page.drawLine({
      start: { x: MARGIN.left, y: rowBottom },
      end: { x: PAGE.width - MARGIN.right, y: rowBottom },
      thickness: 0.55,
      color: LINE,
    });

    let x = MARGIN.left;
    input.columns.forEach((col, index) => {
      const colorTuple = col.color?.(row) ?? null;
      const color = colorTuple ? rgb(colorTuple[0], colorTuple[1], colorTuple[2]) : INK;
      cells[index].forEach((line, lineIndex) => {
        const tx = col.align === "right"
          ? x + colWidths[index] - CELL_PAD - font.widthOfTextAtSize(line, BODY_SIZE)
          : x + CELL_PAD;
        page.drawText(line, { x: tx, y: y - 16 - lineIndex * LINE_HEIGHT, size: BODY_SIZE, font, color });
      });
      x += colWidths[index];
    });
    y = rowBottom;
  });

  if (input.rows.length === 0) {
    page.drawRectangle({ x: MARGIN.left, y: y - 34, width: usableWidth, height: 34, color: ZEBRA });
    page.drawText("No hay registros para los filtros seleccionados.", { x: MARGIN.left + CELL_PAD, y: y - 21, size: BODY_SIZE, font, color: MUTED });
  }

  const footer = sanitizeWinAnsi(input.footerNote ?? "NormaFlow - Documento generado automáticamente - evidencia del sistema de gestión.");
  pages.forEach((currentPage, index) => {
    currentPage.drawLine({
      start: { x: MARGIN.left, y: 45 },
      end: { x: PAGE.width - MARGIN.right, y: 45 },
      thickness: 0.7,
      color: LINE,
    });
    currentPage.drawText(footer, { x: MARGIN.left, y: 31, size: 7, font, color: MUTED });
    drawRightText(currentPage, `Página ${index + 1} de ${pages.length}`, PAGE.width - MARGIN.right, 31, font, 7, MUTED);
  });

  return doc.save();
}
