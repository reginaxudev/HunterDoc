"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import YPartyKitProvider from "y-partykit/provider";
import { buildPartyKitUrl, resolvePartyKitHost } from "@/lib/partykit-host";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Minus,
  Highlighter,
  Sparkles,
  FileUp,
  Paperclip,
  Loader2,
  ListTree,
  AtSign,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/AuthProvider";
import { authUserToCollabUser } from "@/lib/user";
import PresenceAvatars from "@/components/PresenceAvatars";
import AISummaryPanel from "@/components/AISummaryPanel";
import ImportFeishuDialog from "@/components/ImportFeishuDialog";
import FileUploadButton, { useFileDropZone } from "@/components/FileUploadButton";
import { FeishuPaste } from "@/lib/tiptap/feishu-paste";
import { FileAttachment } from "@/lib/tiptap/file-attachment";
import { createMentionExtension } from "@/lib/tiptap/mention-extension";
import { SlashCommand } from "@/lib/tiptap/slash-command";
import {
  setOnlineUsersGetter,
  setDocumentsGetter,
  extractMentionsFromJson,
  isMentionForUser,
} from "@/lib/mentions";
import { addMentionNotification } from "@/lib/mention-inbox";
import {
  blockBulkCopyInteraction,
  clearClipboardEvent,
  countTextCopyItems,
  setBulkCopyGuardRuntime,
} from "@/lib/bulk-copy-guard";
import DocOutlinePanel, { DocStats } from "@/components/DocOutlinePanel";
import MentionSidebar from "@/components/MentionSidebar";
import TeamMemberDialog from "@/components/TeamMemberDialog";
import { useWorkspaceOptional } from "@/components/WorkspaceProvider";
import type { CollabPresenceUser } from "@/types/document";

function ToolbarButton({
  onClick,
  active,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-blue-100 text-blue-700"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        disabled && "cursor-not-allowed opacity-40"
      )}
    >
      {children}
    </button>
  );
}

interface CollaborativeEditorProps {
  documentId: string;
  title: string;
  initialContent: Record<string, unknown>;
  editable?: boolean;
  /** 分享链接 token（匿名访客协作） */
  shareToken?: string;
  onTitleChange?: (title: string) => void;
  onSaveStatusChange?: (status: "saved" | "saving" | "idle") => void;
  showShare?: boolean;
  onShareClick?: () => void;
}

