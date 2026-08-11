import { cellKey, parseCellKey } from "@/lib/sheet-cell-style";
import { parseCellRef, colLabel } from "@/lib/sheet-formula";

export type CellMetaType =
  | "checkbox"
  | "date"
  | "dateReminder"
  | "image"
  | "link"
  | "attachment"
  | "note"
  | "sparkline"
  | "chart"
  | "pivot";

export interface CellMeta {
  type: CellMetaType;
  link?: { url: string; label?: string };
  image?: { url: string; alt?: string };
  attachment?: { name: string; url: string; size?: number };
  note?: string;
  reminder?: { message?: string };
  sparkline?: { sourceRange: string; color?: string };
  chart?: { sourceRange: string; chartType: "bar" | "line" | "pie"; title?: string };
  pivot?: {
    sourceRange: string;
    rowFieldCol: number;
    valueFieldCol: number;
    agg: "sum" | "count" | "avg";
  };
}

export type InsertAction =
  | "checkbox"
  | "dropdown"
  | "date"
  | "dateReminder"
  | "imageUpload"
  | "imageUrl"
  | "chart"
  | "sparkline"
  | "pivot"
  | "link"
  | "attachment"
  | "note"
  | "row"
  | "col";

export function getCellMeta(
  meta: Record<string, CellMeta> | undefined,
  row: number,
  col: number
): CellMeta | undefined {
  return meta?.[cellKey(row, col)];
}

export function setMetaForRange(
  meta: Record<string, CellMeta>,
  r0: number,
  c0: number,
  r1: number,
  c1: number,
  value: CellMeta
): Record<string, CellMeta> {
  const next = { ...meta };
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      next[cellKey(r, c)] = { ...value };
    }
  }
  return next;
}

export function clearMetaInRange(
  meta: Record<string, CellMeta>,
  r0: number,
  c0: number,
  r1: number,
  c1: number
): Record<string, CellMeta> {
  const next = { ...meta };
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      delete next[cellKey(r, c)];
    }
  }
  return next;
}

export function isCheckboxTrue(value: string): boolean {
  return value === "TRUE" || value === "true" || value === "1" || value === "是";
}

export function toggleCheckboxValue(value: string): string {
  return isCheckboxTrue(value) ? "FALSE" : "TRUE";
}

/** Collect numeric values from a range string like A1:A5 */
export function collectRangeNumbers(
  range: string,
  getCell: (row: number, col: number) => string
): number[] {
  const parts = range.split(":");
  const start = parseCellRef(parts[0]);
  const end = parts[1] ? parseCellRef(parts[1]) : start;
  if (!start || !end) return [];

  const r0 = Math.min(start.row, end.row);
  const r1 = Math.max(start.row, end.row);
  const c0 = Math.min(start.col, end.col);
  const c1 = Math.max(start.col, end.col);

  const nums: number[] = [];
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const n = parseFloat(getCell(r, c).replace(/[¥%,]/g, ""));
      if (!isNaN(n)) nums.push(n);
    }
  }
  return nums;
}

export function defaultSparklineRange(row: number, col: number): string {
  const c0 = Math.max(0, col - 4);
  if (c0 >= col) return `${colLabel(col)}${row + 1}`;
  return `${colLabel(c0)}${row + 1}:${colLabel(Math.max(c0, col - 1))}${row + 1}`;
}

export function defaultChartRange(row: number, col: number): string {
  const r0 = Math.max(0, row - 4);
  return `${colLabel(col)}${r0 + 1}:${colLabel(col)}${row + 1}`;
}

export function formatDisplayDate(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function isDatePast(value: string): boolean {
  const d = new Date(value);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export function isDateSoon(value: string, days = 3): boolean {
  const d = new Date(value);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = (d.getTime() - now.getTime()) / (86400000);
  return diff >= 0 && diff <= days;
}

export function metaKeysInSheet(meta: Record<string, CellMeta> | undefined): string[] {
  return meta ? Object.keys(meta) : [];
}

export { cellKey, parseCellKey };
