import type { IWorkbookData, ICellData } from "@univerjs/core";
import { LocaleType } from "@univerjs/core";
import type { SheetData, SheetTab } from "@/lib/content-types";
import { generateId } from "@/lib/content-types";
import type { StoredMention } from "@/lib/content-mentions";

export const SHEET_DATA_VERSION = 2;

export interface UniverSheetData {
  version: typeof SHEET_DATA_VERSION;
  workbook: IWorkbookData;
  mentions?: StoredMention[];
}

export type SheetContent = SheetData | UniverSheetData | Record<string, unknown>;

function defaultWorksheet(id: string, name: string, rowCount = 100, columnCount = 26) {
  return {
    id,
    name,
    tabColor: "",
    hidden: 0 as const,
    freeze: { xSplit: 0, ySplit: 0, startRow: -1, startColumn: -1 },
    rowCount,
    columnCount,
    zoomRatio: 1,
    scrollTop: 0,
    scrollLeft: 0,
    defaultColumnWidth: 88,
    defaultRowHeight: 24,
    mergeData: [] as { startRow: number; endRow: number; startColumn: number; endColumn: number }[],
    cellData: {} as Record<number, Record<number, ICellData>>,
    rowData: {},
    columnData: {},
    showGridlines: 1 as const,
    rowHeader: { width: 46, hidden: 0 as const },
    columnHeader: { height: 20, hidden: 0 as const },
    rightToLeft: 0 as const,
  };
}

export function createDefaultWorkbook(name = "工作簿"): IWorkbookData {
  const sheetId = generateId("sheet");
  return {
    id: generateId("wb"),
    name,
    appVersion: "0.25.1",
    locale: LocaleType.ZH_CN,
    styles: {},
    sheetOrder: [sheetId],
    sheets: {
      [sheetId]: defaultWorksheet(sheetId, "Sheet1"),
    },
  };
}

function isLegacySheetData(content: SheetContent): content is SheetData {
  if (!content || typeof content !== "object") return false;
  const c = content as Record<string, unknown>;
  return Array.isArray(c.sheets) && typeof c.activeSheet === "string";
}

export function isUniverSheetData(content: SheetContent): content is UniverSheetData {
  if (!content || typeof content !== "object") return false;
  const c = content as Record<string, unknown>;
  return (
    c.version === SHEET_DATA_VERSION &&
    !!c.workbook &&
    typeof c.workbook === "object"
  );
}

function legacyTabToWorksheet(tab: SheetTab) {
  const rowCount = Math.max(tab.rows.length, 100);
  const columnCount = Math.max(
    ...tab.rows.map((r) => r.length),
    26
  );

  const cellData: Record<number, Record<number, ICellData>> = {};

  tab.rows.forEach((row, r) => {
    row.forEach((raw, c) => {
      if (!raw) return;
      if (!cellData[r]) cellData[r] = {};
      if (raw.startsWith("=")) {
        cellData[r][c] = { f: raw, v: raw };
      } else {
        cellData[r][c] = { v: raw };
      }
    });
  });

  const mergeData = (tab.mergedRegions ?? []).map((m) => ({
    startRow: m.startRow,
    endRow: m.endRow,
    startColumn: m.startCol,
    endColumn: m.endCol,
  }));

  const columnData: Record<number, { w: number }> = {};
  Object.entries(tab.colWidths ?? {}).forEach(([col, w]) => {
    columnData[Number(col)] = { w };
  });

  const rowData: Record<number, { h: number }> = {};
  Object.entries(tab.rowHeights ?? {}).forEach(([row, h]) => {
    rowData[Number(row)] = { h };
  });

  return {
    ...defaultWorksheet(tab.id, tab.name, rowCount, columnCount),
    cellData,
    mergeData,
    columnData,
    rowData,
  };
}

