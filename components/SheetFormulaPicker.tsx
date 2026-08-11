"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { FORMULA_CATEGORIES, searchFormulas } from "@/lib/sheet-formula-catalog";

interface SheetFormulaPickerProps {
  onSelect: (formula: string) => void;
}

export default function SheetFormulaPicker({ onSelect }: SheetFormulaPickerProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(FORMULA_CATEGORIES[0].name);

  const results = useMemo(() => searchFormulas(query), [query]);

  const displayCategories = query
    ? [{ name: "搜索结果", formulas: results }]
    : FORMULA_CATEGORIES;

  const activeFormulas =
    displayCategories.find((c) => c.name === activeCategory)?.formulas ??
    displayCategories[0]?.formulas ??
    [];

  return (
    <div className="w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
      <div className="border-b border-gray-100 p-2">
        <div className="flex items-center gap-2 rounded border border-gray-200 px-2 py-1">
          <Search className="h-3.5 w-3.5 text-gray-400" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value) setActiveCategory("搜索结果");
              else setActiveCategory(FORMULA_CATEGORIES[0].name);
            }}
            placeholder="搜索公式..."
            className="flex-1 text-xs outline-none"
          />
        </div>
      </div>

      {!query && (
        <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-2 py-1.5">
          {FORMULA_CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => setActiveCategory(cat.name)}
              className={`shrink-0 rounded px-2 py-0.5 text-[10px] ${
                activeCategory === cat.name
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      <div className="max-h-64 overflow-y-auto py-1">
        {activeFormulas.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-gray-400">未找到匹配的公式</p>
        ) : (
          activeFormulas.map((f) => (
            <button
              key={f.label + f.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(f.value)}
              className="block w-full px-3 py-2 text-left hover:bg-gray-50"
            >
              <div className="text-xs font-medium text-gray-800">{f.label}</div>
              {f.desc && <div className="text-[10px] text-gray-400">{f.desc}</div>}
              <div className="mt-0.5 font-mono text-[10px] text-emerald-600">{f.value}</div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
