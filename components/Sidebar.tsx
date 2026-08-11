"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  ChevronDown,
  ChevronRight,
  LayoutTemplate,
  Home,
  Trash2,
  FolderPlus,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { getContentPath, CONTENT_TYPE_META } from "@/lib/content-types";
import CreateMenu from "@/components/CreateMenu";
import MentionInboxPanel from "@/components/MentionInboxPanel";
import AdminAlertPanel from "@/components/AdminAlertPanel";
import { useAuth } from "@/components/AuthProvider";
import type { Document, Folder, ContentType } from "@/types/document";
import { LogOut, Shield } from "lucide-react";

interface SidebarProps {
  folders: Folder[];
  documents: Document[];
  onCreate: (type: ContentType) => void;
  onNewFromTemplate: () => void;
  onNewFolder: () => void;
  onDeleteDoc: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export default function Sidebar({
  folders,
  documents,
  onCreate,
  onNewFromTemplate,
  onNewFolder,
  onDeleteDoc,
  searchQuery,
  onSearchChange,
}: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(folders.map((f) => f.id))
  );
  const [hoveredDoc, setHoveredDoc] = useState<string | null>(null);

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredDocs = documents.filter(
    (d) =>
      !searchQuery ||
      d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const uncategorized = filteredDocs.filter((d) => !d.folderId);

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-[#f7f8fa]">
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
          猎
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-900">猎头云文档</div>
          <div className="text-xs text-gray-500">Headhunter Docs</div>
        </div>
      </div>

      <div className="px-3 py-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索文档..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>

      <div className="flex gap-1 px-3 pb-2">
        <CreateMenu onCreate={onCreate} onFromTemplate={onNewFromTemplate} />
        <button
          onClick={onNewFromTemplate}
          title="从模板创建"
          className="flex items-center justify-center rounded-md border border-gray-200 bg-white px-2 py-1.5 text-gray-600 hover:bg-gray-50"
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onNewFolder}
          title="新建文件夹"
          className="flex items-center justify-center rounded-md border border-gray-200 bg-white px-2 py-1.5 text-gray-600 hover:bg-gray-50"
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        <Link
          href="/"
          className={cn(
            "mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
            pathname === "/"
              ? "bg-blue-50 text-blue-700"
              : "text-gray-700 hover:bg-gray-100"
          )}
        >
          <Home className="h-4 w-4" />
          工作台
        </Link>

        {folders.map((folder) => {
          const folderDocs = filteredDocs.filter(
            (d) => d.folderId === folder.id
          );
          const isExpanded = expandedFolders.has(folder.id);

          return (
            <div key={folder.id} className="mt-1">
              <button
                onClick={() => toggleFolder(folder.id)}
                className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                )}
                <span className="text-base leading-none">{folder.icon}</span>
                <span className="flex-1 truncate text-left font-medium">
                  {folder.name}
                </span>
                <span className="text-xs text-gray-400">
                  {folderDocs.length}
                </span>
              </button>

              {isExpanded &&
                folderDocs.map((doc) => (
                  <DocItem
                    key={doc.id}
                    doc={doc}
                    pathname={pathname}
                    hoveredDoc={hoveredDoc}
                    setHoveredDoc={setHoveredDoc}
                    onDeleteDoc={onDeleteDoc}
                  />
                ))}
            </div>
          );
        })}

        {uncategorized.length > 0 && (
          <div className="mt-2">
            <div className="px-2 py-1 text-xs font-medium text-gray-400">
              未分类
            </div>
            {uncategorized.map((doc) => (
              <DocItem
                key={doc.id}
                doc={doc}
                pathname={pathname}
                hoveredDoc={hoveredDoc}
                setHoveredDoc={setHoveredDoc}
                onDeleteDoc={onDeleteDoc}
              />
            ))}
          </div>
        )}

        {filteredDocs.length === 0 && searchQuery && (
          <div className="px-2 py-4 text-center text-xs text-gray-400">
            未找到匹配的文档
          </div>
        )}
      </nav>

      <div className="border-t border-gray-200 p-3">
        {user && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-white px-2.5 py-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: user.color }}
            >
              {user.name.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-gray-800">
                {user.name}
              </div>
              <div className="truncate text-[10px] text-gray-400">
                @{user.username}
              </div>
            </div>
          </div>
        )}
        <div className="flex gap-1">
          {user?.role === "ADMIN" && (
            <Link
              href="/admin/users"
              className="flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-[11px] text-gray-600 hover:bg-gray-100"
            >
              <Shield className="h-3.5 w-3.5" />
              团队
            </Link>
          )}
          <button
            type="button"
            onClick={() => logout()}
            className="flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-[11px] text-gray-600 hover:bg-gray-100"
          >
            <LogOut className="h-3.5 w-3.5" />
            退出
          </button>
        </div>
      </div>

      <AdminAlertPanel />
      <MentionInboxPanel />
    </aside>
  );
}

