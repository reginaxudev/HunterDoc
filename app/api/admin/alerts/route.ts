import { NextResponse } from "next/server";
import {
  createAdminAlert,
  listAdminAlerts,
  markAdminAlertsRead,
} from "@/lib/storage";
import { requireAdmin, requireAuth } from "@/lib/auth/require-auth";

export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  try {
    const alerts = await listAdminAlerts();
    return NextResponse.json(alerts);
  } catch (error) {
    console.error("List admin alerts error:", error);
    return NextResponse.json(
      {
        error:
          "告警数据加载失败，请确认数据库已执行 prisma db push（AdminAlert 表）",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  try {
    const body = await request.json();
    const documentId = typeof body.documentId === "string" ? body.documentId : "";
    const alertType =
      typeof body.alertType === "string" ? body.alertType : "bulk_copy_blocked";
    const isSecurityAlert =
      alertType === "login_lockout" ||
      alertType === "login_lockout_ip" ||
      alertType.startsWith("login_");

    if (!documentId && !isSecurityAlert) {
      return NextResponse.json({ error: "缺少 documentId" }, { status: 400 });
    }

    const resolvedDocumentId = documentId || "system:security";
    const documentTitle =
      typeof body.documentTitle === "string" ? body.documentTitle : "未命名";
    const documentHref =
      typeof body.documentHref === "string" ? body.documentHref : "/";

    const itemCount =
      typeof body.itemCount === "number" ? body.itemCount : undefined;
    const message =
      typeof body.message === "string"
        ? body.message
        : `${documentTitle}：成员尝试批量复制 ${itemCount ?? "?"} 条内容，已拦截`;

    const alert = await createAdminAlert({
      alertType,
      documentId: resolvedDocumentId,
      documentTitle,
      documentHref,
      fromUserId: auth.user.id,
      fromUserName: auth.user.name,
      message,
      detail:
        itemCount != null
          ? JSON.stringify({ itemCount, source: body.source ?? "other" })
          : undefined,
    });

    return NextResponse.json(alert);
  } catch (error) {
    console.error("Create admin alert error:", error);
    return NextResponse.json({ error: "创建告警失败" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  try {
    const body = await request.json();
    const alertId = typeof body.alertId === "string" ? body.alertId : undefined;
    await markAdminAlertsRead(alertId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Update admin alerts error:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}
