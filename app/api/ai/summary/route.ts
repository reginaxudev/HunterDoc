import { NextResponse } from "next/server";
import { extractTextFromTipTap, buildSummaryPrompt } from "@/lib/ai";
import {
  createChatCompletion,
  getOpenAIConfig,
  type OpenAIConfigOverrides,
} from "@/lib/openai-config";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireDocumentAccess } from "@/lib/document-access";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  try {
    const body = await request.json();
    const { documentId, title, content } = body;

    const aiOverrides: OpenAIConfigOverrides = {
      apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
      baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
      model: typeof body.model === "string" ? body.model : undefined,
    };

    let docTitle = title as string | undefined;
    let docContent = content as Record<string, unknown> | undefined;

    if (documentId) {
      const check = await requireDocumentAccess(auth.user, documentId, "read");
      if ("response" in check) return check.response;
      docTitle = check.doc.title;
      docContent = check.doc.content;
    } else if (!content) {
      return NextResponse.json({ error: "缺少文档内容" }, { status: 400 });
    }

    if (!docContent) {
      return NextResponse.json({ error: "缺少文档内容" }, { status: 400 });
    }

    const text = extractTextFromTipTap(docContent);
    if (text.length < 20) {
      return NextResponse.json(
        { error: "文档内容太少，请先填写更多内容后再生成摘要" },
        { status: 400 }
      );
    }

    const prompt = buildSummaryPrompt(text, docTitle ?? "无标题文档");
    const config = getOpenAIConfig(aiOverrides);

    if (!config) {
      return NextResponse.json({
        summary: generateFallbackSummary(text, docTitle ?? "无标题文档"),
        source: "fallback",
        reason: "missing_key",
        message: "请先配置 OpenAI API Key（可在下方直接填写）",
      });
    }

    const result = await createChatCompletion(
      [
        {
          role: "system",
          content: "你是资深猎头顾问助手，擅长撰写简洁专业的候选人评估摘要。",
        },
        { role: "user", content: prompt },
      ],
      { config: aiOverrides }
    );

    if ("error" in result) {
      console.error("OpenAI API error:", result.error);
      return NextResponse.json({
        summary: generateFallbackSummary(text, docTitle ?? "无标题文档"),
        source: "fallback",
        reason: "api_error",
        message: result.error,
      });
    }

    return NextResponse.json({ summary: result.content, source: "openai" });
  } catch (error) {
    console.error("AI summary error:", error);
    return NextResponse.json({ error: "生成摘要失败" }, { status: 500 });
  }
}

function generateFallbackSummary(text: string, title: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 8);

  return `## ${title} — 摘要报告

**核心要点：**
${lines.map((l, i) => `${i + 1}. ${l.slice(0, 120)}`).join("\n")}`;
}
