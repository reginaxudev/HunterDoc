import { cellAddress, colLabel } from "@/lib/sheet-formula";

export type NumberFormat = "general" | "number" | "currency" | "percent";
export type HAlign = "left" | "center" | "right";
export type VAlign = "top" | "middle" | "bottom";

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontSize?: number;
  textColor?: string;
  backgroundColor?: string;
  align?: HAlign;
  valign?: VAlign;
  numberFormat?: NumberFormat;
  decimalPlaces?: number;
  borderTop?: boolean;
  borderRight?: boolean;
  borderBottom?: boolean;
  borderLeft?: boolean;
}

export interface MergedRegion {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface SheetViewState {
  freezeRows?: number;
  freezeCols?: number;
  filterEnabled?: boolean;
  columnFilters?: Record<number, string[]>;
  sortCol?: number | null;
  sortDir?: "asc" | "desc" | null;
}

export function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export function parseCellKey(key: string): { row: number; col: number } {
  const [r, c] = key.split(":").map(Number);
  return { row: r, col: c };
}

export function getCellStyle(
  styles: Record<string, CellStyle> | undefined,
  row: number,
  col: number
): CellStyle | undefined {
  return styles?.[cellKey(row, col)];
}

export function applyStyleToRange(
  styles: Record<string, CellStyle>,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  patch: Partial<CellStyle>
): Record<string, CellStyle> {
  const next = { ...styles };
  const r0 = Math.min(startRow, endRow);
  const r1 = Math.max(startRow, endRow);
  const c0 = Math.min(startCol, endCol);
  const c1 = Math.max(startCol, endCol);

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const key = cellKey(r, c);
      const merged: CellStyle = { ...next[key] };
      for (const [k, v] of Object.entries(patch) as [keyof CellStyle, CellStyle[keyof CellStyle]][]) {
        if (v === undefined) {
          delete merged[k];
        } else {
          merged[k] = v as never;
        }
      }
      if (Object.keys(merged).length === 0) {
        delete next[key];
      } else {
        next[key] = merged;
      }
    }
  }
  return next;
}

export function clearStyleInRange(
  styles: Record<string, CellStyle>,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): Record<string, CellStyle> {
  const next = { ...styles };
  const r0 = Math.min(startRow, endRow);
  const r1 = Math.max(startRow, endRow);
  const c0 = Math.min(startCol, endCol);
  const c1 = Math.max(startCol, endCol);

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      delete next[cellKey(r, c)];
    }
  }
  return next;
}

export function formatRangeLabel(
  startRow: number,
  startCol: number,
  endRow?: number,
  endCol?: number
): string {
  if (endRow === undefined || endCol === undefined) {
    return cellAddress(startRow, startCol);
  }
  if (startRow === endRow && startCol === endCol) {
    return cellAddress(startRow, startCol);
  }
  return `${cellAddress(startRow, startCol)}:${cellAddress(endRow, endCol)}`;
}

export function formatNumberDisplay(raw: string, style?: CellStyle): string {
  if (!raw || raw.startsWith("=")) return raw;
  const n = parseFloat(raw.replace(/,/g, ""));
  if (isNaN(n)) return raw;

  const fmt = style?.numberFormat ?? "general";
  const decimals = style?.decimalPlaces ?? (fmt === "general" ? undefined : 2);

  switch (fmt) {
    case "currency":
      return `¥${n.toLocaleString("zh-CN", {
        minimumFractionDigits: decimals ?? 2,
        maximumFractionDigits: decimals ?? 2,
      })}`;
    case "percent":
      return `${(n * 100).toLocaleString("zh-CN", {
        minimumFractionDigits: decimals ?? 0,
        maximumFractionDigits: decimals ?? 2,
      })}%`;
    case "number":
      return n.toLocaleString("zh-CN", {
        minimumFractionDigits: decimals ?? 2,
        maximumFractionDigits: decimals ?? 2,
      });
    default:
      return raw;
  }
}

export function findMergeAt(
  regions: MergedRegion[] | undefined,
  row: number,
  col: number
): MergedRegion | null {
  if (!regions) return null;
  return (
    regions.find(
      (m) =>
        row >= m.startRow &&
        row <= m.endRow &&
        col >= m.startCol &&
        col <= m.endCol
    ) ?? null
  );
}

export function isMergeHidden(
  regions: MergedRegion[] | undefined,
  row: number,
  col: number
): boolean {
  const merge = findMergeAt(regions, row, col);
  if (!merge) return false;
  return !(merge.startRow === row && merge.startCol === col);
}

export function createMergeRegion(
  regions: MergedRegion[] | undefined,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): MergedRegion[] {
  const r0 = Math.min(startRow, endRow);
  const r1 = Math.max(startRow, endRow);
  const c0 = Math.min(startCol, endCol);
  const c1 = Math.max(startCol, endCol);

  if (r0 === r1 && c0 === c1) return regions ?? [];

  const filtered = (regions ?? []).filter((m) => {
    const overlap =
      !(m.endRow < r0 || m.startRow > r1 || m.endCol < c0 || m.startCol > c1);
    return !overlap;
  });

  return [...filtered, { startRow: r0, startCol: c0, endRow: r1, endCol: c1 }];
}

