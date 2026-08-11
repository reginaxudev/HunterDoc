"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatMentionDate } from "@/lib/mentions";
import { getTeamMembers } from "@/lib/team-members";

export default function MentionBadgeView({ node }: NodeViewProps) {
  const router = useRouter();
  const [showTooltip, setShowTooltip] = useState(false);

  const mentionType = (node.attrs.mentionType as string) ?? "person";
  const label = node.attrs.label as string;
  const color = node.attrs.color as string | null;
  const href = node.attrs.href as string | null;
  const dateValue = node.attrs.dateValue as string | null;
  const id = node.attrs.id as string;

  const member =
    mentionType === "person"
      ? getTeamMembers().find((m) => m.id === id)
      : null;

  const handleClick = () => {
    if (mentionType === "document" && href) {
      router.push(href);
    }
  };

  const baseClass =
    "mention-badge inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-sm font-medium cursor-default select-none";

  if (mentionType === "group") {
    return (
      <NodeViewWrapper as="span" className="inline relative">
        <span
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className={`${baseClass} mention-group bg-violet-50 text-violet-800`}
        >
          <span className="text-xs">{node.attrs.icon ?? "👥"}</span>
          @{label}
        </span>
        {showTooltip && (
          <div className="absolute bottom-full left-0 z-50 mb-1 w-44 rounded-lg border border-gray-200 bg-white p-2.5 shadow-lg">
            <div className="text-sm font-semibold text-gray-800">{label}</div>
            <div className="text-xs text-gray-400">群组提及 · 通知组内所有成员</div>
          </div>
        )}
      </NodeViewWrapper>
    );
  }

  if (mentionType === "document") {
    return (
      <NodeViewWrapper as="span" className="inline">
        <span
          onClick={handleClick}
          className={`${baseClass} mention-doc cursor-pointer bg-indigo-50 text-indigo-700 hover:bg-indigo-100`}
        >
          <span className="text-xs">{node.attrs.icon ?? "📄"}</span>
          {label}
        </span>
      </NodeViewWrapper>
    );
  }

  if (mentionType === "date") {
    const display = dateValue ? formatMentionDate(dateValue) : label;
    return (
      <NodeViewWrapper as="span" className="inline">
        <span className={`${baseClass} mention-date bg-amber-50 text-amber-800`}>
          <span className="text-xs">📅</span>
          {display}
        </span>
      </NodeViewWrapper>
    );
  }

  const bgColor = color ? `${color}18` : undefined;
  const textColor = color ?? "#1d4ed8";

  return (
    <NodeViewWrapper as="span" className="inline relative">
      <span
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`${baseClass} mention-person`}
        style={{
          backgroundColor: bgColor ?? "#dbeafe",
          color: textColor,
        }}
      >
        <span
          className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ backgroundColor: color ?? "#2563eb" }}
        >
          {label.slice(0, 1)}
        </span>
        @{label}
      </span>

      {showTooltip && member && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-44 rounded-lg border border-gray-200 bg-white p-2.5 shadow-lg">
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: member.color }}
            >
              {member.name.slice(0, 1)}
            </span>
            <div>
              <div className="text-sm font-semibold text-gray-800">{member.name}</div>
              <div className="text-xs text-gray-400">{member.role}</div>
            </div>
          </div>
          {id === "@all" && (
            <p className="mt-1.5 text-[10px] text-gray-400">文档内所有成员将收到通知</p>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
}
