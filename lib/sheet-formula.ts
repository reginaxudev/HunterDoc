/** Spreadsheet formula utilities — cell refs, ranges, and common functions */

export function colLabel(index: number): string {
  let label = "";
  let n = index;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export function colToIndex(label: string): number {
  let index = 0;
  for (let i = 0; i < label.length; i++) {
    index = index * 26 + (label.charCodeAt(i) - 64);
  }
  return index - 1;
}

export function parseCellRef(ref: string): { row: number; col: number } | null {
  const match = /^([A-Z]+)(\d+)$/i.exec(ref.trim());
  if (!match) return null;
  return {
    col: colToIndex(match[1].toUpperCase()),
    row: parseInt(match[2], 10) - 1,
  };
}

export function cellAddress(row: number, col: number): string {
  return `${colLabel(col)}${row + 1}`;
}

type CellGetter = (row: number, col: number) => string;
type EvalResult = string | number;

interface ParsedRange {
  r0: number;
  r1: number;
  c0: number;
  c1: number;
}

function parseRangeRef(range: string): ParsedRange | null {
  const parts = range.split(":");
  if (parts.length === 1) {
    const ref = parseCellRef(parts[0]);
    if (!ref) return null;
    return { r0: ref.row, r1: ref.row, c0: ref.col, c1: ref.col };
  }
  const start = parseCellRef(parts[0]);
  const end = parseCellRef(parts[1]);
  if (!start || !end) return null;
  return {
    r0: Math.min(start.row, end.row),
    r1: Math.max(start.row, end.row),
    c0: Math.min(start.col, end.col),
    c1: Math.max(start.col, end.col),
  };
}

function collectRangeValues(range: string, getCell: CellGetter): number[] {
  const parsed = parseRangeRef(range);
  if (!parsed) return [];
  const values: number[] = [];
  for (let r = parsed.r0; r <= parsed.r1; r++) {
    for (let c = parsed.c0; c <= parsed.c1; c++) {
      const v = getCell(r, c);
      const n = parseFloat(v.replace(/[¥%,]/g, ""));
      if (!isNaN(n)) values.push(n);
    }
  }
  return values;
}

function collectRangeCells(range: string, getCell: CellGetter): string[][] {
  const parsed = parseRangeRef(range);
  if (!parsed) return [];
  const result: string[][] = [];
  for (let r = parsed.r0; r <= parsed.r1; r++) {
    const row: string[] = [];
    for (let c = parsed.c0; c <= parsed.c1; c++) {
      row.push(getCell(r, c));
    }
    result.push(row);
  }
  return result;
}

function isStringLiteral(token: string): boolean {
  const t = token.trim();
  return (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  );
}

function parseStringLiteral(token: string): string {
  return token.trim().slice(1, -1);
}

function resolveToken(token: string, getCell: CellGetter): EvalResult {
  const t = token.trim();
  if (isStringLiteral(t)) return parseStringLiteral(t);

  const ref = parseCellRef(t);
  if (ref) return getCell(ref.row, ref.col);

  const n = parseFloat(t.replace(/[¥%,]/g, ""));
  if (!isNaN(n) && t !== "") return n;

  return t;
}

function resolveNumber(token: string, getCell: CellGetter): number {
  const v = resolveToken(token, getCell);
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(/[¥%,]/g, ""));
  return isNaN(n) ? 0 : n;
}

function resolveString(token: string, getCell: CellGetter): string {
  const v = resolveToken(token, getCell);
  return String(v);
}

function matchesCriteria(cellValue: string, criteria: string, getCell: CellGetter): boolean {
  const crit = resolveString(criteria, getCell);
  const val = cellValue.trim();

  if (crit.startsWith(">=")) return parseFloat(val) >= parseFloat(crit.slice(2));
  if (crit.startsWith("<=")) return parseFloat(val) <= parseFloat(crit.slice(2));
  if (crit.startsWith("<>") || crit.startsWith("!="))
    return val !== crit.slice(2);
  if (crit.startsWith(">")) return parseFloat(val) > parseFloat(crit.slice(1));
  if (crit.startsWith("<")) return parseFloat(val) < parseFloat(crit.slice(1));
  if (crit.startsWith("=")) return val === crit.slice(1);

  if (crit.includes("*")) {
    const pattern = crit.replace(/\*/g, ".*");
    return new RegExp(`^${pattern}$`, "i").test(val);
  }

  const numVal = parseFloat(val);
  const numCrit = parseFloat(crit);
  if (!isNaN(numVal) && !isNaN(numCrit)) return numVal === numCrit;

  return val.toLowerCase() === crit.toLowerCase();
}

