"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  SHARE_LINK_PERMISSION_LABELS,
  SHARE_LINK_PERMISSION_OPTIONS,
  type ShareLinkPermission,
} from "@/lib/document-permissions";

const PERMISSION_HINTS: Record<ShareLinkPermission, string> = {
  manage: "可编辑内容，管理分享链接与协作者",
  edit: "可查看并编辑内容",
  read: "仅可查看，不可编辑",
};

interface ShareLinkPermissionSelectProps {
  value: ShareLinkPermission;
  onChange: (value: ShareLinkPermission) => void;
  disabled?: boolean;
  compact?: boolean;
}

export default function ShareLinkPermissionSelect({
  value,
  onChange,
  disabled = false,
  compact = false,
}: ShareLinkPermissionSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 ${
          compact ? "px-2 py-1 text-xs" : "px-3 py-2"
        }`}
      >
        <span>{SHARE_LINK_PERMISSION_LABELS[value]}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[168px] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {SHARE_LINK_PERMISSION_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
            >
              <div>
                <div className="font-medium text-gray-800">
                  {SHARE_LINK_PERMISSION_LABELS[option]}
                </div>
                {!compact && (
                  <div className="text-xs text-gray-400">
                    {PERMISSION_HINTS[option]}
                  </div>
                )}
              </div>
              {value === option && (
                <Check className="h-4 w-4 shrink-0 text-blue-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ShareLinkPermissionBadge({
  permission,
}: {
  permission: ShareLinkPermission;
}) {
  const styles: Record<ShareLinkPermission, string> = {
    manage: "bg-violet-50 text-violet-700",
    edit: "bg-emerald-50 text-emerald-700",
    read: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${styles[permission]}`}
    >
      {SHARE_LINK_PERMISSION_LABELS[permission]}
    </span>
  );
}
