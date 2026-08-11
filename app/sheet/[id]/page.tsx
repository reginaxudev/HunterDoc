"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import WorkspaceItemHeader, { useAutoSaveContent } from "@/components/WorkspaceItemHeader";
import SheetEditor, { type UniverSheetEditorRef } from "@/components/SheetEditor";
import ContentMentionShell from "@/components/ContentMentionShell";
import type { Document } from "@/types/document";
import type { UniverSheetData, SheetContent } from "@/lib/sheet-univer";
import { isUniverSheetData, normalizeToWorkbook, wrapWorkbook, compactSheetPayloadForSave } from "@/lib/sheet-univer";
import { getContentPath } from "@/lib/content-types";
import type { StoredMention } from "@/lib/content-mentions";
import { notifyContentMention } from "@/lib/content-mentions";
import {
  extractMentionsFromWorkbook,
  mergeScannedMentions,
  mentionKey,
  storedMentionToItem,
} from "@/lib/parse-text-mentions";
import { refreshTeamMembersCache } from "@/lib/team-members";
import { useAuth } from "@/components/AuthProvider";
import { authUserToCollabUser } from "@/lib/user";
import DocumentHistoryPanel from "@/components/DocumentHistoryPanel";

import { useDocumentTitleSync } from "@/lib/use-document-title-sync";
import { buildSheetSavePayload } from "@/lib/sheet-save";

const SHEET_AUTOSAVE_INTERVAL_MS = 60_000;
const SHEET_AUTOSAVE_DEBOUNCE_MS = 3_000;

