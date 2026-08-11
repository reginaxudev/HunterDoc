import { isSyncEnabled, getSyncDebounceMs } from "@/lib/sync/config";
import { isSyncing } from "@/lib/sync/context";
import { runSyncCycle } from "@/lib/sync/engine";

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastResultAt: string | null = null;
let lastError: string | null = null;

export function scheduleSyncPush(): void {
  if (!isSyncEnabled() || isSyncing()) return;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runSyncCycle()
      .then((result) => {
        lastResultAt = result.finishedAt;
        lastError = result.ok ? null : result.error ?? "sync failed";
        if (!result.ok) {
          console.warn("[sync] push cycle failed:", lastError);
        }
      })
      .catch((error) => {
        lastError = error instanceof Error ? error.message : String(error);
        console.warn("[sync] push cycle error:", lastError);
      });
  }, getSyncDebounceMs());
}

export function getSyncHookStatus() {
  return {
    enabled: isSyncEnabled(),
    lastResultAt,
    lastError,
  };
}
