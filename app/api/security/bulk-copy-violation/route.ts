import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { BULK_COPY_THRESHOLD } from "@/lib/bulk-copy-guard";
import { recordBulkCopyViolation } from "@/lib/security/bulk-copy-violation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  if (auth.user.role === "ADMIN") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const body = await request.json();
    const documentId =
      typeof body.documentId === "string" ? body.documentId : "";
    const documentTitle =
      typeof body.documentTitle === "string" ? body.documentTitle : "未命名";
    const documentHref =
      typeof body.documentHref === "string" ? body.documentHref : "/";
    const itemCount =
      typeof body.itemCount === "number" ? body.itemCount : 0;
    const source =
      body.source === "sheet" || body.source === "doc" ? body.source : "other";

    if (!documentId) {
      return NextResponse.json({ error: "缺少 documentId" }, { status: 400 });
    }

    if (itemCount <= BULK_COPY_THRESHOLD) {
      return NextResponse.json({ error: "未达批量复制阈值" }, { status: 400 });
    }

    const result = await recordBulkCopyViolation(request, auth.user, {
      documentId,
      documentTitle,
      documentHref,
      itemCount,
      source,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Bulk copy violation error:", error);
    return NextResponse.json({ error: "记录违规失败" }, { status: 500 });
  }
}
