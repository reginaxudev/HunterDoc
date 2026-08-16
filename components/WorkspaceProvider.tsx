"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Document, Folder, Workspace, ContentType } from "@/types/document";
import type { DocumentTemplate } from "@/types/document";
import { getTemplateFolderId } from "@/lib/templates";
import { getContentPath } from "@/lib/content-types";

interface WorkspaceContextValue {
  folders: Folder[];
  documents: Document[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  refresh: () => Promise<void>;
  /** Optimistically update a document in sidebar / home lists */
  updateDocumentLocal: (
    id: string,
    patch: Partial<Pick<Document, "title" | "icon" | "updatedAt">>
  ) => void;
  createByType: (contentType: ContentType, data?: Partial<Document>) => Promise<Document>;
  createDoc: (data?: Partial<Document>) => Promise<Document>;
  createFromTemplate: (template: DocumentTemplate) => Promise<Document>;
  deleteDoc: (id: string) => Promise<void>;
  createNewFolder: () => Promise<void>;
  showTemplatePicker: boolean;
  setShowTemplatePicker: (v: boolean) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

export function useWorkspaceOptional() {
  return useContext(WorkspaceContext);
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname.startsWith("/login");
  const [workspace, setWorkspace] = useState<Workspace>({
    folders: [],
    documents: [],
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/workspace");
      // On 401 the body is {error}, not a Workspace. Storing it would strip
      // documents/folders and crash every consumer that reads .length.
      if (res.ok) {
        const data = (await res.json()) as Workspace;
        setWorkspace({
          folders: data.folders ?? [],
          documents: data.documents ?? [],
        });
      }
    } catch {
      // keep the last known state; the empty default is already safe
    } finally {
      setLoading(false);
    }
  }, []);

  const updateDocumentLocal = useCallback(
    (id: string, patch: Partial<Pick<Document, "title" | "icon" | "updatedAt">>) => {
      setWorkspace((prev) => ({
        ...prev,
        documents: prev.documents.map((doc) =>
          doc.id === id ? { ...doc, ...patch } : doc
        ),
      }));
    },
    []
  );

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh, isLoginPage]);

  useEffect(() => {
    if (isLoginPage) return;
    if (process.env.NEXT_PUBLIC_SYNC_ENABLED !== "true") return;

    const intervalMs = Number(process.env.NEXT_PUBLIC_SYNC_POLL_INTERVAL_MS ?? 5000);
    const pollMs = Number.isFinite(intervalMs) && intervalMs >= 2000 ? intervalMs : 5000;

    const timer = setInterval(() => {
      void refresh();
    }, pollMs);

    return () => clearInterval(timer);
  }, [refresh, isLoginPage]);

  const createByType = useCallback(
    async (contentType: ContentType, data?: Partial<Document>) => {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType,
          title: data?.title,
          content: data?.content,
          folderId: data?.folderId ?? null,
          icon: data?.icon,
        }),
      });
      const doc = (await res.json()) as Document;
      await refresh();
      router.push(getContentPath(doc.id, doc.contentType));
      return doc;
    },
    [refresh, router]
  );

  const createDoc = useCallback(
    async (data?: Partial<Document>) => createByType("doc", data),
    [createByType]
  );

  const createFromTemplate = useCallback(
    async (template: DocumentTemplate) => {
      const folderId = getTemplateFolderId(template.category);
      return createByType("doc", {
        title: template.name,
        content: template.content,
        folderId,
        icon: template.icon,
      });
    },
    [createByType]
  );

  const deleteDoc = useCallback(
    async (id: string) => {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      await refresh();
      router.push("/");
    },
    [refresh, router]
  );

  const createNewFolder = useCallback(async () => {
    const name = prompt("文件夹名称：");
    if (!name?.trim()) return;
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "folder", name: name.trim() }),
    });
    await refresh();
  }, [refresh]);

  return (
    <WorkspaceContext.Provider
      value={{
        folders: workspace.folders,
        documents: workspace.documents,
        loading,
        searchQuery,
        setSearchQuery,
        refresh,
        updateDocumentLocal,
        createByType,
        createDoc,
        createFromTemplate,
        deleteDoc,
        createNewFolder,
        showTemplatePicker,
        setShowTemplatePicker,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
