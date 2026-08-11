import type { ICellData, IWorkbookData } from "@univerjs/core";
import type { StoredMention } from "@/lib/content-mentions";
import { storedMentionFromItem } from "@/lib/content-mentions";
import {
  getDateMentionCandidates,
  getDocumentMentionCandidates,
  getPersonMentionCandidates,
  type MentionItem,
} from "@/lib/mentions";
import { MENTION_GROUPS } from "@/lib/mention-groups";
import { getTeamMembers } from "@/lib/team-members";
import { matchPinyinQuery } from "@/lib/pinyin-search";

/** @ 后紧跟的提及标签（支持中文、字母、数字、下划线） */
const MENTION_TOKEN_RE = /@([\w\u4e00-\u9fff]+)/g;

export function findMentionLabelsInText(text: string): string[] {
  const labels: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(MENTION_TOKEN_RE.source, "g");
  while ((match = re.exec(text)) !== null) {
    const label = match[1]?.trim();
    if (label) labels.push(label);
  }
  return labels;
}

export function resolveMentionByLabel(label: string): MentionItem | null {
  const q = label.trim();
  if (!q) return null;

  if (q === "所有人") {
    return {
      id: "@all",
      label: "所有人",
      type: "person",
      color: "#4f46e5",
      role: "通知全员",
    };
  }

  const members = getTeamMembers();
  const byExactName = members.find((m) => m.name === q);
  if (byExactName) {
    return {
      id: byExactName.id,
      label: byExactName.name,
      type: "person",
      color: byExactName.color,
      role: byExactName.role,
      username: byExactName.username,
    };
  }

  const byUsername = members.find(
    (m) => m.username?.toLowerCase() === q.toLowerCase()
  );
  if (byUsername) {
    return {
      id: byUsername.id,
      label: byUsername.name,
      type: "person",
      color: byUsername.color,
      role: byUsername.role,
      username: byUsername.username,
    };
  }

  for (const group of MENTION_GROUPS) {
    if (group.name === q) {
      return {
        id: group.id,
        label: group.name,
        type: "group",
        color: group.color,
        role: group.role,
        icon: group.icon,
      };
    }
  }

  const dateHit = getDateMentionCandidates("").find((d) => d.label === q);
  if (dateHit) return dateHit;

  const docHits = getDocumentMentionCandidates(q).filter((d) => d.label === q);
  if (docHits.length === 1) return docHits[0];

  const persons = getPersonMentionCandidates(q);
  const exactPersons = persons.filter(
    (p) =>
      p.label === q ||
      p.username?.toLowerCase() === q.toLowerCase() ||
      matchPinyinQuery(p.label, q)
  );
  if (exactPersons.length === 1) return exactPersons[0];

  const prefixMatches = members.filter(
    (m) => m.id !== "@all" && (m.name === q || m.name.startsWith(q))
  );
  if (prefixMatches.length === 1) {
    const m = prefixMatches[0];
    return {
      id: m.id,
      label: m.name,
      type: "person",
      color: m.color,
      role: m.role,
      username: m.username,
    };
  }

  return null;
}

function cellPlainText(cell: ICellData | undefined): string {
  if (!cell) return "";
  const v = cell.v;
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  if (typeof v === "object" && v !== null) {
    const body = (v as { body?: { dataStream?: string } }).body?.dataStream;
    if (typeof body === "string") return body.replace(/\r\n/g, "\n");
  }
  return String(v);
}

function columnToLetter(col: number): string {
  let n = col + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function toA1(row: number, col: number): string {
  return `${columnToLetter(col)}${row + 1}`;
}

export function extractMentionsFromPlainText(
  text: string,
  context?: string
): StoredMention[] {
  const labels = findMentionLabelsInText(text);
  const seen = new Set<string>();
  const results: StoredMention[] = [];

  for (const label of labels) {
    const item = resolveMentionByLabel(label);
    if (!item) continue;
    const key = `${item.id}:${context ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(storedMentionFromItem(item, context));
  }

  return results;
}

export function extractMentionsFromWorkbook(
  workbook: IWorkbookData
): StoredMention[] {
  const results: StoredMention[] = [];
  const seen = new Set<string>();

  for (const sheetId of workbook.sheetOrder ?? []) {
    const sheet = workbook.sheets?.[sheetId];
    if (!sheet?.cellData) continue;
    const sheetName = sheet.name ?? "Sheet";

    for (const [rowKey, rowCells] of Object.entries(sheet.cellData)) {
      const row = Number(rowKey);
      if (!rowCells) continue;
      for (const [colKey, cell] of Object.entries(rowCells)) {
        const col = Number(colKey);
        const text = cellPlainText(cell as ICellData);
        if (!text.includes("@")) continue;
        const context = `${sheetName}!${toA1(row, col)}`;
        for (const entry of extractMentionsFromPlainText(text, context)) {
          const key = `${entry.id}:${entry.context ?? ""}`;
          if (seen.has(key)) continue;
          seen.add(key);
          results.push(entry);
        }
      }
    }
  }

  return results;
}

export function mergeScannedMentions(
  existing: StoredMention[],
  scanned: StoredMention[]
): StoredMention[] {
  const existingMap = new Map<string, StoredMention>(
    existing.map((m) => [`${m.id}:${m.context ?? ""}`, m])
  );
  return scanned.map((s) => {
    const key = `${s.id}:${s.context ?? ""}`;
    const prev = existingMap.get(key);
    return prev ? { ...s, createdAt: prev.createdAt } : s;
  });
}

export function mentionKey(m: Pick<StoredMention, "id" | "context">): string {
  return `${m.id}:${m.context ?? ""}`;
}

export function storedMentionToItem(m: StoredMention): MentionItem {
  return {
    id: m.id,
    label: m.label,
    type: m.mentionType,
    color: m.color,
    href: m.href,
    dateValue: m.dateValue,
  };
}

/** 解析单元格编辑中的 @ 查询（光标前的片段） */
export function parseActiveMentionQuery(
  text: string,
  cursor: number
): { query: string; atIndex: number } | null {
  const before = text.slice(0, cursor);
  const match = before.match(/@([\w\u4e00-\u9fff]*)$/);
  if (!match) return null;
  return {
    query: match[1] ?? "",
    atIndex: cursor - match[0].length,
  };
}

export function richTextValueToPlain(
  value: unknown
): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object" && value !== null) {
    const body = (value as { body?: { dataStream?: string } }).body?.dataStream;
    if (typeof body === "string") return body.replace(/\r\n/g, "\n");
  }
  return String(value);
}
