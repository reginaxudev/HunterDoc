"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { FileSpreadsheet, FileText, Download } from "lucide-react";
import { formatFileSize } from "@/lib/utils";

export default function FileAttachmentView({ node }: NodeViewProps) {
  const { url, fileName, fileType, fileSize } = node.attrs as {
    url: string;
    fileName: string;
    fileType: string;
    fileSize: number;
  };
  const isPdf = fileType === "pdf";

  return (
    <NodeViewWrapper className="my-4">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
          {isPdf ? (
            <FileText className="h-5 w-5 text-red-500" />
          ) : (
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
          )}
          <div className="flex-1 min-w-0">
            <div className="truncate text-sm font-medium text-gray-900">
              {fileName}
            </div>
            <div className="text-xs text-gray-400">
              {isPdf ? "PDF 文档" : "Excel 表格"} · {formatFileSize(fileSize)}
            </div>
          </div>
          <a
            href={url}
            download={fileName}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            contentEditable={false}
          >
            <Download className="h-3.5 w-3.5" />
            下载
          </a>
        </div>

        {isPdf && (
          <iframe
            src={`${url}#toolbar=1&navpanes=0`}
            title={fileName}
            className="h-[480px] w-full border-0 bg-white"
            contentEditable={false}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}
