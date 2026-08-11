"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { ArrowLeft, Check, Loader2, Share2 } from "lucide-react";
import Link from "next/link";
import ShareDialog from "@/components/ShareDialog";
import { CONTENT_TYPE_META } from "@/lib/content-types";
import type { ContentType } from "@/types/document";
import { formatRelativeTime } from "@/lib/utils";
import { encodeSavePayload, saveFailureMessage, type SaveDocumentPayload } from "@/lib/save-payload-client";

function normalizeSavePayloads(
  built: SaveDocumentPayload | SaveDocumentPayload[] | null,
  fallback: SaveDocumentPayload
): SaveDocumentPayload[] {
  if (built === null) return [fallback];
  return Array.isArray(built) ? built : [built];
}

function payloadHasData(payload: SaveDocumentPayload): boolean {
  return Boolean(
    payload.content ||
      payload.sheetPatch ||
      payload.yjsState ||
      payload.title !== undefined
  );
}

interface WorkspaceItemHeaderProps {
  id: string;
  contentType: ContentType;
  title: string;
  icon: string;
  updatedAt: string;
  saveStatus?: "saved" | "saving" | "idle" | "unsaved";
  saveError?: string | null;
  editable?: boolean;
  onTitleChange: (title: string) => void;
  onTitleBlur?: () => void;
  extra?: React.ReactNode;
}

export default function WorkspaceItemHeader({
  id,
  contentType,
  title,
  icon,
  updatedAt,
  saveStatus = "idle",
  saveError = null,
  editable = true,
  onTitleChange,
  onTitleBlur,
  extra,
}: WorkspaceItemHeaderProps) {
  const [showShare, setShowShare] = useState(false);
  const meta = CONTENT_TYPE_META[contentType];

  return (
    <>
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
        <Link
          href="/"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <span className="text-lg">{icon}</span>

        {editable ? (
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={onTitleBlur}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            className="relative z-10 flex-1 bg-transparent text-base font-medium text-gray-900 outline-none placeholder:text-gray-400"
            placeholder={meta.label}
          />
        ) : (
          <h1 className="flex-1 truncate text-base font-medium text-gray-900">
            {title}
          </h1>
        )}

        <span
          className={`hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-medium sm:inline ${meta.color}`}
        >
          {meta.label}
        </span>

        {extra}

        <button
          onClick={() => setShowShare(true)}
          className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <Share2 className="h-3.5 w-3.5" />
          分享
        </button>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              保存中...
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Check className="h-3 w-3 text-emerald-500" />
              已保存
            </>
          )}
          {saveStatus === "unsaved" && (
            <span className="max-w-[200px] truncate text-amber-600" title={saveError ?? undefined}>
              {saveError ?? "未保存"}
            </span>
          )}
          {saveStatus === "idle" && (
            <span>{formatRelativeTime(updatedAt)}</span>
          )}
        </div>
      </header>

      <ShareDialog
        documentId={id}
        open={showShare}
        onClose={() => setShowShare(false)}
      />
    </>
  );
}

