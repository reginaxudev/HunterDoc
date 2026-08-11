import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/require-auth";

export async function GET() {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  const inbox = await prisma.mentionNotification.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(
    inbox.map((n) => ({
      id: n.id,
      documentId: n.documentId,
      documentTitle: n.documentTitle,
      documentHref: n.documentHref,
      fromUserId: n.fromUserId,
      fromUserName: n.fromUserName,
      mentionLabel: n.mentionLabel,
      mentionType: n.mentionType,
      createdAt: n.createdAt.toISOString(),
      read: n.read,
    }))
  );
}

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  try {
    const body = await request.json();
    const notificationId =
      typeof body.notificationId === "string" ? body.notificationId : undefined;
    const markAllRead = body.markAllRead === true;

    if (markAllRead) {
      await prisma.mentionNotification.updateMany({
        where: { userId: auth.user.id, read: false },
        data: { read: true },
      });
      return NextResponse.json({ ok: true });
    }

    if (notificationId) {
      await prisma.mentionNotification.updateMany({
        where: { id: notificationId, userId: auth.user.id },
        data: { read: true },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  } catch (error) {
    console.error("Update mention inbox error:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function DELETE() {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  await prisma.mentionNotification.deleteMany({
    where: { userId: auth.user.id },
  });

  return NextResponse.json({ ok: true });
}