function DocItem({
  doc,
  pathname,
  hoveredDoc,
  setHoveredDoc,
  onDeleteDoc,
}: {
  doc: Document;
  pathname: string;
  hoveredDoc: string | null;
  setHoveredDoc: (id: string | null) => void;
  onDeleteDoc: (id: string) => void;
}) {
  const href = getContentPath(doc.id, doc.contentType ?? "doc");
  const isActive = pathname === href;
  const typeLabel = CONTENT_TYPE_META[doc.contentType ?? "doc"]?.label;

  return (
    <div
      className="group relative"
      onMouseEnter={() => setHoveredDoc(doc.id)}
      onMouseLeave={() => setHoveredDoc(null)}
    >
      <Link
        href={href}
        className={cn(
          "flex items-center gap-2 rounded-md py-1.5 pl-7 pr-8 text-sm transition-colors",
          isActive
            ? "bg-blue-50 text-blue-700"
            : "text-gray-600 hover:bg-gray-100"
        )}
      >
        <span className="text-sm leading-none">{doc.icon}</span>
        <span className="flex-1 truncate">{doc.title}</span>
        <span className="text-[10px] text-gray-300">{typeLabel}</span>
      </Link>
      {hoveredDoc === doc.id && (
        <button
          onClick={(e) => {
            e.preventDefault();
            if (confirm(`确定删除「${doc.title}」？`)) {
              onDeleteDoc(doc.id);
            }
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function DocCard({
  doc,
  onDelete,
}: {
  doc: Document;
  onDelete: (id: string) => void;
}) {
  return (
    <Link
      href={getContentPath(doc.id, doc.contentType ?? "doc")}
      className="group flex flex-col rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-blue-200 hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between">
        <span className="text-2xl">{doc.icon}</span>
        <div className="flex items-center gap-1">
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
            {CONTENT_TYPE_META[doc.contentType ?? "doc"]?.label}
          </span>
          <button
            onClick={(e) => {
              e.preventDefault();
              if (confirm(`确定删除「${doc.title}」？`)) onDelete(doc.id);
            }}
            className="rounded p-1 text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <h3 className="mb-1 truncate font-medium text-gray-900">{doc.title}</h3>
      <p className="text-xs text-gray-400">
        {formatRelativeTime(doc.updatedAt)} · {doc.createdBy}
      </p>
    </Link>
  );
}

export function EmptyState({
  onCreate,
  onNewFromTemplate,
}: {
  onCreate: (type: ContentType) => void;
  onNewFromTemplate: () => void;
}) {
  const types: ContentType[] = ["doc", "sheet", "mindmap", "bitable"];

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-gray-900">开始创建工作区</h2>
        <p className="mt-1 text-sm text-gray-500">
          文档、表格、思维导图、多维表格 — 像飞书一样高效协作
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {types.map((type) => {
          const meta = CONTENT_TYPE_META[type];
          return (
            <button
              key={type}
              onClick={() => onCreate(type)}
              className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-blue-200 hover:shadow-md"
            >
              <span className="text-3xl">{meta.icon}</span>
              <span className="text-sm font-medium text-gray-900">{meta.label}</span>
            </button>
          );
        })}
      </div>
      <button
        onClick={onNewFromTemplate}
        className="text-sm text-blue-600 hover:text-blue-700"
      >
        或从猎头模板创建文档 →
      </button>
    </div>
  );
}
