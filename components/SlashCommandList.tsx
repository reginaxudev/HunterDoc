"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import type { SlashCommandItem } from "@/lib/tiptap/slash-command";

export interface SlashCommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface SlashCommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

const SlashCommandList = forwardRef<SlashCommandListRef, SlashCommandListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => setSelectedIndex(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          if (items[selectedIndex]) command(items[selectedIndex]);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-400 shadow-lg">
          无匹配命令
        </div>
      );
    }

    return (
      <div className="max-h-72 w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl">
        <div className="px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
          快捷命令
        </div>
        {items.map((item, index) => (
          <button
            key={item.title}
            onClick={() => command(item)}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
              index === selectedIndex ? "bg-blue-50" : "hover:bg-gray-50"
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-sm">
              {item.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-800">{item.title}</div>
              <div className="text-xs text-gray-400">{item.description}</div>
            </div>
          </button>
        ))}
      </div>
    );
  }
);

SlashCommandList.displayName = "SlashCommandList";
export default SlashCommandList;
