"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, Share2 } from "lucide-react";
import Link from "next/link";
import ShareDialog from "@/components/ShareDialog";
import type { Document } from "@/types/document";
import { formatRelativeTime } from "@/lib/utils";
import DocumentHistoryPanel from "@/components/DocumentHistoryPanel";
import { useDocumentTitleSync } from "@/lib/use-document-title-sync";

const CollaborativeEditor = dynamic(
  () => import("@/components/CollaborativeEditor"),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    ),
  }
);

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  const [doc, setDoc] = useState<Document | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">(
    "idle"
  );
  const [showShare, setShowShare] = useState(false);
  const { onTitleChange, onTitleBlur, syncTitleMeta } = useDocumentTitleSync(
    docId,
    doc,
    setDoc,
    title,
    setTitle
  );

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/documents/${docId}`);
      if (!res.ok) {
        router.push("/");
        return;
      }
      const data = (await res.json()) as Document;
      if (data.contentType && data.contentType !== "doc") {
        router.push(`/${data.contentType}/${docId}`);
        return;
      }
      setDoc(data);
      setTitle(data.title);
      syncTitleMeta(data.title, data.updatedAt);
      setLoading(false);
    }
    load();
  }, [docId, router, syncTitleMeta]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!doc) return null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
        <Link
          href="/"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <span className="text-lg">{doc.icon}</span>

        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={() => void onTitleBlur()}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          className="relative z-10 flex-1 bg-transparent text-base font-medium text-gray-900 outline-none placeholder:text-gray-400"
          placeholder="无标题文档"
        />

        <DocumentHistoryPanel
          documentId={docId}
          onRestored={() => {
            window.location.reload();
          }}
        />

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
          {saveStatus === "idle" && (
            <span>{formatRelativeTime(doc.updatedAt)}</span>
          )}
        </div>
      </header>

      <CollaborativeEditor
        key={docId}
        documentId={docId}
        title={title}
        initialContent={doc.content}
        editable
        onSaveStatusChange={setSaveStatus}
        showShare
        onShareClick={() => setShowShare(true)}
      />

      <ShareDialog
        documentId={docId}
        open={showShare}
        onClose={() => setShowShare(false)}
      />
    </div>
  );
}
