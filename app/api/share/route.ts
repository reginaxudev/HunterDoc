import { NextResponse } from "next/server";
import {
  createShareLink,
  getShareLinks,
  getDocumentPermissions,
  getShareLinkById,
} from "@/lib/storage";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireDocumentAccess } from "@/lib/document-access";
import {
  parseShareLinkPermission,
} from "@/lib/document-permissions";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId");
    if (!documentId) {
      return NextResponse.json({ error: "缺少 documentId" }, { status: 400 });
    }

    const accessCheck = await requireDocumentAccess(auth.user, documentId, "read");
    if ("response" in accessCheck) return accessCheck.response;

    const links = await getShareLinks(documentId);
    return NextResponse.json(links);
  } catch (error) {
    console.error("Failed to get share links:", error);
    return NextResponse.json({ error: "获取分享链接失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  try {
    const body = await request.json();
    const { documentId, permission: rawPermission = "read" } = body;
    const permission = parseShareLinkPermission(rawPermission);

    if (!documentId) {
      return NextResponse.json({ error: "缺少 documentId" }, { status: 400 });
    }

    const accessCheck = await requireDocumentAccess(auth.user, documentId, "manage");
    if ("response" in accessCheck) return accessCheck.response;

    const settings = await getDocumentPermissions(documentId);
    if (settings && !settings.allowExternalShare) {
      return NextResponse.json(
        { error: "此文档已关闭对外分享，请在权限设置中开启" },
        { status: 403 }
      );
    }

    if (settings?.externalShareManageOnly && auth.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "仅管理员可创建外部分享链接" },
        { status: 403 }
      );
    }

    const link = await createShareLink(documentId, permission, {
      encrypted: settings?.enableEncryptedLink !== false,
    });
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    return NextResponse.json(
      {
        ...link,
        url: `${baseUrl}/share/${link.token}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create share link:", error);
    const message =
      error instanceof Error ? error.message : "创建分享链接失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
