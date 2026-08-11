import fs from "node:fs";
import path from "node:path";

export interface SyncState {
  lastSyncAt: string | null;
}

const STATE_PATH = path.join(process.cwd(), ".sync-state.json");

export function readSyncState(): SyncState {
  try {
    const raw = fs.readFileSync(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as SyncState;
    return {
      lastSyncAt:
        typeof parsed.lastSyncAt === "string" ? parsed.lastSyncAt : null,
    };
  } catch {
    return { lastSyncAt: null };
  }
}

export function writeSyncState(state: SyncState): void {
  fs.writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
