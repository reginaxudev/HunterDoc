"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Type, PaintBucket, Check, ChevronRight, Palette } from "lucide-react";
import {
  type ColorPickerMode,
  buildPaletteGrid,
  loadRecentColors,
  saveRecentColor,
  colorsMatch,
  displayBarColor,
  isLightColor,
} from "@/lib/sheet-color-palette";

interface SheetColorPickerProps {
  mode: ColorPickerMode;
  value?: string;
  onChange: (color: string) => void;
  active?: boolean;
}

export default function SheetColorPicker({
  mode,
  value,
  onChange,
  active,
}: SheetColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hexInput, setHexInput] = useState(value ?? "");
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const grid = useMemo(() => buildPaletteGrid(mode), [mode]);
  const title = mode === "text" ? "字体颜色" : "底纹填充色";
  const Icon = mode === "text" ? Type : PaintBucket;
  const barColor = displayBarColor(mode, value);

  useEffect(() => {
    if (open) {
      setRecent(loadRecentColors(mode));
      setHexInput(value ?? "");
      setShowAdvanced(false);
      if (btnRef.current) {
        const r = btnRef.current.getBoundingClientRect();
        setCoords({ top: r.bottom + 4, left: r.left });
      }
    }
  }, [open, mode, value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const pick = (color: string, clearFill = false) => {
    if (clearFill) {
      onChange("");
    } else {
      onChange(color);
      saveRecentColor(mode, color);
    }
    setRecent(loadRecentColors(mode));
    setOpen(false);
  };

  const applyHex = () => {
    let c = hexInput.trim();
    if (!c.startsWith("#")) c = `#${c}`;
    if (/^#[0-9a-f]{3,6}$/i.test(c)) {
      pick(c);
    }
  };

  const isNoFill = (_color: string, row: number, col: number) =>
    mode === "fill" && row === 0 && col === 0;

  const panel = open ? (
    <div
      ref={panelRef}
      className="w-[248px] rounded-xl border border-gray-200 bg-white py-3 shadow-xl"
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        zIndex: 10000,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="px-3">
        <div className="flex flex-col gap-[5px]">
          {grid.map((row, ri) => (
            <div key={ri} className="flex gap-[5px]">
              {row.map((color, ci) => {
                const selected = colorsMatch(value, color);
                const noFill = isNoFill(color, ri, ci);
                return (
                  <button
                    key={`${ri}-${ci}`}
                    type="button"
                    title={noFill ? "无填充" : color}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(color, noFill)}
                    className={`relative h-[18px] w-[18px] shrink-0 rounded-[3px] border transition-transform hover:scale-110 ${
                      selected
                        ? "border-blue-500 ring-2 ring-blue-400 ring-offset-1"
                        : "border-gray-200/80"
                    }`}
                    style={{ backgroundColor: noFill ? "#ffffff" : color }}
                  >
                    {noFill && (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-gray-400">
                        ∅
                      </span>
                    )}
                    {selected && !noFill && (
                      <Check
                        className={`absolute inset-0 m-auto h-3 w-3 ${
                          isLightColor(color) ? "text-gray-700" : "text-white"
                        }`}
                        strokeWidth={3}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {recent.length > 0 && (
        <div className="mt-3 px-3">
          <div className="mb-1.5 text-xs text-gray-400">最近使用</div>
          <div className="flex flex-wrap gap-[5px]">
            {recent.map((color) => (
              <button
                key={color}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(color)}
                className={`h-[18px] w-[18px] rounded-[3px] border hover:scale-110 ${
                  colorsMatch(value, color) ? "border-blue-500 ring-1 ring-blue-400" : "border-gray-200"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mx-3 my-2 border-t border-gray-100" />

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
      >
        <Palette className="h-4 w-4 text-gray-500" />
        <span className="flex-1">更多颜色</span>
        <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${showAdvanced ? "rotate-90" : ""}`} />
      </button>

      {showAdvanced && (
        <div className="space-y-2 px-3 pb-1 pt-1">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(hexInput) ? hexInput : "#000000"}
              onChange={(e) => {
                setHexInput(e.target.value);
                pick(e.target.value);
              }}
              className="h-8 w-10 cursor-pointer rounded border border-gray-200 bg-transparent"
            />
            <input
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyHex()}
              placeholder="#000000"
              className="flex-1 rounded border border-gray-200 px-2 py-1 font-mono text-xs outline-none focus:ring-1 focus:ring-blue-300"
            />
            <button
              type="button"
              onClick={applyHex}
              className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
            >
              确定
            </button>
          </div>
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen(!open)}
        title={title}
        className={`flex flex-col items-center gap-0.5 rounded px-1.5 py-1 text-[10px] leading-none transition-colors ${
          open || active ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        <div className="relative flex h-4 w-4 items-end justify-center">
          <Icon className="h-4 w-4" />
          <div
            className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-sm border border-gray-200/50"
            style={{ backgroundColor: barColor }}
          />
        </div>
        <span>{mode === "text" ? "文字色" : "填充色"}</span>
      </button>
      {typeof document !== "undefined" && panel
        ? createPortal(panel, document.body)
        : null}
    </>
  );
}
