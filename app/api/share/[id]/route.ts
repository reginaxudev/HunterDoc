import { NextResponse } from "next/server";
import {
  deleteShareLink,
  updateShareLinkPermission,
  getShareLinkById,
} from "@/lib/storage";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireDocumentAccess } from "@/lib/document-access";
import { parseShareLinkPermission } from "@/lib/document-permissions";

type RouteContext = { params: Promise<{ id: string }> };

async function requireShareLinkAccess(
  linkId: string,
  user: import("@/lib/auth/session").SessionUser,
  level: "read" | "manage"
) {
  const link = await getShareLinkById(linkId);
  if (!link) {
    return {
      response: NextResponse.json({ error: "链接不存在" }, { status: 404 }),
    };
  }
  const check = await requireDocumentAccess(user, link.documentId, level);
  if ("response" in check) return check;
  return { link };
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  try {
    const { id } = await context.params;
    const check = await requireShareLinkAccess(id, auth.user, "manage");
    if ("response" in check) return check.response;

    const body = await request.json();
    const permission = parseShareLinkPermission(body.permission);
    const link = await updateShareLinkPermission(id, permission);
    if (!link) {
      return NextResponse.json({ error: "链接不存在" }, { status: 404 });
    }
    return NextResponse.json(link);
  } catch (error) {
    console.error("Failed to update share link:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  try {
    const { id } = await context.params;
    const check = await requireShareLinkAccess(id, auth.user, "manage");
    if ("response" in check) return check.response;

    const ok = await deleteShareLink(id);
    if (!ok) {
      return NextResponse.json({ error: "链接不存在" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete share link:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
