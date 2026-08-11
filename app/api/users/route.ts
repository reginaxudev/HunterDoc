import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { requireAdmin, requireAuth } from "@/lib/auth/require-auth";
import { toPublicUser } from "@/lib/auth/session";

const COLORS = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#16a34a",
  "#0891b2",
  "#4f46e5",
  "#c026d3",
  "#0d9488",
  "#ca8a04",
];

export async function GET() {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  const users = await prisma.user.findMany({
    where: { active: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
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

  return NextResponse.json(users.map(toPublicUser));
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  try {
    const body = await request.json();
    const username =
      typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = body.role === "ADMIN" ? UserRole.ADMIN : UserRole.MEMBER;

    if (!username || !name || !password) {
      return NextResponse.json(
        { error: "用户名、姓名和密码不能为空" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "密码至少 6 位" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: "用户名已存在" }, { status: 409 });
    }

    const count = await prisma.user.count();
    const user = await prisma.user.create({
      data: {
        username,
        name,
        passwordHash: await hashPassword(password),
        role,
        color: COLORS[count % COLORS.length],
      },
    });

    return NextResponse.json(toPublicUser(user), { status: 201 });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json({ error: "创建用户失败" }, { status: 500 });
  }
}
