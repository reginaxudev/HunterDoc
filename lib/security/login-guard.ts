import { getClientIp } from "@/lib/security/client-ip";
import {
  clearRateLimit,
  isRateLimited,
  loginFailureDelay,
  rateLimitResponse,
  recordRateLimitHit,
} from "@/lib/security/rate-limit";
import {
  createIpLoginLockoutAlert,
  createLoginLockoutAlert,
} from "@/lib/security/login-alert";

const LOGIN_IP_LIMIT = Number(process.env.SECURITY_LOGIN_IP_LIMIT ?? 20);
const LOGIN_USER_LIMIT = Number(process.env.SECURITY_LOGIN_USER_LIMIT ?? 5);
const LOGIN_WINDOW_MS = Number(process.env.SECURITY_LOGIN_WINDOW_MS ?? 15 * 60 * 1000);
const LOGIN_LOCKOUT_MS = Number(process.env.SECURITY_LOGIN_LOCKOUT_MS ?? 30 * 60 * 1000);

const loginIpOptions = {
  limit: LOGIN_IP_LIMIT,
  windowMs: LOGIN_WINDOW_MS,
  lockoutMs: LOGIN_LOCKOUT_MS,
};

const loginUserOptions = {
  limit: LOGIN_USER_LIMIT,
  windowMs: LOGIN_WINDOW_MS,
  lockoutMs: LOGIN_LOCKOUT_MS,
};

export async function assertLoginAllowed(
  request: Request,
  username: string
): Promise<{ ok: true } | { ok: false; response: ReturnType<typeof rateLimitResponse> }> {
  const ip = getClientIp(request);
  const normalized = username.toLowerCase();

  const [ipCheck, userCheck] = await Promise.all([
    isRateLimited(`login:ip:${ip}`, loginIpOptions),
    isRateLimited(`login:user:${normalized}`, loginUserOptions),
  ]);

  if (!ipCheck.allowed) {
    return { ok: false, response: rateLimitResponse(ipCheck.retryAfterSec) };
  }
  if (!userCheck.allowed) {
    return { ok: false, response: rateLimitResponse(userCheck.retryAfterSec) };
  }

  return { ok: true };
}

export async function recordLoginFailure(
  request: Request,
  username: string,
  meta?: { userId?: string; displayName?: string }
): Promise<void> {
  const ip = getClientIp(request);
  const normalized = username.toLowerCase();

  const [ipResult, userResult] = await Promise.all([
    recordRateLimitHit(`login:ip:${ip}`, loginIpOptions),
    recordRateLimitHit(`login:user:${normalized}`, loginUserOptions),
  ]);
  await loginFailureDelay();

  if (userResult.justLocked) {
    await createLoginLockoutAlert({
      username: normalized,
      displayName: meta?.displayName ?? rawDisplayName(username),
      userId: meta?.userId,
      ip,
      attemptCount: userResult.count ?? LOGIN_USER_LIMIT,
      retryAfterSec: userResult.retryAfterSec,
    });
  }

  if (ipResult.justLocked) {
    await createIpLoginLockoutAlert({
      ip,
      attemptCount: ipResult.count ?? LOGIN_IP_LIMIT,
      retryAfterSec: ipResult.retryAfterSec,
    });
  }
}

function rawDisplayName(username: string): string {
  return username.startsWith("@") ? username.slice(1) : username;
}

export async function recordLoginSuccess(
  _request: Request,
  username: string
): Promise<void> {
  await clearRateLimit(`login:user:${username.toLowerCase()}`);
}

const SHARE_IP_LIMIT = Number(process.env.SECURITY_SHARE_IP_LIMIT ?? 60);
const SHARE_WINDOW_MS = Number(process.env.SECURITY_SHARE_WINDOW_MS ?? 60 * 1000);

export async function checkShareTokenRateLimit(
  request: Request
): Promise<{ ok: true } | { ok: false; response: ReturnType<typeof rateLimitResponse> }> {
  const ip = getClientIp(request);
  const result = await recordRateLimitHit(`share:ip:${ip}`, {
    limit: SHARE_IP_LIMIT,
    windowMs: SHARE_WINDOW_MS,
    lockoutMs: 5 * 60 * 1000,
  });

  if (!result.allowed) {
    return { ok: false, response: rateLimitResponse(result.retryAfterSec) };
  }
  return { ok: true };
}

export async function checkAccountsListRateLimit(
  request: Request
): Promise<{ ok: true } | { ok: false; response: ReturnType<typeof rateLimitResponse> }> {
  const ip = getClientIp(request);
  const result = await recordRateLimitHit(`accounts:ip:${ip}`, {
    limit: 30,
    windowMs: 60 * 1000,
    lockoutMs: 10 * 60 * 1000,
  });

  if (!result.allowed) {
    return { ok: false, response: rateLimitResponse(result.retryAfterSec) };
  }
  return { ok: true };
}

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
