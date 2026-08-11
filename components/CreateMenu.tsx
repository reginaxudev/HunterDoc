"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { CONTENT_TYPE_META } from "@/lib/content-types";
import type { ContentType } from "@/types/document";

interface CreateMenuProps {
  onCreate: (type: ContentType) => void;
  onFromTemplate?: () => void;
}

export default function CreateMenu({ onCreate, onFromTemplate }: CreateMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const types: ContentType[] = ["doc", "sheet", "mindmap", "bitable"];

  return (
    <div ref={ref} className="relative flex flex-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex flex-1 items-center justify-center gap-1 rounded-md bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-3.5 w-3.5" />
        新建
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
          {types.map((type) => {
            const meta = CONTENT_TYPE_META[type];
            return (
              <button
                key={type}
                onClick={() => {
                  onCreate(type);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50"
              >
                <span className="text-xl">{meta.icon}</span>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {meta.label}
                  </div>
                  <div className="text-xs text-gray-400">{meta.description}</div>
                </div>
              </button>
            );
          })}
          {onFromTemplate && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button
                onClick={() => {
                  onFromTemplate();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50"
              >
                <span className="text-base">📋</span>
                从模板创建文档
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
