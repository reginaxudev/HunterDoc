#!/usr/bin/env node
/**
 * 本地 ↔ 公网数据库双向同步守护进程
 *
 * 用法：
 *   SYNC_ENABLED=true SYNC_REMOTE_DATABASE_URL="postgresql://..." npm run sync
 *
 * 单次同步：
 *   npm run sync:once
 */

import { isSyncEnabled, getSyncIntervalMs } from "../lib/sync/config";
import { runSyncCycle } from "../lib/sync/engine";
import { disconnectRemotePrisma } from "../lib/sync/remote-db";

const once = process.argv.includes("--once");

async function main() {
  if (!isSyncEnabled()) {
    console.error(
      "请设置 SYNC_ENABLED=true 和 SYNC_REMOTE_DATABASE_URL（Neon 公网库连接串）"
    );
    process.exit(1);
  }

  const run = async () => {
    const result = await runSyncCycle();
    const parts = [
      `docs=${result.documents}`,
      `folders=${result.folders}`,
      `snapshots=${result.snapshots}`,
      `collabs=${result.collaborators}`,
      `links=${result.shareLinks}`,
      `revs=${result.revisions}`,
      `tombstones=${result.tombstones}`,
    ].join(" ");

    if (result.ok) {
      console.log(`[sync] ✓ ${parts}`);
    } else {
      console.error(`[sync] ✗ ${result.error ?? "failed"} (${parts})`);
    }
  };

  if (once) {
    await run();
    await disconnectRemotePrisma();
    return;
  }

  console.log(
    `[sync] 守护进程已启动，每 ${getSyncIntervalMs()}ms 同步一次（Ctrl+C 停止）`
  );
  await run();

  const timer = setInterval(() => {
    void run();
  }, getSyncIntervalMs());

  const shutdown = async () => {
    clearInterval(timer);
    await disconnectRemotePrisma();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((error) => {
  console.error("[sync] fatal:", error);
  process.exit(1);
});
