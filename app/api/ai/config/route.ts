import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  applyEnvToProcess,
  getOpenAIStatus,
  upsertEnvLines,
} from "@/lib/openai-config";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hasClientKey = searchParams.get("clientConfigured") === "1";
  const status = getOpenAIStatus();
  return NextResponse.json({
    ...status,
    configured: status.configured || hasClientKey,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const baseUrl =
      typeof body.baseUrl === "string" ? body.baseUrl.trim() : undefined;
    const model =
      typeof body.model === "string" ? body.model.trim() : undefined;

    if (!apiKey) {
      return NextResponse.json({ error: "API Key 不能为空" }, { status: 400 });
    }

    applyEnvToProcess({
      OPENAI_API_KEY: apiKey,
      ...(baseUrl ? { OPENAI_BASE_URL: baseUrl } : {}),
      ...(model ? { OPENAI_MODEL: model } : {}),
    });

    if (process.env.NODE_ENV !== "production") {
      const envPath = path.join(process.cwd(), ".env.local");
      const existing = fs.existsSync(envPath)
        ? fs.readFileSync(envPath, "utf8")
        : "# Local AI config (auto-generated)\n";
      const next = upsertEnvLines(existing, {
        OPENAI_API_KEY: apiKey,
        OPENAI_BASE_URL: baseUrl,
        OPENAI_MODEL: model ?? "gpt-4o-mini",
      });
      fs.writeFileSync(envPath, next.endsWith("\n") ? next : `${next}\n`, "utf8");
    }

    return NextResponse.json({
      ok: true,
      status: getOpenAIStatus(),
    });
  } catch (error) {
    console.error("Save AI config error:", error);
    return NextResponse.json({ error: "保存配置失败" }, { status: 500 });
  }
}
