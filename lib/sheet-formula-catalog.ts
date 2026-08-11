/** Formula templates grouped by category for the formula picker */

export interface FormulaTemplate {
  label: string;
  value: string;
  desc?: string;
}

export interface FormulaCategory {
  name: string;
  formulas: FormulaTemplate[];
}

export const FORMULA_CATEGORIES: FormulaCategory[] = [
  {
    name: "常用",
    formulas: [
      { label: "求和 SUM", value: "=SUM(A1:A10)", desc: "对区域求和" },
      { label: "平均值 AVG", value: "=AVG(A1:A10)", desc: "计算平均值" },
      { label: "计数 COUNT", value: "=COUNT(A1:A10)", desc: "统计数字个数" },
      { label: "计数 COUNTA", value: "=COUNTA(A1:A10)", desc: "统计非空单元格" },
      { label: "最大值 MAX", value: "=MAX(A1:A10)", desc: "返回最大值" },
      { label: "最小值 MIN", value: "=MIN(A1:A10)", desc: "返回最小值" },
    ],
  },
  {
    name: "条件",
    formulas: [
      { label: "条件 IF", value: '=IF(A1>0,"是","否")', desc: "条件判断" },
      { label: "条件求和 SUMIF", value: '=SUMIF(A1:A10,">100")', desc: "按条件求和" },
      { label: "条件计数 COUNTIF", value: '=COUNTIF(A1:A10,">=60")', desc: "按条件计数" },
      { label: "条件平均 AVERAGEIF", value: '=AVERAGEIF(A1:A10,">0")', desc: "按条件求平均" },
      { label: "错误处理 IFERROR", value: '=IFERROR(A1/B1,"—")', desc: "出错时返回默认值" },
    ],
  },
  {
    name: "查找",
    formulas: [
      { label: "垂直查找 VLOOKUP", value: '=VLOOKUP(A1,A1:B10,2,FALSE)', desc: "在首列查找并返回对应列" },
      { label: "水平查找 HLOOKUP", value: '=HLOOKUP(A1,A1:J2,2,FALSE)', desc: "在首行查找并返回对应行" },
      { label: "索引 INDEX", value: "=INDEX(A1:C10,2,3)", desc: "返回区域中指定行列的值" },
      { label: "匹配 MATCH", value: '=MATCH("目标",A1:A10,0)', desc: "返回值在区域中的位置" },
    ],
  },
  {
    name: "文本",
    formulas: [
      { label: "连接 CONCAT", value: '=CONCAT(A1," ",B1)', desc: "连接多个文本" },
      { label: "左取 LEFT", value: "=LEFT(A1,3)", desc: "取左边 N 个字符" },
      { label: "右取 RIGHT", value: "=RIGHT(A1,3)", desc: "取右边 N 个字符" },
      { label: "中取 MID", value: "=MID(A1,2,3)", desc: "从指定位置取字符" },
      { label: "长度 LEN", value: "=LEN(A1)", desc: "返回文本长度" },
      { label: "去空格 TRIM", value: "=TRIM(A1)", desc: "去除首尾空格" },
    ],
  },
  {
    name: "数学",
    formulas: [
      { label: "四舍五入 ROUND", value: "=ROUND(A1,2)", desc: "四舍五入到指定小数位" },
      { label: "绝对值 ABS", value: "=ABS(A1)", desc: "返回绝对值" },
      { label: "平方根 SQRT", value: "=SQRT(A1)", desc: "返回平方根" },
      { label: "幂 POWER", value: "=POWER(A1,2)", desc: "返回幂运算结果" },
      { label: "取余 MOD", value: "=MOD(A1,3)", desc: "返回余数" },
      { label: "取整 INT", value: "=INT(A1)", desc: "向下取整" },
      { label: "中位数 MEDIAN", value: "=MEDIAN(A1:A10)", desc: "返回中位数" },
    ],
  },
  {
    name: "逻辑",
    formulas: [
      { label: "与 AND", value: "=AND(A1>0,B1>0)", desc: "所有条件为真" },
      { label: "或 OR", value: "=OR(A1>0,B1>0)", desc: "任一条件为真" },
      { label: "非 NOT", value: "=NOT(A1>0)", desc: "取反" },
    ],
  },
];

export const ALL_FORMULAS = FORMULA_CATEGORIES.flatMap((c) => c.formulas);

export function searchFormulas(query: string): FormulaTemplate[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_FORMULAS;
  return ALL_FORMULAS.filter(
    (f) =>
      f.label.toLowerCase().includes(q) ||
      f.value.toLowerCase().includes(q) ||
      f.desc?.toLowerCase().includes(q)
  );
}
