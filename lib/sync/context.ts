let syncing = false;

export function isSyncing(): boolean {
  return syncing;
}

export async function runWithoutSyncHooks<T>(fn: () => Promise<T>): Promise<T> {
  syncing = true;
  try {
    return await fn();
  } finally {
    syncing = false;
  }
}
