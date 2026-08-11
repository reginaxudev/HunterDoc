import { createAdminAlert } from "@/lib/storage";
import { getClientIp } from "@/lib/security/client-ip";
import {
  forceLoginLockout,
  recordRateLimitHit,
} from "@/lib/security/rate-limit";
import { BULK_COPY_THRESHOLD } from "@/lib/bulk-copy-guard";
import type { SessionUser } from "@/lib/auth/session";

/** 24 小时内连续违规次数上限 */
export const BULK_COPY_VIOLATION_LIMIT = Number(
  process.env.SECURITY_BULK_COPY_VIOLATION_LIMIT ?? 3
);
export const BULK_COPY_VIOLATION_WINDOW_MS = Number(
  process.env.SECURITY_BULK_COPY_VIOLATION_WINDOW_MS ?? 24 * 60 * 60 * 1000
);
export const BULK_COPY_LOGIN_LOCKOUT_MS = Number(
  process.env.SECURITY_BULK_COPY_LOGIN_LOCKOUT_MS ?? 30 * 60 * 1000
);

export interface BulkCopyViolationInput {
  documentId: string;
  documentTitle: string;
  documentHref: string;
  itemCount: number;
  source: "sheet" | "doc" | "other";
}

export interface BulkCopyViolationResult {
  violationCount: number;
  loginLocked: boolean;
  lockoutMinutes: number;
}

export async function recordBulkCopyViolation(
  request: Request,
  user: SessionUser,
  input: BulkCopyViolationInput
): Promise<BulkCopyViolationResult> {
  if (user.role === "ADMIN") {
    return { violationCount: 0, loginLocked: false, lockoutMinutes: 0 };
  }

  if (input.itemCount <= BULK_COPY_THRESHOLD) {
    throw new Error("itemCount below bulk copy threshold");
  }

  const ip = getClientIp(request);
  const violationKey = `bulkcopy:user:${user.id}`;
  const loginKey = `login:user:${user.username.toLowerCase()}`;

  const hit = await recordRateLimitHit(violationKey, {
    limit: BULK_COPY_VIOLATION_LIMIT,
    windowMs: BULK_COPY_VIOLATION_WINDOW_MS,
    lockoutMs: BULK_COPY_LOGIN_LOCKOUT_MS,
  });

  const violationCount = hit.count ?? 1;
  const lockoutMinutes = Math.max(1, Math.ceil(BULK_COPY_LOGIN_LOCKOUT_MS / 60_000));
  const loginLocked =
    violationCount >= BULK_COPY_VIOLATION_LIMIT || Boolean(hit.justLocked);

  if (loginLocked) {
    await forceLoginLockout(loginKey, BULK_COPY_LOGIN_LOCKOUT_MS);
  }

  const message = loginLocked
    ? `@${user.username} 在 24 小时内连续 ${violationCount} 次批量复制（>${BULK_COPY_THRESHOLD} 条），已锁定登录 ${lockoutMinutes} 分钟`
    : `${input.documentTitle}：@${user.username} 尝试批量复制 ${input.itemCount} 条内容，已拦截（第 ${violationCount}/${BULK_COPY_VIOLATION_LIMIT} 次）`;

  await createAdminAlert({
    alertType: loginLocked ? "bulk_copy_lockout" : "bulk_copy_blocked",
    documentId: input.documentId,
    documentTitle: input.documentTitle,
    documentHref: input.documentHref,
    fromUserId: user.id,
    fromUserName: user.name,
    message,
    detail: JSON.stringify({
      itemCount: input.itemCount,
      source: input.source,
      violationCount,
      ip,
      loginLocked,
      lockoutMinutes,
    }),
  });

  return { violationCount, loginLocked, lockoutMinutes };
}
