import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireDocumentAccess } from "@/lib/document-access";
import { createCollabToken } from "@/lib/security/collab-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** 已登录用户获取 PartyKit 协作 token */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  const { id: documentId } = await context.params;
  const check = await requireDocumentAccess(auth.user, documentId, "read");
  if ("response" in check) return check.response;

  const access =
    check.access === "read" ? ("read" as const) : ("edit" as const);

  try {
    const token = await createCollabToken({
      documentId,
      userId: auth.user.id,
      userName: auth.user.name,
      color: auth.user.color,
      access,
    });
    return NextResponse.json({ token, expiresIn: 15 * 60 });
  } catch (error) {
    console.error("Collab token error:", error);
    return NextResponse.json({ error: "无法签发协作凭证" }, { status: 500 });
  }
}
