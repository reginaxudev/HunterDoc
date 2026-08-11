"use client";

import { useRouter } from "next/navigation";
import { AtSign, FileText, Calendar, Users, X, MessageSquare, LocateFixed } from "lucide-react";
import type { Editor } from "@tiptap/react";
import type { ExtractedMention } from "@/lib/mentions";
import { formatMentionDate } from "@/lib/mentions";
import { scrollToMentionInEditor } from "@/lib/mention-utils";

interface MentionSidebarProps {
  mentions: ExtractedMention[];
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  currentUserName: string;
  editor?: Editor | null;
}

export default function MentionSidebar({
  mentions,
  open,
  onClose,
  currentUserId,
  currentUserName,
  editor,
}: MentionSidebarProps) {
  const router = useRouter();

  if (!open) return null;

  const persons = mentions.filter((m) => m.mentionType === "person" || m.mentionType === "group");
  const documents = mentions.filter((m) => m.mentionType === "document");
  const dates = mentions.filter((m) => m.mentionType === "date");

  const mentionsMe = persons.some(
    (m) =>
      m.id === currentUserId ||
      m.id === "@all" ||
      m.label === currentUserName ||
      m.label === "所有人"
  );

  const handleScroll = (label: string) => {
    if (editor) scrollToMentionInEditor(editor, label);
  };

  const handleReply = () => {
    if (!editor) return;
    editor.chain().focus().insertContent(`@${currentUserName} `).run();
  };

  return (
    <aside className="flex w-60 shrink-0 flex-col border-l border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
          <AtSign className="h-3.5 w-3.5" />
          提及汇总 ({mentions.length})
        </div>
        <button onClick={onClose} className="rounded p-0.5 text-gray-400 hover:bg-gray-200">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {mentionsMe && (
        <div className="mx-2 mt-2 space-y-1.5">
          <div className="rounded-md bg-blue-50 px-2.5 py-2 text-xs text-blue-700">
            本文档中有 @你的提及
          </div>
          {editor && (
            <button
              onClick={handleReply}
              className="flex w-full items-center justify-center gap-1 rounded-md bg-blue-600 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              <MessageSquare className="h-3 w-3" />
              快速回复
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {mentions.length === 0 ? (
          <p className="px-2 py-4 text-xs text-gray-400">
            输入 @ 提及成员、群组、文档或日期
          </p>
        ) : (
          <>
            {persons.length > 0 && (
              <MentionGroup icon={<Users className="h-3 w-3" />} title={`成员/群组 (${persons.length})`}>
                {persons.map((m, i) => (
                  <div
                    key={`${m.id}-${i}`}
                    className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs hover:bg-white"
                  >
                    <button
                      onClick={() => handleScroll(m.label)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: m.color ?? "#2563eb" }}
                      >
                        {m.mentionType === "group" ? "👥" : m.label.slice(0, 1)}
                      </span>
                      <span className="truncate font-medium text-gray-700">
                        @{m.label}
                      </span>
                    </button>
                    {editor && (
                      <button
                        onClick={() => handleScroll(m.label)}
                        className="shrink-0 rounded p-0.5 text-gray-300 hover:text-blue-500"
                        title="定位"
                      >
                        <LocateFixed className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </MentionGroup>
            )}

            {documents.length > 0 && (
              <MentionGroup icon={<FileText className="h-3 w-3" />} title={`文档 (${documents.length})`}>
                {documents.map((m, i) => (
                  <button
                    key={`${m.id}-${i}`}
                    onClick={() => m.href && router.push(m.href)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-white"
                  >
                    <span>📄</span>
                    <span className="truncate text-indigo-700">{m.label}</span>
                  </button>
                ))}
              </MentionGroup>
            )}

            {dates.length > 0 && (
              <MentionGroup icon={<Calendar className="h-3 w-3" />} title={`日期 (${dates.length})`}>
                {dates.map((m, i) => (
                  <button
                    key={`${m.id}-${i}`}
                    onClick={() => handleScroll(m.label)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-amber-800 hover:bg-white"
                  >
                    <span>📅</span>
                    <span>
                      {m.dateValue ? formatMentionDate(m.dateValue) : m.label}
                    </span>
                  </button>
                ))}
              </MentionGroup>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function MentionGroup({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}
