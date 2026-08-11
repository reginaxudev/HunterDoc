import { parseCellRef, colLabel, colToIndex } from "@/lib/sheet-formula";

export interface ParsedRef {
  text: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

const REF_COLORS = [
  "#3b82f6",
  "#16a34a",
  "#dc2626",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#be185d",
  "#65a30d",
];

/** Extract cell/range references from a formula string */
export function extractFormulaRefs(formula: string): ParsedRef[] {
  if (!formula.startsWith("=")) return [];

  const body = formula.slice(1);
  const refs: ParsedRef[] = [];
  const seen = new Set<string>();

  const pattern = /(\$?[A-Z]+\$?\d+)(?::(\$?[A-Z]+\$?\d+))?/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(body)) !== null) {
    const full = match[0].toUpperCase().replace(/\$/g, "");
    if (seen.has(full)) continue;
    seen.add(full);

    const start = parseCellRef(match[1].replace(/\$/g, ""));
    if (!start) continue;

    if (match[2]) {
      const end = parseCellRef(match[2].replace(/\$/g, ""));
      if (!end) continue;
      refs.push({
        text: full,
        startRow: Math.min(start.row, end.row),
        startCol: Math.min(start.col, end.col),
        endRow: Math.max(start.row, end.row),
        endCol: Math.max(start.col, end.col),
      });
    } else {
      refs.push({
        text: full,
        startRow: start.row,
        startCol: start.col,
        endRow: start.row,
        endCol: start.col,
      });
    }
  }

  return refs;
}

export function getRefHighlightColor(index: number): string {
  return REF_COLORS[index % REF_COLORS.length];
}

export function getCellRefHighlight(
  row: number,
  col: number,
  refs: ParsedRef[]
): { color: string; index: number } | null {
  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i];
    if (
      row >= ref.startRow &&
      row <= ref.endRow &&
      col >= ref.startCol &&
      col <= ref.endCol
    ) {
      return { color: getRefHighlightColor(i), index: i };
    }
  }
  return null;
}

export function adjustFormulaRefs(
  formula: string,
  dRow: number,
  dCol: number
): string {
  if (!formula.startsWith("=")) return formula;

  return formula.replace(
    /(\$?)([A-Z]+)(\$?)(\d+)/gi,
    (_match, colAbs: string, col: string, rowAbs: string, row: string) => {
      let c = colToIndex(col.toUpperCase());
      let r = parseInt(row, 10) - 1;
      if (!colAbs) c += dCol;
      if (!rowAbs) r += dRow;
      if (c < 0 || r < 0) return "#REF!";
      return `${colAbs}${colLabel(c)}${rowAbs}${r + 1}`;
    }
  );
}

function detectNumericSeries(values: string[]): { step: number; nums: number[] } | null {
  const nums = values.map((v) => parseFloat(v.replace(/[¥%,]/g, "")));
  if (nums.some((n) => isNaN(n))) return null;
  if (nums.length < 2) return null;
  const step = nums[1] - nums[0];
  for (let i = 2; i < nums.length; i++) {
    if (Math.abs(nums[i] - nums[i - 1] - step) > 0.0001) return null;
  }
  return { step, nums };
}

export function computeFillValue(
  sourceRows: string[][],
  srcR0: number,
  srcC0: number,
  srcR1: number,
  srcC1: number,
  targetRow: number,
  targetCol: number,
  fillDirection: "down" | "right" | "up" | "left"
): string {
  const srcH = srcR1 - srcR0 + 1;
  const srcW = srcC1 - srcC0 + 1;

  const relR = ((targetRow - srcR0) % srcH + srcH) % srcH;
  const relC = ((targetCol - srcC0) % srcW + srcW) % srcW;
  const srcR = srcR0 + relR;
  const srcC = srcC0 + relC;
  const srcVal = sourceRows[srcR]?.[srcC] ?? "";
  const dRow = targetRow - srcR;
  const dCol = targetCol - srcC;

  if (srcVal.startsWith("=")) {
    return adjustFormulaRefs(srcVal, dRow, dCol);
  }

  if (fillDirection === "down" && srcW === 1 && targetCol === srcC0) {
    const colValues: string[] = [];
    for (let r = srcR0; r <= srcR1; r++) colValues.push(sourceRows[r]?.[srcC0] ?? "");
    const series = detectNumericSeries(colValues);
    if (series) {
      const idx = targetRow - srcR0;
      return String(series.nums[0] + series.step * idx);
    }
  }

  if (fillDirection === "right" && srcH === 1 && targetRow === srcR0) {
    const rowValues: string[] = [];
    for (let c = srcC0; c <= srcC1; c++) rowValues.push(sourceRows[srcR0]?.[c] ?? "");
    const series = detectNumericSeries(rowValues);
    if (series) {
      const idx = targetCol - srcC0;
      return String(series.nums[0] + series.step * idx);
    }
  }

  return srcVal;
}

export interface FillBounds {
  r0: number;
  r1: number;
  c0: number;
  c1: number;
}

export function getFillDirection(
  source: FillBounds,
  target: FillBounds
): "down" | "right" | "up" | "left" {
  if (target.r1 > source.r1) return "down";
  if (target.c1 > source.c1) return "right";
  if (target.r0 < source.r0) return "up";
  return "left";
}

export function applyFill(
  rows: string[][],
  source: FillBounds,
  target: FillBounds
): string[][] {
  const newRows = rows.map((r) => [...r]);
  const dir = getFillDirection(source, target);

  for (let r = target.r0; r <= target.r1; r++) {
    for (let c = target.c0; c <= target.c1; c++) {
      if (r >= source.r0 && r <= source.r1 && c >= source.c0 && c <= source.c1) {
        continue;
      }
      while (newRows.length <= r) newRows.push([]);
      while (newRows[r].length <= c) newRows[r].push("");
      newRows[r][c] = computeFillValue(
        rows,
        source.r0,
        source.c0,
        source.r1,
        source.c1,
        r,
        c,
        dir
      );
    }
  }

  return newRows;
}

export function insertRefAtCursor(
  formula: string,
  ref: string,
  cursorPos: number
): { text: string; cursor: number } {
  const before = formula.slice(0, cursorPos);
  const after = formula.slice(cursorPos);
  const text = before + ref + after;
  return { text, cursor: cursorPos + ref.length };
}

export function cellInBounds(row: number, col: number, b: FillBounds): boolean {
  return row >= b.r0 && row <= b.r1 && col >= b.c0 && col <= b.c1;
}

export function isBottomRightCell(row: number, col: number, b: FillBounds): boolean {
  return row === b.r1 && col === b.c1;
}
