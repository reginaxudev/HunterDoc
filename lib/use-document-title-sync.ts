"use client";

import { useCallback, useRef } from "react";
import type { Document } from "@/types/document";
import { useWorkspaceOptional } from "@/components/WorkspaceProvider";

function syncBrowserTitle(title: string) {
  if (typeof document === "undefined") return;
  const trimmed = title.trim();
  document.title = trimmed ? `${trimmed} · 猎头云文档` : "猎头云文档";
}

export function useDocumentTitleSync(
  documentId: string,
  doc: Document | null,
  setDoc: React.Dispatch<React.SetStateAction<Document | null>>,
  title: string,
  setTitle: React.Dispatch<React.SetStateAction<string>>
) {
  const workspace = useWorkspaceOptional();
  const updateDocumentLocalRef = useRef(workspace?.updateDocumentLocal);
  updateDocumentLocalRef.current = workspace?.updateDocumentLocal;

  const docRef = useRef(doc);
  docRef.current = doc;
  const titleRef = useRef(title);
  titleRef.current = title;

  const onTitleChange = useCallback(
    (next: string) => {
      setTitle(next);
      updateDocumentLocalRef.current?.(documentId, { title: next });
      syncBrowserTitle(next);
    },
    [documentId, setTitle]
  );

  const onTitleBlur = useCallback(async () => {
    const currentDoc = docRef.current;
    const currentTitle = titleRef.current;
    if (!currentDoc || currentTitle === currentDoc.title) return;
    const res = await fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: currentTitle }),
    });
    if (!res.ok) return;
    const updatedAt = new Date().toISOString();
    setDoc((prev) =>
      prev ? { ...prev, title: currentTitle, updatedAt } : prev
    );
    updateDocumentLocalRef.current?.(documentId, {
      title: currentTitle,
      updatedAt,
    });
  }, [documentId, setDoc]);

  const syncTitleMeta = useCallback((nextTitle: string, updatedAt?: string) => {
    updateDocumentLocalRef.current?.(documentId, {
      title: nextTitle,
      ...(updatedAt ? { updatedAt } : {}),
    });
    syncBrowserTitle(nextTitle);
  }, [documentId]);

  return { onTitleChange, onTitleBlur, syncTitleMeta };
}
