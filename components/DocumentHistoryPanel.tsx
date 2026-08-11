"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { History, X, RotateCcw, Loader2, HelpCircle } from "lucide-react";
import type { Document } from "@/types/document";
import type { DocumentRevisionRecord } from "@/lib/document-history";
import {
  formatHistoryDateKey,
  formatHistoryTime,
} from "@/lib/document-history";

interface DocumentHistoryPanelProps {
  documentId: string;
  onRestored?: (doc: Document) => void;
}

interface HistoryGroup {
  dateKey: string;
  items: DocumentRevisionRecord[];
}

function groupByDate(revisions: DocumentRevisionRecord[]): HistoryGroup[] {
  const map = new Map<string, DocumentRevisionRecord[]>();
  for (const rev of revisions) {
    const key = formatHistoryDateKey(rev.createdAt);
    const list = map.get(key) ?? [];
    list.push(rev);
    map.set(key, list);
  }
  return Array.from(map.entries()).map(([dateKey, items]) => ({ dateKey, items }));
}

export default function DocumentHistoryPanel({
  documentId,
  onRestored,
}: DocumentHistoryPanelProps) {
  const [open, setOpen] = useState(false);
  const [revisions, setRevisions] = useState<DocumentRevisionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const groups = useMemo(() => groupByDate(revisions), [revisions]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/history`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as DocumentRevisionRecord[];
      setRevisions(data);
      if (!selectedId && data.length > 0) {
        setSelectedId(data[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [documentId, selectedId]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  async function handleRestore(revisionId: string) {
    if (!confirm("确定恢复到该历史版本？当前未保存的修改可能会丢失。")) return;
    setRestoringId(revisionId);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/history/${revisionId}/restore`,
        { method: "POST" }
      );
      if (!res.ok) {
        alert("恢复失败，请稍后重试");
        return;
      }
      const doc = (await res.json()) as Document;
      onRestored?.(doc);
      void refresh();
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        title="历史记录"
      >
        <History className="h-3.5 w-3.5" />
        历史记录
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/20">
          <aside className="flex h-full w-full max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-semibold text-gray-900">历史记录</h2>
                <HelpCircle className="h-3.5 w-3.5 text-gray-400" aria-hidden />
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-3">
              {loading && revisions.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : revisions.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-gray-400">
                  暂无编辑记录
                </p>
              ) : (
                groups.map((group) => (
                  <div key={group.dateKey} className="mb-4">
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">
                      {group.dateKey}
                    </div>
                    <ul className="space-y-0.5">
                      {group.items.map((rev) => {
                        const isSelected = selectedId === rev.id;
                        const isRestoring = restoringId === rev.id;
                        return (
                          <li key={rev.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedId(rev.id)}
                              className={`w-full rounded-md px-3 py-2.5 text-left transition-colors ${
                                isSelected
                                  ? "border-l-2 border-blue-500 bg-blue-50/80 pl-[10px]"
                                  : "border-l-2 border-transparent hover:bg-gray-50"
                              }`}
                            >
                              <div className="flex items-baseline gap-2 text-xs text-gray-500">
                                <span className="font-medium tabular-nums">
                                  {formatHistoryTime(rev.createdAt)}
                                </span>
                                <span>{rev.userName}</span>
                              </div>
                              <p className="mt-0.5 text-sm text-gray-800">
                                {rev.changeSummary}
                              </p>
                            </button>
                            {isSelected && (
                              <div className="px-3 pb-2">
                                <button
                                  type="button"
                                  disabled={isRestoring}
                                  onClick={() => void handleRestore(rev.id)}
                                  className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                  {isRestoring ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  )}
                                  恢复到此版本
                                </button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </aside>
          <button
            type="button"
            className="flex-1"
            aria-label="关闭"
            onClick={() => setOpen(false)}
          />
        </div>
      )}
    </>
  );
}
