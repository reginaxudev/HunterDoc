import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/auth/require-auth";
import { toPublicUser } from "@/lib/auth/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const data: {
      name?: string;
      role?: UserRole;
      active?: boolean;
      passwordHash?: string;
    } = {};

    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim();
    }
    if (body.role === "ADMIN" || body.role === "MEMBER") {
      data.role = body.role;
    }
    if (typeof body.active === "boolean") {
      data.active = body.active;
    }
    if (typeof body.password === "string") {
      const pwd = body.password.trim();
      if (pwd.length > 0 && pwd.length < 6) {
        return NextResponse.json(
          { error: "新密码至少 6 位" },
          { status: 400 }
        );
      }
      if (pwd.length >= 6) {
        data.passwordHash = await hashPassword(pwd);
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "请提供要更新的内容" },
        { status: 400 }
      );
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    if (target.role === "ADMIN" && data.active === false) {
      const adminCount = await prisma.user.count({
        where: { role: "ADMIN", active: true },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "至少保留一位管理员" },
          { status: 400 }
        );
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data,
    });

    return NextResponse.json(toPublicUser(user));
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: "更新用户失败" }, { status: 500 });
  }
}
