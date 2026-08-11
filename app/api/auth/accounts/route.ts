import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkAccountsListRateLimit } from "@/lib/security/login-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 登录页展示可用账号 — 仅开发环境可用，生产环境已关闭 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const gate = await checkAccountsListRateLimit(request);
  if (!gate.ok) {
    return NextResponse.json(gate.response.body, {
      status: gate.response.status,
      headers: gate.response.headers,
    });
  }

  const users = await prisma.user.findMany({
    where: { active: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      username: true,
      name: true,
      role: true,
    },
  });

  return NextResponse.json(
    users.map((u) => ({
      username: u.username,
      name: u.name,
      role: u.role,
    }))
  );
}
