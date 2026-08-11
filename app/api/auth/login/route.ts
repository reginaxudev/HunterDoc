import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSessionToken,
  sessionCookieOptions,
  toPublicUser,
} from "@/lib/auth/session";
import {
  assertLoginAllowed,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/lib/security/login-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawUsername =
      typeof body.username === "string" ? body.username.trim() : "";
    const password =
      typeof body.password === "string" ? body.password.trim() : "";

    if (!rawUsername || !password) {
      return NextResponse.json({ error: "请输入用户名和密码" }, { status: 400 });
    }

    const gate = await assertLoginAllowed(request, rawUsername);
    if (!gate.ok) {
      return NextResponse.json(gate.response.body, {
        status: gate.response.status,
        headers: gate.response.headers,
      });
    }

    const normalized = rawUsername.toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        active: true,
        OR: [
          { username: normalized },
          { name: rawUsername },
          { name: { equals: rawUsername, mode: "insensitive" } },
        ],
      },
    });

    if (!user) {
      await recordLoginFailure(request, rawUsername);
      return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await recordLoginFailure(request, user.username, {
        userId: user.id,
        displayName: user.name,
      });
      return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
    }

    await recordLoginSuccess(request, user.username);

    const token = await createSessionToken({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      color: user.color,
    });

    const response = NextResponse.json({ user: toPublicUser(user) });
    response.cookies.set(sessionCookieOptions(token, request));
    return response;
  } catch (error) {
    console.error("Login error:", error);
    const message =
      error instanceof Error && error.message.includes("AUTH_SECRET")
        ? "服务器认证配置错误，请联系管理员"
        : "登录失败，请稍后重试";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
