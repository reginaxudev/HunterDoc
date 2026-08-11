#!/usr/bin/env node
/**
 * 公网部署助手：Partykit + Vercel
 *
 * 用法：
 *   node scripts/deploy.mjs           # 检查环境并显示步骤
 *   node scripts/deploy.mjs partykit    # 部署协作服务
 *   node scripts/deploy.mjs vercel      # 部署 Next.js 到 Vercel
 *   node scripts/deploy.mjs seed        # 初始化生产数据库成员账号
 */

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const step = process.argv[2] ?? "check";

function run(cmd, args, opts = {}) {
  console.log(`\n> ${cmd} ${args.join(" ")}\n`);
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: root,
    env: process.env,
    ...opts,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const env = {};
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function printChecklist() {
  const envProd = readEnvFile(path.join(root, ".env.production.local"));
  const env = { ...readEnvFile(path.join(root, ".env")), ...envProd };

  console.log(`
========================================
  猎头云文档 — 公网部署检查清单
========================================

【第一步】创建 Neon 数据库（免费）
  1. 打开 https://neon.tech 注册
  2. 创建项目，复制 Connection string
  3. 格式：postgresql://user:pass@host/db?sslmode=require

【第二步】准备环境变量（写入 .env.production.local 或 Vercel 控制台）

  变量名                        | 说明
  ------------------------------|----------------------------------
  DATABASE_URL                  | Neon PostgreSQL 连接串
  AUTH_SECRET                   | 随机字符串（≥16 位）${env.AUTH_SECRET ? " ✓ 已设置" : ""}
  DEFAULT_PASSWORD              | 团队成员默认登录密码
  NEXT_PUBLIC_APP_URL           | 部署后的网址，如 https://xxx.vercel.app
  NEXT_PUBLIC_PARTYKIT_HOST     | Partykit 地址（第二步部署后获得）
  OPENAI_API_KEY                | 可选，AI 摘要

  生成 AUTH_SECRET 示例：
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

【第三步】部署 Partykit 协作服务
  npm run deploy:partykit
  → 记录输出的 host，例如 headhunter-docs-collab.xxx.partykit.dev

【第四步】部署 Vercel
  npm run deploy:vercel
  → 首次会要求登录 Vercel 账号（浏览器授权）

【第五步】在 Vercel 控制台配置环境变量
  Project → Settings → Environment Variables
  填入上述变量，然后 Redeploy

【第六步】初始化生产数据库账号
  DATABASE_URL="postgresql://..." npm run deploy:seed

【第七步】访问
  https://你的域名.vercel.app/login

详细说明见 DEPLOY.md
`);
}

function deployPartykit() {
  run("npx", ["partykit", "deploy"]);
  console.log(`
Partykit 部署完成。请将输出的 host 填入：
  NEXT_PUBLIC_PARTYKIT_HOST=<your-host>.partykit.dev
`);
}

function deployVercel() {
  run("npx", ["vercel@latest", "deploy", "--prod"]);
  console.log(`
Vercel 部署完成。请将实际域名填入：
  NEXT_PUBLIC_APP_URL=https://你的项目.vercel.app
然后在 Vercel 控制台 Redeploy 一次。
`);
}

function seedProduction() {
  if (!process.env.DATABASE_URL) {
    console.error("请先设置 DATABASE_URL 环境变量（Neon 连接串）");
    process.exit(1);
  }
  run("npx", ["prisma", "db", "push"]);
  run("npx", ["tsx", "prisma/seed.ts"]);
}

function generateSecret() {
  console.log(randomBytes(32).toString("hex"));
}

switch (step) {
  case "partykit":
    deployPartykit();
    break;
  case "vercel":
    deployVercel();
    break;
  case "seed":
    seedProduction();
    break;
  case "secret":
    generateSecret();
    break;
  default:
    printChecklist();
}
