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

/** 侧边栏/工作台多用户轮询间隔；设为 0 可关闭 */
export function getClientPollIntervalMs(): number {
  const raw =
    process.env.NEXT_PUBLIC_WORKSPACE_POLL_MS ??
    process.env.NEXT_PUBLIC_SYNC_POLL_INTERVAL_MS ??
    "5000";
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value >= 2000 ? value : 5000;
}

/** 打开中的表格/脑图等拉取他人保存的间隔；设为 0 可关闭 */
export function getDocumentPollIntervalMs(): number {
  const raw = process.env.NEXT_PUBLIC_DOCUMENT_POLL_MS ?? "4000";
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value >= 2000 ? value : 4000;
}

export function getSyncDebounceMs(): number {
  const value = Number(process.env.SYNC_DEBOUNCE_MS ?? 800);
  return Number.isFinite(value) && value >= 200 ? value : 800;
}

/** Overlap window to avoid missing rows near cursor boundaries. */
export const SYNC_OVERLAP_MS = 15_000;