export function useAutoSaveContent(
  docId: string,
  title: string,
  content: Record<string, unknown> | null,
  options?: {
    delay?: number;
    /** Skip autosave once when content is first loaded from server */
    skipInitial?: boolean;
    /** Persist on every content change (debounced). Default true. */
    saveOnChange?: boolean;
    /** Periodic autosave interval in ms */
    intervalMs?: number;
    /** Read freshest content before interval / page-close saves */
    getLatestContent?: () => Record<string, unknown> | null | undefined;
    /** Persist when tab closes or navigates away */
    saveOnPageHide?: boolean;
    /** Skip revision history (faster for large sheets on autosave) */
    skipRevision?: boolean;
    /** Only save when dirty (for interval / page-hide) */
    isDirtyRef?: MutableRefObject<boolean>;
    /** 自定义保存体（如表格增量 patch） */
    buildPayload?: (
      latest: Record<string, unknown>,
      options: { skipRevision?: boolean }
    ) =>
      | SaveDocumentPayload
      | SaveDocumentPayload[]
      | null
      | Promise<SaveDocumentPayload | SaveDocumentPayload[] | null>;
    onSaved?: () => void;
  }
) {
  const delay = options?.delay ?? 1500;
  const saveOnChange = options?.saveOnChange ?? true;
  const intervalMs = options?.intervalMs;
  const saveOnPageHide = options?.saveOnPageHide ?? false;
  const defaultSkipRevision = options?.skipRevision ?? false;
  const isDirtyRef = options?.isDirtyRef;
  const skipInitialRef = useRef(options?.skipInitial ?? false);
  const [saveStatus, setSaveStatus] = useState<
    "saved" | "saving" | "idle" | "unsaved"
  >("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const onSavedRef = useRef(options?.onSaved);
  onSavedRef.current = options?.onSaved;
  const getLatestContentRef = useRef(options?.getLatestContent);
  getLatestContentRef.current = options?.getLatestContent;
  const buildPayloadRef = useRef(options?.buildPayload);
  buildPayloadRef.current = options?.buildPayload;
  const titleRef = useRef(title);
  titleRef.current = title;
  const contentRef = useRef(content);
  contentRef.current = content;

  const saveChainRef = useRef(Promise.resolve());
  const pendingSaveRef = useRef<{
    override?: Record<string, unknown>;
    saveOptions?: { skipRevision?: boolean };
  } | null>(null);

  const runSave = useCallback(
    async (
      override?: Record<string, unknown>,
      saveOptions?: { skipRevision?: boolean }
    ) => {
      const latest =
        override ?? getLatestContentRef.current?.() ?? contentRef.current;
      if (!latest) {
        setSaveError("无法读取表格内容，请刷新页面后重试。");
        return false;
      }

      setSaveStatus("saving");
      setSaveError(null);
      try {
        const built = buildPayloadRef.current
          ? await buildPayloadRef.current(latest, {
              skipRevision: saveOptions?.skipRevision ?? defaultSkipRevision,
            })
          : null;

        const payloads = normalizeSavePayloads(built, {
          title: titleRef.current,
          content: latest,
          skipRevision: saveOptions?.skipRevision ?? defaultSkipRevision,
        }).filter(payloadHasData);

        if (payloads.length === 0) {
          setSaveStatus("saved");
          if (isDirtyRef) isDirtyRef.current = false;
          onSavedRef.current?.();
          return true;
        }

        for (const payload of payloads) {
          const wire = await encodeSavePayload(payload);

          if (wire.byteLength > 4_200_000) {
            setSaveError("表格仍然过大，请删除无用行列或拆成多个表格。");
            return false;
          }

          const res = await fetch(`/api/documents/${docId}`, {
            method: "PATCH",
            headers: wire.headers,
            credentials: "same-origin",
            body: wire.body,
          });
          if (!res.ok) {
            setSaveError(saveFailureMessage(res.status));
            return false;
          }
        }
        return true;
      } catch (err) {
        console.error("Save failed:", err);
        if (err instanceof Error && err.message.includes("SHEET_TOO_LARGE")) {
          setSaveError("表格过大无法全量保存，请刷新页面后重试。");
        } else {
          setSaveError("保存失败，请打开控制台查看详情或刷新后重试。");
        }
        return false;
      }
    },
    [docId, defaultSkipRevision]
  );

  const save = useCallback(
    (override?: Record<string, unknown>, saveOptions?: { skipRevision?: boolean }) => {
      pendingSaveRef.current = { override, saveOptions };
      if (isDirtyRef) isDirtyRef.current = true;

      const job = saveChainRef.current.then(async (): Promise<void> => {
        let ok = false;
        while (pendingSaveRef.current) {
          const pending = pendingSaveRef.current;
          pendingSaveRef.current = null;
          ok = await runSave(pending.override, pending.saveOptions);
          if (!ok) break;
        }
        if (ok) {
          setSaveStatus("saved");
          onSavedRef.current?.();
          if (isDirtyRef && !pendingSaveRef.current) isDirtyRef.current = false;
        } else {
          setSaveStatus("unsaved");
          if (isDirtyRef) isDirtyRef.current = true;
        }
      });

      saveChainRef.current = job.catch(() => {});
      return job;
    },
    [runSave, isDirtyRef]
  );

  const saveKeepalive = useCallback(
    async (override?: Record<string, unknown>) => {
      if (isDirtyRef && !isDirtyRef.current) return;
      const latest =
        override ?? getLatestContentRef.current?.() ?? contentRef.current;
      if (!latest) return;

      try {
        const built = buildPayloadRef.current
          ? await buildPayloadRef.current(latest, {
              skipRevision: defaultSkipRevision,
            })
          : null;
        const payloads = normalizeSavePayloads(built, {
          title: titleRef.current,
          content: latest,
          skipRevision: defaultSkipRevision,
        }).filter(payloadHasData);

        if (payloads.length !== 1) {
          void save(override);
          return;
        }

        const wire = await encodeSavePayload(payloads[0]);
        if (wire.byteLength > 60_000) {
          void save(override);
          return;
        }
        void fetch(`/api/documents/${docId}`, {
          method: "PATCH",
          headers: wire.headers,
          credentials: "same-origin",
          body: wire.body,
          keepalive: true,
        });
      } catch {
        void save(override);
      }
    },
    [docId, defaultSkipRevision, isDirtyRef, save]
  );

  useEffect(() => {
    if (!saveOnChange || !content) return;
    if (skipInitialRef.current) {
      skipInitialRef.current = false;
      return;
    }
    setSaveStatus("unsaved");
    if (isDirtyRef) isDirtyRef.current = true;
    const timer = setTimeout(() => void save(), delay);
    return () => clearTimeout(timer);
  }, [content, title, save, delay, saveOnChange]);

  useEffect(() => {
    if (!intervalMs) return;
    const timer = setInterval(() => {
      if (isDirtyRef && !isDirtyRef.current) return;
      void save();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, save, isDirtyRef]);

  useEffect(() => {
    if (!saveOnPageHide) return;

    const handlePageHide = () => {
      saveKeepalive();
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      saveKeepalive();
    };
  }, [saveOnPageHide, saveKeepalive]);

  return { saveStatus, saveError, saveNow: save };
}
