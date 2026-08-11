import { prisma } from "@/lib/db";

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  lockoutMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec?: number;
  count?: number;
  /** 本次请求刚触发锁定（用于告警，避免重复通知） */
  justLocked?: boolean;
}

const DEFAULT_LOCKOUT_MS = 30 * 60 * 1000;

function retryAfter(lockedUntil: Date): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));
}

/** 只读检查：当前是否被限流/锁定 */
export async function isRateLimited(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const now = new Date();
  const row = await prisma.securityRateLimit.findUnique({ where: { id: key } });

  if (row?.lockedUntil && row.lockedUntil > now) {
    return { allowed: false, retryAfterSec: retryAfter(row.lockedUntil) };
  }

  if (
    row &&
    row.count >= options.limit &&
    now.getTime() - row.windowStart.getTime() <= options.windowMs
  ) {
    const lockoutMs = options.lockoutMs ?? DEFAULT_LOCKOUT_MS;
    const lockedUntil = new Date(now.getTime() + lockoutMs);
    await prisma.securityRateLimit.update({
      where: { id: key },
      data: { lockedUntil },
    });
    return { allowed: false, retryAfterSec: Math.ceil(lockoutMs / 1000) };
  }

  return { allowed: true };
}

/** 记录一次失败/请求，并在超限时锁定 */
export async function recordRateLimitHit(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const now = new Date();
  const lockoutMs = options.lockoutMs ?? DEFAULT_LOCKOUT_MS;
  const row = await prisma.securityRateLimit.findUnique({ where: { id: key } });

  if (row?.lockedUntil && row.lockedUntil > now) {
    return { allowed: false, retryAfterSec: retryAfter(row.lockedUntil) };
  }

  if (!row || now.getTime() - row.windowStart.getTime() > options.windowMs) {
    await prisma.securityRateLimit.upsert({
      where: { id: key },
      update: { count: 1, windowStart: now, lockedUntil: null },
      create: { id: key, count: 1, windowStart: now },
    });
    return { allowed: true, count: 1 };
  }

  const nextCount = row.count + 1;
  const lockedUntil =
    nextCount >= options.limit ? new Date(now.getTime() + lockoutMs) : null;

  await prisma.securityRateLimit.update({
    where: { id: key },
    data: { count: nextCount, lockedUntil },
  });

  if (lockedUntil) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil(lockoutMs / 1000),
      count: nextCount,
      justLocked: nextCount === options.limit,
    };
  }

  return { allowed: true, count: nextCount };
}

export async function clearRateLimit(key: string): Promise<void> {
  try {
    await prisma.securityRateLimit.delete({ where: { id: key } });
  } catch {
    // ignore
  }
}

/** 强制锁定（用于批量复制违规等安全策略） */
export async function forceLoginLockout(
  key: string,
  lockoutMs: number
): Promise<void> {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + lockoutMs);
  await prisma.securityRateLimit.upsert({
    where: { id: key },
    update: { lockedUntil },
    create: {
      id: key,
      count: 0,
      windowStart: now,
      lockedUntil,
    },
  });
}

export function rateLimitResponse(retryAfterSec?: number) {
  const headers: Record<string, string> = {};
  if (retryAfterSec) {
    headers["Retry-After"] = String(retryAfterSec);
  }
  return {
    status: 429 as const,
    body: { error: "请求过于频繁，请稍后再试" },
    headers,
  };
}

export async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loginFailureDelay(): Promise<void> {
  await delay(600);
}
