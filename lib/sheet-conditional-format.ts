import { parseCellRef, colToIndex, colLabel } from "@/lib/sheet-formula";

export type CondFormatOperator =
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "eq"
  | "neq"
  | "between"
  | "contains"
  | "not_contains"
  | "empty"
  | "not_empty"
  | "color_scale"
  | "data_bar";

export interface ConditionalFormatStyle {
  backgroundColor?: string;
  textColor?: string;
  bold?: boolean;
  italic?: boolean;
  barColor?: string;
  barPercent?: number;
}

export interface ConditionalFormatRule {
  id: string;
  range: string;
  operator: CondFormatOperator;
  value?: string;
  value2?: string;
  style: ConditionalFormatStyle;
}

export const STYLE_PRESETS: {
  id: string;
  label: string;
  style: ConditionalFormatStyle;
}[] = [
  { id: "red", label: "浅红底", style: { backgroundColor: "#fecaca", textColor: "#991b1b" } },
  { id: "green", label: "浅绿底", style: { backgroundColor: "#bbf7d0", textColor: "#166534" } },
  { id: "yellow", label: "浅黄底", style: { backgroundColor: "#fef08a", textColor: "#854d0e" } },
  { id: "blue", label: "浅蓝底", style: { backgroundColor: "#bfdbfe", textColor: "#1e40af" } },
  { id: "orange", label: "浅橙底", style: { backgroundColor: "#fed7aa", textColor: "#9a3412" } },
  { id: "purple", label: "浅紫底", style: { backgroundColor: "#e9d5ff", textColor: "#6b21a8" } },
  { id: "bold_red", label: "红色加粗", style: { textColor: "#dc2626", bold: true } },
  { id: "bold_green", label: "绿色加粗", style: { textColor: "#16a34a", bold: true } },
];

interface ParsedRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

function parseRange(range: string): ParsedRange | null {
  const trimmed = range.trim().toUpperCase();
  if (!trimmed) return null;

  // Full column: A:A or B:D
  const colRange = /^([A-Z]+):([A-Z]+)$/.exec(trimmed);
  if (colRange) {
    return {
      startRow: 0,
      endRow: 9999,
      startCol: colToIndex(colRange[1]),
      endCol: colToIndex(colRange[2]),
    };
  }

  // Full row: 1:5
  const rowRange = /^(\d+):(\d+)$/.exec(trimmed);
  if (rowRange) {
    return {
      startRow: parseInt(rowRange[1], 10) - 1,
      endRow: parseInt(rowRange[2], 10) - 1,
      startCol: 0,
      endCol: 999,
    };
  }

  // A1:C10 or single A1
  const parts = trimmed.split(":");
  const start = parseCellRef(parts[0]);
  if (!start) return null;
  const end = parts[1] ? parseCellRef(parts[1]) : start;
  if (!end) return null;

  return {
    startRow: Math.min(start.row, end.row),
    endRow: Math.max(start.row, end.row),
    startCol: Math.min(start.col, end.col),
    endCol: Math.max(start.col, end.col),
  };
}

export function cellInRange(row: number, col: number, range: string): boolean {
  const parsed = parseRange(range);
  if (!parsed) return false;
  return (
    row >= parsed.startRow &&
    row <= parsed.endRow &&
    col >= parsed.startCol &&
    col <= parsed.endCol
  );
}

function parseNum(value: string): number | null {
  const n = parseFloat(value.replace(/[,%]/g, ""));
  return isNaN(n) ? null : n;
}

