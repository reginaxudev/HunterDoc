import { NextResponse } from "next/server";
import { getDocumentByShareToken } from "@/lib/storage";
import { createCollabToken } from "@/lib/security/collab-token";
import {
  canEditViaShareLink,
  type ShareLinkPermission,
} from "@/lib/document-permissions";
import { checkShareTokenRateLimit } from "@/lib/security/login-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 分享链接访客获取 PartyKit 协作 token（只读或可编辑） */
export async function POST(request: Request) {
  const gate = await checkShareTokenRateLimit(request);
  if (!gate.ok) {
    return NextResponse.json(gate.response.body, {
      status: gate.response.status,
      headers: gate.response.headers,
    });
  }

  try {
    const body = await request.json();
    const shareToken =
      typeof body.token === "string" ? body.token.trim() : "";

    if (!shareToken || shareToken.length < 8) {
      return NextResponse.json({ error: "无效的分享链接" }, { status: 400 });
    }

    const result = await getDocumentByShareToken(shareToken);
    if (!result) {
      return NextResponse.json(
        { error: "分享链接无效、已过期或已关闭对外分享" },
        { status: 404 }
      );
    }

    if (result.document.contentType !== "doc") {
      return NextResponse.json(
        { error: "此类型文档不支持实时协作" },
        { status: 400 }
      );
    }

    const permission = result.permission as ShareLinkPermission;
    const access = canEditViaShareLink(permission) ? "edit" : "read";

    const token = await createCollabToken({
      documentId: result.document.id,
      userId: `share:${shareToken.slice(0, 8)}`,
      userName: "访客",
      color: "#64748b",
      access,
    });

    return NextResponse.json({ token, expiresIn: 15 * 60, access });
  } catch (error) {
    console.error("Share collab token error:", error);
    return NextResponse.json({ error: "无法签发协作凭证" }, { status: 500 });
  }
}
