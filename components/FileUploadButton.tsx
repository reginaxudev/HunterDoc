"use client";

import { useRef, useState, useCallback } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import {
  getAcceptString,
  isSupportedFile,
  prepareFileForEditor,
  insertFilesIntoEditor,
} from "@/lib/file-import";
import type { Editor } from "@tiptap/react";

interface FileUploadButtonProps {
  editor: Editor;
}

export default function FileUploadButton({ editor }: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | File[]) {
    const fileArray = Array.from(files).filter(isSupportedFile);
    if (fileArray.length === 0) {
      setError("不支持的文件格式，请上传 PNG、PDF、Excel 等");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      for (const file of fileArray) {
        const { inserts } = await prepareFileForEditor(file);
        insertFilesIntoEditor(editor, inserts);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={getAcceptString()}
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title="上传文件（PNG / PDF / Excel）"
        className="flex items-center gap-1.5 rounded-md bg-orange-50 px-2.5 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50"
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Paperclip className="h-3.5 w-3.5" />
        )}
        上传文件
      </button>

      {error && <span className="text-xs text-red-500">{error}</span>}
    </>
  );
}

export function useFileDropZone(
  editor: Editor | null,
  editable: boolean
) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const processFiles = useCallback(
    async (files: File[]) => {
      if (!editor) return;
      const supported = files.filter(isSupportedFile);
      if (!supported.length) return;

      setUploading(true);
      try {
        for (const file of supported) {
          const { inserts } = await prepareFileForEditor(file);
          insertFilesIntoEditor(editor, inserts);
        }
      } catch {
        // ignore individual failures
      } finally {
        setUploading(false);
      }
    },
    [editor]
  );

  const handlers = editable
    ? {
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) {
            processFiles(Array.from(e.dataTransfer.files));
          }
        },
        onDragOver: (e: React.DragEvent) => {
          const hasSupported = Array.from(e.dataTransfer.items).some((item) => {
            if (item.kind !== "file") return false;
            const ext = item.type;
            return ext.startsWith("image/") || ext.includes("pdf") || ext.includes("sheet") || ext.includes("csv") || ext.includes("excel");
          });
          if (hasSupported || e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDragOver(true);
          }
        },
        onDragLeave: (e: React.DragEvent) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOver(false);
          }
        },
        onPaste: (e: React.ClipboardEvent) => {
          const files = Array.from(e.clipboardData.files).filter(isSupportedFile);
          if (files.length && editor) {
            e.preventDefault();
            processFiles(files);
          }
        },
      }
    : {};

  return { dragOver, uploading, handlers, setDragOver };
}
