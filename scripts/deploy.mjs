#!/usr/bin/env node
/**
 * 公网部署助手：Docker + Partykit
 *
 * 用法：
 *   node scripts/deploy.mjs           # 检查环境并显示步骤
 *   node scripts/deploy.mjs docker    # 本地构建并启动 Docker 生产栈
 *   node scripts/deploy.mjs partykit  # 部署协作服务
 *   node scripts/deploy.mjs seed      # 初始化生产数据库成员账号
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
  const envProd = readEnvFile(path.join(root, ".env.production"));
  const env = { ...readEnvFile(path.join(root, ".env")), ...envProd };

  console.log(`
========================================
  猎头云文档 — Docker 部署检查清单
========================================

【第一步】准备环境变量
  cp .env.docker.example .env.production
  编辑 .env.production（DATABASE_URL、AUTH_SECRET、NEXT_PUBLIC_APP_URL 等）

【第二步】部署 Partykit 协作服务
  npm run deploy:partykit
  → 将 host 填入 NEXT_PUBLIC_PARTYKIT_HOST

【第三步 A】服务器 Docker 部署（推荐）
  1. 服务器安装 Docker + Docker Compose
  2. 克隆仓库：git clone https://github.com/reginaxudev/HunterDoc.git
  3. cd HunterDoc && cp .env.docker.example .env.production && 编辑
  4. 启动：
     - 外部数据库（Neon）：npm run deploy:docker
     - 自带 PostgreSQL：npm run deploy:docker:db
  5. 初始化账号（在能访问数据库的机器上）：
     DATABASE_URL="postgresql://..." npm run deploy:seed

【第三步 B】GitHub 自动部署（push 到 main）
  1. push 代码到 GitHub → Actions 自动构建镜像到 ghcr.io/reginaxudev/hunterdoc
  2. 服务器 .env.production 中设置：
     DOCKER_IMAGE=ghcr.io/reginaxudev/hunterdoc:latest
  3. 配置 GitHub Repository Variables / Secrets 见 DEPLOY.md
  4. 服务器执行：npm run deploy:docker:pull

【第四步】访问
  http://服务器IP:3000/login
  （建议前面加 Nginx/Caddy 配 HTTPS）

详细说明见 DEPLOY.md
当前 AUTH_SECRET：${env.AUTH_SECRET ? "✓ 已设置" : "未设置"}
`);
}

function deployDocker() {
  if (!existsSync(path.join(root, ".env.production"))) {
    console.error("请先创建 .env.production：cp .env.docker.example .env.production");
    process.exit(1);
  }
  run("docker", ["compose", "-f", "docker-compose.prod.yml", "up", "-d", "--build"]);
  console.log(`
Docker 已启动。初始化账号（首次，需能访问数据库）：
  DATABASE_URL="postgresql://..." npm run deploy:seed
`);
}

function deployPartykit() {
  run("npx", ["partykit", "deploy"]);
  console.log(`
Partykit 部署完成。请将输出的 host 填入 .env.production：
  NEXT_PUBLIC_PARTYKIT_HOST=<your-host>.partykit.dev
然后重启 Docker：docker compose -f docker-compose.prod.yml up -d
`);
}

function seedProduction() {
  if (!process.env.DATABASE_URL) {
    console.error("请先设置 DATABASE_URL 环境变量");
    process.exit(1);
  }
  run("npx", ["prisma", "db", "push"]);
  run("npx", ["tsx", "prisma/seed.ts"]);
}

function generateSecret() {
  console.log(randomBytes(32).toString("hex"));
}

switch (step) {
  case "docker":
    deployDocker();
    break;
  case "partykit":
    deployPartykit();
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
