export interface MentionNotification {
  id: string;
  documentId: string;
  documentTitle: string;
  documentHref: string;
  fromUserId: string;
  fromUserName: string;
  mentionLabel: string;
  mentionType: string;
  createdAt: string;
  read: boolean;
}

function dispatchInboxUpdate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("mention-inbox-update"));
}

export async function fetchMentionInbox(): Promise<MentionNotification[]> {
  if (typeof window === "undefined") return [];
  try {
    const res = await fetch("/api/mentions/inbox", { cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()) as MentionNotification[];
  } catch {
    return [];
  }
}

/** @deprecated use fetchMentionInbox */
export function getMentionInbox(_userId: string): MentionNotification[] {
  return [];
}

export function addMentionNotification(
  targetUserId: string,
  notification: Omit<MentionNotification, "id" | "read" | "createdAt">
) {
  if (typeof window === "undefined") return;

  void (async () => {
    try {
      const res = await fetch("/api/mentions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId,
          documentId: notification.documentId,
          documentTitle: notification.documentTitle,
          documentHref: notification.documentHref,
          mentionLabel: notification.mentionLabel,
          mentionType: notification.mentionType,
        }),
      });
      if (res.ok) {
        dispatchInboxUpdate();
      }
    } catch {
      // ignore network errors
    }
  })();
}

export async function markInboxRead(
  _userId: string,
  notificationId?: string
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/mentions/inbox", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        notificationId ? { notificationId } : { markAllRead: true }
      ),
    });
    dispatchInboxUpdate();
  } catch {
    // ignore
  }
}

export async function getUnreadCount(_userId: string): Promise<number> {
  const inbox = await fetchMentionInbox();
  return inbox.filter((n) => !n.read).length;
}

export async function clearInbox(_userId: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/mentions/inbox", { method: "DELETE" });
    dispatchInboxUpdate();
  } catch {
    // ignore
  }
}
