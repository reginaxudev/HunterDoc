"use client";

import dynamic from "next/dynamic";
import SheetEditor from "@/components/SheetEditor";
import type { Document } from "@/types/document";
import type { MindmapData, BitableData } from "@/lib/content-types";
import type { SheetContent } from "@/lib/sheet-univer";
import { Loader2 } from "lucide-react";

const CollaborativeEditor = dynamic(
  () => import("@/components/CollaborativeEditor"),
  { ssr: false, loading: () => <EditorLoading /> }
);
const MindmapEditor = dynamic(() => import("@/components/MindmapEditor"), {
  ssr: false,
  loading: () => <EditorLoading />,
});
const BitableEditor = dynamic(() => import("@/components/BitableEditor"), {
  ssr: false,
  loading: () => <EditorLoading />,
});

function EditorLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
    </div>
  );
}

interface ContentRendererProps {
  doc: Document;
  title: string;
  editable?: boolean;
  shareToken?: string;
  onSaveStatusChange?: (status: "saved" | "saving" | "idle") => void;
  onContentChange?: (content: Record<string, unknown>) => void;
  onShareClick?: () => void;
}

export default function ContentRenderer({
  doc,
  title,
  editable = true,
  shareToken,
  onSaveStatusChange,
  onContentChange,
  onShareClick,
}: ContentRendererProps) {
  const contentType = doc.contentType ?? "doc";

  switch (contentType) {
    case "doc":
      return (
        <CollaborativeEditor
          key={doc.id}
          documentId={doc.id}
          title={title}
          initialContent={doc.content}
          editable={editable}
          shareToken={shareToken}
          onSaveStatusChange={onSaveStatusChange}
          showShare
          onShareClick={onShareClick}
        />
      );

    case "sheet":
      return (
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          <SheetEditor
            key={doc.id}
            initialData={doc.content as unknown as SheetContent}
            onChange={(data) => onContentChange?.(data as unknown as Record<string, unknown>)}
            editable={editable}
            viewportTopOffset={56}
          />
        </div>
      );

    case "mindmap":
      return (
        <MindmapEditor
          data={doc.content as unknown as MindmapData}
          onChange={(data) => onContentChange?.(data as unknown as Record<string, unknown>)}
          editable={editable}
        />
      );

    case "bitable":
      return (
        <BitableEditor
          data={doc.content as unknown as BitableData}
          onChange={(data) => onContentChange?.(data as unknown as Record<string, unknown>)}
          editable={editable}
        />
      );

    default:
      return (
        <div className="flex flex-1 items-center justify-center text-gray-400">
          不支持的内容类型
        </div>
      );
  }
}
