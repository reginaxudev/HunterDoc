"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, X } from "lucide-react";
import { BULK_COPY_THRESHOLD } from "@/lib/bulk-copy-guard";

export default function BulkCopyToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: number | null = null;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ itemCount: number }>).detail;
      const count = detail?.itemCount ?? BULK_COPY_THRESHOLD + 1;
      setMessage(
        `批量复制已拦截：非管理员一次最多复制 ${BULK_COPY_THRESHOLD} 条，本次 ${count} 条。已通知管理员。`
      );
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(null), 6000);
    };

    window.addEventListener("bulk-copy-blocked", handler);
    return () => {
      window.removeEventListener("bulk-copy-blocked", handler);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  if (!message) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[200] -translate-x-1/2">
      <div className="pointer-events-auto flex max-w-md items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="flex-1 text-sm text-amber-900">{message}</p>
        <button
          type="button"
          onClick={() => setMessage(null)}
          className="rounded p-0.5 text-amber-600 hover:bg-amber-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
