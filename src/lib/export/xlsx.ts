import ExcelJS from "exceljs";

/**
 * Generador XLSX real (exceljs) — sustituye al antiguo SpreadsheetML (.xls).
 * Encabezado con estilo, autofiltro, anchos de columna automáticos.
 */

type Cell = string | number | boolean | null;
type Row = Record<string, Cell>;

export async function buildXlsx(sheetName: string, rows: Row[], title?: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NormaFlow";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName.slice(0, 31) || "Informe");
  const headers = rows.length ? Object.keys(rows[0]) : ["resultado"];

  let headerRowIndex = 1;
  if (title) {
    const titleRow = sheet.addRow([title]);
    titleRow.font = { bold: true, size: 13, color: { argb: "FF1F2937" } };
    sheet.mergeCells(1, 1, 1, Math.max(headers.length, 1));
    sheet.addRow([]);
    headerRowIndex = 3;
  }

  const headerRow = sheet.addRow(headers.map((h) => h.replaceAll("_", " ").toUpperCase()));
  headerRow.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5266F6" } };
    cell.alignment = { vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: "FFD1D5DB" } } };
  });

  for (const row of rows) {
    sheet.addRow(headers.map((key) => row[key] ?? ""));
  }

  // Anchos automáticos acotados
  headers.forEach((key, i) => {
    const maxContent = Math.max(
      key.length,
      ...rows.slice(0, 200).map((row) => String(row[key] ?? "").length)
    );
    sheet.getColumn(i + 1).width = Math.min(Math.max(maxContent + 3, 10), 48);
  });

  if (rows.length) {
    sheet.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: headerRowIndex, column: headers.length },
    };
    sheet.views = [{ state: "frozen", ySplit: headerRowIndex }];
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
