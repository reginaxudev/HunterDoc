/** 分享链接权限：可管理 > 可编辑 > 可阅读 */
export type ShareLinkPermission = "manage" | "edit" | "read";

export const SHARE_LINK_PERMISSION_LABELS: Record<ShareLinkPermission, string> = {
  manage: "可管理",
  edit: "可编辑",
  read: "可阅读",
};

export const SHARE_LINK_PERMISSION_OPTIONS: ShareLinkPermission[] = [
  "manage",
  "edit",
  "read",
];

/** 权限等级：可管理 > 可编辑 > 可评论 > 可阅读 */
export type PermissionLevel = "manage" | "edit" | "comment" | "read";

export type EffectiveAccess = PermissionLevel;

export interface DocumentPermissionSettings {
  /** 允许内容被分享到组织外（分享链接） */
  allowExternalShare: boolean;
  /** 仅「可管理」权限可将内容分享到组织外 */
  externalShareManageOnly: boolean;
  /** 新建分享链接时使用加密链接（更长 token） */
  enableEncryptedLink: boolean;
  /** 谁可以查看、添加、移除协作者 */
  collaboratorManageLevel: PermissionLevel;
  /** 仅组织内用户可管理协作者 */
  collaboratorManageOrgOnly: boolean;
  copyLevel: PermissionLevel;
  duplicatePrintDownloadLevel: PermissionLevel;
  commentLevel: PermissionLevel;
}

export interface ShareCapabilities {
  canCopy: boolean;
  canDuplicatePrintDownload: boolean;
  canComment: boolean;
  canManageCollaborators: boolean;
}

export const PERMISSION_LEVEL_LABELS: Record<PermissionLevel, string> = {
  manage: "可管理的用户",
  edit: "可编辑的用户",
  comment: "可评论的用户",
  read: "可阅读的用户",
};

export const DEFAULT_DOCUMENT_PERMISSION_SETTINGS: DocumentPermissionSettings = {
  allowExternalShare: true,
  externalShareManageOnly: false,
  enableEncryptedLink: false,
  collaboratorManageLevel: "edit",
  collaboratorManageOrgOnly: false,
  copyLevel: "read",
  duplicatePrintDownloadLevel: "edit",
  commentLevel: "read",
};

const LEVEL_RANK: Record<PermissionLevel, number> = {
  read: 0,
  comment: 1,
  edit: 2,
  manage: 3,
};

export function normalizePermissionSettings(
  raw: unknown
): DocumentPermissionSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_DOCUMENT_PERMISSION_SETTINGS };
  }
  const s = raw as Partial<DocumentPermissionSettings>;
  const level = (v: unknown, fallback: PermissionLevel): PermissionLevel =>
    v === "manage" || v === "edit" || v === "comment" || v === "read"
      ? v
      : fallback;

  return {
    allowExternalShare: s.allowExternalShare ?? true,
    externalShareManageOnly: s.externalShareManageOnly ?? false,
    enableEncryptedLink: s.enableEncryptedLink ?? false,
    collaboratorManageLevel: level(
      s.collaboratorManageLevel,
      DEFAULT_DOCUMENT_PERMISSION_SETTINGS.collaboratorManageLevel
    ),
    collaboratorManageOrgOnly: s.collaboratorManageOrgOnly ?? false,
    copyLevel: level(s.copyLevel, DEFAULT_DOCUMENT_PERMISSION_SETTINGS.copyLevel),
    duplicatePrintDownloadLevel: level(
      s.duplicatePrintDownloadLevel,
      DEFAULT_DOCUMENT_PERMISSION_SETTINGS.duplicatePrintDownloadLevel
    ),
    commentLevel: level(
      s.commentLevel,
      DEFAULT_DOCUMENT_PERMISSION_SETTINGS.commentLevel
    ),
  };
}

export function meetsPermissionLevel(
  access: EffectiveAccess,
  required: PermissionLevel
): boolean {
  return LEVEL_RANK[access] >= LEVEL_RANK[required];
}

export function shareLinkAccess(
  permission: ShareLinkPermission
): EffectiveAccess {
  if (permission === "manage") return "manage";
  if (permission === "edit") return "edit";
  return "read";
}

export function parseShareLinkPermission(value: unknown): ShareLinkPermission {
  if (value === "manage" || value === "edit" || value === "read") return value;
  return "read";
}

export function canEditViaShareLink(permission: ShareLinkPermission): boolean {
  return permission === "edit" || permission === "manage";
}

export function authUserAccess(role: "ADMIN" | "MEMBER"): EffectiveAccess {
  return role === "ADMIN" ? "manage" : "edit";
}

export function computeShareCapabilities(
  settings: DocumentPermissionSettings,
  linkPermission: ShareLinkPermission
): ShareCapabilities {
  const access = shareLinkAccess(linkPermission);
  return {
    canCopy: meetsPermissionLevel(access, settings.copyLevel),
    canDuplicatePrintDownload: meetsPermissionLevel(
      access,
      settings.duplicatePrintDownloadLevel
    ),
    canComment: meetsPermissionLevel(access, settings.commentLevel),
    canManageCollaborators: meetsPermissionLevel(
      access,
      settings.collaboratorManageLevel
    ),
  };
}
