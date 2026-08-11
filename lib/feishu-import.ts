/**
 * 飞书 / Lark 云文档内容导入转换器
 * 支持从剪贴板 HTML、.html 文件导入
 */

const FEISHU_MARKERS =
  /lark-record-clipboard|data-lark-|feishu|bytedance|ace-line|docs-component|fly-doc|x-flydoc|lark-doc|docx-|suite-doc/i;

export function isFeishuContent(html: string): boolean {
  return FEISHU_MARKERS.test(html);
}

export function convertFeishuHtml(rawHtml: string): string {
  if (typeof document === "undefined") return rawHtml;

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, "text/html");

  doc.querySelectorAll("script, style, meta, link, svg, noscript").forEach((el) => el.remove());

  // 飞书任务列表：checkbox + 文本
  doc.querySelectorAll("li").forEach((li) => {
    const checkbox = li.querySelector('input[type="checkbox"]');
    if (checkbox) {
      li.setAttribute("data-type", "taskItem");
      li.setAttribute(
        "data-checked",
        (checkbox as HTMLInputElement).checked ? "true" : "false"
      );
      checkbox.remove();
    }
  });

  // 飞书 ace-line 段落 → <p>
  doc.querySelectorAll(".ace-line, [data-line='true']").forEach((el) => {
    if (el.tagName === "DIV" && !el.querySelector("div.ace-line")) {
      const p = doc.createElement("p");
      p.innerHTML = el.innerHTML;
      copyAttributes(el, p, ["class", "style", "data-*"]);
      el.replaceWith(p);
    }
  });

  // 标题识别：class 含 heading 或 role=heading
  doc.querySelectorAll("[class*='heading'], [data-heading]").forEach((el) => {
    const level = detectHeadingLevel(el);
    if (level) {
      const h = doc.createElement(`h${level}`);
      h.innerHTML = el.innerHTML;
      el.replaceWith(h);
    }
  });

  // 引用块
  doc.querySelectorAll("[class*='quote'], blockquote.feelgood").forEach((el) => {
    if (el.tagName !== "BLOCKQUOTE") {
      const bq = doc.createElement("blockquote");
      bq.innerHTML = el.innerHTML;
      el.replaceWith(bq);
    }
  });

  // 分割线
  doc.querySelectorAll("[class*='divider'], hr").forEach((el) => {
    if (el.tagName !== "HR") {
      const hr = doc.createElement("hr");
      el.replaceWith(hr);
    }
  });

  // 表格：保留基本结构，清理样式
  doc.querySelectorAll("table").forEach((table) => {
    table.removeAttribute("style");
    table.querySelectorAll("td, th").forEach((cell) => {
      cell.removeAttribute("style");
      cell.removeAttribute("class");
    });
  });

  // 清理所有元素的飞书特有属性
  doc.body.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      if (
        attr.name.startsWith("data-") &&
        !attr.name.startsWith("data-type") &&
        !attr.name.startsWith("data-checked")
      ) {
        el.removeAttribute(attr.name);
      }
    });
    el.removeAttribute("style");
    el.removeAttribute("contenteditable");
    el.className = "";
  });

  // unwrap 多余的 wrapper div
  unwrapSingleChildDivs(doc.body);

  // 包裹裸文本节点
  normalizeBlockStructure(doc.body);

  let html = doc.body.innerHTML.trim();
  html = html.replace(/<div>\s*<\/div>/gi, "");
  html = html.replace(/\n{3,}/g, "\n\n");

  return html || "<p></p>";
}

function detectHeadingLevel(el: Element): number | null {
  const cls = el.className?.toString() ?? "";
  const match = cls.match(/heading(?:-|\s|_)?(\d)/i);
  if (match) return Math.min(parseInt(match[1], 10), 6);

  const dataLevel = el.getAttribute("data-heading-level");
  if (dataLevel) return Math.min(parseInt(dataLevel, 10), 6);

  const style = el.getAttribute("style") ?? "";
  const fontSize = style.match(/font-size:\s*(\d+)/);
  if (fontSize) {
    const size = parseInt(fontSize[1], 10);
    if (size >= 28) return 1;
    if (size >= 24) return 2;
    if (size >= 20) return 3;
    if (size >= 18) return 4;
  }

  return null;
}

function copyAttributes(from: Element, to: Element, exclude: string[]) {
  [...from.attributes].forEach((attr) => {
    const skip = exclude.some(
      (p) => p === attr.name || (p.endsWith("*") && attr.name.startsWith(p.slice(0, -1)))
    );
    if (!skip) to.setAttribute(attr.name, attr.value);
  });
}

