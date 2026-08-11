import { parseCellRef, colLabel } from "@/lib/sheet-formula";

export interface PivotResult {
  headers: string[];
  rows: string[][];
}

/** Simple pivot: group by rowFieldCol, aggregate valueFieldCol */
export function buildPivotTable(
  sourceRows: string[][],
  range: string,
  rowFieldCol: number,
  valueFieldCol: number,
  agg: "sum" | "count" | "avg" = "sum"
): PivotResult {
  const parts = range.split(":");
  const start = parseCellRef(parts[0]);
  const end = parts[1] ? parseCellRef(parts[1]) : start;
  if (!start || !end) return { headers: ["分组", "值"], rows: [] };

  const r0 = Math.min(start.row, end.row);
  const r1 = Math.max(start.row, end.row);

  const groups = new Map<string, number[]>();

  for (let r = r0; r <= r1; r++) {
    const key = sourceRows[r]?.[rowFieldCol]?.trim() || "(空白)";
    const raw = sourceRows[r]?.[valueFieldCol] ?? "";
    const num = parseFloat(raw.replace(/[¥%,]/g, ""));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(isNaN(num) ? 0 : num);
  }

  const aggLabel = agg === "sum" ? "求和" : agg === "count" ? "计数" : "平均";
  const headers = ["分组", aggLabel];
  const rows: string[][] = [];

  for (const [key, vals] of groups) {
    let result: number;
    if (agg === "count") result = vals.length;
    else if (agg === "avg") result = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
    else result = vals.reduce((a, b) => a + b, 0);
    rows.push([key, String(Math.round(result * 100) / 100)]);
  }

  rows.sort((a, b) => a[0].localeCompare(b[0], "zh-CN"));
  return { headers, rows };
}

export function pivotOutputRange(
  startRow: number,
  startCol: number,
  pivot: PivotResult
): { rows: string[][]; endRow: number; endCol: number } {
  const rows: string[][] = [pivot.headers, ...pivot.rows];
  return {
    rows,
    endRow: startRow + rows.length - 1,
    endCol: startCol + pivot.headers.length - 1,
  };
}

export function collectChartData(
  sourceRows: string[][],
  range: string
): { values: number[]; labels: string[] } {
  const parts = range.split(":");
  const start = parseCellRef(parts[0]);
  const end = parts[1] ? parseCellRef(parts[1]) : start;
  if (!start || !end) return { values: [], labels: [] };

  const r0 = Math.min(start.row, end.row);
  const r1 = Math.max(start.row, end.row);
  const c = start.col;

  const values: number[] = [];
  const labels: string[] = [];

  for (let r = r0; r <= r1; r++) {
    const raw = sourceRows[r]?.[c] ?? "";
    const n = parseFloat(raw.replace(/[¥%,]/g, ""));
    values.push(isNaN(n) ? 0 : n);
    labels.push(`${colLabel(c)}${r + 1}`);
  }

  return { values, labels };
}
