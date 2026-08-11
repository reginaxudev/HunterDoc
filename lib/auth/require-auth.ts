import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";

export async function requireAuth(): Promise<
  { user: SessionUser } | { response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: "未登录" }, { status: 401 }),
    };
  }
  return { user };
}

export async function requireAdmin(): Promise<
  { user: SessionUser } | { response: NextResponse }
> {
  const auth = await requireAuth();
  if ("response" in auth) return auth;
  if (auth.user.role !== "ADMIN") {
    return {
      response: NextResponse.json({ error: "需要管理员权限" }, { status: 403 }),
    };
  }
  return auth;
}
