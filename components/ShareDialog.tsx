"use client";

import { useCallback, useEffect, useState } from "react";
import {
  X,
  Copy,
  Check,
  Loader2,
  Settings,
  ChevronLeft,
  Users,
  Link2,
  HelpCircle,
} from "lucide-react";
import DocumentPermissionSettingsPanel from "@/components/DocumentPermissionSettingsPanel";
import DocumentMemberSharePanel from "@/components/DocumentMemberSharePanel";
import ShareLinkPermissionSelect, {
  ShareLinkPermissionBadge,
} from "@/components/ShareLinkPermissionSelect";
import { useAuth } from "@/components/AuthProvider";
import {
  authUserAccess,
  normalizePermissionSettings,
  parseShareLinkPermission,
  SHARE_LINK_PERMISSION_LABELS,
  type ShareLinkPermission,
} from "@/lib/document-permissions";

interface ShareDialogProps {
  documentId: string;
  open: boolean;
  onClose: () => void;
}

interface ShareLinkItem {
  id: string;
  token: string;
  permission: ShareLinkPermission;
  encrypted?: boolean;
  url: string;
  createdAt: string;
}

type View = "share" | "permissions";

export default function ShareDialog({
  documentId,
  open,
  onClose,
}: ShareDialogProps) {
  const { user } = useAuth();
  const [view, setView] = useState<View>("share");
  const [links, setLinks] = useState<ShareLinkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkPermission, setLinkPermission] = useState<ShareLinkPermission>("read");
  const [allowExternalShare, setAllowExternalShare] = useState(true);
  const [externalShareManageOnly, setExternalShareManageOnly] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [collaboratorCount, setCollaboratorCount] = useState(0);
  const [docAccess, setDocAccess] = useState<"read" | "edit" | "manage" | null>(
    null
  );

  const userAccess = user ? authUserAccess(user.role) : "read";
  const canManageDoc = docAccess === "manage" || userAccess === "manage";
  const canManageLink =
    allowExternalShare &&
    canManageDoc &&
    (!externalShareManageOnly || userAccess === "manage");
  const primaryLink = links[0] ?? null;
  const linkShareEnabled = !!primaryLink;

  const load = useCallback(async () => {
    setLoading(true);
    setCreateError(null);
    try {
      const [linksRes, permRes, collabRes, accessRes] = await Promise.all([
        fetch(`/api/share?documentId=${documentId}`, { cache: "no-store" }),
        fetch(`/api/documents/${documentId}/permissions`, { cache: "no-store" }),
        fetch(`/api/documents/${documentId}/collaborators`, { cache: "no-store" }),
        fetch(`/api/documents/${documentId}/access`, { cache: "no-store" }),
      ]);

      const baseUrl = window.location.origin;

      if (linksRes.ok) {
        const data = (await linksRes.json()) as ShareLinkItem[];
        const mapped = data.map((l) => ({
          ...l,
          permission: parseShareLinkPermission(l.permission),
          url: `${baseUrl}/share/${l.token}`,
        }));
        setLinks(mapped);
        if (mapped[0]) setLinkPermission(mapped[0].permission);
      } else {
        setLinks([]);
      }

      if (permRes.ok) {
        const settings = normalizePermissionSettings(await permRes.json());
        setAllowExternalShare(settings.allowExternalShare);
        setExternalShareManageOnly(settings.externalShareManageOnly);
      }

      if (collabRes.ok) {
        const collaborators = (await collabRes.json()) as unknown[];
        setCollaboratorCount(collaborators.length);
      }

      if (accessRes.ok) {
        const data = (await accessRes.json()) as { access?: "read" | "edit" | "manage" };
        setDocAccess(data.access ?? null);
      } else {
        setDocAccess(null);
      }
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (!open) return;
    setView("share");
    void load();
  }, [open, load]);

  if (!open) return null;

  async function ensureLink(permission: ShareLinkPermission = linkPermission) {
    if (!canManageLink) return null;
    if (primaryLink) return primaryLink;

    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, permission }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? "创建分享链接失败");
        return null;
      }
      const item: ShareLinkItem = {
        ...data,
        permission: parseShareLinkPermission(data.permission),
        url: `${window.location.origin}/share/${data.token}`,
      };
      setLinks([item]);
      setLinkPermission(item.permission);
      return item;
    } finally {
      setCreating(false);
    }
  }

  async function enableLinkShare() {
    await ensureLink(linkPermission);
  }

  async function disableLinkShare() {
    if (!primaryLink) return;
    setCreating(true);
    setCreateError(null);
    try {
      await fetch(`/api/share/${primaryLink.id}`, { method: "DELETE" });
      setLinks([]);
    } finally {
      setCreating(false);
    }
  }

  async function updateLinkPermission(next: ShareLinkPermission) {
    setLinkPermission(next);
    if (!primaryLink) {
      await ensureLink(next);
      return;
    }
    const res = await fetch(`/api/share/${primaryLink.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permission: next }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setLinks([
      {
        ...primaryLink,
        permission: parseShareLinkPermission(updated.permission),
      },
    ]);
  }

  async function copyLink() {
    let url: string | undefined = primaryLink?.url;
    if (!url) {
      const created = await ensureLink(linkPermission);
      url = created?.url;
    }
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          {view === "permissions" ? (
            <button
              type="button"
              onClick={() => setView("share")}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <ChevronLeft className="h-4 w-4" />
              返回分享
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-semibold text-gray-900">分享文档</h2>
              <HelpCircle className="h-3.5 w-3.5 text-gray-400" aria-hidden />
            </div>
          )}
          <div className="flex items-center gap-1">
            {view === "share" && canManageDoc && (
              <button
                type="button"
                onClick={() => setView("permissions")}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <Settings className="h-3.5 w-3.5" />
                权限设置
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {view === "permissions" ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <DocumentPermissionSettingsPanel documentId={documentId} />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <section className="border-b border-gray-100 px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">邀请协作者</h3>
                {collaboratorCount > 0 && (
                  <span className="text-xs text-gray-400">
                    {collaboratorCount} 人
                  </span>
                )}
              </div>
              <DocumentMemberSharePanel
                documentId={documentId}
                variant="compact"
                onCollaboratorsChange={setCollaboratorCount}
              />
            </section>

            <section className="px-5 py-4">
              <h3 className="mb-3 text-sm font-medium text-gray-900">链接分享</h3>

              {!allowExternalShare && (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  已关闭对外分享，请在「权限设置」中开启。
                </div>
              )}

              {externalShareManageOnly && userAccess !== "manage" && (
                <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  仅管理员可开启链接分享。
                </div>
              )}

              <div className="flex items-start gap-3 rounded-xl border border-gray-200 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  {linkShareEnabled ? (
                    <Link2 className="h-4 w-4" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {canManageLink ? (
                      linkShareEnabled ? (
                        <ShareLinkPermissionSelect
                          value={linkPermission}
                          onChange={(next) => void updateLinkPermission(next)}
                          compact
                        />
                      ) : (
                        <select
                          value="off"
                          disabled={creating}
                          onChange={(e) => {
                            if (e.target.value === "on") void enableLinkShare();
                          }}
                          className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-gray-800"
                        >
                          <option value="off">未开启</option>
                          <option value="on">开启链接分享</option>
                        </select>
                      )
                    ) : (
                      <span className="text-sm text-gray-600">未开启</span>
                    )}

                    {linkShareEnabled && canManageLink && (
                      <button
                        type="button"
                        disabled={creating}
                        onClick={() => void disableLinkShare()}
                        className="text-xs text-gray-400 hover:text-red-500"
                      >
                        关闭
                      </button>
                    )}

                    {linkShareEnabled && (
                      <ShareLinkPermissionBadge permission={linkPermission} />
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    {linkShareEnabled
                      ? `持有链接的用户可${SHARE_LINK_PERMISSION_LABELS[linkPermission]}`
                      : "仅协作者可访问"}
                  </p>
                </div>
              </div>

              {createError && (
                <p className="mt-3 text-sm text-red-600">{createError}</p>
              )}
            </section>

            <div className="border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                disabled={!canManageLink || creating || loading}
                onClick={() => void copyLink()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : copied ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "已复制链接" : "复制链接"}
              </button>
              <p className="mt-2 text-center text-[11px] text-gray-400">
                {linkShareEnabled
                  ? "开启链接分享后，组织外用户也可通过链接访问"
                  : "复制链接将自动开启链接分享（可阅读）"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
