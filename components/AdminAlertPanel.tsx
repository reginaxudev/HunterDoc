"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, X, Check } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  fetchAdminAlerts,
  markAdminAlertsRead,
  type AdminAlert,
} from "@/lib/admin-alerts";
import { formatRelativeTime } from "@/lib/utils";

const ALERT_POLL_MS = 15_000;

export default function AdminAlertPanel() {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (user?.role !== "ADMIN") {
      setAlerts([]);
      setUnread(0);
      setLoadError(null);
      return;
    }
    setLoading(true);
    try {
      const { alerts: items, error } = await fetchAdminAlerts();
      setAlerts(items);
      setUnread(items.filter((a) => !a.read).length);
      setLoadError(error ?? null);
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    void refresh();
    const handler = () => void refresh();
    window.addEventListener("admin-alert-update", handler);
    window.addEventListener("focus", handler);
    const timer = window.setInterval(() => void refresh(), ALERT_POLL_MS);
    return () => {
      window.removeEventListener("admin-alert-update", handler);
      window.removeEventListener("focus", handler);
      window.clearInterval(timer);
    };
  }, [refresh]);

  if (user?.role !== "ADMIN") return null;

  return (
    <div className="relative border-t border-gray-200 px-3 py-2">
      <button
        onClick={() => {
          setOpen((prev) => !prev);
          void refresh();
        }}
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-gray-600 hover:bg-gray-100"
      >
        <div className="relative">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          {unread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </div>
        <span>安全告警</span>
        {unread > 0 && (
          <span className="ml-auto text-xs text-red-500">{unread} 未读</span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-3 right-3 z-50 mb-1 max-h-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <span className="text-xs font-semibold text-gray-700">管理员告警</span>
            <div className="flex items-center gap-1">
              {alerts.length > 0 && (
                <button
                  onClick={() => void markAdminAlertsRead().then(refresh)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100"
                  title="全部已读"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {loading && alerts.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-gray-400">加载中...</p>
            ) : loadError ? (
              <p className="px-3 py-6 text-center text-xs text-red-500">{loadError}</p>
            ) : alerts.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-gray-400">暂无告警</p>
            ) : (
              alerts.map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => {
                    void markAdminAlertsRead(alert.id).then(refresh);
                    router.push(alert.documentHref);
                    setOpen(false);
                  }}
                  className={`w-full border-b border-gray-50 px-3 py-2.5 text-left last:border-0 hover:bg-gray-50 ${
                    !alert.read ? "bg-amber-50/50" : ""
                  }`}
                >
                  <p className="text-xs font-medium text-gray-900">{alert.message}</p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {alert.fromUserName} · {formatRelativeTime(alert.createdAt)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
