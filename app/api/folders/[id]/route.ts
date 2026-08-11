import { NextResponse } from "next/server";
import { deleteFolder } from "@/lib/storage";
import { requireAdmin } from "@/lib/auth/require-auth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  try {
    const { id } = await context.params;
    const ok = await deleteFolder(id);
    if (!ok) {
      return NextResponse.json({ error: "无法删除该文件夹" }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete folder:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