export function migrateLegacySheetData(legacy: SheetData): IWorkbookData {
  const sheetOrder = legacy.sheets.map((s) => s.id);
  const sheets: IWorkbookData["sheets"] = {};

  legacy.sheets.forEach((tab) => {
    sheets[tab.id] = legacyTabToWorksheet(tab);
  });

  return {
    id: generateId("wb"),
    name: "工作簿",
    appVersion: "0.25.1",
    locale: LocaleType.ZH_CN,
    styles: {},
    sheetOrder,
    sheets,
  };
}

/** Normalize any stored sheet content into Univer workbook data. */
export function normalizeToWorkbook(content: SheetContent | null | undefined): IWorkbookData {
  if (!content) return createDefaultWorkbook();

  if (isUniverSheetData(content)) {
    return content.workbook;
  }

  if (isLegacySheetData(content)) {
    return migrateLegacySheetData(content);
  }

  const maybeWorkbook = content as Partial<IWorkbookData>;
  if (maybeWorkbook.sheetOrder && maybeWorkbook.sheets) {
    return maybeWorkbook as IWorkbookData;
  }

  return createDefaultWorkbook();
}

export function wrapWorkbook(
  workbook: IWorkbookData,
  mentions?: StoredMention[]
): UniverSheetData {
  const data: UniverSheetData = { version: SHEET_DATA_VERSION, workbook };
  if (mentions && mentions.length > 0) data.mentions = mentions;
  return data;
}

export function isSameWorkbook(a: IWorkbookData, b: IWorkbookData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** 统一单元格字段，避免 Univer 运行时附加字段导致整表假 diff */
export function normalizeCellForSave(
  cell: ICellData | undefined | null
): ICellData | null {
  if (!cell || typeof cell !== "object") return null;

  const out: ICellData = {};
  const formula = cell.f;
  const value = cell.v;

  if (formula != null && String(formula) !== "") {
    out.f = String(formula);
    if (value != null && value !== "") out.v = value;
  } else if (value != null && value !== "") {
    out.v = value;
  }

  if (cell.s != null && cell.s !== "") out.s = cell.s;
  if (cell.t != null) out.t = cell.t;
  if (cell.p != null) out.p = cell.p;

  return Object.keys(out).length > 0 ? out : null;
}

/** 保存前压缩 workbook JSON，去掉空单元格与冗余范围，降低 413 风险 */
export function compactSheetPayloadForSave(
  data: UniverSheetData | SheetContent
): UniverSheetData | SheetContent {
  if (!isUniverSheetData(data)) return data;

  const workbook = structuredClone(data.workbook);
  delete (workbook as { resources?: unknown }).resources;

  for (const sheetId of workbook.sheetOrder ?? []) {
    const sheet = workbook.sheets?.[sheetId];
    if (!sheet) continue;

    delete (sheet as { resources?: unknown }).resources;

    let maxRow = 0;
    let maxCol = 0;
    const nextCellData: typeof sheet.cellData = {};

    for (const [rowKey, row] of Object.entries(sheet.cellData ?? {})) {
      const rowNum = Number(rowKey);
      if (!row || typeof row !== "object") continue;
      const nextRow: Record<number, ICellData> = {};
      for (const [colKey, cell] of Object.entries(row)) {
        const colNum = Number(colKey);
        const normalized = normalizeCellForSave(cell as ICellData);
        if (!normalized) continue;
        nextRow[colNum] = normalized;
        maxRow = Math.max(maxRow, rowNum);
        maxCol = Math.max(maxCol, colNum);
      }
      if (Object.keys(nextRow).length > 0) {
        nextCellData[rowNum] = nextRow;
      }
    }

    sheet.cellData = nextCellData;
    sheet.rowCount = Math.max(maxRow + 20, 50);
    sheet.columnCount = Math.max(maxCol + 5, 20);
  }

  const compact: UniverSheetData = {
    version: SHEET_DATA_VERSION,
    workbook,
  };
  if (data.mentions?.length) compact.mentions = data.mentions;
  return compact;
}
