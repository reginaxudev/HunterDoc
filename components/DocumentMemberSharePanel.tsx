"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Loader2, Plus, Search, X } from "lucide-react";
import ShareLinkPermissionSelect from "@/components/ShareLinkPermissionSelect";
import { useAuth } from "@/components/AuthProvider";
import {
  parseShareLinkPermission,
  type ShareLinkPermission,
} from "@/lib/document-permissions";
import { refreshTeamMembersCache } from "@/lib/team-members";

interface CollaboratorUser {
  id: string;
  username: string;
  name: string;
  color: string;
  role: string;
}

interface CollaboratorItem {
  id: string;
  documentId: string;
  userId: string;
  permission: ShareLinkPermission;
  addedById: string;
  createdAt: string;
  user: CollaboratorUser;
}

interface TeamUser {
  id: string;
  username: string;
  name: string;
  color: string;
  role: string;
}

interface DocumentMemberSharePanelProps {
  documentId: string;
  variant?: "full" | "compact";
  onCollaboratorsChange?: (count: number) => void;
}

export default function DocumentMemberSharePanel({
  documentId,
  variant = "full",
  onCollaboratorsChange,
}: DocumentMemberSharePanelProps) {
  const { user } = useAuth();
  const [collaborators, setCollaborators] = useState<CollaboratorItem[]>([]);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showList, setShowList] = useState(false);
  const [invitePermission, setInvitePermission] =
    useState<ShareLinkPermission>("read");
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const compact = variant === "compact";

  const collaboratorIds = useMemo(
    () => new Set(collaborators.map((c) => c.userId)),
    [collaborators]
  );

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = teamUsers
      .filter((u) => u.id !== user?.id)
      .filter((u) => !collaboratorIds.has(u.id));
    if (!q) return pool.slice(0, 6);
    return pool
      .filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query, teamUsers, collaboratorIds, user?.id]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [collabRes, usersRes, accessRes] = await Promise.all([
        fetch(`/api/documents/${documentId}/collaborators`, { cache: "no-store" }),
        fetch("/api/users"),
        fetch(`/api/documents/${documentId}/access`, { cache: "no-store" }),
      ]);

      if (collabRes.ok) {
        const data = (await collabRes.json()) as CollaboratorItem[];
        const mapped = data.map((c) => ({
          ...c,
          permission: parseShareLinkPermission(c.permission),
        }));
        setCollaborators(mapped);
        onCollaboratorsChange?.(mapped.length);
      }

      if (usersRes.ok) {
        setTeamUsers((await usersRes.json()) as TeamUser[]);
      }

      if (accessRes.ok) {
        const data = (await accessRes.json()) as { access?: string };
        setCanManage(data.access === "manage");
      } else {
        setCanManage(false);
      }
    } finally {
      setLoading(false);
    }
  }, [documentId, onCollaboratorsChange]);

  useEffect(() => {
    void refreshTeamMembersCache();
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!showSuggestions) return;
    const handler = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSuggestions]);

  async function addMember(target: TeamUser) {
    if (!canManage) return;
    setAddingUserId(target.id);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: target.id, permission: invitePermission }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "添加失败");
        return;
      }
      setCollaborators((prev) => {
        const next = prev.filter((c) => c.userId !== data.userId);
        const merged = [
          ...next,
          { ...data, permission: parseShareLinkPermission(data.permission) },
        ];
        onCollaboratorsChange?.(merged.length);
        return merged;
      });
      setQuery("");
      setShowSuggestions(false);
    } finally {
      setAddingUserId(null);
    }
  }

  async function updatePermission(userId: string, permission: ShareLinkPermission) {
    const res = await fetch(`/api/documents/${documentId}/collaborators`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, permission }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setCollaborators((prev) =>
      prev.map((c) =>
        c.userId === userId
          ? { ...c, permission: parseShareLinkPermission(data.permission) }
          : c
      )
    );
  }

  async function removeMember(userId: string) {
    const res = await fetch(
      `/api/documents/${documentId}/collaborators?userId=${encodeURIComponent(userId)}`,
      { method: "DELETE" }
    );
    if (!res.ok) return;
    setCollaborators((prev) => {
      const next = prev.filter((c) => c.userId !== userId);
      onCollaboratorsChange?.(next.length);
      return next;
    });
  }

  const searchBlock = (
    <div ref={searchRef} className="relative">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 focus-within:border-blue-400 focus-within:bg-white focus-within:ring-1 focus-within:ring-blue-400">
          <Search className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="搜索用户、群组或部门"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
            disabled={!canManage}
          />
        </div>
        {canManage && (
          <button
            type="button"
            disabled={!query.trim() || suggestions.length === 0 || !!addingUserId}
            onClick={() => {
              const first = suggestions[0];
              if (first) void addMember(first);
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
            title="添加协作者"
          >
            {addingUserId ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {canManage && (
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <span>新成员权限</span>
          <ShareLinkPermissionSelect
            value={invitePermission}
            onChange={setInvitePermission}
            compact
          />
        </div>
      )}

      {showSuggestions && canManage && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {suggestions.map((member) => (
            <button
              key={member.id}
              type="button"
              disabled={addingUserId === member.id}
              onClick={() => void addMember(member)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              <MemberAvatar name={member.name} color={member.color} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-gray-800">{member.name}</div>
                <div className="truncate text-xs text-gray-400">@{member.username}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const memberList = (
    <ul className={compact ? "mt-3 space-y-1.5" : "space-y-2"}>
      {collaborators.map((collaborator) => (
        <li
          key={collaborator.id}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2"
        >
          <MemberAvatar name={collaborator.user.name} color={collaborator.user.color} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-gray-800">
              {collaborator.user.name}
            </div>
            <div className="truncate text-xs text-gray-400">
              @{collaborator.user.username}
            </div>
          </div>
          <ShareLinkPermissionSelect
            value={collaborator.permission}
            onChange={(next) => void updatePermission(collaborator.userId, next)}
            disabled={!canManage}
            compact
          />
          {canManage && (
            <button
              type="button"
              onClick={() => void removeMember(collaborator.userId)}
              className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
              title="移除"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );

  if (compact) {
    return (
      <div>
        {!canManage && (
          <p className="mb-3 text-xs text-gray-500">
            你当前只能查看协作者，如需添加请联系管理员。
          </p>
        )}

        {collaborators.length > 0 && (
          <button
            type="button"
            onClick={() => setShowList(!showList)}
            className="mb-3 flex w-full items-center gap-2 rounded-lg py-1 hover:bg-gray-50"
          >
            <div className="flex -space-x-2">
              {collaborators.slice(0, 5).map((c) => (
                <MemberAvatar
                  key={c.id}
                  name={c.user.name}
                  color={c.user.color}
                  size="sm"
                  stacked
                />
              ))}
              {collaborators.length > 5 && (
                <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[10px] font-medium text-gray-600">
                  +{collaborators.length - 5}
                </span>
              )}
            </div>
            <span className="flex-1 text-left text-xs text-gray-500">
              {collaborators.length} 位协作者
            </span>
            <ChevronRight
              className={`h-4 w-4 text-gray-400 transition ${showList ? "rotate-90" : ""}`}
            />
          </button>
        )}

        {searchBlock}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        {loading && collaborators.length === 0 ? (
          <div className="py-4 text-center text-xs text-gray-400">
            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
          </div>
        ) : showList && collaborators.length > 0 ? (
          memberList
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex max-h-[min(70vh,520px)] flex-col p-6">
      {!canManage && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
          你当前只能查看已分享成员，如需添加或修改请联系可管理的协作者。
        </div>
      )}

      {canManage && <div className="mb-4">{searchBlock}</div>}
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mb-2 text-xs font-medium text-gray-500">
          已分享给 {collaborators.length} 位成员
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-400">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            加载中...
          </div>
        ) : collaborators.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
            暂未分享给任何成员
          </div>
        ) : (
          memberList
        )}
      </div>
    </div>
  );
}

function MemberAvatar({
  name,
  color,
  size = "md",
  stacked = false,
}: {
  name: string;
  color: string;
  size?: "sm" | "md";
  stacked?: boolean;
}) {
  const dim = size === "sm" ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-xs";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${dim} ${
        stacked ? "border-2 border-white" : ""
      }`}
      style={{ backgroundColor: color }}
      title={name}
    >
      {name.slice(0, 1)}
    </span>
  );
}
