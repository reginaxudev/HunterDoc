export interface AdminAlert {
  id: string;
  alertType: string;
  documentId: string;
  documentTitle: string;
  documentHref: string;
  fromUserId: string;
  fromUserName: string;
  message: string;
  detail: string | null;
  read: boolean;
  createdAt: string;
}

function dispatchAlertUpdate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("admin-alert-update"));
}

export async function fetchAdminAlerts(): Promise<{
  alerts: AdminAlert[];
  error?: string;
}> {
  if (typeof window === "undefined") return { alerts: [] };
  try {
    const res = await fetch("/api/admin/alerts", { cache: "no-store" });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return {
        alerts: [],
        error: data.error ?? `加载告警失败 (${res.status})`,
      };
    }
    const alerts = (await res.json()) as AdminAlert[];
    return { alerts };
  } catch {
    return { alerts: [], error: "无法连接告警服务" };
  }
}

export async function markAdminAlertsRead(alertId?: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/admin/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alertId ? { alertId } : {}),
    });
    dispatchAlertUpdate();
  } catch {
    // ignore
  }
}

export async function getUnreadAdminAlertCount(): Promise<number> {
  const { alerts } = await fetchAdminAlerts();
  return alerts.filter((a) => !a.read).length;
}

export { dispatchAlertUpdate as dispatchAdminAlertUpdate };
