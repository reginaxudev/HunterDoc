const RECENT_KEY = "headhunter-docs-recent-mentions";
const MAX_RECENT = 12;

export interface RecentMention {
  id: string;
  label: string;
  type: string;
  color?: string;
  icon?: string;
  usedAt: number;
}

export function getRecentMentions(): RecentMention[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    return stored ? (JSON.parse(stored) as RecentMention[]) : [];
  } catch {
    return [];
  }
}

export function addRecentMention(item: Omit<RecentMention, "usedAt">) {
  if (typeof window === "undefined") return;
  const recent = getRecentMentions().filter((r) => r.id !== item.id);
  recent.unshift({ ...item, usedAt: Date.now() });
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

export function clearRecentMentions() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(RECENT_KEY);
}
