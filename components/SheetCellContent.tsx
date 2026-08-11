"use client";

import {
  type CellMeta,
  isCheckboxTrue,
  formatDisplayDate,
  isDatePast,
  isDateSoon,
} from "@/lib/sheet-cell-meta";

interface SheetCellContentProps {
  raw: string;
  display: string;
  meta?: CellMeta;
  dropdownOpts?: string[];
  editing: boolean;
  editable: boolean;
  formulaBar: string;
  sparklineValues?: number[];
  chartValues?: number[];
  chartLabels?: string[];
  onFormulaChange: (v: string) => void;
  onCommit: () => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onToggleCheckbox: () => void;
  onOpenNote: () => void;
  textAlign?: string;
  textColor?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  fontSize?: string;
  isFormula?: boolean;
  isError?: boolean;
}

function SparklineSvg({ values, color = "#3b82f6" }: { values: number[]; color?: string }) {
  if (values.length === 0) return <span className="text-xs text-gray-300">—</span>;
  const w = 80;
  const h = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} className="inline-block">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}

function MiniBarChart({ values, labels }: { values: number[]; labels: string[] }) {
  if (values.length === 0) return <span className="text-xs text-gray-300">无数据</span>;
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-16 items-end gap-0.5 px-1 py-1">
      {values.slice(0, 8).map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
          <div
            className="w-full rounded-t bg-blue-500"
            style={{ height: `${Math.max(4, (v / max) * 48)}px` }}
          />
          <span className="max-w-full truncate text-[8px] text-gray-400">
            {labels[i] ?? String(i + 1)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SheetCellContent({
  raw,
  display,
  meta,
  dropdownOpts,
  editing,
  editable,
  formulaBar,
  sparklineValues = [],
  chartValues = [],
  chartLabels = [],
  onFormulaChange,
  onCommit,
  onBlur,
  onKeyDown,
  onToggleCheckbox,
  onOpenNote,
  textAlign,
  textColor,
  fontWeight,
  fontStyle,
  textDecoration,
  fontSize,
  isFormula,
  isError,
}: SheetCellContentProps) {
  if (editing && editable) {
    if (meta?.type === "date" || meta?.type === "dateReminder") {
      return (
        <input
          autoFocus
          type="date"
          value={raw.slice(0, 10)}
          onChange={(e) => onFormulaChange(e.target.value)}
          onBlur={onBlur}
          className="relative z-[1] w-full bg-blue-50 px-2 py-1.5 text-sm outline-none"
        />
      );
    }
    if (dropdownOpts?.length) {
      return (
        <select
          autoFocus
          value={formulaBar}
          onChange={(e) => {
            onFormulaChange(e.target.value);
            onCommit();
          }}
          onBlur={onBlur}
          className="relative z-[1] w-full bg-blue-50 px-1 py-1 text-sm outline-none"
        >
          <option value="">请选择</option>
          {dropdownOpts.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        autoFocus
        value={formulaBar}
        onChange={(e) => onFormulaChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className="relative z-[1] w-full bg-blue-50 px-2 py-1.5 font-mono text-sm outline-none"
        style={{ textAlign: textAlign as React.CSSProperties["textAlign"] }}
      />
    );
  }

  if (meta?.type === "checkbox") {
    return (
      <label
        className="relative z-[1] flex cursor-pointer items-center justify-center px-2 py-1.5"
        onClick={(e) => {
          e.stopPropagation();
          if (editable) onToggleCheckbox();
        }}
      >
        <input
          type="checkbox"
          checked={isCheckboxTrue(raw)}
          readOnly
          className="h-4 w-4 rounded border-gray-300 text-blue-600"
        />
      </label>
    );
  }

  if (meta?.type === "date") {
    return (
      <span className="relative z-[1] flex items-center gap-1 px-2 py-1.5 text-sm text-gray-700">
        <span>📅</span>
        {formatDisplayDate(raw) || "选择日期"}
      </span>
    );
  }

  if (meta?.type === "dateReminder") {
    const past = isDatePast(raw);
    const soon = isDateSoon(raw);
    return (
      <span
        className={`relative z-[1] flex items-center gap-1 px-2 py-1.5 text-sm ${
          past ? "text-red-600" : soon ? "text-amber-600" : "text-gray-700"
        }`}
      >
        <span>{past ? "⏰" : soon ? "🔔" : "📅"}</span>
        {formatDisplayDate(raw) || "设置提醒"}
        {meta.reminder?.message && (
          <span className="truncate text-xs text-gray-400">({meta.reminder.message})</span>
        )}
      </span>
    );
  }

  if (meta?.type === "image" && meta.image?.url) {
    return (
      <div className="relative z-[1] flex items-center justify-center p-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={meta.image.url}
          alt={meta.image.alt ?? ""}
          className="max-h-16 max-w-full rounded object-contain"
        />
      </div>
    );
  }

  if (meta?.type === "link" && meta.link) {
    return (
      <a
        href={meta.link.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="relative z-[1] block truncate px-2 py-1.5 text-sm text-blue-600 underline"
      >
        {meta.link.label || meta.link.url || display}
      </a>
    );
  }

  if (meta?.type === "attachment" && meta.attachment) {
    return (
      <a
        href={meta.attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="relative z-[1] flex items-center gap-1 truncate px-2 py-1.5 text-sm text-gray-700 hover:text-blue-600"
      >
        <span>📎</span>
        {meta.attachment.name}
      </a>
    );
  }

  if (meta?.type === "sparkline") {
    return (
      <div className="relative z-[1] flex items-center justify-center px-1 py-1">
        <SparklineSvg values={sparklineValues} color={meta.sparkline?.color} />
      </div>
    );
  }

  if (meta?.type === "chart") {
    return (
      <div className="relative z-[1] w-full">
        {meta.chart?.title && (
          <div className="truncate px-1 text-[10px] font-medium text-gray-500">
            {meta.chart.title}
          </div>
        )}
        <MiniBarChart values={chartValues} labels={chartLabels} />
      </div>
    );
  }

  if (meta?.type === "pivot") {
    return (
      <span className="relative z-[1] px-2 py-1.5 text-xs text-violet-600">📊 透视表区域</span>
    );
  }

  const hasNote = meta?.type === "note" && meta.note;

  return (
    <span
      className="relative z-[1] flex items-center px-2 py-1.5 text-sm"
      style={{
        color: isError ? "#ef4444" : isFormula && !textColor ? "#047857" : textColor,
        fontWeight,
        fontStyle,
        textDecoration,
        fontSize,
        textAlign: textAlign as React.CSSProperties["textAlign"],
        justifyContent:
          textAlign === "center" ? "center" : textAlign === "right" ? "flex-end" : "flex-start",
      }}
    >
      {display}
      {dropdownOpts?.length ? (
        <span className="ml-auto text-[10px] text-gray-400">▾</span>
      ) : null}
      {hasNote && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenNote();
          }}
          className="ml-1 text-amber-500 hover:text-amber-600"
          title="查看备注"
        >
          📝
        </button>
      )}
    </span>
  );
}
