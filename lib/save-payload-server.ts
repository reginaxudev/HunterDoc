import { gunzipSync } from "zlib";
import type { SaveDocumentPayload } from "@/lib/save-payload-client";

export type SaveWireBody =
  | SaveDocumentPayload
  | { compressed: true; payload: string };

/** 解析 PATCH 请求体（支持 gzip 二进制与旧版 base64 JSON） */
export async function parseSaveRequest(request: Request): Promise<SaveDocumentPayload> {
  const encoding = request.headers.get("x-save-encoding");
  const contentType = request.headers.get("content-type") ?? "";

  if (
    encoding === "gzip" ||
    contentType.includes("application/gzip") ||
    contentType.includes("application/octet-stream")
  ) {
    const buf = Buffer.from(await request.arrayBuffer());
    const json = gunzipSync(buf).toString("utf8");
    return JSON.parse(json) as SaveDocumentPayload;
  }

  const raw = (await request.json()) as SaveWireBody;
  return decodeSavePayload(raw);
}

/** 旧版：base64 包在 JSON 里（仍兼容） */
export function decodeSavePayload(raw: SaveWireBody): SaveDocumentPayload {
  if (!raw || typeof raw !== "object" || !("compressed" in raw) || !raw.compressed) {
    return raw as SaveDocumentPayload;
  }

  const json = gunzipSync(Buffer.from(raw.payload, "base64")).toString("utf8");
  return JSON.parse(json) as SaveDocumentPayload;
}
