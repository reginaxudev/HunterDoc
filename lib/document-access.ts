import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDocument } from "@/lib/storage";
import type { SessionUser } from "@/lib/auth/session";

export type DocumentAccessLevel = "read" | "edit" | "manage";

const LEVEL_RANK: Record<DocumentAccessLevel, number> = {
  read: 0,
  edit: 1,
  manage: 2,
};

export function meetsDocumentAccess(
  actual: DocumentAccessLevel,
  required: DocumentAccessLevel
): boolean {
  return LEVEL_RANK[actual] >= LEVEL_RANK[required];
}

/**
 * 可访问的文档 ID 集合。
 * 返回 null 表示团队内不限制（全员共享工作区）。
 */
export async function getAccessibleDocumentIds(
  _userId: string,
  _role: SessionUser["role"]
): Promise<Set<string> | null> {
  return null;
}

/**
 * 文档权限：
 * - 管理员：可管理
 * - 已单独设置协作者：按其权限
 * - 其余活跃成员：默认可编辑（团队共享，无需逐个邀请才能看到/同步）
 */
export async function getDocumentAccessForUser(
  userId: string,
  role: SessionUser["role"],
  documentId: string
): Promise<DocumentAccessLevel | null> {
  if (role === "ADMIN") return "manage";

  const row = await prisma.documentCollaborator.findUnique({
    where: {
      documentId_userId: { documentId, userId },
    },
  });
  if (row) {
    const permission = row.permission.toLowerCase();
    if (permission === "manage") return "manage";
    if (permission === "edit") return "edit";
    return "read";
  }

  return "edit";
}

export async function requireDocumentAccess(
  user: SessionUser,
  documentId: string,
  required: DocumentAccessLevel = "read"
): Promise<
  | { access: DocumentAccessLevel; doc: NonNullable<Awaited<ReturnType<typeof getDocument>>> }
  | { response: NextResponse }
> {
  const doc = await getDocument(documentId);
  if (!doc) {
    return {
      response: NextResponse.json({ error: "文档不存在" }, { status: 404 }),
    };
  }

  const access = await getDocumentAccessForUser(user.id, user.role, documentId);
  if (!access || !meetsDocumentAccess(access, required)) {
    return {
      response: NextResponse.json({ error: "无权访问此文档" }, { status: 403 }),
    };
  }

  return { access, doc };
}

export async function canManageDocumentCollaborators(
  user: SessionUser,
  documentId: string
): Promise<boolean> {
  const access = await getDocumentAccessForUser(user.id, user.role, documentId);
  return access === "manage";
}
