"use client";

import { useEffect, useRef } from "react";
import type { Document } from "@/types/document";

const DEFAULT_POLL_MS = 4000;

/**
 * 当本地无未保存修改时，轮询服务端文档；
 * 若他人已保存更新（updatedAt 更新），则回调应用最新内容。
 */
export function useRemoteDocumentSync(options: {
  documentId: string;
  enabled?: boolean;
  isDirtyRef: React.MutableRefObject<boolean>;
  localUpdatedAtRef: React.MutableRefObject<string | null>;
  onRemoteUpdate: (doc: Document) => void;
  pollMs?: number;
}) {
  const {
    documentId,
    enabled = true,
    isDirtyRef,
    localUpdatedAtRef,
    onRemoteUpdate,
    pollMs,
  } = options;

  const onRemoteUpdateRef = useRef(onRemoteUpdate);
  onRemoteUpdateRef.current = onRemoteUpdate;

  useEffect(() => {
    if (!enabled || !documentId) return;

    const raw = process.env.NEXT_PUBLIC_DOCUMENT_POLL_MS ?? String(pollMs ?? DEFAULT_POLL_MS);
    const intervalMs = Number(raw);
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) return;
    const ms = intervalMs >= 2000 ? intervalMs : DEFAULT_POLL_MS;

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      if (isDirtyRef.current) return;

      try {
        const res = await fetch(`/api/documents/${documentId}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as Document;
        const localAt = localUpdatedAtRef.current;
        if (!localAt) {
          localUpdatedAtRef.current = data.updatedAt;
          return;
        }
        if (data.updatedAt <= localAt) return;
        if (isDirtyRef.current || cancelled) return;
        localUpdatedAtRef.current = data.updatedAt;
        onRemoteUpdateRef.current(data);
      } catch {
        // ignore transient network errors
      }
    };

    const timer = window.setInterval(() => {
      void tick();
    }, ms);

    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [documentId, enabled, isDirtyRef, localUpdatedAtRef, pollMs]);
}