function evalFunction(name: string, args: string, getCell: CellGetter): EvalResult {
  const upper = name.toUpperCase();
  const argList = splitArgs(args);

  if (upper === "SUM") {
    return argList.reduce((sum, arg) => {
      if (arg.includes(":")) {
        return sum + collectRangeValues(arg, getCell).reduce((a, b) => a + b, 0);
      }
      return sum + resolveNumber(arg, getCell);
    }, 0);
  }

  if (upper === "AVERAGE" || upper === "AVG") {
    const values: number[] = [];
    for (const arg of argList) {
      if (arg.includes(":")) values.push(...collectRangeValues(arg, getCell));
      else values.push(resolveNumber(arg, getCell));
    }
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  if (upper === "COUNT") {
    let count = 0;
    for (const arg of argList) {
      if (arg.includes(":")) count += collectRangeValues(arg, getCell).length;
      else {
        const ref = parseCellRef(arg);
        if (ref) {
          const v = getCell(ref.row, ref.col);
          if (v !== "" && !isNaN(parseFloat(v))) count++;
        }
      }
    }
    return count;
  }

  if (upper === "COUNTA") {
    let count = 0;
    for (const arg of argList) {
      if (arg.includes(":")) {
        const parsed = parseRangeRef(arg);
        if (parsed) {
          for (let r = parsed.r0; r <= parsed.r1; r++) {
            for (let c = parsed.c0; c <= parsed.c1; c++) {
              if (getCell(r, c) !== "") count++;
            }
          }
        }
      } else {
        const ref = parseCellRef(arg);
        if (ref && getCell(ref.row, ref.col) !== "") count++;
      }
    }
    return count;
  }

  if (upper === "MIN") {
    const values: number[] = [];
    for (const arg of argList) {
      if (arg.includes(":")) values.push(...collectRangeValues(arg, getCell));
      else values.push(resolveNumber(arg, getCell));
    }
    return values.length ? Math.min(...values) : 0;
  }

  if (upper === "MAX") {
    const values: number[] = [];
    for (const arg of argList) {
      if (arg.includes(":")) values.push(...collectRangeValues(arg, getCell));
      else values.push(resolveNumber(arg, getCell));
    }
    return values.length ? Math.max(...values) : 0;
  }

  if (upper === "MEDIAN") {
    const values: number[] = [];
    for (const arg of argList) {
      if (arg.includes(":")) values.push(...collectRangeValues(arg, getCell));
      else values.push(resolveNumber(arg, getCell));
    }
    if (!values.length) return 0;
    values.sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    return values.length % 2
      ? values[mid]
      : (values[mid - 1] + values[mid]) / 2;
  }

  if (upper === "IF") {
    const [cond, tVal, fVal] = argList;
    const condResult = evalCondition(cond, getCell);
    return condResult
      ? resolveToken(tVal, getCell)
      : resolveToken(fVal ?? "0", getCell);
  }

  if (upper === "IFERROR") {
    const [expr, fallback] = argList;
    try {
      const result = evalExpression(expr, getCell);
      if (typeof result === "string" && result.startsWith("#")) {
        return resolveToken(fallback, getCell);
      }
      return result;
    } catch {
      return resolveToken(fallback, getCell);
    }
  }

  if (upper === "ROUND") {
    const [numArg, decArg] = argList;
    const num = resolveNumber(numArg, getCell);
    const dec = decArg ? resolveNumber(decArg, getCell) : 0;
    const factor = Math.pow(10, dec);
    return Math.round(num * factor) / factor;
  }

  if (upper === "ABS") return Math.abs(resolveNumber(argList[0], getCell));
  if (upper === "SQRT") return Math.sqrt(Math.max(0, resolveNumber(argList[0], getCell)));
  if (upper === "POWER") {
    return Math.pow(resolveNumber(argList[0], getCell), resolveNumber(argList[1], getCell));
  }
  if (upper === "MOD") {
    const divisor = resolveNumber(argList[1], getCell);
    return divisor === 0 ? 0 : resolveNumber(argList[0], getCell) % divisor;
  }
  if (upper === "INT") return Math.floor(resolveNumber(argList[0], getCell));
  if (upper === "FLOOR") {
    const dec = argList[1] ? resolveNumber(argList[1], getCell) : 1;
    return Math.floor(resolveNumber(argList[0], getCell) / dec) * dec;
  }
  if (upper === "CEILING") {
    const dec = argList[1] ? resolveNumber(argList[1], getCell) : 1;
    return Math.ceil(resolveNumber(argList[0], getCell) / dec) * dec;
  }

  if (upper === "SUMIF") {
    const [rangeArg, criteria, sumRange] = argList;
    const parsed = parseRangeRef(rangeArg);
    if (!parsed) return 0;
    let sum = 0;
    for (let r = parsed.r0; r <= parsed.r1; r++) {
      for (let c = parsed.c0; c <= parsed.c1; c++) {
        if (matchesCriteria(getCell(r, c), criteria, getCell)) {
          if (sumRange) {
            const sumParsed = parseRangeRef(sumRange);
            if (sumParsed) {
              const offsetR = r - parsed.r0;
              const offsetC = c - parsed.c0;
              sum += resolveNumber(
                getCell(sumParsed.r0 + offsetR, sumParsed.c0 + offsetC),
                getCell
              );
            }
          } else {
            sum += resolveNumber(getCell(r, c), getCell);
          }
        }
      }
    }
    return sum;
  }

  if (upper === "COUNTIF") {
    const [rangeArg, criteria] = argList;
    const parsed = parseRangeRef(rangeArg);
    if (!parsed) return 0;
    let count = 0;
    for (let r = parsed.r0; r <= parsed.r1; r++) {
      for (let c = parsed.c0; c <= parsed.c1; c++) {
        if (matchesCriteria(getCell(r, c), criteria, getCell)) count++;
      }
    }
    return count;
  }

  if (upper === "AVERAGEIF") {
    const [rangeArg, criteria] = argList;
    const parsed = parseRangeRef(rangeArg);
    if (!parsed) return 0;
    const values: number[] = [];
    for (let r = parsed.r0; r <= parsed.r1; r++) {
      for (let c = parsed.c0; c <= parsed.c1; c++) {
        if (matchesCriteria(getCell(r, c), criteria, getCell)) {
          values.push(resolveNumber(getCell(r, c), getCell));
        }
      }
    }
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  if (upper === "VLOOKUP") {
    const [lookupArg, tableArg, colIdxArg, exactArg] = argList;
    const lookup = resolveString(lookupArg, getCell);
    const table = collectRangeCells(tableArg, getCell);
    const colIdx = Math.max(1, resolveNumber(colIdxArg, getCell)) - 1;
    const exact = exactArg
      ? !["FALSE", "0"].includes(resolveString(exactArg, getCell).toUpperCase())
      : true;

    for (const row of table) {
      const key = row[0] ?? "";
      if (exact) {
        if (key === lookup || key.toLowerCase() === lookup.toLowerCase()) {
          return row[colIdx] ?? "#N/A";
        }
      } else {
        if (key >= lookup) return row[colIdx] ?? "#N/A";
      }
    }
    return "#N/A";
  }

  if (upper === "HLOOKUP") {
    const [lookupArg, tableArg, rowIdxArg, exactArg] = argList;
    const lookup = resolveString(lookupArg, getCell);
    const table = collectRangeCells(tableArg, getCell);
    const rowIdx = Math.max(1, resolveNumber(rowIdxArg, getCell)) - 1;
    const exact = exactArg
      ? !["FALSE", "0"].includes(resolveString(exactArg, getCell).toUpperCase())
      : true;

    const header = table[0] ?? [];
    for (let c = 0; c < header.length; c++) {
      const key = header[c] ?? "";
      if (exact ? key === lookup : key >= lookup) {
        return table[rowIdx]?.[c] ?? "#N/A";
      }
    }
    return "#N/A";
  }

  if (upper === "INDEX") {
    const [rangeArg, rowArg, colArg] = argList;
    const table = collectRangeCells(rangeArg, getCell);
    const ri = resolveNumber(rowArg, getCell) - 1;
    const ci = colArg ? resolveNumber(colArg, getCell) - 1 : 0;
    return table[ri]?.[ci] ?? "#REF!";
  }

  if (upper === "MATCH") {
    const [lookupArg, rangeArg, matchType] = argList;
    const lookup = resolveString(lookupArg, getCell);
    const parsed = parseRangeRef(rangeArg);
    if (!parsed) return "#N/A";
    const type = matchType ? resolveNumber(matchType, getCell) : 0;
    let idx = 0;
    for (let r = parsed.r0; r <= parsed.r1; r++) {
      for (let c = parsed.c0; c <= parsed.c1; c++) {
        idx++;
        const val = getCell(r, c);
        if (type === 0 && (val === lookup || val.toLowerCase() === lookup.toLowerCase())) {
          return idx;
        }
      }
    }
    return "#N/A";
  }

  if (upper === "CONCAT" || upper === "CONCATENATE") {
    return argList.map((a) => resolveString(a, getCell)).join("");
  }

  if (upper === "LEFT") {
    const s = resolveString(argList[0], getCell);
    const n = resolveNumber(argList[1], getCell);
    return s.slice(0, n);
  }

  if (upper === "RIGHT") {
    const s = resolveString(argList[0], getCell);
    const n = resolveNumber(argList[1], getCell);
    return s.slice(-n);
  }

  if (upper === "MID") {
    const s = resolveString(argList[0], getCell);
    const start = resolveNumber(argList[1], getCell) - 1;
    const len = resolveNumber(argList[2], getCell);
    return s.slice(start, start + len);
  }

  if (upper === "LEN") return resolveString(argList[0], getCell).length;
  if (upper === "TRIM") return resolveString(argList[0], getCell).trim();
  if (upper === "UPPER") return resolveString(argList[0], getCell).toUpperCase();
  if (upper === "LOWER") return resolveString(argList[0], getCell).toLowerCase();

  if (upper === "AND") {
    return argList.every((a) => evalCondition(a, getCell)) ? 1 : 0;
  }
  if (upper === "OR") {
    return argList.some((a) => evalCondition(a, getCell)) ? 1 : 0;
  }
  if (upper === "NOT") {
    return evalCondition(argList[0], getCell) ? 0 : 1;
  }

  return `#NAME?`;
}

function splitArgs(args: string): string[] {
  const result: string[] = [];
  let current = "";
  let depth = 0;
  let inString = false;
  let quote = "";

  for (const ch of args) {
    if ((ch === '"' || ch === "'") && !inString) {
      inString = true;
      quote = ch;
      current += ch;
      continue;
    }
    if (inString && ch === quote) {
      inString = false;
      current += ch;
      continue;
    }
    if (inString) {
      current += ch;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function evalCondition(cond: string, getCell: CellGetter): boolean {
  const c = cond.trim();

  if (isStringLiteral(c)) return Boolean(parseStringLiteral(c));

  const ops = [">=", "<=", "<>", "!=", ">", "<", "="];
  for (const op of ops) {
    const idx = c.indexOf(op);
    if (idx === -1) continue;
    const leftStr = c.slice(0, idx).trim();
    const rightStr = c.slice(idx + op.length).trim();
    const left = resolveToken(leftStr, getCell);
    const right = resolveToken(rightStr, getCell);

    if (typeof left === "string" || typeof right === "string") {
      const ls = String(left);
      const rs = String(right);
      switch (op) {
        case ">=": return ls >= rs;
        case "<=": return ls <= rs;
        case "<>":
        case "!=": return ls !== rs;
        case ">": return ls > rs;
        case "<": return ls < rs;
        case "=": return ls === rs;
      }
    }

    const ln = typeof left === "number" ? left : parseFloat(String(left)) || 0;
    const rn = typeof right === "number" ? right : parseFloat(String(right)) || 0;
    switch (op) {
      case ">=": return ln >= rn;
      case "<=": return ln <= rn;
      case "<>":
      case "!=": return ln !== rn;
      case ">": return ln > rn;
      case "<": return ln < rn;
      case "=": return ln === rn;
    }
  }

  const v = resolveToken(c, getCell);
  if (typeof v === "number") return v !== 0;
  return Boolean(v);
}

function evalExpression(expr: string, getCell: CellGetter): EvalResult {
  expr = expr.trim();
  if (!expr) return 0;

  if (isStringLiteral(expr)) return parseStringLiteral(expr);

  const funcMatch = /^([A-Z_]+)\((.+)\)$/i.exec(expr);
  if (funcMatch) {
    return evalFunction(funcMatch[1], funcMatch[2], getCell);
  }

  if (expr.includes(":")) {
    const vals = collectRangeValues(expr, getCell);
    return vals.reduce((a, b) => a + b, 0);
  }

  const ref = parseCellRef(expr);
  if (ref) return resolveToken(expr, getCell);

  for (let i = expr.length - 1; i >= 0; i--) {
    const ch = expr[i];
    if ((ch === "+" || ch === "-") && i > 0) {
      const left = evalExpression(expr.slice(0, i), getCell);
      const right = evalExpression(expr.slice(i + 1), getCell);
      if (typeof left === "string" || typeof right === "string") {
        return String(left) + String(right);
      }
      return ch === "+" ? (left as number) + (right as number) : (left as number) - (right as number);
    }
  }

  for (let i = expr.length - 1; i >= 0; i--) {
    const ch = expr[i];
    if ((ch === "*" || ch === "/") && i > 0) {
      const left = evalExpression(expr.slice(0, i), getCell) as number;
      const right = evalExpression(expr.slice(i + 1), getCell) as number;
      return ch === "*" ? left * right : right === 0 ? "#DIV/0!" : left / right;
    }
  }

  return resolveToken(expr, getCell);
}

export function evaluateCell(raw: string, getCell: CellGetter): string {
  if (!raw.startsWith("=")) return raw;

  const formula = raw.slice(1).trim();
  if (!formula) return "";

  try {
    const result = evalExpression(formula, getCell);
    if (typeof result === "string") {
      if (result.startsWith("#")) return result;
      return result;
    }
    if (!isFinite(result)) return "#DIV/0!";
    return Number.isInteger(result)
      ? String(result)
      : String(Math.round(result * 10000) / 10000);
  } catch {
    return "#ERROR!";
  }
}

export function isFormula(value: string): boolean {
  return value.startsWith("=");
}

export const DEFAULT_COL_WIDTH = 120;
export const DEFAULT_ROW_HEIGHT = 33;
export const ROW_HEADER_WIDTH = 40;

export function getColWidth(
  colWidths: Record<number, number> | undefined,
  col: number
): number {
  return colWidths?.[col] ?? DEFAULT_COL_WIDTH;
}

export function getRowHeight(
  rowHeights: Record<number, number> | undefined,
  row: number
): number {
  return rowHeights?.[row] ?? DEFAULT_ROW_HEIGHT;
}

export function getColLeftOffset(
  col: number,
  colWidths: Record<number, number> | undefined
): number {
  let left = ROW_HEADER_WIDTH;
  for (let i = 0; i < col; i++) {
    left += getColWidth(colWidths, i);
  }
  return left;
}

export function getRowTopOffset(
  row: number,
  rowHeights: Record<number, number> | undefined
): number {
  let top = 0;
  for (let i = 0; i < row; i++) {
    top += getRowHeight(rowHeights, i);
  }
  return top;
}
