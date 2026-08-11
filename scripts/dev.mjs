import { networkInterfaces } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const tsxBin = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");

function getLanIp() {
  try {
    for (const iface of Object.values(networkInterfaces())) {
      for (const addr of iface ?? []) {
        if (addr.family === "IPv4" && !addr.internal) {
          return addr.address;
        }
      }
    }
  } catch {
    // ignore
  }
  return "localhost";
}

const lanIp = getLanIp();
const syncEnabled =
  process.env.SYNC_ENABLED === "true" &&
  process.env.SYNC_REMOTE_DATABASE_URL?.startsWith("postgres");

console.log("\n========================================");
console.log("  猎头云文档 开发服务器");
console.log(`  本机:     http://localhost:3000`);
console.log(`  局域网:   http://${lanIp}:3000`);
console.log("  协作服务: npm run party（另开终端）");
if (syncEnabled) {
  console.log("  数据同步: 已启用（本地 ↔ 公网）");
} else {
  console.log("  数据同步: 未启用（见 .env 中 SYNC_* 配置）");
}
console.log("========================================\n");

const children = [];

if (syncEnabled) {
  const syncChild = spawn(process.execPath, [tsxBin, "scripts/sync-daemon.ts"], {
    stdio: "inherit",
    cwd: root,
    env: process.env,
  });
  children.push(syncChild);
  syncChild.on("exit", (code) => {
    if (code && code !== 0) {
      console.warn(`[sync] 守护进程退出 code=${code}`);
    }
  });
}

const child = spawn(
  process.execPath,
  [nextBin, "dev", "--turbopack", "-H", "0.0.0.0", "-p", "3000"],
  { stdio: "inherit", cwd: root, env: process.env }
);
children.push(child);

function shutdown(code = 0) {
  for (const proc of children) {
    if (!proc.killed) proc.kill("SIGTERM");
  }
  process.exit(code);
}

child.on("exit", (code) => {
  shutdown(code ?? 1);
});

child.on("error", (err) => {
  console.error("启动失败:", err.message);
  shutdown(1);
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
