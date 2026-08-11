import { NextResponse } from "next/server";
import { getDocumentAccessForUser } from "@/lib/document-access";
import { requireAuth } from "@/lib/auth/require-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const access = await getDocumentAccessForUser(
    auth.user.id,
    auth.user.role,
    id
  );

  if (!access) {
    return NextResponse.json({ error: "无权访问此文档" }, { status: 403 });
  }

  return NextResponse.json({ access });
}
