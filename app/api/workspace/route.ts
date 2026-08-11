import { NextResponse } from "next/server";
import {
  readWorkspaceForUser,
  createDocument,
  createFolder,
  upsertDocumentCollaborator,
} from "@/lib/storage";
import { requireAuth } from "@/lib/auth/require-auth";

export async function GET() {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  try {
    const workspace = await readWorkspaceForUser(auth.user.id, auth.user.role);
    return NextResponse.json(workspace);
  } catch (error) {
    console.error("Failed to read workspace:", error);
    return NextResponse.json(
      { error: "数据库连接失败，请检查 DATABASE_URL 配置" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  try {
    const body = await request.json();
    const { type } = body;

    if (type === "folder") {
      const folder = await createFolder(body.name, body.icon);
      return NextResponse.json(folder, { status: 201 });
    }

    const doc = await createDocument({
      contentType: body.contentType ?? "doc",
      title: body.title,
      content: body.content,
      folderId: body.folderId ?? null,
      icon: body.icon,
      createdBy: auth.user.name,
    });

    await upsertDocumentCollaborator({
      documentId: doc.id,
      userId: auth.user.id,
      permission: auth.user.role === "ADMIN" ? "manage" : "edit",
      addedById: auth.user.id,
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("Failed to create:", error);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
