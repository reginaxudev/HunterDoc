import { NextResponse } from "next/server";
import {
  getDocumentPermissions,
  updateDocumentPermissions,
} from "@/lib/storage";
import {
  normalizePermissionSettings,
  type DocumentPermissionSettings,
  type PermissionLevel,
} from "@/lib/document-permissions";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireDocumentAccess } from "@/lib/document-access";

type RouteContext = { params: Promise<{ id: string }> };

function parseSettings(body: Record<string, unknown>): DocumentPermissionSettings {
  const current = normalizePermissionSettings(body);
  return current;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const check = await requireDocumentAccess(auth.user, id, "read");
  if ("response" in check) return check.response;

  const settings = await getDocumentPermissions(id);
  return NextResponse.json(settings ?? normalizePermissionSettings(null));
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  try {
    const { id } = await context.params;
    const check = await requireDocumentAccess(auth.user, id, "manage");
    if ("response" in check) return check.response;
    const doc = check.doc;

    const body = await request.json();
    const prev = normalizePermissionSettings(doc.permissionSettings);
    const level = (v: unknown, fallback: PermissionLevel): PermissionLevel =>
      v === "manage" || v === "edit" || v === "comment" || v === "read"
        ? v
        : fallback;

    const next = parseSettings({
      ...prev,
      ...(typeof body.allowExternalShare === "boolean"
        ? { allowExternalShare: body.allowExternalShare }
        : {}),
      ...(typeof body.externalShareManageOnly === "boolean"
        ? { externalShareManageOnly: body.externalShareManageOnly }
        : {}),
      ...(typeof body.enableEncryptedLink === "boolean"
        ? { enableEncryptedLink: body.enableEncryptedLink }
        : {}),
      ...(body.collaboratorManageLevel !== undefined
        ? { collaboratorManageLevel: level(body.collaboratorManageLevel, prev.collaboratorManageLevel) }
        : {}),
      ...(typeof body.collaboratorManageOrgOnly === "boolean"
        ? { collaboratorManageOrgOnly: body.collaboratorManageOrgOnly }
        : {}),
      ...(body.copyLevel !== undefined
        ? { copyLevel: level(body.copyLevel, prev.copyLevel) }
        : {}),
      ...(body.duplicatePrintDownloadLevel !== undefined
        ? {
            duplicatePrintDownloadLevel: level(
              body.duplicatePrintDownloadLevel,
              prev.duplicatePrintDownloadLevel
            ),
          }
        : {}),
      ...(body.commentLevel !== undefined
        ? { commentLevel: level(body.commentLevel, prev.commentLevel) }
        : {}),
    });

    const updated = await updateDocumentPermissions(id, next);
    if (!updated) {
      return NextResponse.json({ error: "更新失败" }, { status: 500 });
    }

    return NextResponse.json(updated.permissionSettings);
  } catch (error) {
    console.error("Update permissions error:", error);
    return NextResponse.json({ error: "更新权限失败" }, { status: 500 });
  }
}
