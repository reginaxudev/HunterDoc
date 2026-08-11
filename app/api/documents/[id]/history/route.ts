import { NextResponse } from "next/server";
import { listDocumentRevisions } from "@/lib/storage";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireDocumentAccess } from "@/lib/document-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const check = await requireDocumentAccess(auth.user, id, "read");
  if ("response" in check) return check.response;

  const revisions = await listDocumentRevisions(id);
  return NextResponse.json(revisions);
}
