import * as XLSX from "xlsx";
import type { SheetData, SheetTab } from "@/lib/content-types";
import { evaluateCell } from "@/lib/sheet-formula";

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function getDisplayValue(raw: string, rows: string[][]): string {
  if (raw.startsWith("=")) {
    return evaluateCell(raw, (r, c) => rows[r]?.[c] ?? "");
  }
  return raw;
}

function downloadBlob(content: BlobPart, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export a single sheet to CSV (display values) */
export function exportSheetToCsv(sheet: SheetTab, filename: string) {
  const rows = sheet.rows ?? [[""]];
  const lines = rows.map((row) =>
    row.map((cell) => escapeCsvField(getDisplayValue(cell, rows))).join(",")
  );
  const bom = "\uFEFF";
  downloadBlob(bom + lines.join("\n"), `${filename}.csv`, "text/csv;charset=utf-8");
}

/** Export entire workbook to Excel (.xlsx) with all sheets */
export function exportWorkbookToExcel(data: SheetData, filename: string) {
  const wb = XLSX.utils.book_new();

  for (const sheet of data.sheets) {
    const rows = sheet.rows ?? [[""]];
    const aoa = rows.map((row) =>
      row.map((cell) => {
        const display = getDisplayValue(cell, rows);
        const num = parseFloat(display.replace(/[¥%,]/g, ""));
        if (!isNaN(num) && display.trim() !== "" && !display.startsWith("#")) {
          return num;
        }
        return display;
      })
    );

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const safeName = sheet.name.replace(/[\\/?*[\]:]/g, "_").slice(0, 31) || "Sheet1";
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/** Export current sheet only to Excel */
export function exportSheetToExcel(sheet: SheetTab, filename: string) {
  exportWorkbookToExcel(
    { version: 1, sheets: [sheet], activeSheet: sheet.id },
    filename
  );
}
