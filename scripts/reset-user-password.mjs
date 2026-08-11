#!/usr/bin/env node
/**
 * 重置指定用户密码
 *
 * 用法：
 *   RESET_USERNAME=gray RESET_PASSWORD='Gr@y202608' DATABASE_URL="postgresql://..." npx tsx scripts/reset-user-password.mjs
 *
 * 仅重置 gray（使用 config 中的 GRAY_DEFAULT_PASSWORD）：
 *   DATABASE_URL="postgresql://..." npm run db:reset-gray-password
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth/password";
import { GRAY_DEFAULT_PASSWORD } from "../config/team-members";

const username = (process.env.RESET_USERNAME ?? "gray").trim().toLowerCase();
const password = process.env.RESET_PASSWORD ?? GRAY_DEFAULT_PASSWORD;

if (!password || password.length < 6) {
  console.error("密码至少 6 位，请设置 RESET_PASSWORD");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    console.error(`用户 @${username} 不存在`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, active: true },
  });

  console.log(`✓ 已重置 @${username}（${user.name}）的登录密码`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
