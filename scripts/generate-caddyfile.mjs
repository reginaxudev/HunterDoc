#!/usr/bin/env node
/**
 * 根据 .env.production 生成 Caddy 配置
 * 用法：node scripts/generate-caddyfile.mjs
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envPath = path.join(root, ".env.production");
const outPath = path.join(root, "deploy", "Caddyfile");
const defaultPath = path.join(root, "deploy", "Caddyfile.default");

function useDefault() {
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, readFileSync(defaultPath, "utf8"), "utf8");
  console.log("[caddy] 使用默认 HTTP :80 配置");
  console.log(`[caddy] 写入 ${outPath}`);
}

if (!existsSync(envPath)) {
  if (!existsSync(defaultPath)) {
    console.error("缺少 .env.production 与 deploy/Caddyfile.default");
    process.exit(1);
  }
  useDefault();
  process.exit(0);
}

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

const env = readEnv(envPath);
const domain = (env.APP_DOMAIN || "").trim();
const email = (env.ACME_EMAIL || "admin@example.com").trim();
const maxBody = (env.CADDY_MAX_BODY || "50MB").trim();

let siteBlock;
if (domain) {
  siteBlock = `${domain} {
  encode gzip zstd
  request_body {
    max_size ${maxBody}
  }
  reverse_proxy app:3000
}`;
} else {
  siteBlock = `:80 {
  encode gzip zstd
  request_body {
    max_size ${maxBody}
  }
  reverse_proxy app:3000
}`;
}

const globalBlock = domain
  ? `{
  email ${email}
}

`
  : "";

const caddyfile = `${globalBlock}${siteBlock}
`;

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, caddyfile, "utf8");

console.log(
  domain
    ? `[caddy] HTTPS 已启用：${domain}`
    : "[caddy] 仅 HTTP :80（未设置 APP_DOMAIN，可用服务器 IP 访问）"
);
console.log(`[caddy] 写入 ${outPath}`);
