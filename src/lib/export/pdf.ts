import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * Generador PDF corporativo compartido (pdf-lib).
 *
 * - A4 multipágina con encabezado, pie y numeración.
 * - WinAnsi (Latin-1): acentos y ñ se renderizan correctamente.
 * - Texto con ajuste de línea por columna; filas de altura variable.
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
};

const PAGE = { width: 595.28, height: 841.89 }; // A4
const MARGIN = { top: 64, bottom: 56, left: 42, right: 42 };
const BRAND = rgb(0.32, 0.4, 0.96);
const INK = rgb(0.08, 0.13, 0.2);
const MUTED = rgb(0.42, 0.47, 0.55);
const LINE = rgb(0.88, 0.9, 0.94);
const ZEBRA = rgb(0.965, 0.973, 0.985);

/** pdf-lib lanza si un carácter no existe en WinAnsi; sustituimos los raros. */
function sanitizeWinAnsi(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/–/g, "-")
    .replace(/—/g, "—")
    .replace(/…/g, "...")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF€•—]/g, "?");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const clean = sanitizeWinAnsi(text ?? "");
  if (!clean) return [""];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
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
        if (font.widthOfTextAtSize(chunk + char, size) > maxWidth) {
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
  return lines.length ? lines : [""];
}

export async function buildTablePdf<T>(input: TablePdfInput<T>): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const usableWidth = PAGE.width - MARGIN.left - MARGIN.right;
  const totalWeight = input.columns.reduce((sum, col) => sum + col.width, 0);
  const colWidths = input.columns.map((col) => (col.width / totalWeight) * usableWidth);

  const BODY_SIZE = 8.5;
  const HEADER_SIZE = 8;
  const LINE_HEIGHT = 11;
  const CELL_PAD = 4;

  const generatedAt = input.generatedAt ?? new Date();
  const dateStr = generatedAt.toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });

  let page: PDFPage;
  let y = 0;
  const pages: PDFPage[] = [];

  function drawPageHeader(first: boolean) {
    page = doc.addPage([PAGE.width, PAGE.height]);
    pages.push(page);
    let cursor = PAGE.height - MARGIN.top + 20;

    page.drawText(sanitizeWinAnsi(input.orgName), { x: MARGIN.left, y: cursor, size: 13, font: bold, color: INK });
    cursor -= 17;
    page.drawText(sanitizeWinAnsi(input.title), { x: MARGIN.left, y: cursor, size: 11, font: bold, color: BRAND });
    cursor -= 13;
    const subtitleParts = [input.subtitle, `Generado: ${dateStr}`].filter(Boolean);
    page.drawText(sanitizeWinAnsi(subtitleParts.join("  ·  ")), { x: MARGIN.left, y: cursor, size: 8, font, color: MUTED });
    cursor -= 8;
    page.drawLine({
      start: { x: MARGIN.left, y: cursor },
      end: { x: PAGE.width - MARGIN.right, y: cursor },
      thickness: 0.8,
      color: LINE,
    });
    cursor -= 14;

    if (first && input.summary?.length) {
      for (const line of input.summary) {
        page.drawText(sanitizeWinAnsi(line), { x: MARGIN.left, y: cursor, size: 9, font, color: INK });
        cursor -= 13;
      }
      cursor -= 4;
    }

    // Encabezado de tabla
    let x = MARGIN.left;
    input.columns.forEach((col, i) => {
      const text = sanitizeWinAnsi(col.label.toUpperCase());
      const tx = col.align === "right"
        ? x + colWidths[i] - CELL_PAD - bold.widthOfTextAtSize(text, HEADER_SIZE)
        : x + CELL_PAD;
      page.drawText(text, { x: tx, y: cursor, size: HEADER_SIZE, font: bold, color: MUTED });
      x += colWidths[i];
    });
    cursor -= 5;
    page.drawLine({
      start: { x: MARGIN.left, y: cursor },
      end: { x: PAGE.width - MARGIN.right, y: cursor },
      thickness: 0.8,
      color: LINE,
    });
    y = cursor - 6;
  }

  drawPageHeader(true);

  input.rows.forEach((row, rowIndex) => {
    // Preparar celdas con wrapping para conocer la altura de la fila.
    const cells = input.columns.map((col, i) => {
      const raw = row[col.key];
      const text = raw == null ? "" : String(raw);
      return wrapText(text, font, BODY_SIZE, colWidths[i] - CELL_PAD * 2);
    });
    const rowLines = Math.max(...cells.map((c) => c.length));
    const rowHeight = rowLines * LINE_HEIGHT + 4;

    if (y - rowHeight < MARGIN.bottom) {
      drawPageHeader(false);
    }

    if (rowIndex % 2 === 1) {
      page.drawRectangle({
        x: MARGIN.left,
        y: y - rowHeight + LINE_HEIGHT - 2,
        width: usableWidth,
        height: rowHeight,
        color: ZEBRA,
      });
    }

    let x = MARGIN.left;
    input.columns.forEach((col, i) => {
      const colorTuple = col.color?.(row) ?? null;
      const color = colorTuple ? rgb(colorTuple[0], colorTuple[1], colorTuple[2]) : INK;
      cells[i].forEach((line, lineIndex) => {
        const tx = col.align === "right"
          ? x + colWidths[i] - CELL_PAD - font.widthOfTextAtSize(line, BODY_SIZE)
          : x + CELL_PAD;
        page.drawText(line, { x: tx, y: y - lineIndex * LINE_HEIGHT, size: BODY_SIZE, font, color });
      });
      x += colWidths[i];
    });

    y -= rowHeight;
  });

  // Pie de página con numeración
  const footer = sanitizeWinAnsi(
    input.footerNote ?? "NormaFlow · Documento generado automáticamente — válido como evidencia del sistema de gestión."
  );
  pages.forEach((p, index) => {
    p.drawText(footer, { x: MARGIN.left, y: 32, size: 7, font, color: MUTED });
    const pageLabel = `Página ${index + 1} de ${pages.length}`;
    p.drawText(pageLabel, {
      x: PAGE.width - MARGIN.right - font.widthOfTextAtSize(pageLabel, 7),
      y: 32,
      size: 7,
      font,
      color: MUTED,
    });
  });

  return doc.save();
}
