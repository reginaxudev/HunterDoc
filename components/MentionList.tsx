"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import type { MentionItem, MentionTab } from "@/lib/mentions";

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface MentionListProps {
  items: MentionItem[];
  query?: string;
  activeTab?: MentionTab;
  command: (item: MentionItem) => void;
  onTabChange?: (tab: MentionTab) => void;
}

const TABS: { id: MentionTab; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "person", label: "成员" },
  { id: "group", label: "群组" },
  { id: "document", label: "文档" },
  { id: "date", label: "日期" },
];

const TYPE_LABELS: Record<string, string> = {
  person: "成员",
  group: "群组",
  document: "文档",
  date: "日期",
};

const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, query = "", activeTab = "all", command, onTabChange }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => setSelectedIndex(0), [items, activeTab]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i + items.length - 1) % Math.max(items.length, 1));
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % Math.max(items.length, 1));
          return true;
        }
        if (event.key === "Enter") {
          if (items[selectedIndex]) command(items[selectedIndex]);
          return true;
        }
        return false;
      },
    }));

    // Group items by type when showing "all" tab without query
  const showGroups = activeTab === "all" && !query.trim();
  const grouped = showGroups
    ? (["person", "group", "document", "date"] as const).map((type) => ({
          type,
          items: items.filter((i) => i.type === type),
        })).filter((g) => g.items.length > 0)
      : null;

    const flatItems = grouped
      ? grouped.flatMap((g) => g.items)
      : items;

    let runningIndex = 0;

    return (
      <div className="w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex border-b border-gray-100">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange?.(tab.id)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="max-h-64 overflow-y-auto py-1">
          {flatItems.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-gray-400">
              未找到匹配项
            </div>
          ) : grouped ? (
            grouped.map((group) => (
              <div key={group.type}>
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {TYPE_LABELS[group.type]}
                </div>
                {group.items.map((item) => {
                  const idx = runningIndex++;
                  return (
                    <MentionRow
                      key={item.id}
                      item={item}
                      selected={idx === selectedIndex}
                      onSelect={() => command(item)}
                    />
                  );
                })}
              </div>
            ))
          ) : (
            flatItems.map((item, index) => (
              <MentionRow
                key={item.id}
                item={item}
                selected={index === selectedIndex}
                onSelect={() => command(item)}
              />
            ))
          )}
        </div>

        <div className="border-t border-gray-100 px-3 py-1.5 text-[10px] text-gray-400">
          ↑↓ 选择 · Enter 确认 · Esc 关闭
        </div>
      </div>
    );
  }
);

function MentionRow({
  item,
  selected,
  onSelect,
}: {
  item: MentionItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
        selected ? "bg-blue-50 text-blue-800" : "hover:bg-gray-50"
      }`}
    >
      {item.type === "person" ? (
        <span
          className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: item.color ?? "#2563eb" }}
        >
          {item.label.slice(0, 1)}
          {item.online && (
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" />
          )}
        </span>
      ) : item.type === "group" ? (
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm"
          style={{ backgroundColor: `${item.color}20` }}
        >
          {item.icon ?? "👥"}
        </span>
      ) : (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-sm">
          {item.icon ?? (item.type === "date" ? "📅" : "📄")}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{item.label}</div>
        {item.subtitle && (
          <div className="truncate text-xs text-gray-400">{item.subtitle}</div>
        )}
        {item.role && item.type === "person" && (
          <div className="truncate text-xs text-gray-400">{item.role}</div>
        )}
      </div>
      {item.online && (
        <span className="shrink-0 text-[10px] text-emerald-600">在线</span>
      )}
    </button>
  );
}

MentionList.displayName = "MentionList";
export default MentionList;
