import * as XLSX from "xlsx";
import type { Editor } from "@tiptap/react";
import type { UploadedFile } from "@/types/document";

export async function uploadFile(file: File): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "上传失败");
  }
  return data as UploadedFile;
}

export async function parseSpreadsheet(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const html = XLSX.utils.sheet_to_html(sheet, { id: "imported-table" });
  return cleanSpreadsheetHtml(html, sheetName);
}

function cleanSpreadsheetHtml(html: string, sheetName: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");

  if (!table) return `<p>（空表格：${sheetName}）</p>`;

  table.className = "imported-spreadsheet";
  table.removeAttribute("id");

  table.querySelectorAll("td, th").forEach((cell) => {
    cell.removeAttribute("style");
    cell.removeAttribute("class");
    const text = cell.textContent?.trim() ?? "";
    if (!text) cell.innerHTML = "&nbsp;";
  });

  return `<h3>${sheetName}</h3>${table.outerHTML}`;
}

export function isSupportedFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const supported = ["png", "jpg", "jpeg", "gif", "webp", "pdf", "xlsx", "xls", "csv"];
  return supported.includes(ext);
}

export function getAcceptString(): string {
  return ".png,.jpg,.jpeg,.gif,.webp,.pdf,.xlsx,.xls,.csv";
}

export interface InsertFileResult {
  type: "image" | "pdf" | "spreadsheet" | "attachment";
  content: Record<string, unknown> | string;
}

export async function prepareFileForEditor(file: File): Promise<{
  saved: UploadedFile;
  inserts: InsertFileResult[];
}> {
  const saved = await uploadFile(file);

  switch (saved.fileType) {
    case "image":
      return {
        saved,
        inserts: [
          {
            type: "image",
            content: { type: "image", attrs: { src: saved.url, alt: saved.fileName } },
          },
        ],
      };

    case "pdf":
      return {
        saved,
        inserts: [
          {
            type: "pdf",
            content: {
              type: "fileAttachment",
              attrs: {
                url: saved.url,
                fileName: saved.fileName,
                fileType: "pdf",
                fileSize: saved.size,
              },
            },
          },
        ],
      };

    case "spreadsheet": {
      const tableHtml = await parseSpreadsheet(file);
      return {
        saved,
        inserts: [
          { type: "spreadsheet", content: tableHtml },
          {
            type: "attachment",
            content: {
              type: "fileAttachment",
              attrs: {
                url: saved.url,
                fileName: saved.fileName,
                fileType: "spreadsheet",
                fileSize: saved.size,
              },
            },
          },
        ],
      };
    }

    default:
      throw new Error("不支持的文件类型");
  }
}

export function insertFilesIntoEditor(
  editor: Editor,
  inserts: InsertFileResult[]
) {
  for (const item of inserts) {
    if (typeof item.content === "string") {
      editor.chain().focus().insertContent(item.content).run();
    } else {
      editor.chain().focus().insertContent(item.content).run();
    }
  }
}
