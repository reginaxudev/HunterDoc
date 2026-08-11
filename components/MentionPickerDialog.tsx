"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import MentionList from "@/components/MentionList";
import {
  getMentionCandidates,
  setDocumentsGetter,
  type MentionItem,
  type MentionTab,
} from "@/lib/mentions";
import { refreshTeamMembersCache } from "@/lib/team-members";
import { useWorkspaceOptional } from "@/components/WorkspaceProvider";
import { handleMentionPick, type StoredMention } from "@/lib/content-mentions";
import { useAuth } from "@/components/AuthProvider";
import { authUserToCollabUser } from "@/lib/user";

interface MentionPickerDialogProps {
  documentId: string;
  documentTitle: string;
  documentHref: string;
  mentions: StoredMention[];
  context?: string;
  onMentionsChange: (next: StoredMention[]) => void;
  onPick?: (item: MentionItem) => string | void;
  onClose: () => void;
}

export default function MentionPickerDialog({
  documentId,
  documentTitle,
  documentHref,
  mentions,
  context,
  onMentionsChange,
  onPick,
  onClose,
}: MentionPickerDialogProps) {
  const workspace = useWorkspaceOptional();
  const { user: authUser } = useAuth();
  const actor = authUser ? authUserToCollabUser(authUser) : { id: "", name: "", color: "" };
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<MentionTab>("all");
  const [membersReady, setMembersReady] = useState(false);

  useEffect(() => {
    setDocumentsGetter(() => workspace?.documents ?? [], documentId);
  }, [workspace?.documents, documentId]);

  useEffect(() => {
    let cancelled = false;
    refreshTeamMembersCache().finally(() => {
      if (!cancelled) setMembersReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = membersReady ? getMentionCandidates(query, tab) : [];

  const handlePick = (item: MentionItem) => {
    const pickedContext = onPick?.(item);
    handleMentionPick(
      item,
      { documentId, documentTitle, documentHref, context: pickedContext ?? context },
      mentions,
      onMentionsChange,
      actor
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/30 pt-24">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span className="text-sm font-medium text-gray-800">@ 提及</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-gray-100 px-3 py-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索成员、文档、日期..."
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-300"
          />
        </div>
        <MentionList
          items={items}
          query={query}
          activeTab={tab}
          onTabChange={setTab}
          command={handlePick}
        />
      </div>
    </div>
  );
}
