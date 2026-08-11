import { NextResponse } from "next/server";
import {
  getDocument,
  listDocumentCollaborators,
  upsertDocumentCollaborator,
  removeDocumentCollaborator,
} from "@/lib/storage";
import { requireAuth } from "@/lib/auth/require-auth";
import { parseShareLinkPermission } from "@/lib/document-permissions";
import {
  canManageDocumentCollaborators,
  requireDocumentAccess,
} from "@/lib/document-access";

import type { SessionUser } from "@/lib/auth/session";

type RouteContext = { params: Promise<{ id: string }> };

async function assertCanManageCollaborators(
  documentId: string,
  user: SessionUser
) {
  const doc = await getDocument(documentId);
  if (!doc) {
    return { response: NextResponse.json({ error: "文档不存在" }, { status: 404 }) };
  }

  const allowed = await canManageDocumentCollaborators(user, documentId);
  if (!allowed) {
    return {
      response: NextResponse.json({ error: "无权管理协作者" }, { status: 403 }),
    };
  }

  return { doc };
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const check = await requireDocumentAccess(auth.user, id, "read");
  if ("response" in check) return check.response;

  const collaborators = await listDocumentCollaborators(id);
  return NextResponse.json(collaborators);
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  try {
    const { id } = await context.params;
    const check = await assertCanManageCollaborators(id, auth.user);
    if ("response" in check) return check.response;

    const body = await request.json();
    const userId = typeof body.userId === "string" ? body.userId : "";
    const permission = parseShareLinkPermission(body.permission);

    if (!userId) {
      return NextResponse.json({ error: "请选择成员" }, { status: 400 });
    }

    const collaborator = await upsertDocumentCollaborator({
      documentId: id,
      userId,
      permission,
      addedById: auth.user.id,
    });

    if (!collaborator) {
      return NextResponse.json({ error: "成员不存在" }, { status: 404 });
    }

    return NextResponse.json(collaborator);
  } catch (error) {
    console.error("Add collaborator error:", error);
    return NextResponse.json({ error: "添加失败" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  try {
    const { id } = await context.params;
    const check = await assertCanManageCollaborators(id, auth.user);
    if ("response" in check) return check.response;

    const body = await request.json();
    const userId = typeof body.userId === "string" ? body.userId : "";
    const permission = parseShareLinkPermission(body.permission);

    if (!userId) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }

    const collaborator = await upsertDocumentCollaborator({
      documentId: id,
      userId,
      permission,
      addedById: auth.user.id,
    });

    if (!collaborator) {
      return NextResponse.json({ error: "成员不存在" }, { status: 404 });
    }

    return NextResponse.json(collaborator);
  } catch (error) {
    console.error("Update collaborator error:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  try {
    const { id } = await context.params;
    const check = await assertCanManageCollaborators(id, auth.user);
    if ("response" in check) return check.response;

    const userId = new URL(request.url).searchParams.get("userId") ?? "";
    if (!userId) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }

    const ok = await removeDocumentCollaborator(id, userId);
    if (!ok) {
      return NextResponse.json({ error: "协作者不存在" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Remove collaborator error:", error);
    return NextResponse.json({ error: "移除失败" }, { status: 500 });
  }
}
