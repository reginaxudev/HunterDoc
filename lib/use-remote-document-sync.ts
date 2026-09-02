"use client";

import { useEffect, useRef } from "react";
import type { Document } from "@/types/document";

const DEFAULT_POLL_MS = 8000;

interface DocumentMeta {
  id: string;
  title: string;
  contentType: string;
  updatedAt: string;
  icon?: string;
}

/**
 * 本地无未保存修改时，先轮询 meta（updatedAt）；
 * 仅当他人已保存更新时再拉取全文，避免大表格拖垮保存请求。
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
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !documentId) return;

    const raw =
      process.env.NEXT_PUBLIC_DOCUMENT_POLL_MS ?? String(pollMs ?? DEFAULT_POLL_MS);
    const intervalMs = Number(raw);
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) return;
    const ms = intervalMs >= 2000 ? intervalMs : DEFAULT_POLL_MS;

    let cancelled = false;

    const tick = async () => {
      if (cancelled || fetchingRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      if (isDirtyRef.current) return;

      fetchingRef.current = true;
      try {
        const metaRes = await fetch(`/api/documents/${documentId}?fields=meta`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!metaRes.ok || cancelled) return;
        const meta = (await metaRes.json()) as DocumentMeta;
        const localAt = localUpdatedAtRef.current;
        if (!localAt) {
          localUpdatedAtRef.current = meta.updatedAt;
          return;
        }
        if (meta.updatedAt <= localAt) return;
        if (isDirtyRef.current || cancelled) return;

        const res = await fetch(`/api/documents/${documentId}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok || cancelled || isDirtyRef.current) return;
        const data = (await res.json()) as Document;
        if (data.updatedAt <= (localUpdatedAtRef.current ?? "")) return;
        localUpdatedAtRef.current = data.updatedAt;
        onRemoteUpdateRef.current(data);
      } catch {
        // ignore transient network errors
      } finally {
        fetchingRef.current = false;
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