function matchRule(value: string, rule: ConditionalFormatRule): boolean {
  const trimmed = value.trim();

  switch (rule.operator) {
    case "empty":
      return trimmed === "";
    case "not_empty":
      return trimmed !== "";
    case "contains":
      return trimmed.toLowerCase().includes((rule.value ?? "").toLowerCase());
    case "not_contains":
      return !trimmed.toLowerCase().includes((rule.value ?? "").toLowerCase());
    case "eq":
      return trimmed === (rule.value ?? "");
    case "neq":
      return trimmed !== (rule.value ?? "");
    case "gt": {
      const n = parseNum(trimmed);
      const t = parseNum(rule.value ?? "");
      return n !== null && t !== null && n > t;
    }
    case "gte": {
      const n = parseNum(trimmed);
      const t = parseNum(rule.value ?? "");
      return n !== null && t !== null && n >= t;
    }
    case "lt": {
      const n = parseNum(trimmed);
      const t = parseNum(rule.value ?? "");
      return n !== null && t !== null && n < t;
    }
    case "lte": {
      const n = parseNum(trimmed);
      const t = parseNum(rule.value ?? "");
      return n !== null && t !== null && n <= t;
    }
    case "between": {
      const n = parseNum(trimmed);
      const a = parseNum(rule.value ?? "");
      const b = parseNum(rule.value2 ?? "");
      return n !== null && a !== null && b !== null && n >= Math.min(a, b) && n <= Math.max(a, b);
    }
    default:
      return false;
  }
}

function lerpColor(min: string, max: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const [r1, g1, b1] = parse(min);
  const [r2, g2, b2] = parse(max);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function collectRangeNumericValues(
  range: string,
  getDisplayValue: (row: number, col: number) => string,
  rowCount: number,
  colCount: number
): number[] {
  const values: number[] = [];
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      if (!cellInRange(r, c, range)) continue;
      const n = parseNum(getDisplayValue(r, c));
      if (n !== null) values.push(n);
    }
  }
  return values;
}

export function getCellConditionalStyle(
  row: number,
  col: number,
  rules: ConditionalFormatRule[],
  getDisplayValue: (row: number, col: number) => string,
  rowCount: number,
  colCount: number
): ConditionalFormatStyle | null {
  // Later rules override earlier ones (except color_scale/data_bar computed separately)
  let result: ConditionalFormatStyle | null = null;

  for (const rule of rules) {
    if (!cellInRange(row, col, rule.range)) continue;

    const value = getDisplayValue(row, col);

    if (rule.operator === "color_scale") {
      const nums = collectRangeNumericValues(rule.range, getDisplayValue, rowCount, colCount);
      if (nums.length === 0) continue;
      const n = parseNum(value);
      if (n === null) continue;
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      const t = max === min ? 0.5 : (n - min) / (max - min);
      const bg = lerpColor(rule.style.backgroundColor ?? "#fecaca", rule.style.textColor ?? "#bbf7d0", t);
      result = { backgroundColor: bg, textColor: t > 0.5 ? "#166534" : "#991b1b", bold: false };
      continue;
    }

    if (rule.operator === "data_bar") {
      const nums = collectRangeNumericValues(rule.range, getDisplayValue, rowCount, colCount);
      if (nums.length === 0) continue;
      const n = parseNum(value);
      if (n === null) continue;
      const max = Math.max(...nums);
      const min = Math.min(...nums);
      const percent = max === min ? 100 : ((n - min) / (max - min)) * 100;
      result = {
        barColor: rule.style.barColor ?? "#3b82f6",
        barPercent: Math.max(0, Math.min(100, percent)),
        backgroundColor: result?.backgroundColor,
        textColor: result?.textColor,
        bold: result?.bold,
      };
      continue;
    }

    if (matchRule(value, rule)) {
      result = { ...rule.style };
    }
  }

  return result;
}

export function formatRangeFromSelection(
  startRow: number,
  startCol: number,
  endRow?: number,
  endCol?: number
): string {
  const er = endRow ?? startRow;
  const ec = endCol ?? startCol;
  const a = `${colLabel(Math.min(startCol, ec))}${Math.min(startRow, er) + 1}`;
  const b = `${colLabel(Math.max(startCol, ec))}${Math.max(startRow, er) + 1}`;
  return a === b ? a : `${a}:${b}`;
}

export const OPERATOR_LABELS: Record<CondFormatOperator, string> = {
  gt: "大于",
  gte: "大于等于",
  lt: "小于",
  lte: "小于等于",
  eq: "等于",
  neq: "不等于",
  between: "介于",
  contains: "文本包含",
  not_contains: "文本不包含",
  empty: "为空",
  not_empty: "不为空",
  color_scale: "色阶",
  data_bar: "数据条",
};

export const VALUE_OPERATORS: CondFormatOperator[] = [
  "gt", "gte", "lt", "lte", "eq", "neq", "between", "contains", "not_contains", "empty", "not_empty",
];
