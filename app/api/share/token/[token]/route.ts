import { NextResponse } from "next/server";
import { getDocumentByShareToken } from "@/lib/storage";
import { checkShareTokenRateLimit } from "@/lib/security/login-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(request: Request, context: RouteContext) {
  const gate = await checkShareTokenRateLimit(request);
  if (!gate.ok) {
    return NextResponse.json(gate.response.body, {
      status: gate.response.status,
      headers: gate.response.headers,
    });
  }

  try {
    const { token } = await context.params;

    if (!token || token.length < 8 || token.length > 64) {
      return NextResponse.json({ error: "无效的分享链接" }, { status: 400 });
    }

    const result = await getDocumentByShareToken(token);
    if (!result) {
      return NextResponse.json(
        { error: "分享链接无效、已过期或已关闭对外分享" },
        { status: 404 }
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to get shared document:", error);
    return NextResponse.json({ error: "获取分享文档失败" }, { status: 500 });
  }
}
