import { PrismaClient, UserRole } from "@prisma/client";
// explicit .ts extensions: the container runs this file through Node's type
// stripping, whose ESM resolver does not infer extensions
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

  console.log(`默认成员密码: ${DEFAULT_MEMBER_PASSWORD}`);
  console.log(`管理员密码: ${adminPassword}\n`);

  for (let i = 0; i < TEAM_MEMBERS_SEED.length; i++) {
    const member = TEAM_MEMBERS_SEED[i];
    const password =
      member.password ??
      (member.role === "ADMIN" ? adminPassword : DEFAULT_MEMBER_PASSWORD);
    const passwordHash = await hashPassword(password);
    const role =
      member.role === "ADMIN" ? UserRole.ADMIN : UserRole.MEMBER;

    const user = await prisma.user.upsert({
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
      },
    });

    const roleLabel = member.title ?? member.role;
    console.log(
      `✓ ${user.name} (@${user.username}) — ${roleLabel} / 密码: ${password}`
    );
  }

  // 停用不在名单里的旧演示账号
  const validUsernames = new Set(TEAM_MEMBERS_SEED.map((m) => m.username));
  const stale = await prisma.user.findMany({
    where: { username: { notIn: [...validUsernames] } },
  });
  for (const u of stale) {
    await prisma.user.update({
      where: { id: u.id },
      data: { active: false },
    });
    console.log(`✗ 已停用旧账号: ${u.name} (@${u.username})`);
  }

  const count = await prisma.user.count({ where: { active: true } });
  console.log(`\n共 ${count} 位活跃成员`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
