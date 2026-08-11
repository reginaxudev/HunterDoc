/** Vercel Serverless 请求体硬上限约 4.5MB */
export const VERCEL_MAX_BODY_BYTES = 4_500_000;

/** 超过此大小或表格内容也走 gzip */
const COMPRESS_THRESHOLD_BYTES = 400_000;

import type { SheetCellPatch } from "@/lib/sheet-save";

export interface SaveDocumentPayload {
  title?: string;
  content?: Record<string, unknown>;
  sheetPatch?: SheetCellPatch;
  skipRevision?: boolean;
  yjsState?: string;
}

export interface EncodedSavePayload {
  body: BodyInit;
  headers: Record<string, string>;
  byteLength: number;
}

function isSheetLikeContent(content: Record<string, unknown> | undefined): boolean {
  if (!content || typeof content !== "object") return false;
  return "workbook" in content || "sheets" in content || content.version === 2;
}

function shouldCompress(payload: SaveDocumentPayload, jsonByteLength: number): boolean {
  if (payload.sheetPatch) return true;
  if (isSheetLikeContent(payload.content)) return true;
  if (jsonByteLength >= COMPRESS_THRESHOLD_BYTES) return true;
  return false;
}

export async function encodeSavePayload(
  payload: SaveDocumentPayload
): Promise<EncodedSavePayload> {
  const json = JSON.stringify(payload);
  const jsonBytes = new TextEncoder().encode(json).length;

  if (!shouldCompress(payload, jsonBytes) || typeof CompressionStream === "undefined") {
    return {
      body: json,
      headers: { "Content-Type": "application/json" },
      byteLength: jsonBytes,
    };
  }

  const compressed = await new Response(
    new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"))
  ).arrayBuffer();

  return {
    body: compressed,
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Save-Encoding": "gzip",
    },
    byteLength: compressed.byteLength,
  };
}

export function saveFailureMessage(status: number): string | null {
  if (status === 413) {
    return "表格数据过大，无法保存。请删除空白行列或拆成多个表格。";
  }
  if (status === 401 || status === 403) {
    return "登录已过期或无编辑权限，请重新登录。";
  }
  if (status >= 500) {
    return "服务器错误，请稍后重试。";
  }
  return null;
}
