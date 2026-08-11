"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { ListTree, X } from "lucide-react";

interface HeadingItem {
  level: number;
  text: string;
  pos: number;
}

function extractHeadings(editor: Editor): HeadingItem[] {
  const headings: HeadingItem[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      headings.push({
        level: node.attrs.level as number,
        text: node.textContent,
        pos,
      });
    }
  });
  return headings;
}

function countWords(editor: Editor): { chars: number; words: number } {
  const text = editor.state.doc.textContent;
  const chars = text.replace(/\s/g, "").length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return { chars, words };
}

interface DocOutlinePanelProps {
  editor: Editor;
  open: boolean;
  onClose: () => void;
}

export default function DocOutlinePanel({
  editor,
  open,
  onClose,
}: DocOutlinePanelProps) {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [stats, setStats] = useState({ chars: 0, words: 0 });

  useEffect(() => {
    const update = () => {
      setHeadings(extractHeadings(editor));
      setStats(countWords(editor));
    };
    update();
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor]);

  if (!open) return null;

  return (
    <aside className="flex w-56 shrink-0 flex-col border-l border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
          <ListTree className="h-3.5 w-3.5" />
          文档大纲
        </div>
        <button onClick={onClose} className="rounded p-0.5 text-gray-400 hover:bg-gray-200">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="border-b border-gray-200 px-3 py-2 text-xs text-gray-500">
        {stats.chars} 字 · {stats.words} 词
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {headings.length === 0 ? (
          <p className="px-2 py-4 text-xs text-gray-400">
            使用标题（H1/H2/H3）自动生成大纲
          </p>
        ) : (
          headings.map((h, i) => (
            <button
              key={`${h.pos}-${i}`}
              onClick={() => {
                editor.chain().focus().setTextSelection(h.pos + 1).run();
                const el = document.querySelector(".ProseMirror");
                const headingEls = el?.querySelectorAll("h1, h2, h3");
                const idx = headings.indexOf(h);
                headingEls?.[idx]?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className={`block w-full truncate rounded px-2 py-1.5 text-left text-xs hover:bg-white ${
                h.level === 1
                  ? "font-semibold text-gray-800"
                  : h.level === 2
                    ? "pl-4 text-gray-700"
                    : "pl-6 text-gray-600"
              }`}
            >
              {h.text || "无标题"}
            </button>
          ))
        )}
      </div>
    </aside>
  );
}

export function DocStats({ editor }: { editor: Editor }) {
  const [stats, setStats] = useState({ chars: 0, words: 0 });

  useEffect(() => {
    const update = () => setStats(countWords(editor));
    update();
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor]);

  return (
    <span className="text-xs text-gray-400">
      {stats.chars} 字
    </span>
  );
}
