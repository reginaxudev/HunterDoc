"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  CheckSquare,
  List,
  Calendar,
  AlarmClock,
  Image,
  BarChart3,
  TrendingUp,
  TableProperties,
  Link2,
  Paperclip,
  StickyNote,
  ChevronRight,
  Rows3,
  Columns3,
  Plus,
} from "lucide-react";
import type { InsertAction } from "@/lib/sheet-cell-meta";

interface SheetInsertButtonProps {
  onInsert: (action: InsertAction) => void;
}

interface MenuItem {
  id: InsertAction;
  label: string;
  icon: React.ReactNode;
  submenu?: { id: InsertAction; label: string }[];
}

const SECTIONS: { items: MenuItem[] }[] = [
  {
    items: [
      { id: "checkbox", label: "复选框", icon: <CheckSquare className="h-4 w-4" /> },
      { id: "dropdown", label: "下拉列表", icon: <List className="h-4 w-4" /> },
      { id: "date", label: "日期选项", icon: <Calendar className="h-4 w-4" /> },
      { id: "dateReminder", label: "日期提醒", icon: <AlarmClock className="h-4 w-4" /> },
    ],
  },
  {
    items: [
      {
        id: "imageUpload",
        label: "图片",
        icon: <Image className="h-4 w-4" />,
        submenu: [
          { id: "imageUpload", label: "上传图片" },
          { id: "imageUrl", label: "图片链接" },
        ],
      },
      { id: "chart", label: "图表", icon: <BarChart3 className="h-4 w-4" /> },
      { id: "sparkline", label: "迷你图", icon: <TrendingUp className="h-4 w-4" /> },
      { id: "pivot", label: "数据透视表", icon: <TableProperties className="h-4 w-4" /> },
    ],
  },
  {
    items: [
      { id: "link", label: "链接", icon: <Link2 className="h-4 w-4" /> },
      { id: "attachment", label: "附件", icon: <Paperclip className="h-4 w-4" /> },
    ],
  },
  {
    items: [
      { id: "note", label: "备注", icon: <StickyNote className="h-4 w-4" /> },
      { id: "row", label: "插入行", icon: <Rows3 className="h-4 w-4" /> },
      { id: "col", label: "插入列", icon: <Columns3 className="h-4 w-4" /> },
    ],
  },
];

function MenuRow({
  item,
  onSelect,
}: {
  item: MenuItem;
  onSelect: (action: InsertAction) => void;
}) {
  const [hover, setHover] = useState(false);
  const hasSub = item.submenu && item.submenu.length > 0;

  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => !hasSub && onSelect(item.id)}
        className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
      >
        <span className="text-gray-500">{item.icon}</span>
        <span className="flex-1">{item.label}</span>
        {hasSub && <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
      </button>
      {hasSub && hover && (
        <div
          className="absolute left-full top-0 z-[10001] ml-0.5 min-w-[128px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {item.submenu!.map((sub) => (
            <button
              key={sub.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(sub.id)}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              {sub.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SheetInsertButton({ onInsert }: SheetInsertButtonProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setCoords({ top: r.bottom + 4, left: r.left });
    }
  }, [open]);

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

  const handleSelect = (action: InsertAction) => {
    onInsert(action);
    setOpen(false);
  };

  const panel = open ? (
    <div
      ref={panelRef}
      className="w-52 rounded-xl border border-gray-200 bg-white py-2 shadow-xl"
      style={{ position: "fixed", top: coords.top, left: coords.left, zIndex: 10000 }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {SECTIONS.map((section, si) => (
        <div key={si}>
          {si > 0 && <div className="my-1 border-t border-gray-100" />}
          {section.items.map((item) => (
            <MenuRow key={item.id + item.label} item={item} onSelect={handleSelect} />
          ))}
        </div>
      ))}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen(!open)}
        title="插入"
        className={`flex flex-col items-center gap-0.5 rounded px-1.5 py-1 text-[10px] leading-none transition-colors ${
          open ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        <Plus className="h-4 w-4" />
        <span>插入</span>
      </button>
      {typeof document !== "undefined" && panel ? createPortal(panel, document.body) : null}
    </>
  );
}
