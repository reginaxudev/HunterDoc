import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export const ALLOWED_TYPES: Record<string, string[]> = {
  image: ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"],
  pdf: ["application/pdf"],
  spreadsheet: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
  ],
};

export const ALLOWED_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".pdf",
  ".xlsx",
  ".xls",
  ".csv",
];

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

export type FileCategory = "image" | "pdf" | "spreadsheet";

export function getFileCategory(mime: string, ext: string): FileCategory | null {
  if (ALLOWED_TYPES.image.includes(mime) || [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) {
    return "image";
  }
  if (ALLOWED_TYPES.pdf.includes(mime) || ext === ".pdf") {
    return "pdf";
  }
  if (ALLOWED_TYPES.spreadsheet.includes(mime) || [".xlsx", ".xls", ".csv"].includes(ext)) {
    return "spreadsheet";
  }
  return null;
}

export interface SavedFile {
  url: string;
  fileName: string;
  fileType: FileCategory;
  mimeType: string;
  size: number;
}

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

export async function saveUploadedFile(file: File): Promise<SavedFile> {
  ensureUploadDir();

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`不支持的文件格式：${ext}`);
  }

  if (file.size > MAX_SIZE) {
    throw new Error("文件大小不能超过 20MB");
  }

  const category = getFileCategory(file.type, ext);
  if (!category) {
    throw new Error(`不支持的文件类型：${file.type || ext}`);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fff]/g, "_");
  const storedName = `${nanoid(10)}-${safeName}`;
  const filePath = path.join(UPLOAD_DIR, storedName);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  return {
    url: `/uploads/${storedName}`,
    fileName: file.name,
    fileType: category,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  };
}
