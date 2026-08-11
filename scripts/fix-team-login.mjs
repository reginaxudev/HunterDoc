/**
 * 激活团队账号并重置为默认密码（不删除文档数据）
 * 用法: node scripts/fix-team-login.mjs
 */
import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../lib/auth/password.ts";
import {
  DEFAULT_MEMBER_PASSWORD,
  MEMBER_COLORS,
  TEAM_MEMBERS_SEED,
} from "../config/team-members.ts";

const prisma = new PrismaClient();

async function main() {
  const adminPassword =
    process.env.ADMIN_PASSWORD ?? DEFAULT_MEMBER_PASSWORD;

  console.log(`重置团队账号，默认密码: ${DEFAULT_MEMBER_PASSWORD}\n`);

  for (let i = 0; i < TEAM_MEMBERS_SEED.length; i++) {
    const member = TEAM_MEMBERS_SEED[i];
    const password =
      member.password ??
      (member.role === "ADMIN" ? adminPassword : DEFAULT_MEMBER_PASSWORD);
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

    console.log(`✓ ${member.name} (@${member.username})`);
  }

  const count = await prisma.user.count({ where: { active: true } });
  console.log(`\n已激活 ${count} 个账号，请使用上方密码登录。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
