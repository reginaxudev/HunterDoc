"use client";

import { useEffect, useState, useCallback } from "react";
import { AtSign } from "lucide-react";
import MentionSidebar from "@/components/MentionSidebar";
import MentionPickerDialog from "@/components/MentionPickerDialog";
import { setDocumentsGetter } from "@/lib/mentions";
import { refreshTeamMembersCache } from "@/lib/team-members";
import { useWorkspaceOptional } from "@/components/WorkspaceProvider";
import { useAuth } from "@/components/AuthProvider";
import { authUserToCollabUser } from "@/lib/user";
import type { StoredMention } from "@/lib/content-mentions";
import { toExtractedMentions } from "@/lib/content-mentions";

interface ContentMentionShellProps {
  documentId: string;
  documentTitle: string;
  documentHref: string;
  mentions: StoredMention[];
  onMentionsChange: (next: StoredMention[]) => void;
  editable?: boolean;
  onMentionPicked?: (item: import("@/lib/mentions").MentionItem) => string | void;
  showMentionButton?: boolean;
  mentionButtonLabel?: string;
  children: React.ReactNode;
}

export default function ContentMentionShell({
  documentId,
  documentTitle,
  documentHref,
  mentions,
  onMentionsChange,
  editable = true,
  onMentionPicked,
  showMentionButton = true,
  mentionButtonLabel = "提及",
  children,
}: ContentMentionShellProps) {
  const workspace = useWorkspaceOptional();
  const { user: authUser } = useAuth();
  const user = authUser ? authUserToCollabUser(authUser) : { id: "", name: "", color: "" };
  const [showSidebar, setShowSidebar] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    setDocumentsGetter(() => workspace?.documents ?? [], documentId);
  }, [workspace?.documents, documentId]);

  const extracted = toExtractedMentions(mentions);

  const openMentionPicker = useCallback(async () => {
    await refreshTeamMembersCache();
    setShowPicker(true);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        {editable && showMentionButton && (
          <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 py-1.5">
            <button
              type="button"
              onClick={() => void openMentionPicker()}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
              title="插入 @提及"
            >
              <AtSign className="h-3.5 w-3.5" />
              {mentionButtonLabel}
            </button>
            <button
              type="button"
              onClick={() => setShowSidebar(!showSidebar)}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                showSidebar
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              提及汇总
              {extracted.length > 0 && (
                <span className="rounded-full bg-blue-100 px-1.5 text-[10px] font-medium text-blue-700">
                  {extracted.length}
                </span>
              )}
            </button>
          </div>
        )}
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>

      <MentionSidebar
        mentions={extracted}
        open={showSidebar}
        onClose={() => setShowSidebar(false)}
        currentUserId={user.id}
        currentUserName={user.name}
      />

      {showPicker && (
        <MentionPickerDialog
          documentId={documentId}
          documentTitle={documentTitle}
          documentHref={documentHref}
          mentions={mentions}
          onClose={() => setShowPicker(false)}
          onMentionsChange={onMentionsChange}
          onPick={onMentionPicked}
        />
      )}
    </div>
  );
}