export default function SheetPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const sheetRef = useRef<UniverSheetEditorRef>(null);
  const sheetDirtyRef = useRef(false);
  const lastSavedSheetRef = useRef<UniverSheetData | SheetContent | null>(null);
  const notifiedMentionKeysRef = useRef<Set<string>>(new Set());
  const { user: authUser } = useAuth();

  const [doc, setDoc] = useState<Document | null>(null);
  const [title, setTitle] = useState("");
  const titleRef = useRef(title);
  titleRef.current = title;
  const [content, setContent] = useState<UniverSheetData | SheetContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [manualSaving, setManualSaving] = useState(false);
  const [editorKey, setEditorKey] = useState(id);

  const documentHref = getContentPath(id, "sheet");
  const isAdmin = authUser?.role === "ADMIN";
  const mentions: StoredMention[] =
    content && isUniverSheetData(content) ? content.mentions ?? [] : [];

  const { onTitleChange, onTitleBlur, syncTitleMeta } = useDocumentTitleSync(
    id,
    doc,
    setDoc,
    title,
    setTitle
  );

  const handleSaved = useCallback(() => {
    const snapshot = sheetRef.current?.getSnapshot();
    if (snapshot) {
      lastSavedSheetRef.current = compactSheetPayloadForSave(snapshot) as UniverSheetData;
    } else if (content) {
      lastSavedSheetRef.current = compactSheetPayloadForSave(content);
    }
    setDoc((prev) => {
      if (!prev) return prev;
      const updatedAt = new Date().toISOString();
      syncTitleMeta(titleRef.current, updatedAt);
      return { ...prev, title: titleRef.current, updatedAt };
    });
  }, [syncTitleMeta, content]);

  const buildSheetPayload = useCallback(
    (latest: Record<string, unknown>, options: { skipRevision?: boolean }) => {
      return buildSheetSavePayload(
        lastSavedSheetRef.current,
        latest as unknown as UniverSheetData | SheetContent,
        { title: titleRef.current, skipRevision: options.skipRevision }
      );
    },
    []
  );

  const getLatestSheetContent = useCallback((): Record<string, unknown> | null => {
    const raw = sheetRef.current?.getSnapshot() ?? sheetRef.current?.flushSave();
    const latest = raw ?? content;
    if (!latest) return null;
    return compactSheetPayloadForSave(latest) as unknown as Record<string, unknown>;
  }, [content]);

  const handleEditorReady = useCallback(() => {
    const snapshot = sheetRef.current?.getSnapshot();
    if (snapshot) {
      lastSavedSheetRef.current = compactSheetPayloadForSave(snapshot);
      sheetDirtyRef.current = false;
    }
  }, []);

  const { saveStatus, saveError, saveNow } = useAutoSaveContent(
    id,
    title,
    content as unknown as Record<string, unknown> | null,
    {
      skipInitial: true,
      saveOnChange: true,
      delay: SHEET_AUTOSAVE_DEBOUNCE_MS,
      intervalMs: SHEET_AUTOSAVE_INTERVAL_MS,
      saveOnPageHide: true,
      skipRevision: true,
      isDirtyRef: sheetDirtyRef,
      getLatestContent: getLatestSheetContent,
      buildPayload: buildSheetPayload,
      onSaved: handleSaved,
    }
  );

  useEffect(() => {
    void refreshTeamMembersCache();
  }, []);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/documents/${id}`);
      if (!res.ok) {
        router.push("/");
        return;
      }
      const data = (await res.json()) as Document;
      if (data.contentType !== "sheet") {
        router.push(`/${data.contentType}/${id}`);
        return;
      }
      setDoc(data);
      setTitle(data.title);
      syncTitleMeta(data.title, data.updatedAt);
      setContent(data.content as unknown as UniverSheetData | SheetContent);
      lastSavedSheetRef.current = compactSheetPayloadForSave(
        data.content as UniverSheetData | SheetContent
      );
      const loaded = data.content as UniverSheetData | SheetContent;
      if (isUniverSheetData(loaded)) {
        for (const m of loaded.mentions ?? []) {
          notifiedMentionKeysRef.current.add(mentionKey(m));
        }
      }
      setLoading(false);
    }
    load();
  }, [id, router, syncTitleMeta]);

  const updateMentions = (next: StoredMention[]) => {
    sheetDirtyRef.current = true;
    setContent((prev) => {
      if (!prev) return prev;
      if (isUniverSheetData(prev)) return { ...prev, mentions: next };
      return wrapWorkbook(normalizeToWorkbook(prev), next);
    });
  };

  const handleSheetChange = useCallback(
    (data: UniverSheetData) => {
      const scanned = extractMentionsFromWorkbook(data.workbook);
      setContent((prev) => {
        const prevMentions =
          prev && isUniverSheetData(prev) ? prev.mentions ?? [] : [];
        const merged = mergeScannedMentions(prevMentions, scanned);

        if (authUser) {
          const actor = authUserToCollabUser(authUser);
          const meta = { documentId: id, documentTitle: title, documentHref };
          for (const entry of merged) {
            const key = mentionKey(entry);
            if (notifiedMentionKeysRef.current.has(key)) continue;
            if (entry.mentionType !== "person" && entry.mentionType !== "group") {
              continue;
            }
            notifiedMentionKeysRef.current.add(key);
            notifyContentMention(storedMentionToItem(entry), meta, actor);
          }
        }

        return { ...data, mentions: merged };
      });
      sheetDirtyRef.current = true;
    },
    [authUser, documentHref, id, title]
  );

  async function handleManualSave() {
    setManualSaving(true);
    try {
      const snapshot = sheetRef.current?.getSnapshot();
      const next = snapshot ?? (content as UniverSheetData | SheetContent);
      sheetDirtyRef.current = true;
      await saveNow(compactSheetPayloadForSave(next) as unknown as Record<string, unknown>, {
        skipRevision: false,
      });
    } finally {
      setManualSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!doc || !content) return null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <WorkspaceItemHeader
        id={id}
        contentType="sheet"
        title={title}
        icon={doc.icon}
        updatedAt={doc.updatedAt}
        saveStatus={saveStatus}
        saveError={saveError}
        onTitleChange={onTitleChange}
        onTitleBlur={() => void onTitleBlur()}
        extra={
          <>
            <DocumentHistoryPanel
              documentId={id}
              onRestored={(restored) => {
                setDoc(restored);
                setTitle(restored.title);
                syncTitleMeta(restored.title, restored.updatedAt);
                setContent(restored.content as unknown as UniverSheetData | SheetContent);
                setEditorKey(`${id}-${Date.now()}`);
              }}
            />
            <button
            type="button"
            onClick={() => void handleManualSave()}
            disabled={manualSaving || saveStatus === "saving"}
            className="flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {manualSaving || saveStatus === "saving" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            保存
          </button>
          </>
        }
      />
      <ContentMentionShell
        documentId={id}
        documentTitle={title}
        documentHref={documentHref}
        mentions={mentions}
        onMentionsChange={updateMentions}
        onMentionPicked={(item) =>
          sheetRef.current?.insertMentionAtActiveCell(item) ?? undefined
        }
      >
        <SheetEditor
          key={editorKey}
          ref={sheetRef}
          initialData={content}
          mentions={mentions}
          onChange={handleSheetChange}
          onReady={handleEditorReady}
          title={title}
          documentId={id}
          documentTitle={title}
          documentHref={documentHref}
          isAdmin={isAdmin}
          viewportTopOffset={88}
        />
      </ContentMentionShell>
    </div>
  );
}
