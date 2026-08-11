import type { CollabPresenceUser, Document } from "@/types/document";
import { CONTENT_TYPE_META, getContentPath, type ContentType } from "@/lib/content-types";
import { getTeamMembers } from "@/lib/team-members";
import { MENTION_GROUPS, getGroupMemberIds, isUserInGroup } from "@/lib/mention-groups";
import { getRecentMentions } from "@/lib/mention-recent";
import { matchPinyinQuery } from "@/lib/pinyin-search";

export type MentionItemType = "person" | "document" | "date" | "group";

export interface MentionItem {
  id: string;
  label: string;
  type: MentionItemType;
  color?: string;
  role?: string;
  username?: string;
  online?: boolean;
  href?: string;
  icon?: string;
  dateValue?: string;
  subtitle?: string;
  memberIds?: string[];
}

export type MentionTab = "all" | "person" | "document" | "date" | "group";

let onlineUsersGetter: () => CollabPresenceUser[] = () => [];
let documentsGetter: () => Document[] = () => [];
let excludeDocumentId: string | null = null;

export function setOnlineUsersGetter(fn: () => CollabPresenceUser[]) {
  onlineUsersGetter = fn;
}

export function setDocumentsGetter(fn: () => Document[], excludeId?: string) {
  documentsGetter = fn;
  excludeDocumentId = excludeId ?? null;
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function getNextMonday(base: Date): Date {
  const d = new Date(base);
  const day = d.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function getDateMentionCandidates(query: string): MentionItem[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const presets: MentionItem[] = [
    {
      id: "date_today",
      label: "今天",
      type: "date",
      icon: "📅",
      dateValue: now.toISOString().slice(0, 10),
      subtitle: formatDateLabel(now),
    },
    {
      id: "date_tomorrow",
      label: "明天",
      type: "date",
      icon: "📅",
      dateValue: addDays(now, 1).toISOString().slice(0, 10),
      subtitle: formatDateLabel(addDays(now, 1)),
    },
    {
      id: "date_day_after",
      label: "后天",
      type: "date",
      icon: "📅",
      dateValue: addDays(now, 2).toISOString().slice(0, 10),
      subtitle: formatDateLabel(addDays(now, 2)),
    },
    {
      id: "date_next_week",
      label: "下周",
      type: "date",
      icon: "📅",
      dateValue: addDays(now, 7).toISOString().slice(0, 10),
      subtitle: formatDateLabel(addDays(now, 7)),
    },
    {
      id: "date_next_monday",
      label: "下周一",
      type: "date",
      icon: "📅",
      dateValue: getNextMonday(now).toISOString().slice(0, 10),
      subtitle: formatDateLabel(getNextMonday(now)),
    },
  ];

  const q = query.toLowerCase().trim();
  if (!q) return presets;
  return presets.filter(
    (p) =>
      p.label.includes(q) ||
      p.subtitle?.includes(q) ||
      "日期".includes(q) ||
      "date".includes(q)
  );
}

export function getPersonMentionCandidates(query: string): MentionItem[] {
  const online = onlineUsersGetter();
  const members = getTeamMembers();
  const merged = new Map<string, MentionItem>();

  for (const member of members) {
    merged.set(member.id, {
      id: member.id,
      label: member.name,
      type: "person",
      color: member.color,
      role: member.role,
      username: member.username,
      online: false,
    });
  }

  for (const u of online) {
    const existing = merged.get(u.id);
    if (existing) {
      merged.set(u.id, {
        ...existing,
        online: true,
        label: u.name,
        color: u.color,
      });
    } else {
      merged.set(u.id, {
        id: u.id,
        label: u.name,
        type: "person",
        color: u.color,
        role: "在线成员",
        online: true,
      });
    }
  }

  const all = Array.from(merged.values());
  const q = query.toLowerCase().trim();
  const filtered = q
    ? all.filter(
        (u) =>
          matchPinyinQuery(u.label, q) ||
          u.role?.toLowerCase().includes(q) ||
          u.username?.toLowerCase().includes(q)
      )
    : all;

  return filtered.sort((a, b) => {
    if (a.online && !b.online) return -1;
    if (!a.online && b.online) return 1;
    return 0;
  });
}

export function getDocumentMentionCandidates(query: string): MentionItem[] {
  const docs = documentsGetter().filter((d) => d.id !== excludeDocumentId);
  const q = query.toLowerCase().trim();

  const items: MentionItem[] = docs.map((doc) => {
    const ct = (doc.contentType ?? "doc") as ContentType;
    const meta = CONTENT_TYPE_META[ct];
    return {
      id: `doc_${doc.id}`,
      label: doc.title,
      type: "document",
      icon: doc.icon || meta.icon,
      href: getContentPath(doc.id, ct),
      subtitle: meta.label,
      color: "#6366f1",
    };
  });

  if (!q) return items.slice(0, 20);
  return items
    .filter(
      (d) =>
        matchPinyinQuery(d.label, q) ||
        d.subtitle?.toLowerCase().includes(q)
    )
    .slice(0, 20);
}

export function getGroupMentionCandidates(query: string): MentionItem[] {
  const q = query.toLowerCase().trim();
  const items: MentionItem[] = MENTION_GROUPS.map((g) => {
    const memberIds = getGroupMemberIds(g.id);
    return {
      id: g.id,
      label: g.name,
      type: "group" as const,
      color: g.color,
      role: g.role,
      icon: g.icon,
      subtitle: `${memberIds.length} 人`,
      memberIds,
    };
  });

  if (!q) return items;
  return items.filter(
    (g) => matchPinyinQuery(g.label, q) || g.role?.toLowerCase().includes(q)
  );
}

export function getRecentMentionItems(): MentionItem[] {
  return getRecentMentions().map((r) => ({
    id: r.id,
    label: r.label,
    type: r.type as MentionItemType,
    color: r.color,
    icon: r.icon,
    subtitle: "最近使用",
  }));
}

export function getMentionCandidates(
  query: string,
  tab: MentionTab = "all"
): MentionItem[] {
  if (tab === "person") return getPersonMentionCandidates(query);
  if (tab === "document") return getDocumentMentionCandidates(query);
  if (tab === "date") return getDateMentionCandidates(query);
  if (tab === "group") return getGroupMentionCandidates(query);

  const persons = getPersonMentionCandidates(query);
  const documents = getDocumentMentionCandidates(query);
  const dates = getDateMentionCandidates(query);
  const groups = getGroupMentionCandidates(query);

  if (query.trim()) {
    return [
      ...persons.slice(0, 6),
      ...groups.slice(0, 3),
      ...documents.slice(0, 4),
      ...dates.slice(0, 2),
    ];
  }

  // 无查询时：最近使用 + 分组
  const recent = getRecentMentionItems().slice(0, 4);
  const recentIds = new Set(recent.map((r) => r.id));
  const filteredPersons = persons.filter((p) => !recentIds.has(p.id)).slice(0, 4);

  return [
    ...recent,
    ...filteredPersons,
    ...groups.slice(0, 3),
    ...documents.slice(0, 3),
    ...dates.slice(0, 2),
  ];
}

export function mentionItemToAttrs(item: MentionItem) {
  return {
    id: item.id,
    label: item.label,
    mentionType: item.type,
    color: item.color ?? null,
    href: item.href ?? null,
    dateValue: item.dateValue ?? null,
    icon: item.icon ?? null,
    memberIds: item.memberIds ?? null,
  };
}

export interface ExtractedMention {
  id: string;
  label: string;
  mentionType: MentionItemType;
  color?: string;
  href?: string;
  dateValue?: string;
}

export function extractMentionsFromJson(
  content: Record<string, unknown> | undefined
): ExtractedMention[] {
  if (!content) return [];
  const results: ExtractedMention[] = [];

  function walk(node: Record<string, unknown>) {
    if (node.type === "mention") {
      const attrs = node.attrs as Record<string, unknown> | undefined;
      if (attrs?.label) {
        results.push({
          id: String(attrs.id ?? ""),
          label: String(attrs.label),
          mentionType: (attrs.mentionType as MentionItemType) ?? "person",
          color: attrs.color as string | undefined,
          href: attrs.href as string | undefined,
          dateValue: attrs.dateValue as string | undefined,
        });
      }
    }
    const contentArr = node.content as Record<string, unknown>[] | undefined;
    contentArr?.forEach(walk);
  }

  walk(content);
  return results;
}

export function isMentionForUser(
  mention: ExtractedMention,
  userId: string,
  userName: string
): boolean {
  if (mention.mentionType === "group") {
    const members = getTeamMembers();
    return isUserInGroup(
      mention.id,
      userId,
      userName,
      (id) => members.find((m) => m.id === id)?.name
    );
  }
  if (mention.mentionType !== "person") return false;
  if (mention.id === userId) return true;
  if (mention.id === "@all" || mention.label === "所有人") return true;
  return mention.label === userName;
}

/** 获取 mention 应通知的目标用户 ID 列表 */
export function getMentionTargetIds(mention: ExtractedMention): string[] {
  if (mention.mentionType === "group") {
    return getGroupMemberIds(mention.id);
  }
  if (mention.mentionType === "person") {
    if (mention.id === "@all") {
      return getTeamMembers()
        .filter((m) => m.id !== "@all")
        .map((m) => m.id);
    }
    return [mention.id];
  }
  return [];
}

export function formatMentionDate(dateValue: string): string {
  try {
    const d = new Date(dateValue + "T00:00:00");
    return d.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  } catch {
    return dateValue;
  }
}
