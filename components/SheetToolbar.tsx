"use client";

import { useState, useRef, useEffect } from "react";
import {
  Undo2,
  Redo2,
  Paintbrush,
  Eraser,
  Bold,
  Strikethrough,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Merge,
  Snowflake,
  Filter,
  ArrowUpDown,
  Palette,
  Sigma,
  ChevronDown,
  Square,
  Printer,
  Download,
} from "lucide-react";
import type { CellStyle, NumberFormat, HAlign, VAlign } from "@/lib/sheet-cell-style";
import { FONT_SIZES } from "@/lib/sheet-cell-style";
import SheetInsertButton from "@/components/SheetInsertMenu";
import SheetColorPicker from "@/components/SheetColorPicker";
import type { InsertAction } from "@/lib/sheet-cell-meta";

interface SheetToolbarProps {
  editable: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onFormatPaint: () => void;
  onClearFormat: () => void;
  currentStyle: CellStyle;
  onStyleChange: (patch: Partial<CellStyle>) => void;
  onMerge: () => void;
  onUnmerge: () => void;
  canMerge: boolean;
  isMerged: boolean;
  onFreezeFirstRowCol: () => void;
  onFreezeToSelection: () => void;
  onUnfreeze: () => void;
  freezeActive: boolean;
  onToggleFilter: () => void;
  filterActive: boolean;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onOpenCondFormat: () => void;
  condFormatActive: boolean;
  onInsert: (action: InsertAction) => void;
  onOpenFormula: () => void;
  onPrint: () => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
  onExportWorkbook: () => void;
}

