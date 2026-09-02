import { nanoid } from "nanoid";
import type { SharePermission as PrismaSharePermission, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Document, Folder, ShareLink, Workspace, ContentType } from "@/types/document";
import {
  normalizePermissionSettings,
  type DocumentPermissionSettings,
  computeShareCapabilities,
  type ShareCapabilities,
  parseShareLinkPermission,
  type ShareLinkPermission,
} from "@/lib/document-permissions";
import type { DocumentRevisionRecord, HistoryChangeType } from "@/lib/document-history";
import {
  getDefaultContent,
  getDefaultTitle,
  CONTENT_TYPE_META,
} from "@/lib/content-types";
import { scheduleSyncPush } from "@/lib/sync/hooks";
import { recordSyncTombstone } from "@/lib/sync/engine";

const DEFAULT_FOLDERS = [
  { id: "folder-candidates", name: "候选人档案", icon: "👤" },
  { id: "folder-clients", name: "客户项目", icon: "🏢" },
  { id: "folder-internal", name: "团队内部", icon: "📋" },
];

/** 侧边栏/工作台列表只需元数据，不拉取 content（大表格 JSON 可达数 MB） */
const WORKSPACE_DOCUMENT_SELECT = {
  id: true,
  title: true,
  contentType: true,
  folderId: true,
  icon: true,
  createdBy: true,
  permissionSettings: true,
  createdAt: true,
  updatedAt: true,
} as const;

let defaultFoldersReady: Promise<void> | null = null;

async function ensureDefaultFolders() {
  if (!defaultFoldersReady) {
    defaultFoldersReady = (async () => {
      for (const folder of DEFAULT_FOLDERS) {
        await prisma.folder.upsert({
          where: { id: folder.id },
          update: {},
          create: {
            id: folder.id,
            name: folder.name,
            icon: folder.icon,
          },
        });
      }
    })();
  }
  await defaultFoldersReady;
}

