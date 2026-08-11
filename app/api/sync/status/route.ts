import { NextResponse } from "next/server";
import { isSyncEnabled, isClientSyncEnabled, getSyncIntervalMs } from "@/lib/sync/config";
import { readSyncState } from "@/lib/sync/state";
import { getSyncHookStatus } from "@/lib/sync/hooks";

export async function GET() {
  const state = readSyncState();
  const hooks = getSyncHookStatus();

  return NextResponse.json({
    enabled: isSyncEnabled(),
    clientPoll: isClientSyncEnabled(),
    intervalMs: getSyncIntervalMs(),
    lastSyncAt: state.lastSyncAt,
    lastHookResultAt: hooks.lastResultAt,
    lastError: hooks.lastError,
  });
}