export function unmergeAt(
  regions: MergedRegion[] | undefined,
  row: number,
  col: number
): MergedRegion[] {
  const merge = findMergeAt(regions, row, col);
  if (!merge) return regions ?? [];
  return (regions ?? []).filter((m) => m !== merge);
}

export function getColumnUniqueValues(
  rows: string[][],
  col: number,
  getDisplay: (row: number, col: number) => string
): string[] {
  const set = new Set<string>();
  rows.forEach((_, ri) => {
    const v = getDisplay(ri, col).trim();
    set.add(v || "(空白)");
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function rowPassesFilters(
  row: number,
  rows: string[][],
  filters: Record<number, string[]> | undefined,
  getDisplay: (row: number, col: number) => string
): boolean {
  if (!filters) return true;
  for (const [colStr, allowed] of Object.entries(filters)) {
    if (!allowed || allowed.length === 0) continue;
    const col = Number(colStr);
    const val = getDisplay(row, col).trim() || "(空白)";
    if (!allowed.includes(val)) return false;
  }
  return true;
}

export interface SortIndices {
  originalIndex: number;
  sortKey: string;
}

export function sortRowIndices(
  rows: string[][],
  col: number,
  dir: "asc" | "desc",
  getDisplay: (row: number, col: number) => string
): number[] {
  const indices = rows.map((_, i) => i);
  indices.sort((a, b) => {
    const va = getDisplay(a, col);
    const vb = getDisplay(b, col);
    const na = parseFloat(va.replace(/[¥%,]/g, ""));
    const nb = parseFloat(vb.replace(/[¥%,]/g, ""));
    let cmp: number;
    if (!isNaN(na) && !isNaN(nb)) {
      cmp = na - nb;
    } else {
      cmp = va.localeCompare(vb, "zh-CN");
    }
    return dir === "asc" ? cmp : -cmp;
  });
  return indices;
}

export function reorderRows(rows: string[][], order: number[]): string[][] {
  return order.map((i) => [...rows[i]]);
}

export function reorderStyles(
  styles: Record<string, CellStyle> | undefined,
  order: number[]
): Record<string, CellStyle> {
  if (!styles) return {};
  const inv = new Map<number, number>();
  order.forEach((orig, newIdx) => inv.set(orig, newIdx));

  const next: Record<string, CellStyle> = {};
  for (const [key, style] of Object.entries(styles)) {
    const { row, col } = parseCellKey(key);
    const newRow = inv.get(row);
    if (newRow !== undefined) {
      next[cellKey(newRow, col)] = style;
    }
  }
  return next;
}

export function remapMergedRegions(
  regions: MergedRegion[] | undefined,
  order: number[]
): MergedRegion[] {
  if (!regions) return [];
  const inv = new Map<number, number>();
  order.forEach((orig, newIdx) => inv.set(orig, newIdx));
  return regions.map((m) => ({
    startRow: inv.get(m.startRow) ?? m.startRow,
    endRow: inv.get(m.endRow) ?? m.endRow,
    startCol: m.startCol,
    endCol: m.endCol,
  }));
}

export const TEXT_COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#cccccc", "#ffffff",
  "#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff",
  "#4a86e8", "#0000ff", "#9900ff", "#ff00ff",
];

export const FILL_COLORS = [
  "#ffffff", "#f3f3f3", "#fce5cd", "#fff2cc", "#d9ead3", "#cfe2f3",
  "#d9d2e9", "#ead1dc", "#ea9999", "#f9cb9c", "#ffe599", "#b6d7a8",
  "#9fc5e8", "#b4a7d6", "#d5a6bd", "#e06666",
];

export const FONT_SIZES = [9, 10, 11, 12, 14, 16, 18, 24];

export function cellStyleToCss(style?: CellStyle): Record<string, string | undefined> {
  return cellStyleToCssPlain(style);
}

type CSSProperties = Record<string, string | undefined>;

export function cellStyleToCssPlain(style?: CellStyle): CSSProperties {
  if (!style) return {};
  const deco = [style.underline ? "underline" : "", style.strikethrough ? "line-through" : ""]
    .filter(Boolean)
    .join(" ");
  return {
    fontWeight: style.bold ? "bold" : undefined,
    fontStyle: style.italic ? "italic" : undefined,
    textDecoration: deco || undefined,
    fontSize: style.fontSize ? `${style.fontSize}px` : undefined,
    color: style.textColor,
    backgroundColor: style.backgroundColor,
    textAlign: style.align,
    verticalAlign: style.valign,
    borderTop: style.borderTop ? "1px solid #333" : undefined,
    borderRight: style.borderRight ? "1px solid #333" : undefined,
    borderBottom: style.borderBottom ? "1px solid #333" : undefined,
    borderLeft: style.borderLeft ? "1px solid #333" : undefined,
  };
}