function mapDocumentSummary(doc: {
  id: string;
  title: string;
  contentType: string;
  folderId: string | null;
  icon: string;
  createdBy: string;
  permissionSettings?: unknown;
  createdAt: Date;
  updatedAt: Date;
}): Document {
  return {
    id: doc.id,
    title: doc.title,
    content: {},
    contentType: (doc.contentType ?? "doc") as ContentType,
    folderId: doc.folderId,
    icon: doc.icon,
    createdBy: doc.createdBy,
    permissionSettings: normalizePermissionSettings(doc.permissionSettings),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function mapDocument(doc: {
  id: string;
  title: string;
  content: unknown;
  contentType: string;
  folderId: string | null;
  icon: string;
  createdBy: string;
  permissionSettings?: unknown;
  createdAt: Date;
  updatedAt: Date;
}): Document {
  return {
    id: doc.id,
    title: doc.title,
    content: doc.content as Record<string, unknown>,
    contentType: (doc.contentType ?? "doc") as ContentType,
    folderId: doc.folderId,
    icon: doc.icon,
    createdBy: doc.createdBy,
    permissionSettings: normalizePermissionSettings(doc.permissionSettings),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function mapFolder(folder: {
  id: string;
  name: string;
  icon: string;
  parentId: string | null;
  createdAt: Date;
}): Folder {
  return {
    id: folder.id,
    name: folder.name,
    icon: folder.icon,
    parentId: folder.parentId,
    createdAt: folder.createdAt.toISOString(),
  };
}

function mapShareLink(link: {
  id: string;
  token: string;
  documentId: string;
  permission: PrismaSharePermission;
  encrypted?: boolean;
  createdAt: Date;
  expiresAt: Date | null;
}): ShareLink {
  return {
    id: link.id,
    token: link.token,
    documentId: link.documentId,
    permission: link.permission.toLowerCase() as ShareLinkPermission,
    encrypted: link.encrypted ?? false,
    createdAt: link.createdAt.toISOString(),
    expiresAt: link.expiresAt?.toISOString() ?? null,
  };
}

export async function readWorkspace(): Promise<Workspace> {
  await ensureDefaultFolders();
  const [folders, documents] = await Promise.all([
    prisma.folder.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.document.findMany({
      select: WORKSPACE_DOCUMENT_SELECT,
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  return {
    folders: folders.map(mapFolder),
    documents: documents.map(mapDocumentSummary),
  };
}

export async function readWorkspaceForUser(
  _userId: string,
  _role: "ADMIN" | "MEMBER"
): Promise<Workspace> {
  // 团队共享工作区：所有登录成员看到同一套文档/文件夹，便于多账号实时同步
  return readWorkspace();
}

export async function createDocument(
  data: Partial<Document> & {
    title?: string;
    content?: Record<string, unknown>;
    contentType?: ContentType;
  }
): Promise<Document> {
  const contentType = data.contentType ?? "doc";
  const meta = CONTENT_TYPE_META[contentType];

  const doc = await prisma.document.create({
    data: {
      title: data.title ?? getDefaultTitle(contentType),
      content: (data.content ?? getDefaultContent(contentType)) as Prisma.InputJsonValue,
      contentType,
      folderId: data.folderId ?? null,
      icon: data.icon ?? meta.icon,
      createdBy: data.createdBy ?? "我",
    },
  });
  scheduleSyncPush();
  return mapDocument(doc);
}

export async function updateDocument(
  id: string,
  updates: Partial<Pick<Document, "title" | "content" | "folderId" | "icon" | "contentType">>
): Promise<Document | null> {
  try {
    const doc = await prisma.document.update({
      where: { id },
      data: {
        ...(updates.title !== undefined && { title: updates.title }),
        ...(updates.content !== undefined && {
          content: updates.content as Prisma.InputJsonValue,
        }),
        ...(updates.folderId !== undefined && { folderId: updates.folderId }),
        ...(updates.icon !== undefined && { icon: updates.icon }),
        ...(updates.contentType !== undefined && { contentType: updates.contentType }),
      },
    });
    scheduleSyncPush();
    return mapDocument(doc);
  } catch {
    return null;
  }
}

export async function deleteDocument(id: string): Promise<boolean> {
  try {
    await recordSyncTombstone("document", id);
    await prisma.document.delete({ where: { id } });
    scheduleSyncPush();
    return true;
  } catch {
    return false;
  }
}

export async function getDocument(id: string): Promise<Document | null> {
  const doc = await prisma.document.findUnique({ where: { id } });
  return doc ? mapDocument(doc) : null;
}

export async function createFolder(name: string, icon = "📁"): Promise<Folder> {
  const folder = await prisma.folder.create({
    data: { name, icon },
  });
  scheduleSyncPush();
  return mapFolder(folder);
}

export async function deleteFolder(id: string): Promise<boolean> {
  const defaultIds = DEFAULT_FOLDERS.map((f) => f.id);
  if (defaultIds.includes(id)) return false;

  await recordSyncTombstone("folder", id);
  await prisma.$transaction([
    prisma.document.updateMany({
      where: { folderId: id },
      data: { folderId: null },
    }),
    prisma.folder.delete({ where: { id } }),
  ]);
  scheduleSyncPush();
  return true;
}

export async function updateDocumentPermissions(
  id: string,
  settings: DocumentPermissionSettings
): Promise<Document | null> {
  try {
    const doc = await prisma.document.update({
      where: { id },
      data: {
        permissionSettings: settings as unknown as Prisma.InputJsonValue,
      },
    });
    scheduleSyncPush();
    return mapDocument(doc);
  } catch {
    return null;
  }
}

export async function getDocumentPermissions(
  id: string
): Promise<DocumentPermissionSettings | null> {
  const doc = await getDocument(id);
  if (!doc) return null;
  return doc.permissionSettings ?? normalizePermissionSettings(null);
}

export async function createShareLink(
  documentId: string,
  permission: ShareLinkPermission,
  options?: { encrypted?: boolean }
): Promise<ShareLink> {
  const encrypted = options?.encrypted ?? false;
  const link = await prisma.shareLink.create({
    data: {
      token: nanoid(encrypted ? 24 : 12),
      documentId,
      permission: permission.toUpperCase() as PrismaSharePermission,
      encrypted,
    },
  });
  scheduleSyncPush();
  return mapShareLink(link);
}

export async function getShareLinks(documentId: string): Promise<ShareLink[]> {
  const links = await prisma.shareLink.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
  });
  return links.map(mapShareLink);
}

export async function deleteShareLink(id: string): Promise<boolean> {
  try {
    await prisma.shareLink.delete({ where: { id } });
    scheduleSyncPush();
    return true;
  } catch {
    return false;
  }
}

export async function updateShareLinkPermission(
  id: string,
  permission: ShareLinkPermission
): Promise<ShareLink | null> {
  try {
    const link = await prisma.shareLink.update({
      where: { id },
      data: {
        permission: permission.toUpperCase() as PrismaSharePermission,
      },
    });
    scheduleSyncPush();
    return mapShareLink(link);
  } catch {
    return null;
  }
}

export async function getShareLinkById(id: string): Promise<ShareLink | null> {
  const link = await prisma.shareLink.findUnique({ where: { id } });
  return link ? mapShareLink(link) : null;
}

export async function getDocumentByShareToken(token: string): Promise<{
  document: Document;
  permission: ShareLinkPermission;
  capabilities: ShareCapabilities;
} | null> {
  const link = await prisma.shareLink.findUnique({
    where: { token },
    include: { document: true },
  });
  if (!link) return null;
  if (link.expiresAt && link.expiresAt < new Date()) return null;

  const settings = normalizePermissionSettings(link.document.permissionSettings);
  if (!settings.allowExternalShare) return null;

  const permission = parseShareLinkPermission(link.permission.toLowerCase());

  return {
    document: mapDocument(link.document),
    permission,
    capabilities: computeShareCapabilities(settings, permission),
  };
}

export async function saveCollabSnapshot(
  documentId: string,
  yjsState: Uint8Array
): Promise<void> {
  await prisma.collabSnapshot.upsert({
    where: { documentId },
    update: { yjsState: Buffer.from(yjsState) },
    create: { documentId, yjsState: Buffer.from(yjsState) },
  });
  scheduleSyncPush();
}

export async function getCollabSnapshot(
  documentId: string
): Promise<Uint8Array | null> {
  const snapshot = await prisma.collabSnapshot.findUnique({
    where: { documentId },
  });
  return snapshot ? new Uint8Array(snapshot.yjsState) : null;
}

export async function deleteCollabSnapshot(documentId: string): Promise<void> {
  await prisma.collabSnapshot.deleteMany({ where: { documentId } });
}

export async function createDocumentRevision(data: {
  documentId: string;
  title: string;
  content: Record<string, unknown>;
  changeType?: HistoryChangeType;
  changeSummary: string;
  changeCount?: number;
  userId: string;
  userName: string;
}): Promise<DocumentRevisionRecord> {
  const row = await prisma.documentRevision.create({
    data: {
      documentId: data.documentId,
      title: data.title,
      content: data.content as Prisma.InputJsonValue,
      changeType: data.changeType ?? "edit",
      changeSummary: data.changeSummary,
      changeCount: data.changeCount ?? 1,
      userId: data.userId,
      userName: data.userName,
    },
  });
  scheduleSyncPush();
  return {
    id: row.id,
    documentId: row.documentId,
    title: row.title,
    changeType: row.changeType as HistoryChangeType,
    changeSummary: row.changeSummary,
    changeCount: row.changeCount,
    userId: row.userId,
    userName: row.userName,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listDocumentRevisions(
  documentId: string,
  limit = 100
): Promise<DocumentRevisionRecord[]> {
  const rows = await prisma.documentRevision.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      documentId: true,
      title: true,
      changeType: true,
      changeSummary: true,
      changeCount: true,
      userId: true,
      userName: true,
      createdAt: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    documentId: row.documentId,
    title: row.title,
    changeType: row.changeType as HistoryChangeType,
    changeSummary: row.changeSummary,
    changeCount: row.changeCount,
    userId: row.userId,
    userName: row.userName,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getDocumentRevision(
  documentId: string,
  revisionId: string
): Promise<{
  id: string;
  documentId: string;
  title: string;
  content: Record<string, unknown>;
  changeType: string;
  changeSummary: string;
  changeCount: number;
  userId: string;
  userName: string;
  createdAt: string;
} | null> {
  const row = await prisma.documentRevision.findFirst({
    where: { id: revisionId, documentId },
  });
  if (!row) return null;
  return {
    id: row.id,
    documentId: row.documentId,
    title: row.title,
    content: row.content as Record<string, unknown>,
    changeType: row.changeType,
    changeSummary: row.changeSummary,
    changeCount: row.changeCount,
    userId: row.userId,
    userName: row.userName,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface AdminAlertRecord {
  id: string;
  alertType: string;
  documentId: string;
  documentTitle: string;
  documentHref: string;
  fromUserId: string;
  fromUserName: string;
  message: string;
  detail: string | null;
  read: boolean;
  createdAt: string;
}

export async function createAdminAlert(data: {
  alertType: string;
  documentId: string;
  documentTitle: string;
  documentHref: string;
  fromUserId: string;
  fromUserName: string;
  message: string;
  detail?: string;
}): Promise<AdminAlertRecord> {
  const row = await prisma.adminAlert.create({ data });
  return {
    id: row.id,
    alertType: row.alertType,
    documentId: row.documentId,
    documentTitle: row.documentTitle,
    documentHref: row.documentHref,
    fromUserId: row.fromUserId,
    fromUserName: row.fromUserName,
    message: row.message,
    detail: row.detail,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAdminAlerts(limit = 50): Promise<AdminAlertRecord[]> {
  const rows = await prisma.adminAlert.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((row) => ({
    id: row.id,
    alertType: row.alertType,
    documentId: row.documentId,
    documentTitle: row.documentTitle,
    documentHref: row.documentHref,
    fromUserId: row.fromUserId,
    fromUserName: row.fromUserName,
    message: row.message,
    detail: row.detail,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function markAdminAlertsRead(alertId?: string): Promise<void> {
  if (alertId) {
    await prisma.adminAlert.updateMany({
      where: { id: alertId, read: false },
      data: { read: true },
    });
    return;
  }
  await prisma.adminAlert.updateMany({
    where: { read: false },
    data: { read: true },
  });
}

export async function getUnreadAdminAlertCount(): Promise<number> {
  return prisma.adminAlert.count({ where: { read: false } });
}

export interface DocumentCollaboratorRecord {
  id: string;
  documentId: string;
  userId: string;
  permission: ShareLinkPermission;
  addedById: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    name: string;
    color: string;
    role: string;
  };
}

function mapCollaboratorPermission(
  permission: PrismaSharePermission
): ShareLinkPermission {
  return permission.toLowerCase() as ShareLinkPermission;
}

export async function listDocumentCollaborators(
  documentId: string
): Promise<DocumentCollaboratorRecord[]> {
  const rows = await prisma.documentCollaborator.findMany({
    where: { documentId },
    orderBy: { createdAt: "asc" },
  });
  if (rows.length === 0) return [];

  const userIds = [...new Set(rows.map((r) => r.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      username: true,
      name: true,
      color: true,
      role: true,
    },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return rows.flatMap((row) => {
    const user = userMap.get(row.userId);
    if (!user) return [];
    return [
      {
        id: row.id,
        documentId: row.documentId,
        userId: row.userId,
        permission: mapCollaboratorPermission(row.permission),
        addedById: row.addedById,
        createdAt: row.createdAt.toISOString(),
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          color: user.color,
          role: user.role,
        },
      },
    ];
  });
}

export async function upsertDocumentCollaborator(data: {
  documentId: string;
  userId: string;
  permission: ShareLinkPermission;
  addedById: string;
}): Promise<DocumentCollaboratorRecord | null> {
  const prismaPermission = data.permission.toUpperCase() as PrismaSharePermission;
  const row = await prisma.documentCollaborator.upsert({
    where: {
      documentId_userId: {
        documentId: data.documentId,
        userId: data.userId,
      },
    },
    update: { permission: prismaPermission },
    create: {
      documentId: data.documentId,
      userId: data.userId,
      permission: prismaPermission,
      addedById: data.addedById,
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: row.userId },
    select: {
      id: true,
      username: true,
      name: true,
      color: true,
      role: true,
    },
  });
  if (!user) return null;

  scheduleSyncPush();
  return {
    id: row.id,
    documentId: row.documentId,
    userId: row.userId,
    permission: mapCollaboratorPermission(row.permission),
    addedById: row.addedById,
    createdAt: row.createdAt.toISOString(),
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      color: user.color,
      role: user.role,
    },
  };
}

export async function removeDocumentCollaborator(
  documentId: string,
  userId: string
): Promise<boolean> {
  const result = await prisma.documentCollaborator.deleteMany({
    where: { documentId, userId },
  });
  if (result.count > 0) scheduleSyncPush();
  return result.count > 0;
}
