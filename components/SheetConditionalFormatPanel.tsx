"use client";

import { useState } from "react";
import { X, Plus, Trash2, Palette } from "lucide-react";
import type { ConditionalFormatRule } from "@/lib/sheet-conditional-format";
import {
  OPERATOR_LABELS,
  STYLE_PRESETS,
  VALUE_OPERATORS,
} from "@/lib/sheet-conditional-format";
import { generateId } from "@/lib/content-types";

interface SheetConditionalFormatPanelProps {
  open: boolean;
  onClose: () => void;
  rules: ConditionalFormatRule[];
  defaultRange: string;
  onChange: (rules: ConditionalFormatRule[]) => void;
}

export default function SheetConditionalFormatPanel({
  open,
  onClose,
  rules,
  defaultRange,
  onChange,
}: SheetConditionalFormatPanelProps) {
  const [range, setRange] = useState(defaultRange);
  const [operator, setOperator] = useState<ConditionalFormatRule["operator"]>("gt");
  const [value, setValue] = useState("");
  const [value2, setValue2] = useState("");
  const [presetId, setPresetId] = useState(STYLE_PRESETS[0].id);

  if (!open) return null;

  const needsValue = VALUE_OPERATORS.includes(operator) && !["empty", "not_empty"].includes(operator);
  const needsValue2 = operator === "between";
  const isSpecial = operator === "color_scale" || operator === "data_bar";

  const addRule = () => {
    let style = STYLE_PRESETS.find((p) => p.id === presetId)?.style ?? STYLE_PRESETS[0].style;

    if (operator === "color_scale") {
      style = { backgroundColor: "#fecaca", textColor: "#bbf7d0" };
    } else if (operator === "data_bar") {
      style = { barColor: "#3b82f6" };
    }

    const rule: ConditionalFormatRule = {
      id: generateId("cf"),
      range: range.trim() || defaultRange,
      operator,
      ...(needsValue && { value }),
      ...(needsValue2 && { value2 }),
      style,
    };
    onChange([...rules, rule]);
  };

  const removeRule = (id: string) => {
    onChange(rules.filter((r) => r.id !== id));
  };

  return (
    <div className="absolute right-4 top-14 z-30 w-80 rounded-xl border border-gray-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Palette className="h-4 w-4 text-blue-600" />
          条件格式
        </div>
        <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">应用范围</label>
          <input
            value={range}
            onChange={(e) => setRange(e.target.value.toUpperCase())}
            placeholder="如 A1:D10、B:B、2:2"
            className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 font-mono text-sm outline-none focus:border-blue-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">规则类型</label>
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value as ConditionalFormatRule["operator"])}
            className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm outline-none"
          >
            {Object.entries(OPERATOR_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {needsValue && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              {operator === "contains" || operator === "not_contains" ? "文本" : "数值"}
            </label>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400"
            />
          </div>
        )}

        {needsValue2 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">到</label>
            <input
              value={value2}
              onChange={(e) => setValue2(e.target.value)}
              className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400"
            />
          </div>
        )}

        {!isSpecial && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">样式</label>
            <div className="grid grid-cols-4 gap-1.5">
              {STYLE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPresetId(p.id)}
                  title={p.label}
                  className={`rounded-md border px-1 py-1.5 text-[10px] transition-all ${
                    presetId === p.id ? "border-blue-500 ring-1 ring-blue-300" : "border-gray-200"
                  }`}
                  style={{
                    backgroundColor: p.style.backgroundColor,
                    color: p.style.textColor,
                    fontWeight: p.style.bold ? "bold" : "normal",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {operator === "color_scale" && (
          <p className="text-xs text-gray-400">
            色阶：范围内最小值显示红色，最大值显示绿色，中间渐变
          </p>
        )}

        {operator === "data_bar" && (
          <p className="text-xs text-gray-400">
            数据条：按数值大小在单元格内显示蓝色进度条
          </p>
        )}

        <button
          onClick={addRule}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          添加规则
        </button>
      </div>

      {rules.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="mb-2 text-xs font-medium text-gray-500">
            已生效规则 ({rules.length})
          </div>
          <div className="max-h-40 space-y-1.5 overflow-y-auto">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-2 rounded-md bg-gray-50 px-2 py-1.5"
              >
                <div
                  className="h-5 w-5 shrink-0 rounded border border-gray-200"
                  style={{
                    backgroundColor: rule.style.backgroundColor ?? "transparent",
                    color: rule.style.textColor,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-xs text-gray-700">{rule.range}</div>
                  <div className="text-[10px] text-gray-400">
                    {OPERATOR_LABELS[rule.operator]}
                    {rule.value !== undefined && ` ${rule.value}`}
                    {rule.value2 !== undefined && ` ~ ${rule.value2}`}
                  </div>
                </div>
                <button
                  onClick={() => removeRule(rule.id)}
                  className="shrink-0 text-gray-300 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
