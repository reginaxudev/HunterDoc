"use client";

import type { CollabPresenceUser } from "@/types/document";

interface PresenceAvatarsProps {
  users: CollabPresenceUser[];
}

export default function PresenceAvatars({ users }: PresenceAvatarsProps) {
  if (users.length === 0) return null;

  const visible = users.slice(0, 5);
  const extra = users.length - visible.length;

  return (
    <div className="flex items-center gap-1">
      <span className="mr-1 text-xs text-gray-400">
        {users.length} 人在线
      </span>
      <div className="flex -space-x-2">
        {visible.map((user) => (
          <div
            key={user.id}
            title={user.name}
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-medium text-white"
            style={{ backgroundColor: user.color }}
          >
            {user.name.slice(0, 1)}
          </div>
        ))}
        {extra > 0 && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-200 text-xs font-medium text-gray-600">
            +{extra}
          </div>
        )}
      </div>
    </div>
  );
}
