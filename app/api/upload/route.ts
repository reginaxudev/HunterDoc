import { NextResponse } from "next/server";
import { saveUploadedFile } from "@/lib/uploads";
import { requireAuth } from "@/lib/auth/require-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "请选择文件" }, { status: 400 });
    }

    const saved = await saveUploadedFile(file);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "上传失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
