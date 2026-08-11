import { NextResponse } from "next/server";
import {
  getDocument,
  updateDocument,
  deleteDocument,
  saveCollabSnapshot,
  getCollabSnapshot,
  createDocumentRevision,
} from "@/lib/storage";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireDocumentAccess } from "@/lib/document-access";
import { buildRevisionMeta } from "@/lib/document-history";
import { parseSaveRequest } from "@/lib/save-payload-server";
import { applySheetCellPatch, isSheetCellPatch } from "@/lib/sheet-save";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  try {
    const { id } = await context.params;
    const check = await requireDocumentAccess(auth.user, id, "read");
    if ("response" in check) return check.response;
    return NextResponse.json(check.doc);
  } catch (error) {
    console.error("Failed to get document:", error);
    return NextResponse.json({ error: "获取文档失败" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  try {
    const { id } = await context.params;
    const check = await requireDocumentAccess(auth.user, id, "edit");
    if ("response" in check) return check.response;

    const body = await parseSaveRequest(request);
    const prevDoc = check.doc;

    if (body.yjsState && typeof body.yjsState === "string") {
      const bytes = Buffer.from(body.yjsState, "base64");
      await saveCollabSnapshot(id, new Uint8Array(bytes));
    }

    const { yjsState: _, skipRevision, sheetPatch, ...updates } = body;

    if (sheetPatch && isSheetCellPatch(sheetPatch)) {
      const merged = applySheetCellPatch(prevDoc.content, sheetPatch);
      updates.content = merged as unknown as Record<string, unknown>;
    }

    const hasRevisionFields =
      updates.title !== undefined ||
      updates.content !== undefined ||
      !!sheetPatch;

    let doc = prevDoc;
    if (Object.keys(updates).length > 0) {
      const updated = await updateDocument(id, updates);
      if (!updated) {
        return NextResponse.json({ error: "文档不存在" }, { status: 404 });
      }
      doc = updated;
    }

    if (hasRevisionFields && !skipRevision) {
      const meta = buildRevisionMeta(
        prevDoc.content,
        doc.content,
        prevDoc.title,
        doc.title
      );
      const shouldRecord =
        prevDoc.title !== doc.title || meta.changeCount > 0;

      if (shouldRecord) {
        await createDocumentRevision({
          documentId: id,
          title: doc.title,
          content: doc.content,
          changeType: meta.changeType,
          changeSummary: meta.changeSummary,
          changeCount: meta.changeCount,
          userId: auth.user.id,
          userName: auth.user.name,
        });
      }
    }

    if (skipRevision) {
      return NextResponse.json({
        id: doc.id,
        title: doc.title,
        updatedAt: doc.updatedAt,
      });
    }

    return NextResponse.json(doc);
  } catch (error) {
    console.error("Failed to update document:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  try {
    const { id } = await context.params;
    const check = await requireDocumentAccess(auth.user, id, "manage");
    if ("response" in check) return check.response;

    const ok = await deleteDocument(id);
    if (!ok) {
      return NextResponse.json({ error: "文档不存在" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete document:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}

export async function HEAD(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const check = await requireDocumentAccess(auth.user, id, "read");
  if ("response" in check) return check.response;

  const snapshot = await getCollabSnapshot(id);
  return new NextResponse(null, {
    status: snapshot ? 200 : 204,
    headers: snapshot
      ? { "X-Has-Snapshot": "true" }
      : { "X-Has-Snapshot": "false" },
  });
}