function unwrapSingleChildDivs(root: Element) {
  let changed = true;
  while (changed) {
    changed = false;
    root.querySelectorAll("div").forEach((div) => {
      if (
        div.children.length === 1 &&
        div.children[0].tagName === "DIV" &&
        !div.textContent?.trim()
      ) {
        return;
      }
      if (
        div.parentElement &&
        div.children.length <= 1 &&
        !div.className &&
        !div.getAttribute("data-type")
      ) {
        const child = div.firstElementChild ?? div.firstChild;
        if (child && div.parentElement) {
          div.replaceWith(...Array.from(div.childNodes));
          changed = true;
        }
      }
    });
  }
}

function normalizeBlockStructure(body: HTMLElement) {
  const blockTags = new Set([
    "P", "H1", "H2", "H3", "H4", "H5", "H6",
    "UL", "OL", "LI", "BLOCKQUOTE", "HR", "TABLE", "PRE",
  ]);

  Array.from(body.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      const p = body.ownerDocument.createElement("p");
      p.textContent = node.textContent.trim();
      body.replaceChild(p, node);
    } else if (
      node.nodeType === Node.ELEMENT_NODE &&
      !blockTags.has((node as Element).tagName)
    ) {
      const el = node as Element;
      if (el.tagName === "DIV" && el.textContent?.trim()) {
        const p = body.ownerDocument.createElement("p");
        p.innerHTML = el.innerHTML;
        body.replaceChild(p, el);
      }
    }
  });
}

/** 尝试解析飞书私有 flydoc JSON 格式 */
export function tryParseFlydoc(json: string): string | null {
  try {
    const data = JSON.parse(json) as Record<string, unknown>;
    const blocks = (data.blocks ?? data.body ?? data.content) as unknown[];
    if (!Array.isArray(blocks)) return null;

    const parts: string[] = [];
    for (const block of blocks) {
      const b = block as Record<string, unknown>;
      const type = String(b.type ?? b.block_type ?? "");
      const text = extractBlockText(b);

      switch (type) {
        case "heading1":
        case "heading_1":
          parts.push(`<h1>${text}</h1>`);
          break;
        case "heading2":
        case "heading_2":
          parts.push(`<h2>${text}</h2>`);
          break;
        case "heading3":
        case "heading_3":
          parts.push(`<h3>${text}</h3>`);
          break;
        case "bullet":
        case "unordered_list":
          parts.push(`<ul><li>${text}</li></ul>`);
          break;
        case "ordered":
        case "ordered_list":
          parts.push(`<ol><li>${text}</li></ol>`);
          break;
        case "todo":
        case "task":
          parts.push(`<ul data-type="taskList"><li data-type="taskItem" data-checked="false">${text}</li></ul>`);
          break;
        case "quote":
        case "blockquote":
          parts.push(`<blockquote>${text}</blockquote>`);
          break;
        case "divider":
          parts.push("<hr>");
          break;
        default:
          if (text) parts.push(`<p>${text}</p>`);
      }
    }
    return parts.length > 0 ? parts.join("") : null;
  } catch {
    return null;
  }
}

function extractBlockText(block: Record<string, unknown>): string {
  if (typeof block.text === "string") return escapeHtml(block.text);
  const elements = block.elements ?? block.text_elements ?? block.content;
  if (Array.isArray(elements)) {
    return elements
      .map((el) => {
        const e = el as Record<string, unknown>;
        const t = String(e.text ?? e.content ?? "");
        const style = e.text_run ?? e.style;
        if (style && typeof style === "object") {
          const s = style as Record<string, unknown>;
          let wrapped = escapeHtml(t);
          if (s.bold) wrapped = `<strong>${wrapped}</strong>`;
          if (s.italic) wrapped = `<em>${wrapped}</em>`;
          if (s.underline) wrapped = `<u>${wrapped}</u>`;
          if (s.strikethrough) wrapped = `<s>${wrapped}</s>`;
          return wrapped;
        }
        return escapeHtml(t);
      })
      .join("");
  }
  return "";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 从 ClipboardEvent 提取并转换飞书内容 */
export function extractFeishuFromClipboard(
  clipboardData: DataTransfer
): string | null {
  // 优先尝试飞书私有格式
  const flydoc =
    clipboardData.getData("application/x-flydoc") ||
    clipboardData.getData("application/x-lark-doc");
  if (flydoc) {
    const parsed = tryParseFlydoc(flydoc);
    if (parsed) return parsed;
  }

  const html = clipboardData.getData("text/html");
  if (html && (isFeishuContent(html) || html.length > 50)) {
    return convertFeishuHtml(html);
  }

  const plain = clipboardData.getData("text/plain");
  if (plain && plain.trim()) {
    const lines = plain.split("\n").filter((l) => l.trim());
    return lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("");
  }

  return null;
}

/** 从 HTML 文件内容转换 */
export function convertFeishuFileContent(content: string): string {
  return convertFeishuHtml(content);
}

export function countImportedBlocks(html: string): number {
  if (typeof document === "undefined") return 0;
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.querySelectorAll(
    "p, h1, h2, h3, h4, h5, h6, li, blockquote, hr, table, pre"
  ).length;
}
