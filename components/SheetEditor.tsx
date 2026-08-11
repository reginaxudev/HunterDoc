"use client";

import dynamic from "next/dynamic";
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import type { UniverSheetData, SheetContent } from "@/lib/sheet-univer";
import type { UniverSheetEditorRef } from "@/components/UniverSheetEditor";

const UniverSheetEditor = dynamic(() => import("@/components/UniverSheetEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-[#f5f6f7]">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  ),
});

interface SheetEditorProps {
  initialData: SheetContent;
  mentions?: import("@/lib/content-mentions").StoredMention[];
  onChange: (data: UniverSheetData) => void;
  editable?: boolean;
  title?: string;
  documentId?: string;
  documentTitle?: string;
  documentHref?: string;
  isAdmin?: boolean;
  viewportTopOffset?: number;
  onReady?: () => void;
}

const SheetEditor = forwardRef<UniverSheetEditorRef, SheetEditorProps>(
  function SheetEditor(props, ref) {
    return <UniverSheetEditor {...props} ref={ref} />;
  }
);

export default SheetEditor;
export type { UniverSheetEditorRef };
