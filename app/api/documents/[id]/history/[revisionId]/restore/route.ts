import { NextResponse } from "next/server";
import {
  getDocumentRevision,
  updateDocument,
  createDocumentRevision,
  deleteCollabSnapshot,
} from "@/lib/storage";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireDocumentAccess } from "@/lib/document-access";
import { buildRevisionMeta } from "@/lib/document-history";

type RouteContext = {
  params: Promise<{ id: string; revisionId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  try {
    const { id, revisionId } = await context.params;
    const check = await requireDocumentAccess(auth.user, id, "edit");
    if ("response" in check) return check.response;
    const prevDoc = check.doc;

    const revision = await getDocumentRevision(id, revisionId);
    if (!revision) {
      return NextResponse.json({ error: "历史版本不存在" }, { status: 404 });
    }

    const doc = await updateDocument(id, {
      title: revision.title,
      content: revision.content,
    });
    if (!doc) {
      return NextResponse.json({ error: "恢复失败" }, { status: 500 });
    }

    if (doc.contentType === "doc") {
      await deleteCollabSnapshot(id);
    }

    const meta = buildRevisionMeta(
      prevDoc.content,
      doc.content,
      prevDoc.title,
      doc.title,
      "restore"
    );

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

    return NextResponse.json(doc);
  } catch (error) {
    console.error("Restore revision error:", error);
    return NextResponse.json({ error: "恢复失败" }, { status: 500 });
  }
}
