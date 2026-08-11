import { NextResponse } from "next/server";
import { getOpenAIStatus } from "@/lib/openai-config";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hasClientKey = searchParams.get("clientConfigured") === "1";
  const status = getOpenAIStatus();
  return NextResponse.json({
    ...status,
    configured: status.configured || hasClientKey,
  });
}
