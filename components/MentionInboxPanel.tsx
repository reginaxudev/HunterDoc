"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, X, Check, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  fetchMentionInbox,
  markInboxRead,
  clearInbox,
  type MentionNotification,
} from "@/lib/mention-inbox";
import { formatRelativeTime } from "@/lib/utils";

const INBOX_POLL_MS = 30_000;

export default function MentionInboxPanel() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const userId = authUser?.id ?? "";
  const [open, setOpen] = useState(false);
  const [inbox, setInbox] = useState<MentionNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setInbox([]);
      setUnread(0);
      return;
    }
    setLoading(true);
    try {
      const items = await fetchMentionInbox();
      setInbox(items);
      setUnread(items.filter((n) => !n.read).length);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
    const handler = () => void refresh();
    window.addEventListener("mention-inbox-update", handler);
    window.addEventListener("focus", handler);
    const timer = window.setInterval(() => void refresh(), INBOX_POLL_MS);
    return () => {
      window.removeEventListener("mention-inbox-update", handler);
      window.removeEventListener("focus", handler);
      window.clearInterval(timer);
    };
  }, [refresh]);

  return (
    <div className="relative border-t border-gray-200 px-3 py-2">
      <button
        onClick={() => {
          setOpen(!open);
          void refresh();
          if (!open && unread > 0) void markInboxRead(userId);
        }}
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-gray-600 hover:bg-gray-100"
      >
        <div className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </div>
        <span>@ 消息</span>
        {unread > 0 && (
          <span className="ml-auto text-xs text-red-500">{unread} 未读</span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-3 right-3 z-50 mb-1 max-h-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <span className="text-xs font-semibold text-gray-700">@ 消息收件箱</span>
            <div className="flex items-center gap-1">
              {inbox.length > 0 && (
                <>
                  <button
                    onClick={() => {
                      void markInboxRead(userId).then(refresh);
                    }}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100"
                    title="全部已读"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      void clearInbox(userId).then(refresh);
                    }}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100"
                    title="清空"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              <button onClick={() => setOpen(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {loading && inbox.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-gray-400">加载中...</p>
            ) : inbox.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-gray-400">暂无 @ 消息</p>
            ) : (
              inbox.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    void markInboxRead(userId, n.id).then(() => {
                      router.push(n.documentHref);
                      setOpen(false);
                      void refresh();
                    });
                  }}
                  className={`flex w-full flex-col gap-0.5 border-b border-gray-50 px-3 py-2.5 text-left hover:bg-gray-50 ${
                    !n.read ? "bg-blue-50/50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-800">
                      {n.fromUserName} @了你
                    </span>
                    {!n.read && (
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    在「{n.documentTitle}」中提及 @{n.mentionLabel}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {formatRelativeTime(n.createdAt)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
