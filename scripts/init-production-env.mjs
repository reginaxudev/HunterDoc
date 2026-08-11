#!/usr/bin/env node
/**
 * 初始化生产环境 .env.production
 * 用法：node scripts/init-production-env.mjs
 */

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const target = path.join(root, ".env.production");
const example = path.join(root, ".env.docker.example");

function readEnv(filePath) {
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

function setEnvValue(content, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) return content.replace(re, line);
  return `${content.trim()}\n${line}\n`;
}

async function ask(rl, question, defaultValue = "") {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || defaultValue;
}

async function main() {
  if (!existsSync(example)) {
    console.error("缺少 .env.docker.example");
    process.exit(1);
  }

  if (existsSync(target)) {
    const rl = readline.createInterface({ input, output });
    const overwrite = await ask(rl, ".env.production 已存在，是否覆盖 (y/N)", "N");
    rl.close();
    if (overwrite.toLowerCase() !== "y") {
      console.log("已取消。");
      return;
    }
  }

  copyFileSync(example, target);
  let content = readFileSync(target, "utf8");
  const localEnv = readEnv(path.join(root, ".env"));

  const rl = readline.createInterface({ input, output });
  console.log("\n=== HunterDoc 生产环境配置 ===\n");

  const appDomain = await ask(rl, "域名（留空则先用 IP 访问）", "");
  const acmeEmail = await ask(rl, "HTTPS 证书邮箱", "admin@example.com");
  const databaseUrl = await ask(
    rl,
    "DATABASE_URL（Neon 连接串）",
    localEnv.DATABASE_URL?.startsWith("postgresql") ? localEnv.DATABASE_URL : ""
  );
  const partykitHost = await ask(
    rl,
    "NEXT_PUBLIC_PARTYKIT_HOST",
    "headhunter-docs-collab.reginaxudev-lgtm.partykit.dev"
  );
  const defaultPassword = await ask(rl, "DEFAULT_PASSWORD", "Lt@202607");

  rl.close();

  const authSecret = randomBytes(32).toString("hex");
  const appUrl = appDomain
    ? `https://${appDomain.replace(/^https?:\/\//, "")}`
    : "http://YOUR_SERVER_IP";

  content = setEnvValue(content, "AUTH_SECRET", authSecret);
  content = setEnvValue(content, "APP_DOMAIN", appDomain);
  content = setEnvValue(content, "ACME_EMAIL", acmeEmail);
  content = setEnvValue(content, "NEXT_PUBLIC_APP_URL", appUrl);
  content = setEnvValue(content, "NEXT_PUBLIC_PARTYKIT_HOST", partykitHost);
  content = setEnvValue(content, "DEFAULT_PASSWORD", defaultPassword);
  if (databaseUrl) content = setEnvValue(content, "DATABASE_URL", databaseUrl);

  writeFileSync(target, content, "utf8");
  console.log(`\n已写入 ${target}`);
  console.log("\n下一步：");
  console.log("  node scripts/generate-caddyfile.mjs");
  console.log("  npm run deploy:docker");
  if (databaseUrl) {
    console.log(`  DATABASE_URL="${databaseUrl}" npm run deploy:seed`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
