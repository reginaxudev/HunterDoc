"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Lock, Eye, ShieldOff } from "lucide-react";
import ContentRenderer from "@/components/ContentRenderer";
import ShareAccessGuard from "@/components/ShareAccessGuard";
import { useAutoSaveContent } from "@/components/WorkspaceItemHeader";
import { CONTENT_TYPE_META } from "@/lib/content-types";
import type { Document } from "@/types/document";
import {
  type ShareCapabilities,
  type ShareLinkPermission,
  SHARE_LINK_PERMISSION_LABELS,
  canEditViaShareLink,
} from "@/lib/document-permissions";

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;

  const [doc, setDoc] = useState<Document | null>(null);
  const [content, setContent] = useState<Record<string, unknown> | null>(null);
  const [permission, setPermission] = useState<ShareLinkPermission>("read");
  const [capabilities, setCapabilities] = useState<ShareCapabilities>({
    canCopy: true,
    canDuplicatePrintDownload: true,
    canComment: true,
    canManageCollaborators: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/share/token/${token}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.error ??
            (res.status === 403
              ? "此文档已关闭对外分享"
              : "分享链接无效或已过期")
        );
        setLoading(false);
        return;
      }
      const data = await res.json();
      setDoc(data.document);
      setContent(data.document.content);
      setPermission(data.permission);
      setCapabilities(data.capabilities ?? {
        canCopy: true,
        canDuplicatePrintDownload: true,
        canComment: true,
        canManageCollaborators: false,
      });
      setLoading(false);
    }
    load();
  }, [token]);

  const contentType = doc?.contentType ?? "doc";
  const canEdit = canEditViaShareLink(permission);
  const canAutoSave = canEdit && contentType !== "doc" && doc !== null;

  const { saveStatus } = useAutoSaveContent(
    doc?.id ?? "",
    doc?.title ?? "",
    canAutoSave ? content : null,
    { skipInitial: true }
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <Lock className="h-10 w-10 text-gray-300" />
        <p className="text-gray-500">{error ?? "无法访问该文档"}</p>
      </div>
    );
  }

  const meta = CONTENT_TYPE_META[doc.contentType ?? "doc"];

  return (
    <ShareAccessGuard capabilities={capabilities}>
      <div className="flex h-screen flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            猎
          </div>
          <span className="text-lg">{doc.icon}</span>
          <h1 className="flex-1 truncate text-base font-medium text-gray-900">
            {doc.title}
          </h1>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>
            {meta.label}
          </span>
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              permission === "manage"
                ? "bg-violet-50 text-violet-700"
                : canEdit
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-gray-100 text-gray-600"
            }`}
          >
            {canEdit ? (
              <>
                {SHARE_LINK_PERMISSION_LABELS[permission]}
                {canAutoSave && saveStatus === "saving" && (
                  <span className="text-emerald-500">· 保存中</span>
                )}
                {canAutoSave && saveStatus === "saved" && (
                  <span className="text-emerald-500">· 已保存</span>
                )}
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" />
                {SHARE_LINK_PERMISSION_LABELS[permission]}
              </>
            )}
          </div>
        </header>

        {(!capabilities.canCopy ||
          !capabilities.canDuplicatePrintDownload ||
          !capabilities.canComment) && (
          <div className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            <ShieldOff className="h-3.5 w-3.5 shrink-0" />
            {!capabilities.canCopy && <span>禁止复制</span>}
            {!capabilities.canDuplicatePrintDownload && (
              <span>禁止打印/下载</span>
            )}
            {!capabilities.canComment && <span>禁止评论</span>}
          </div>
        )}

        <ContentRenderer
          doc={{ ...doc, content: content ?? doc.content }}
          title={doc.title}
          editable={canEdit}
          shareToken={token}
          onContentChange={canAutoSave ? setContent : undefined}
        />
      </div>
    </ShareAccessGuard>
  );
}
