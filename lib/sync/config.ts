export function isSyncEnabled(): boolean {
  return (
    process.env.SYNC_ENABLED === "true" &&
    Boolean(process.env.SYNC_REMOTE_DATABASE_URL?.startsWith("postgres"))
  );
}

export function isClientSyncEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SYNC_ENABLED === "true";
}

export function getSyncIntervalMs(): number {
  const value = Number(process.env.SYNC_INTERVAL_MS ?? 5000);
  return Number.isFinite(value) && value >= 2000 ? value : 5000;
}

export function getClientPollIntervalMs(): number {
  const value = Number(process.env.NEXT_PUBLIC_SYNC_POLL_INTERVAL_MS ?? 5000);
  return Number.isFinite(value) && value >= 2000 ? value : 5000;
}

export function getSyncDebounceMs(): number {
  const value = Number(process.env.SYNC_DEBOUNCE_MS ?? 800);
  return Number.isFinite(value) && value >= 200 ? value : 800;
}

/** Overlap window to avoid missing rows near cursor boundaries. */
export const SYNC_OVERLAP_MS = 15_000;
