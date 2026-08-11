import type { ExtractedMention, MentionItem, MentionItemType } from "@/lib/mentions";
import { getMentionTargetIds } from "@/lib/mentions";
import { addMentionNotification } from "@/lib/mention-inbox";
import { addRecentMention } from "@/lib/mention-recent";
import type { CollabUser } from "@/lib/user";

export interface StoredMention extends ExtractedMention {
  /** Where the mention appears, e.g. Sheet1!A3 / node:n1 / record:r1 */
  context?: string;
  createdAt?: string;
}

export function formatMentionToken(item: Pick<MentionItem, "label">): string {
  return `@${item.label}`;
}

export function storedMentionFromItem(
  item: MentionItem,
  context?: string
): StoredMention {
  return {
    id: item.id,
    label: item.label,
    mentionType: item.type as MentionItemType,
    color: item.color,
    href: item.href,
    dateValue: item.dateValue,
    context,
    createdAt: new Date().toISOString(),
  };
}

export function upsertStoredMention(
  list: StoredMention[],
  entry: StoredMention
): StoredMention[] {
  const key = `${entry.id}:${entry.context ?? ""}`;
  const filtered = list.filter((m) => `${m.id}:${m.context ?? ""}` !== key);
  return [...filtered, entry];
}

export function toExtractedMentions(list: StoredMention[]): ExtractedMention[] {
  return list.map(({ id, label, mentionType, color, href, dateValue }) => ({
    id,
    label,
    mentionType,
    color,
    href,
    dateValue,
  }));
}

export function notifyContentMention(
  item: MentionItem,
  meta: {
    documentId: string;
    documentTitle: string;
    documentHref: string;
  },
  actor: CollabUser
) {
  if (item.type !== "person" && item.type !== "group") return;

  const mention = storedMentionFromItem(item);
  const targets = getMentionTargetIds(mention);

  for (const targetId of targets) {
    addMentionNotification(targetId, {
      documentId: meta.documentId,
      documentTitle: meta.documentTitle,
      documentHref: meta.documentHref,
      fromUserId: actor.id,
      fromUserName: actor.name,
      mentionLabel: item.label,
      mentionType: item.type,
    });
  }

  addRecentMention({
    id: item.id,
    label: item.label,
    type: item.type,
    color: item.color,
    icon: item.icon,
  });
}

export function handleMentionPick(
  item: MentionItem,
  meta: {
    documentId: string;
    documentTitle: string;
    documentHref: string;
    context?: string;
  },
  mentions: StoredMention[],
  onMentionsChange: (next: StoredMention[]) => void,
  actor: CollabUser
) {
  const entry = storedMentionFromItem(item, meta.context);
  onMentionsChange(upsertStoredMention(mentions, entry));
  notifyContentMention(item, meta, actor);
}
