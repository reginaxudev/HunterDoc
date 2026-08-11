import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/require-auth";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  try {
    const body = await request.json();
    const targetUserId =
      typeof body.targetUserId === "string" ? body.targetUserId.trim() : "";
    const documentId =
      typeof body.documentId === "string" ? body.documentId.trim() : "";
    const documentTitle =
      typeof body.documentTitle === "string" ? body.documentTitle.trim() : "";
    const documentHref =
      typeof body.documentHref === "string" ? body.documentHref.trim() : "";
    const mentionLabel =
      typeof body.mentionLabel === "string" ? body.mentionLabel.trim() : "";
    const mentionType =
      typeof body.mentionType === "string" ? body.mentionType.trim() : "person";

    if (!targetUserId || !documentId || !documentTitle || !documentHref || !mentionLabel) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const duplicate = await prisma.mentionNotification.findFirst({
      where: {
        userId: targetUserId,
        documentId,
        fromUserId: auth.user.id,
        createdAt: { gte: fiveMinutesAgo },
      },
    });
    if (duplicate) {
      return NextResponse.json({ ok: true, duplicate: true, id: duplicate.id });
    }

    const entry = await prisma.mentionNotification.create({
      data: {
        userId: targetUserId,
        documentId,
        documentTitle,
        documentHref,
        fromUserId: auth.user.id,
        fromUserName: auth.user.name,
        mentionLabel,
        mentionType,
      },
    });

    return NextResponse.json({ ok: true, id: entry.id });
  } catch (error) {
    console.error("Create mention notification error:", error);
    return NextResponse.json({ error: "创建 @ 消息失败" }, { status: 500 });
  }
}
