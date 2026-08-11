"use client";

import { useCallback, useRef, useState } from "react";
import { X, Upload, ClipboardPaste, FileText, Loader2 } from "lucide-react";
import {
  convertFeishuFileContent,
  convertFeishuHtml,
  countImportedBlocks,
  extractFeishuFromClipboard,
} from "@/lib/feishu-import";

interface ImportFeishuDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (html: string, mode: "insert" | "replace") => void;
}

export default function ImportFeishuDialog({
  open,
  onClose,
  onImport,
}: ImportFeishuDialogProps) {
  const [html, setHtml] = useState("");
  const [mode, setMode] = useState<"insert" | "replace">("insert");
  const [preview, setPreview] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleConvert = useCallback((raw: string) => {
    const converted = convertFeishuHtml(raw);
    setHtml(converted);
    setPreview(countImportedBlocks(converted));
    setError(null);
  }, []);

  const handlePasteFromClipboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await navigator.clipboard.read();
      let found = false;

      for (const item of items) {
        if (item.types.includes("text/html")) {
          const blob = await item.getType("text/html");
          const raw = await blob.text();
          handleConvert(raw);
          found = true;
          break;
        }
      }

      if (!found) {
        const text = await navigator.clipboard.readText();
        if (text.trim()) {
          handleConvert(`<pre>${text}</pre>`);
        } else {
          setError("剪贴板为空，请先在飞书文档中复制内容");
        }
      }
    } catch {
      setError("无法读取剪贴板，请手动粘贴到下方文本框");
    }
    setLoading(false);
  }, [handleConvert]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setLoading(true);
      setError(null);
      try {
        const content = await file.text();
        const converted = convertFeishuFileContent(content);
        setHtml(converted);
        setPreview(countImportedBlocks(converted));
      } catch {
        setError("文件读取失败");
      }
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    },
    []
  );

  const handleTextareaPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const clipboardData = e.clipboardData;
      const converted = extractFeishuFromClipboard(clipboardData);
      if (converted) {
        e.preventDefault();
        setHtml(converted);
        setPreview(countImportedBlocks(converted));
      }
    },
    []
  );

  const handleImport = () => {
    if (!html.trim()) {
      setError("请先粘贴或上传飞书文档内容");
      return;
    }
    onImport(html, mode);
    setHtml("");
    setPreview(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              从飞书文档导入
            </h2>
            <p className="text-sm text-gray-500">
              支持复制粘贴、上传 HTML 文件，自动转换格式
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 flex gap-2">
            <button
              onClick={handlePasteFromClipboard}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ClipboardPaste className="h-4 w-4" />
              )}
              从剪贴板粘贴
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              上传 HTML 文件
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".html,.htm,text/html"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          <div className="mb-3 rounded-lg bg-gray-50 px-4 py-3 text-xs text-gray-500">
            <p className="mb-1 font-medium text-gray-700">使用步骤：</p>
            <ol className="list-inside list-decimal space-y-0.5">
              <li>在飞书云文档中选中内容，按 Ctrl+C / ⌘+C 复制</li>
              <li>点击「从剪贴板粘贴」，或直接 Ctrl+V 粘贴到下方文本框</li>
              <li>也可上传从飞书导出的 .html 文件</li>
            </ol>
          </div>

          <textarea
            value={html}
            onChange={(e) => {
              setHtml(e.target.value);
              if (e.target.value.trim()) {
                setPreview(countImportedBlocks(e.target.value));
              } else {
                setPreview(null);
              }
            }}
            onPaste={handleTextareaPaste}
            placeholder="在此粘贴飞书文档内容（支持直接 Ctrl+V）..."
            className="h-48 w-full resize-none rounded-lg border border-gray-200 p-3 font-mono text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />

          {preview !== null && preview > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
              <FileText className="h-3.5 w-3.5" />
              已识别 {preview} 个内容块（标题、段落、列表等）
            </div>
          )}

          {error && (
            <p className="mt-2 text-xs text-red-500">{error}</p>
          )}

          <div className="mt-4 flex items-center gap-4">
            <span className="text-sm text-gray-600">导入方式：</span>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="import-mode"
                checked={mode === "insert"}
                onChange={() => setMode("insert")}
                className="accent-blue-600"
              />
              插入到光标位置
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="import-mode"
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
                className="accent-blue-600"
              />
              替换全部内容
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={!html.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            导入
          </button>
        </div>
      </div>
    </div>
  );
}
