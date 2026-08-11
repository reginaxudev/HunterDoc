import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import {
  DEFAULT_MEMBER_PASSWORD,
  MEMBER_COLORS,
  TEAM_MEMBERS_SEED,
} from "@/config/team-members";

/** 开发环境：重置团队账号为默认密码并激活（不删除文档） */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "仅开发环境可用" }, { status: 403 });
  }

  try {
    const adminPassword =
      process.env.ADMIN_PASSWORD ?? DEFAULT_MEMBER_PASSWORD;

    for (let i = 0; i < TEAM_MEMBERS_SEED.length; i++) {
      const member = TEAM_MEMBERS_SEED[i];
      const password =
        member.role === "ADMIN" ? adminPassword : DEFAULT_MEMBER_PASSWORD;
      const passwordHash = await hashPassword(password);
      const role =
        member.role === "ADMIN" ? UserRole.ADMIN : UserRole.MEMBER;

      await prisma.user.upsert({
        where: { username: member.username },
        update: {
          name: member.name,
          passwordHash,
          role,
          color: MEMBER_COLORS[i % MEMBER_COLORS.length],
          active: true,
        },
        create: {
          username: member.username,
          name: member.name,
          passwordHash,
          role,
          color: MEMBER_COLORS[i % MEMBER_COLORS.length],
          active: true,
        },
      });
    }

    const count = await prisma.user.count({ where: { active: true } });
    return NextResponse.json({
      ok: true,
      count,
      accounts: TEAM_MEMBERS_SEED.map((m) => ({
        username: m.username,
        name: m.name,
      })),
    });
  } catch (error) {
    console.error("Fix team login error:", error);
    return NextResponse.json({ error: "重置失败，请检查数据库" }, { status: 500 });
  }
}