export default function CollaborativeEditor({
  documentId,
  title,
  initialContent,
  editable = true,
  shareToken,
  onSaveStatusChange,
  showShare,
  onShareClick,
}: CollaborativeEditorProps) {
  const [synced, setSynced] = useState(false);
  const [collabError, setCollabError] = useState<string | null>(null);
  const [presenceUsers, setPresenceUsers] = useState<CollabPresenceUser[]>([]);
  const [showAI, setShowAI] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const [mentionToast, setMentionToast] = useState<string | null>(null);
  const prevMentionsRef = useRef<Set<string>>(new Set());
  const lastAwarenessMentionRef = useRef<number>(0);
  const processedEventsRef = useRef<Set<number>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.role === "ADMIN";
  const user = useMemo(
    () => (authUser ? authUserToCollabUser(authUser) : { id: "guest", name: "访客", color: "#2563eb" }),
    [authUser]
  );
  const mentionExtension = useMemo(() => createMentionExtension(), []);
  const workspace = useWorkspaceOptional();

  const ydoc = useMemo(() => new Y.Doc(), []);
  const provider = useMemo(() => {
    const host = resolvePartyKitHost();
    return new YPartyKitProvider(buildPartyKitUrl(host), `doc-${documentId}`, ydoc, {
      connect: false,
      params: async () => {
        if (shareToken) {
          const res = await fetch("/api/share/collab-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: shareToken }),
          });
          if (!res.ok) {
            throw new Error("分享协作鉴权失败");
          }
          const data = (await res.json()) as { token: string };
          return { token: data.token };
        }

        const res = await fetch(`/api/documents/${documentId}/collab-token`, {
          credentials: "same-origin",
        });
        if (!res.ok) {
          throw new Error("协作鉴权失败");
        }
        const data = (await res.json()) as { token: string };
        return { token: data.token };
      },
    });
  }, [documentId, ydoc, shareToken]);

  useEffect(() => {
    setCollabError(null);
    provider.on("synced", () => setSynced(true));
    provider.connect();

    provider.on("connection-error", () => {
      setCollabError("协作连接被拒绝，请重新登录后再试");
    });

    provider.awareness.setLocalStateField("user", {
      id: user.id,
      name: user.name,
      color: user.color,
    });

    const updatePresence = () => {
      const states = provider.awareness.getStates();
      const users: CollabPresenceUser[] = [];
      states.forEach((state) => {
        const u = state.user as CollabPresenceUser | undefined;
        if (u?.id) users.push(u);
      });
      setPresenceUsers(users);

      // 监听协作者的 @ 提及广播
      states.forEach((state, clientId) => {
        if (clientId === provider.awareness.clientID) return;
        const event = state.mentionEvent as {
          fromUserId: string;
          fromUserName: string;
          mentions: { id: string; label: string; mentionType: string }[];
          at: number;
        } | undefined;
        if (!event || processedEventsRef.current.has(event.at)) return;
        processedEventsRef.current.add(event.at);

        for (const m of event.mentions) {
          const extracted = {
            id: m.id,
            label: m.label,
            mentionType: m.mentionType as "person" | "group" | "document" | "date",
          };
          if (isMentionForUser(extracted, user.id, user.name)) {
            setMentionToast(`${event.fromUserName} @提及 了你`);
            setTimeout(() => setMentionToast(null), 5000);
            addMentionNotification(user.id, {
              documentId,
              documentTitle: title,
              documentHref: `/doc/${documentId}`,
              fromUserId: event.fromUserId,
              fromUserName: event.fromUserName,
              mentionLabel: m.label,
              mentionType: m.mentionType,
            });
            break;
          }
        }
      });
    };

    provider.awareness.on("change", updatePresence);
    updatePresence();

    setOnlineUsersGetter(() => {
      const states = provider.awareness.getStates();
      const users: CollabPresenceUser[] = [];
      states.forEach((state) => {
        const u = state.user as CollabPresenceUser | undefined;
        if (u?.id) users.push(u);
      });
      return users;
    });

    return () => {
      provider.awareness.off("change", updatePresence);
      provider.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc, user]);

  useEffect(() => {
    setDocumentsGetter(
      () => workspace?.documents ?? [],
      documentId
    );
  }, [workspace?.documents, documentId]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Underline,
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({
        placeholder: editable
          ? "输入 / 唤起快捷命令，@ 提及团队成员..."
          : "只读模式",
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: false, allowBase64: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      FileAttachment,
      FeishuPaste,
      mentionExtension,
      SlashCommand,
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({
        provider,
        user: { name: user.name, color: user.color },
      }),
    ],
    editable,
    editorProps: {
      attributes: {
        class:
          "prose prose-gray max-w-none min-h-[calc(100vh-200px)] px-16 py-8 focus:outline-none",
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (!editable) return;

      // @提及通知检测（本地新增）
      const json = ed.getJSON() as Record<string, unknown>;
      const mentions = extractMentionsFromJson(json);
      const currentKeys = new Set(mentions.map((m) => `${m.id}:${m.label}`));
      const newMentions = mentions.filter(
        (m) => !prevMentionsRef.current.has(`${m.id}:${m.label}`)
      );

      if (newMentions.length > 0) {
        const now = Date.now();
        if (now - lastAwarenessMentionRef.current > 500) {
          lastAwarenessMentionRef.current = now;
          provider.awareness.setLocalStateField("mentionEvent", {
            fromUserId: user.id,
            fromUserName: user.name,
            mentions: newMentions.map((m) => ({
              id: m.id,
              label: m.label,
              mentionType: m.mentionType,
            })),
            at: now,
          });
        }

        for (const m of newMentions) {
          const extracted = {
            id: m.id,
            label: m.label,
            mentionType: m.mentionType,
          };
          if (isMentionForUser(extracted, user.id, user.name)) {
            addMentionNotification(user.id, {
              documentId,
              documentTitle: title,
              documentHref: `/doc/${documentId}`,
              fromUserId: user.id,
              fromUserName: user.name,
              mentionLabel: m.label,
              mentionType: m.mentionType,
            });
          }
        }
      }

      prevMentionsRef.current = currentKeys;

      onSaveStatusChange?.("saving");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          const state = Y.encodeStateAsUpdate(ydoc);
          const b64 = btoa(String.fromCharCode(...state));
          const json = editor?.getJSON() as Record<string, unknown> | undefined;
          await fetch(`/api/documents/${documentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              yjsState: b64,
              ...(json ? { content: json } : {}),
            }),
          });
          onSaveStatusChange?.("saved");
        } catch {
          onSaveStatusChange?.("idle");
        }
      }, 2000);
    },
  }, [documentId, ydoc, provider, user, editable, mentionExtension]);

  useEffect(() => {
    if (!editor) return;

    const getSelectedText = (): string => {
      const { from, to } = editor.state.selection;
      if (from === to) return "";
      return editor.state.doc.textBetween(from, to, "\n");
    };

    const getDocItemCount = (): number => countTextCopyItems(getSelectedText());

    setBulkCopyGuardRuntime({
      source: "doc",
      isAdmin,
      documentId,
      documentTitle: title,
      documentHref: `/doc/${documentId}`,
      getLiveItemCount: getDocItemCount,
    });

    const tryBlockDocClipboard = (e: ClipboardEvent): boolean => {
      if (isAdmin) return false;
      const fromSelection = getSelectedText();
      const fromClipboard = e.clipboardData?.getData("text/plain") ?? "";
      const text = fromSelection || fromClipboard;
      const itemCount = countTextCopyItems(text);
      return blockBulkCopyInteraction(isAdmin, itemCount, {
        documentId,
        documentTitle: title,
        documentHref: `/doc/${documentId}`,
        source: "doc",
      });
    };

    const handleClipboard = (e: ClipboardEvent) => {
      if (tryBlockDocClipboard(e)) {
        clearClipboardEvent(e);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAdmin) return;
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (e.key.toLowerCase() !== "c" && e.key.toLowerCase() !== "x") return;

      const itemCount = getDocItemCount();
      if (blockBulkCopyInteraction(isAdmin, itemCount, {
        documentId,
        documentTitle: title,
        documentHref: `/doc/${documentId}`,
        source: "doc",
      })) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    document.addEventListener("copy", handleClipboard, true);
    document.addEventListener("cut", handleClipboard, true);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      setBulkCopyGuardRuntime(null);
      document.removeEventListener("copy", handleClipboard, true);
      document.removeEventListener("cut", handleClipboard, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [editor, isAdmin, documentId, title]);

  useEffect(() => {
    if (!editor || !synced) return;
    const fragment = ydoc.getXmlFragment("default");
    if (fragment.length === 0 && initialContent) {
      editor.commands.setContent(initialContent);
    }
  }, [editor, synced, initialContent, ydoc]);

  const getEditorJson = useCallback(() => {
    return editor?.getJSON() as Record<string, unknown> | undefined;
  }, [editor]);

  const handleFeishuImport = useCallback(
    (html: string, mode: "insert" | "replace") => {
      if (!editor) return;
      if (mode === "replace") {
        editor.commands.setContent(html);
      } else {
        editor.commands.insertContent(html);
      }
    },
    [editor]
  );

  const { dragOver, uploading: fileUploading, handlers: dropHandlers } =
    useFileDropZone(editor, editable);

  const [mentionsList, setMentionsList] = useState<ReturnType<typeof extractMentionsFromJson>>([]);
  useEffect(() => {
    if (!editor) return;
    const update = () =>
      setMentionsList(extractMentionsFromJson(editor.getJSON() as Record<string, unknown>));
    update();
    editor.on("update", update);
    return () => { editor.off("update", update); };
  }, [editor]);

  if (collabError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm text-red-600">{collabError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          刷新重试
        </button>
      </div>
    );
  }

  if (!editor) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
        正在连接协作服务...
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-white px-4 py-2">
        {editable && (
          <>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive("bold")}
              title="加粗"
            >
              <Bold className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive("italic")}
              title="斜体"
            >
              <Italic className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              active={editor.isActive("underline")}
              title="下划线"
            >
              <UnderlineIcon className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              active={editor.isActive("strike")}
              title="删除线"
            >
              <Strikethrough className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              active={editor.isActive("highlight")}
              title="高亮"
            >
              <Highlighter className="h-4 w-4" />
            </ToolbarButton>

            <div className="mx-1 h-5 w-px bg-gray-200" />

            <ToolbarButton
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              }
              active={editor.isActive("heading", { level: 1 })}
              title="标题 1"
            >
              <Heading1 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
              active={editor.isActive("heading", { level: 2 })}
              title="标题 2"
            >
              <Heading2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 3 }).run()
              }
              active={editor.isActive("heading", { level: 3 })}
              title="标题 3"
            >
              <Heading3 className="h-4 w-4" />
            </ToolbarButton>

            <div className="mx-1 h-5 w-px bg-gray-200" />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              active={editor.isActive("bulletList")}
              title="无序列表"
            >
              <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              active={editor.isActive("orderedList")}
              title="有序列表"
            >
              <ListOrdered className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              active={editor.isActive("taskList")}
              title="待办列表"
            >
              <ListChecks className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              active={editor.isActive("blockquote")}
              title="引用"
            >
              <Quote className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title="分割线"
            >
              <Minus className="h-4 w-4" />
            </ToolbarButton>

            <div className="mx-1 h-5 w-px bg-gray-200" />

            <button
              type="button"
              onClick={() => {
                editor.chain().focus().insertContent("@").run();
                setShowMentions(true);
              }}
              title="提及 (@) — 成员/群组/文档/日期"
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                showMentions
                  ? "bg-blue-100 text-blue-800"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              <AtSign className="h-3.5 w-3.5" />
              @提及
              {mentionsList.length > 0 && (
                <span className="rounded-full bg-blue-600 px-1.5 text-[10px] text-white">
                  {mentionsList.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowImport(true)}
              title="从飞书文档导入"
              className="flex items-center gap-1.5 rounded-md bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100"
            >
              <FileUp className="h-3.5 w-3.5" />
              飞书导入
            </button>

            <FileUploadButton editor={editor} />

            <button
              type="button"
              onClick={() => setShowAI(true)}
              title="AI 生成摘要"
              className="flex items-center gap-1.5 rounded-md bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100"
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI 摘要
            </button>

            <button
              type="button"
              onClick={() => setShowTeamDialog(true)}
              title="管理团队成员"
              className="flex items-center gap-1.5 rounded-md bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              <UserPlus className="h-3.5 w-3.5" />
              成员
            </button>

            <button
              type="button"
              onClick={() => setShowOutline(!showOutline)}
              title="文档大纲"
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                showOutline
                  ? "bg-gray-200 text-gray-800"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              <ListTree className="h-3.5 w-3.5" />
              大纲
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-3">
          <DocStats editor={editor} />
          <PresenceAvatars users={presenceUsers} />
          {showShare && onShareClick && (
            <button
              type="button"
              onClick={onShareClick}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              分享
            </button>
          )}
          {!synced && (
            <span className="text-xs text-amber-500">同步中...</span>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        <div
          className="flex-1 overflow-y-auto relative"
          {...dropHandlers}
        >
          {dragOver && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-blue-600/10 backdrop-blur-sm">
              <div className="rounded-2xl border-2 border-dashed border-blue-400 bg-white px-12 py-8 text-center shadow-lg">
                <Paperclip className="mx-auto mb-3 h-8 w-8 text-blue-500" />
                <p className="text-lg font-medium text-gray-900">释放以上传文件</p>
                <p className="mt-1 text-sm text-gray-500">
                  支持 PNG · PDF · Excel (.xlsx/.xls/.csv)
                </p>
              </div>
            </div>
          )}
          {fileUploading && (
            <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-gray-600 shadow-md">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              上传中...
            </div>
          )}
          {mentionToast && (
            <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 animate-bounce rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
              {mentionToast}
            </div>
          )}
          <EditorContent editor={editor} />
        </div>
        {showAI && (
          <AISummaryPanel
            documentId={documentId}
            title={title}
            getContent={getEditorJson}
            onClose={() => setShowAI(false)}
          />
        )}
        <DocOutlinePanel
          editor={editor}
          open={showOutline}
          onClose={() => setShowOutline(false)}
        />
        <MentionSidebar
          mentions={mentionsList}
          open={showMentions}
          onClose={() => setShowMentions(false)}
          currentUserId={user.id}
          currentUserName={user.name}
          editor={editor}
        />
      </div>

      <TeamMemberDialog
        open={showTeamDialog}
        onClose={() => setShowTeamDialog(false)}
      />

      <ImportFeishuDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleFeishuImport}
      />
    </div>
  );
}
