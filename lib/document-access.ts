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

/** 成员可访问的文档 ID；管理员返回 null 表示不限制 */
export async function getAccessibleDocumentIds(
  userId: string,
  role: SessionUser["role"]
): Promise<Set<string> | null> {
  if (role === "ADMIN") return null;

  const rows = await prisma.documentCollaborator.findMany({
    where: { userId },
    select: { documentId: true },
  });
  return new Set(rows.map((r) => r.documentId));
}

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
  if (!row) return null;

  const permission = row.permission.toLowerCase();
  if (permission === "manage") return "manage";
  if (permission === "edit") return "edit";
  return "read";
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
