import type { DocumentPermissionSettings } from "@/lib/document-permissions";
import type { ShareLinkPermission } from "@/lib/document-permissions";

export type ContentType = "doc" | "sheet" | "mindmap" | "bitable";

export interface Document {
  id: string;
  title: string;
  content: Record<string, unknown>;
  contentType: ContentType;
  folderId: string | null;
  icon: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  permissionSettings?: DocumentPermissionSettings;
}

export interface Folder {
  id: string;
  name: string;
  icon: string;
  parentId: string | null;
  createdAt: string;
}

export interface Workspace {
  folders: Folder[];
  documents: Document[];
}

export interface ShareLink {
  id: string;
  token: string;
  documentId: string;
  permission: ShareLinkPermission;
  encrypted?: boolean;
  createdAt: string;
  expiresAt: string | null;
}

export type TemplateCategory =
  | "candidate"
  | "client"
  | "internal"
  | "interview";

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string;
  content: Record<string, unknown>;
}

export interface CollabPresenceUser {
  id: string;
  name: string;
  color: string;
}

export interface UploadedFile {
  url: string;
  fileName: string;
  fileType: "image" | "pdf" | "spreadsheet";
  mimeType: string;
  size: number;
}
