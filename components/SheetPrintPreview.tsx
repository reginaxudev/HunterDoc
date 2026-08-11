"use client";

import { useMemo, useState } from "react";
import { X, Printer } from "lucide-react";
import type { SheetTab } from "@/lib/content-types";
import {
  colLabel,
  evaluateCell,
  isFormula,
  getColWidth,
  getRowHeight,
} from "@/lib/sheet-formula";
import {
  getCellStyle,
  findMergeAt,
  isMergeHidden,
  formatNumberDisplay,
  cellStyleToCssPlain,
} from "@/lib/sheet-cell-style";
import { getCellConditionalStyle } from "@/lib/sheet-conditional-format";

interface SheetPrintPreviewProps {
  sheet: SheetTab;
  title: string;
  onClose: () => void;
}

export default function SheetPrintPreview({
  sheet,
  title,
  onClose,
}: SheetPrintPreviewProps) {
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
  const [scale, setScale] = useState(100);
  const [showGridlines, setShowGridlines] = useState(true);

  const rows = sheet.rows ?? [[""]];
  const colCount = Math.max(...rows.map((r) => r.length), 1);
  const cellStyles = sheet.cellStyles ?? {};
  const mergedRegions = sheet.mergedRegions ?? [];
  const colWidths = sheet.colWidths ?? {};
  const rowHeights = sheet.rowHeights ?? {};
  const conditionalFormats = sheet.conditionalFormats ?? [];

  const getRawCell = (row: number, col: number) => rows[row]?.[col] ?? "";

  const getDisplayCell = useMemo(() => {
    return (row: number, col: number): string => {
      const raw = getRawCell(row, col);
      if (raw.startsWith("=")) {
        return evaluateCell(raw, (r, c) => {
          const v = rows[r]?.[c] ?? "";
          if (v.startsWith("=")) return evaluateCell(v, (rr, cc) => rows[rr]?.[cc] ?? "");
          return v;
        });
      }
      return formatNumberDisplay(raw, getCellStyle(cellStyles, row, col));
    };
  }, [rows, cellStyles]);

  const handlePrint = () => {
    window.print();
  };

  const renderCell = (ri: number, ci: number) => {
    if (isMergeHidden(mergedRegions, ri, ci)) return null;

    const raw = getRawCell(ri, ci);
    const display = getDisplayCell(ri, ci);
    const style = getCellStyle(cellStyles, ri, ci);
    const css = cellStyleToCssPlain(style);
    const condStyle = getCellConditionalStyle(
      ri,
      ci,
      conditionalFormats,
      getDisplayCell,
      rows.length,
      colCount
    );
    const merge = findMergeAt(mergedRegions, ri, ci);
    const rowSpan = merge ? merge.endRow - merge.startRow + 1 : 1;
    const colSpan = merge ? merge.endCol - merge.startCol + 1 : 1;

    return (
      <td
        key={ci}
        rowSpan={rowSpan > 1 ? rowSpan : undefined}
        colSpan={colSpan > 1 ? colSpan : undefined}
        className={`px-2 py-1 text-sm ${showGridlines ? "border border-gray-300" : ""}`}
        style={{
          ...css,
          width: getColWidth(colWidths, ci),
          height: getRowHeight(rowHeights, ri),
          backgroundColor:
            condStyle?.backgroundColor && !condStyle.barPercent
              ? condStyle.backgroundColor
              : css.backgroundColor,
          color: condStyle?.textColor ?? css.color,
          fontWeight: condStyle?.bold ? "bold" : css.fontWeight,
        }}
      >
        <span
          className={
            isFormula(raw) && !style?.textColor ? "text-emerald-700" : ""
          }
        >
          {display}
        </span>
      </td>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/40">
      {/* Controls — hidden when printing */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 print:hidden">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-semibold text-gray-800">打印预览</h2>
          <select
            value={orientation}
            onChange={(e) => setOrientation(e.target.value as "portrait" | "landscape")}
            className="rounded border border-gray-200 px-2 py-1 text-xs outline-none"
          >
            <option value="portrait">纵向</option>
            <option value="landscape">横向</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            缩放
            <input
              type="range"
              min={50}
              max={150}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="w-24"
            />
            {scale}%
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={showGridlines}
              onChange={(e) => setShowGridlines(e.target.checked)}
            />
            网格线
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
          >
            <Printer className="h-3.5 w-3.5" />
            打印
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex flex-1 items-start justify-center overflow-auto p-8 print:p-0 print:overflow-visible">
        <div
          id="sheet-print-area"
          className="bg-white shadow-xl print:shadow-none"
          style={{
            transform: `scale(${scale / 100})`,
            transformOrigin: "top center",
          }}
        >
          <style>{`
            @media print {
              @page {
                size: ${orientation};
                margin: 12mm;
              }
              body * { visibility: hidden; }
              #sheet-print-area, #sheet-print-area * { visibility: visible; }
              #sheet-print-area {
                position: absolute;
                left: 0;
                top: 0;
                transform: none !important;
                box-shadow: none !important;
              }
            }
          `}</style>

          <div className="border-b border-gray-200 px-6 py-3 print:py-2">
            <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
            <p className="text-xs text-gray-400">{sheet.name}</p>
          </div>

          <table className="border-collapse">
            <thead>
              <tr>
                <th className={`w-8 bg-gray-50 text-xs text-gray-400 ${showGridlines ? "border border-gray-300" : ""}`} />
                {Array.from({ length: colCount }).map((_, ci) => (
                  <th
                    key={ci}
                    className={`bg-gray-50 px-2 py-1 text-center text-xs font-medium text-gray-500 ${showGridlines ? "border border-gray-300" : ""}`}
                    style={{ width: getColWidth(colWidths, ci) }}
                  >
                    {colLabel(ci)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((_, ri) => (
                <tr key={ri} style={{ height: getRowHeight(rowHeights, ri) }}>
                  <td className={`bg-gray-50 text-center text-xs text-gray-400 ${showGridlines ? "border border-gray-300" : ""}`}>
                    {ri + 1}
                  </td>
                  {Array.from({ length: colCount }).map((_, ci) => renderCell(ri, ci))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
