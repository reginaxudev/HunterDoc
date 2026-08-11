import { NextResponse } from "next/server";
import { getSessionUser, toPublicUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      color: true,
      active: true,
      createdAt: true,
    },
  });

  if (!user || !user.active) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({ user: toPublicUser(user) });
}
