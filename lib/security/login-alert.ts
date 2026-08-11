import { createAdminAlert } from "@/lib/storage";

const SYSTEM_DOC_ID = "system:security";
const ADMIN_USERS_HREF = "/admin/users";

export async function createLoginLockoutAlert(data: {
  username: string;
  displayName: string;
  userId?: string;
  ip: string;
  attemptCount: number;
  retryAfterSec?: number;
}): Promise<void> {
  const lockMinutes = data.retryAfterSec
    ? Math.max(1, Math.ceil(data.retryAfterSec / 60))
    : 30;

  try {
    await createAdminAlert({
      alertType: "login_lockout",
      documentId: SYSTEM_DOC_ID,
      documentTitle: "登录安全",
      documentHref: ADMIN_USERS_HREF,
      fromUserId: data.userId ?? `login:${data.username}`,
      fromUserName: data.displayName,
      message: `@${data.username} 连续 ${data.attemptCount} 次登录失败，已锁定 ${lockMinutes} 分钟`,
      detail: JSON.stringify({
        username: data.username,
        ip: data.ip,
        attemptCount: data.attemptCount,
        retryAfterSec: data.retryAfterSec,
      }),
    });
  } catch (error) {
    console.error("Failed to create login lockout alert:", error);
  }
}

export async function createIpLoginLockoutAlert(data: {
  ip: string;
  attemptCount: number;
  retryAfterSec?: number;
}): Promise<void> {
  const lockMinutes = data.retryAfterSec
    ? Math.max(1, Math.ceil(data.retryAfterSec / 60))
    : 30;

  try {
    await createAdminAlert({
      alertType: "login_lockout_ip",
      documentId: SYSTEM_DOC_ID,
      documentTitle: "登录安全",
      documentHref: ADMIN_USERS_HREF,
      fromUserId: `ip:${data.ip}`,
      fromUserName: data.ip,
      message: `IP ${data.ip} 连续 ${data.attemptCount} 次登录失败，已锁定 ${lockMinutes} 分钟`,
      detail: JSON.stringify({
        ip: data.ip,
        attemptCount: data.attemptCount,
        retryAfterSec: data.retryAfterSec,
      }),
    });
  } catch (error) {
    console.error("Failed to create IP login lockout alert:", error);
  }
}
