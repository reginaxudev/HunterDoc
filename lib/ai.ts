export function extractTextFromTipTap(content: Record<string, unknown>): string {
  const parts: string[] = [];

  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;

    if (n.type === "text" && typeof n.text === "string") {
      parts.push(n.text);
    }

    if (Array.isArray(n.content)) {
      for (const child of n.content) {
        walk(child);
      }
      if (
        n.type === "paragraph" ||
        n.type === "heading" ||
        n.type === "listItem"
      ) {
        parts.push("\n");
      }
    }
  }

  walk(content);
  return parts.join("").trim();
}

export function buildSummaryPrompt(documentText: string, title: string): string {
  return `你是一位资深猎头顾问，请根据以下候选人/项目文档内容，生成一份简洁专业的中文摘要报告。

要求：
1. 用 3-5 个要点概括核心信息
2. 如有候选人，突出：背景、核心优势、潜在风险、推荐等级
3. 如有职位/客户信息，突出：关键要求、搜索策略、当前进展
4. 语言专业简洁，适合向 Team Leader 或客户汇报
5. 总字数控制在 200-400 字

文档标题：${title}

文档内容：
${documentText.slice(0, 8000)}`;
}
