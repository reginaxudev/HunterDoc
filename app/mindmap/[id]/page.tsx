"use client";

import { useEffect, useState } from "react";
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

export default function MindmapPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [doc, setDoc] = useState<Document | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<MindmapData | null>(null);
  const [loading, setLoading] = useState(true);

  const documentHref = getContentPath(id, "mindmap");
  const { user: authUser } = useAuth();
  const { onTitleChange, onTitleBlur, syncTitleMeta } = useDocumentTitleSync(
    id,
    doc,
    setDoc,
    title,
    setTitle
  );

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
      setContent(data.content as unknown as MindmapData);
      setLoading(false);
    }
    load();
  }, [id, router, syncTitleMeta]);

  const { saveStatus } = useAutoSaveContent(
    id,
    title,
    content as unknown as Record<string, unknown> | null,
    { skipInitial: true }
  );

  const updateMentions = (next: StoredMention[]) => {
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
          data={content}
          onChange={setContent}
          documentId={id}
          onMention={handleMention}
        />
      </ContentMentionShell>
    </div>
  );
}
