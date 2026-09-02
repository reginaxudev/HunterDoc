"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import WorkspaceItemHeader, { useAutoSaveContent } from "@/components/WorkspaceItemHeader";
import MindmapEditor from "@/components/MindmapEditor";
import ContentMentionShell from "@/components/ContentMentionShell";
import { useAuth } from "@/components/AuthProvider";
import type { Document } from "@/types/document";
import type { MindmapData } from "@/lib/content-types";
import { getContentPath } from "@/lib/content-types";
import { handleMentionPick, type StoredMention } from "@/lib/content-mentions";
import { authUserToCollabUser } from "@/lib/user";
import type { MentionItem } from "@/lib/mentions";
import { useDocumentTitleSync } from "@/lib/use-document-title-sync";
import { useRemoteDocumentSync } from "@/lib/use-remote-document-sync";

export default function MindmapPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const dirtyRef = useRef(false);
  const localUpdatedAtRef = useRef<string | null>(null);

  const [doc, setDoc] = useState<Document | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<MindmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorKey, setEditorKey] = useState(id);

  const documentHref = getContentPath(id, "mindmap");
  const { user: authUser } = useAuth();
  const { onTitleChange, onTitleBlur, syncTitleMeta } = useDocumentTitleSync(
    id,
    doc,
    setDoc,
    title,
    setTitle
  );

  const applyRemoteDocument = useCallback(
    (remote: Document) => {
      if (remote.contentType !== "mindmap") return;
      setDoc(remote);
      setTitle(remote.title);
      syncTitleMeta(remote.title, remote.updatedAt);
      setContent(remote.content as unknown as MindmapData);
      dirtyRef.current = false;
      setEditorKey(`${id}-${remote.updatedAt}`);
    },
    [id, syncTitleMeta]
  );

  useRemoteDocumentSync({
    documentId: id,
    isDirtyRef: dirtyRef,
    localUpdatedAtRef,
    onRemoteUpdate: applyRemoteDocument,
  });

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/documents/${id}`);
      if (!res.ok) {
        router.push("/");
        return;
      }
      const data = (await res.json()) as Document;
      if (data.contentType !== "mindmap") {
        router.push(`/${data.contentType}/${id}`);
        return;
      }
      setDoc(data);
      setTitle(data.title);
      syncTitleMeta(data.title, data.updatedAt);
      localUpdatedAtRef.current = data.updatedAt;
      setContent(data.content as unknown as MindmapData);
      dirtyRef.current = false;
      setLoading(false);
    }
    load();
  }, [id, router, syncTitleMeta]);

  const { saveStatus } = useAutoSaveContent(
    id,
    title,
    content as unknown as Record<string, unknown> | null,
    {
      skipInitial: true,
      isDirtyRef: dirtyRef,
      onSaved: () => {
        const updatedAt = new Date().toISOString();
        localUpdatedAtRef.current = updatedAt;
        setDoc((prev) => (prev ? { ...prev, updatedAt } : prev));
      },
    }
  );

  const updateMentions = (next: StoredMention[]) => {
    dirtyRef.current = true;
    setContent((prev) => (prev ? { ...prev, mentions: next } : prev));
  };

  const handleMention = (item: MentionItem, context: string) => {
    if (!authUser) return;
    handleMentionPick(
      item,
      { documentId: id, documentTitle: title, documentHref, context },
      content?.mentions ?? [],
      updateMentions,
      authUserToCollabUser(authUser)
    );
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!doc || !content) return null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <WorkspaceItemHeader
        id={id}
        contentType="mindmap"
        title={title}
        icon={doc.icon}
        updatedAt={doc.updatedAt}
        saveStatus={saveStatus}
        onTitleChange={onTitleChange}
        onTitleBlur={() => void onTitleBlur()}
      />
      <ContentMentionShell
        documentId={id}
        documentTitle={title}
        documentHref={documentHref}
        mentions={content.mentions ?? []}
        onMentionsChange={updateMentions}
      >
        <MindmapEditor
          key={editorKey}
          data={content}
          onChange={(next) => {
            dirtyRef.current = true;
            setContent(next);
          }}
          documentId={id}
          onMention={handleMention}
        />
      </ContentMentionShell>
    </div>
  );
}