function ToolbarBtn({
  onClick,
  active,
  disabled,
  title,
  children,
  className = "",
}: {
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex flex-col items-center gap-0.5 rounded px-1.5 py-1 text-[10px] leading-none transition-colors disabled:opacity-40 ${
        active
          ? "bg-blue-50 text-blue-600"
          : "text-gray-600 hover:bg-gray-100"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export default function SheetToolbar({
  editable,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onFormatPaint,
  onClearFormat,
  currentStyle,
  onStyleChange,
  onMerge,
  onUnmerge,
  canMerge,
  isMerged,
  onFreezeFirstRowCol,
  onFreezeToSelection,
  onUnfreeze,
  freezeActive,
  onToggleFilter,
  filterActive,
  onSortAsc,
  onSortDesc,
  onOpenCondFormat,
  condFormatActive,
  onInsert,
  onOpenFormula,
  onPrint,
  onExportCsv,
  onExportExcel,
  onExportWorkbook,
}: SheetToolbarProps) {
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const [showFreezeMenu, setShowFreezeMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const formatRef = useRef<HTMLDivElement>(null);
  const freezeRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (formatRef.current && !formatRef.current.contains(t)) setShowFormatMenu(false);
      if (freezeRef.current && !freezeRef.current.contains(t)) setShowFreezeMenu(false);
      if (exportRef.current && !exportRef.current.contains(t)) setShowExportMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!editable) {
    return (
      <div className="flex items-center border-b border-gray-200 bg-white px-2 py-1">
        <ToolbarBtn onClick={onPrint} title="打印预览">
          <Printer className="h-4 w-4" />
          <span>打印</span>
        </ToolbarBtn>
        <div ref={exportRef} className="relative">
          <ToolbarBtn onClick={() => setShowExportMenu(!showExportMenu)} title="导出">
            <Download className="h-4 w-4" />
            <span>导出</span>
          </ToolbarBtn>
          {showExportMenu && (
            <div className="absolute left-0 top-full z-50 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <button type="button" onClick={() => { onExportCsv(); setShowExportMenu(false); }} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50">导出 CSV</button>
              <button type="button" onClick={() => { onExportExcel(); setShowExportMenu(false); }} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50">导出 Excel (当前表)</button>
              <button type="button" onClick={() => { onExportWorkbook(); setShowExportMenu(false); }} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50">导出 Excel (全部)</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const fmt = currentStyle.numberFormat ?? "general";
  const fmtLabel: Record<NumberFormat, string> = {
    general: "常规",
    number: "数字",
    currency: "货币",
    percent: "百分比",
  };

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto border-b border-gray-200 bg-white px-2 py-1">
      <ToolbarBtn onClick={onUndo} disabled={!canUndo} title="撤销 (⌘Z)">
        <Undo2 className="h-4 w-4" />
        <span>撤销</span>
      </ToolbarBtn>
      <ToolbarBtn onClick={onRedo} disabled={!canRedo} title="重做 (⌘⇧Z)">
        <Redo2 className="h-4 w-4" />
        <span>重做</span>
      </ToolbarBtn>

      <div className="mx-1 h-6 w-px bg-gray-200" />

      <ToolbarBtn onClick={onFormatPaint} title="格式刷">
        <Paintbrush className="h-4 w-4" />
        <span>格式刷</span>
      </ToolbarBtn>
      <ToolbarBtn onClick={onClearFormat} title="清除格式">
        <Eraser className="h-4 w-4" />
        <span>清除格式</span>
      </ToolbarBtn>

      <div className="mx-1 h-6 w-px bg-gray-200" />

      <SheetInsertButton onInsert={onInsert} />

      <select
        value={currentStyle.fontSize ?? 10}
        onChange={(e) => onStyleChange({ fontSize: Number(e.target.value) })}
        className="mx-0.5 h-7 w-12 rounded border border-gray-200 text-xs outline-none focus:ring-1 focus:ring-blue-300"
        title="字号"
      >
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <ToolbarBtn onClick={() => onStyleChange({ bold: !currentStyle.bold })} active={!!currentStyle.bold} title="加粗 (⌘B)">
        <Bold className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => onStyleChange({ strikethrough: !currentStyle.strikethrough })} active={!!currentStyle.strikethrough} title="删除线">
        <Strikethrough className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => onStyleChange({ italic: !currentStyle.italic })} active={!!currentStyle.italic} title="斜体 (⌘I)">
        <Italic className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => onStyleChange({ underline: !currentStyle.underline })} active={!!currentStyle.underline} title="下划线 (⌘U)">
        <Underline className="h-4 w-4" />
      </ToolbarBtn>

      <SheetColorPicker
        mode="text"
        value={currentStyle.textColor}
        onChange={(c) => onStyleChange({ textColor: c || undefined })}
      />
      <SheetColorPicker
        mode="fill"
        value={currentStyle.backgroundColor}
        onChange={(c) => onStyleChange({ backgroundColor: c || undefined })}
      />

      <ToolbarBtn onClick={() => onStyleChange({ borderTop: true, borderRight: true, borderBottom: true, borderLeft: true })} title="边框">
        <Square className="h-4 w-4" />
        <span>边框</span>
      </ToolbarBtn>

      <div className="mx-1 h-6 w-px bg-gray-200" />

      {(["left", "center", "right"] as HAlign[]).map((a) => {
        const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
        return (
          <ToolbarBtn key={a} onClick={() => onStyleChange({ align: a })} active={currentStyle.align === a} title={a === "left" ? "左对齐" : a === "center" ? "居中" : "右对齐"}>
            <Icon className="h-4 w-4" />
          </ToolbarBtn>
        );
      })}

      {(["top", "middle", "bottom"] as VAlign[]).map((v) => {
        const Icon = v === "top" ? AlignVerticalJustifyStart : v === "middle" ? AlignVerticalJustifyCenter : AlignVerticalJustifyEnd;
        return (
          <ToolbarBtn key={v} onClick={() => onStyleChange({ valign: v })} active={currentStyle.valign === v} title={v === "top" ? "顶端对齐" : v === "middle" ? "垂直居中" : "底端对齐"}>
            <Icon className="h-4 w-4" />
          </ToolbarBtn>
        );
      })}

      <ToolbarBtn onClick={isMerged ? onUnmerge : onMerge} disabled={!canMerge && !isMerged} title="合并单元格">
        <Merge className="h-4 w-4" />
        <span>合并</span>
      </ToolbarBtn>

      <div className="mx-1 h-6 w-px bg-gray-200" />

      <div ref={formatRef} className="relative">
        <button type="button" onClick={() => setShowFormatMenu(!showFormatMenu)} className="flex h-7 items-center gap-0.5 rounded border border-gray-200 px-2 text-xs text-gray-700 hover:bg-gray-50">
          {fmtLabel[fmt]}
          <ChevronDown className="h-3 w-3" />
        </button>
        {showFormatMenu && (
          <div className="absolute left-0 top-full z-50 mt-1 w-28 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {(Object.keys(fmtLabel) as NumberFormat[]).map((f) => (
              <button key={f} type="button" onClick={() => { onStyleChange({ numberFormat: f }); setShowFormatMenu(false); }} className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 ${fmt === f ? "text-blue-600 font-medium" : "text-gray-700"}`}>
                {fmtLabel[f]}
              </button>
            ))}
          </div>
        )}
      </div>

      <ToolbarBtn onClick={() => onStyleChange({ numberFormat: "currency" })} active={fmt === "currency"} title="货币格式">
        <span className="text-sm font-medium">¥</span>
      </ToolbarBtn>
      <ToolbarBtn onClick={() => onStyleChange({ numberFormat: "percent" })} active={fmt === "percent"} title="百分比">
        <span className="text-sm font-medium">%</span>
      </ToolbarBtn>
      <ToolbarBtn onClick={() => onStyleChange({ decimalPlaces: Math.max(0, (currentStyle.decimalPlaces ?? 2) - 1), numberFormat: fmt === "general" ? "number" : fmt })} title="减少小数位">
        <span className="text-xs">.0←</span>
      </ToolbarBtn>
      <ToolbarBtn onClick={() => onStyleChange({ decimalPlaces: Math.min(10, (currentStyle.decimalPlaces ?? 2) + 1), numberFormat: fmt === "general" ? "number" : fmt })} title="增加小数位">
        <span className="text-xs">.00→</span>
      </ToolbarBtn>

      <div className="mx-1 h-6 w-px bg-gray-200" />

      <div ref={freezeRef} className="relative">
        <ToolbarBtn onClick={() => setShowFreezeMenu(!showFreezeMenu)} active={freezeActive} title="冻结">
          <Snowflake className="h-4 w-4" />
          <span>冻结</span>
        </ToolbarBtn>
        {showFreezeMenu && (
          <div className="absolute left-0 top-full z-50 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <button type="button" onClick={() => { onFreezeFirstRowCol(); setShowFreezeMenu(false); }} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50">冻结首行首列</button>
            <button type="button" onClick={() => { onFreezeToSelection(); setShowFreezeMenu(false); }} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50">冻结至当前选区</button>
            <button type="button" onClick={() => { onUnfreeze(); setShowFreezeMenu(false); }} className="block w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-gray-50">取消冻结</button>
          </div>
        )}
      </div>

      <ToolbarBtn onClick={onToggleFilter} active={filterActive} title="筛选">
        <Filter className="h-4 w-4" />
        <span>筛选</span>
      </ToolbarBtn>
      <ToolbarBtn onClick={onSortAsc} title="升序排序">
        <ArrowUpDown className="h-4 w-4 rotate-180" />
        <span>排序</span>
      </ToolbarBtn>
      <ToolbarBtn onClick={onSortDesc} title="降序排序">
        <ArrowUpDown className="h-4 w-4" />
      </ToolbarBtn>

      <ToolbarBtn onClick={onOpenCondFormat} active={condFormatActive} title="条件格式">
        <Palette className="h-4 w-4" />
        <span>条件格式</span>
      </ToolbarBtn>

      <ToolbarBtn onClick={onOpenFormula} title="公式">
        <Sigma className="h-4 w-4" />
        <span>公式</span>
      </ToolbarBtn>

      <div className="mx-1 h-6 w-px bg-gray-200" />

      <ToolbarBtn onClick={onPrint} title="打印预览">
        <Printer className="h-4 w-4" />
        <span>打印</span>
      </ToolbarBtn>

      <div ref={exportRef} className="relative">
        <ToolbarBtn onClick={() => setShowExportMenu(!showExportMenu)} title="导出 CSV / Excel">
          <Download className="h-4 w-4" />
          <span>导出</span>
        </ToolbarBtn>
        {showExportMenu && (
          <div className="absolute left-0 top-full z-50 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <button type="button" onClick={() => { onExportCsv(); setShowExportMenu(false); }} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50">导出 CSV</button>
            <button type="button" onClick={() => { onExportExcel(); setShowExportMenu(false); }} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50">导出 Excel (当前表)</button>
            <button type="button" onClick={() => { onExportWorkbook(); setShowExportMenu(false); }} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50">导出 Excel (全部)</button>
          </div>
        )}
      </div>
    </div>
  );
}
