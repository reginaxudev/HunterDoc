#!/usr/bin/env node
/**
 * 本地一键 Docker：构建镜像并启动 App + Postgres
 * 用法：node scripts/docker-local.mjs
 */

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envLocal = path.join(root, ".env.docker.local");
const envExample = path.join(root, ".env.docker.local.example");
const composeFile = "docker-compose.local.yml";

function run(cmd, args) {
  console.log(`\n> ${cmd} ${args.join(" ")}\n`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function hasDocker() {
  const r = spawnSync("docker", ["version"], { stdio: "ignore" });
  return r.status === 0;
}

function main() {
  if (!hasDocker()) {
    console.error("未检测到 Docker。请先安装并启动 Docker Desktop：");
    console.error("  https://www.docker.com/products/docker-desktop/");
    process.exit(1);
  }

  if (!existsSync(envLocal)) {
    if (!existsSync(envExample)) {
      console.error("缺少 .env.docker.local.example");
      process.exit(1);
    }
    copyFileSync(envExample, envLocal);
    console.log("已创建 .env.docker.local（可按需修改）");
  }

  run("docker", [
    "compose",
    "-f",
    composeFile,
    "up",
    "-d",
    "--build",
  ]);

  console.log(`
========================================
  HunterDoc 本地 Docker 已启动
========================================

  打开登录页：http://localhost:3000/login

  默认账号（见 config/team-members.ts）：
    管理员  yu / Lt@202607
    成员    gray / Gr@y202608

  常用命令：
    npm run docker:local:logs    # 看日志
    npm run docker:local:stop    # 停止
    npm run docker:local:reset   # 清空数据重建

  说明：实时协作依赖 Partykit；已默认指向线上 host。
  若要完全本地协作，另开终端：npm run party
`);
}

main();
