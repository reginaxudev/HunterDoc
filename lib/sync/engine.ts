import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runWithoutSyncHooks } from "@/lib/sync/context";
import { SYNC_OVERLAP_MS } from "@/lib/sync/config";
import { getRemotePrisma } from "@/lib/sync/remote-db";
import { readSyncState, writeSyncState } from "@/lib/sync/state";

type Db = PrismaClient;

export interface SyncRunResult {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  documents: number;
  folders: number;
  snapshots: number;
  collaborators: number;
  shareLinks: number;
  revisions: number;
  tombstones: number;
  error?: string;
}

type UserIdMap = Map<string, string>;

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function sinceDate(lastSyncAt: string | null): Date {
  if (!lastSyncAt) return new Date(0);
  return new Date(new Date(lastSyncAt).getTime() - SYNC_OVERLAP_MS);
}

function pickNewer<T extends { updatedAt: Date }>(local: T | null, remote: T | null): "local" | "remote" | null {
  if (local && !remote) return "local";
  if (remote && !local) return "remote";
  if (!local || !remote) return null;
  if (local.updatedAt.getTime() > remote.updatedAt.getTime()) return "local";
  if (remote.updatedAt.getTime() > local.updatedAt.getTime()) return "remote";
  return null;
}

async function buildUserIdMap(local: Db, remote: Db): Promise<{
  localToRemote: UserIdMap;
  remoteToLocal: UserIdMap;
}> {
  const [localUsers, remoteUsers] = await Promise.all([
    local.user.findMany({ select: { id: true, username: true } }),
    remote.user.findMany({ select: { id: true, username: true } }),
  ]);

  const remoteByUsername = new Map(remoteUsers.map((u) => [u.username, u.id]));
  const localByUsername = new Map(localUsers.map((u) => [u.username, u.id]));

  const localToRemote = new Map<string, string>();
  const remoteToLocal = new Map<string, string>();

  for (const user of localUsers) {
    const remoteId = remoteByUsername.get(user.username);
    if (remoteId) {
      localToRemote.set(user.id, remoteId);
      remoteToLocal.set(remoteId, user.id);
    }
  }

  for (const user of remoteUsers) {
    const localId = localByUsername.get(user.username);
    if (localId) {
      localToRemote.set(localId, user.id);
      remoteToLocal.set(user.id, localId);
    }
  }

  return { localToRemote, remoteToLocal };
}

function mapUserId(
  userId: string | null | undefined,
  map: UserIdMap
): string | null {
  if (!userId) return null;
  return map.get(userId) ?? null;
}

async function syncDocuments(
  local: Db,
  remote: Db,
  since: Date
): Promise<number> {
  const [localRows, remoteRows] = await Promise.all([
    local.document.findMany({ where: { updatedAt: { gt: since } } }),
    remote.document.findMany({ where: { updatedAt: { gt: since } } }),
  ]);

  const byId = new Map<string, { local?: (typeof localRows)[0]; remote?: (typeof remoteRows)[0] }>();
  for (const row of localRows) byId.set(row.id, { ...byId.get(row.id), local: row });
  for (const row of remoteRows) byId.set(row.id, { ...byId.get(row.id), remote: row });

  let count = 0;
  for (const [id, pair] of byId) {
    const winner = pickNewer(pair.local ?? null, pair.remote ?? null);
    if (!winner) continue;

    if (winner === "local" && pair.local) {
      const row = pair.local;
      await remote.document.upsert({
        where: { id },
        update: {
          title: row.title,
          content: asJson(row.content),
          contentType: row.contentType,
          folderId: row.folderId,
          icon: row.icon,
          createdBy: row.createdBy,
          permissionSettings: asJson(row.permissionSettings),
          updatedAt: row.updatedAt,
        },
        create: {
          id: row.id,
          title: row.title,
          content: asJson(row.content),
          contentType: row.contentType,
          folderId: row.folderId,
          icon: row.icon,
          createdBy: row.createdBy,
          permissionSettings: asJson(row.permissionSettings),
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        },
      });
      count++;
    } else if (winner === "remote" && pair.remote) {
      const row = pair.remote;
      await local.document.upsert({
        where: { id },
        update: {
          title: row.title,
          content: asJson(row.content),
          contentType: row.contentType,
          folderId: row.folderId,
          icon: row.icon,
          createdBy: row.createdBy,
          permissionSettings: asJson(row.permissionSettings),
          updatedAt: row.updatedAt,
        },
        create: {
          id: row.id,
          title: row.title,
          content: asJson(row.content),
          contentType: row.contentType,
          folderId: row.folderId,
          icon: row.icon,
          createdBy: row.createdBy,
          permissionSettings: asJson(row.permissionSettings),
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        },
      });
      count++;
    }
  }

  return count;
}

async function syncFolders(local: Db, remote: Db, since: Date): Promise<number> {
  const [localRows, remoteRows] = await Promise.all([
    local.folder.findMany({ where: { updatedAt: { gt: since } } }),
    remote.folder.findMany({ where: { updatedAt: { gt: since } } }),
  ]);

  const byId = new Map<string, { local?: (typeof localRows)[0]; remote?: (typeof remoteRows)[0] }>();
  for (const row of localRows) byId.set(row.id, { ...byId.get(row.id), local: row });
  for (const row of remoteRows) byId.set(row.id, { ...byId.get(row.id), remote: row });

  let count = 0;
  for (const [id, pair] of byId) {
    const winner = pickNewer(pair.local ?? null, pair.remote ?? null);
    if (!winner) continue;

    const source = winner === "local" ? pair.local : pair.remote;
    const target = winner === "local" ? remote : local;
    if (!source) continue;

    await target.folder.upsert({
      where: { id },
      update: {
        name: source.name,
        icon: source.icon,
        parentId: source.parentId,
        updatedAt: source.updatedAt,
      },
      create: {
        id: source.id,
        name: source.name,
        icon: source.icon,
        parentId: source.parentId,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
      },
    });
    count++;
  }

  return count;
}

async function syncSnapshots(local: Db, remote: Db, since: Date): Promise<number> {
  const [localRows, remoteRows] = await Promise.all([
    local.collabSnapshot.findMany({ where: { updatedAt: { gt: since } } }),
    remote.collabSnapshot.findMany({ where: { updatedAt: { gt: since } } }),
  ]);

  const byDocId = new Map<
    string,
    { local?: (typeof localRows)[0]; remote?: (typeof remoteRows)[0] }
  >();
  for (const row of localRows) {
    byDocId.set(row.documentId, { ...byDocId.get(row.documentId), local: row });
  }
  for (const row of remoteRows) {
    byDocId.set(row.documentId, { ...byDocId.get(row.documentId), remote: row });
  }

  let count = 0;
  for (const [, pair] of byDocId) {
    const winner = pickNewer(pair.local ?? null, pair.remote ?? null);
    if (!winner) continue;

    if (winner === "local" && pair.local) {
      await remote.collabSnapshot.upsert({
        where: { documentId: pair.local.documentId },
        update: {
          yjsState: pair.local.yjsState,
          updatedAt: pair.local.updatedAt,
        },
        create: {
          documentId: pair.local.documentId,
          yjsState: pair.local.yjsState,
          updatedAt: pair.local.updatedAt,
        },
      });
      count++;
    } else if (winner === "remote" && pair.remote) {
      await local.collabSnapshot.upsert({
        where: { documentId: pair.remote.documentId },
        update: {
          yjsState: pair.remote.yjsState,
          updatedAt: pair.remote.updatedAt,
        },
        create: {
          documentId: pair.remote.documentId,
          yjsState: pair.remote.yjsState,
          updatedAt: pair.remote.updatedAt,
        },
      });
      count++;
    }
  }

  return count;
}

async function syncCollaborators(
  local: Db,
  remote: Db,
  since: Date,
  localToRemote: UserIdMap,
  remoteToLocal: UserIdMap
): Promise<number> {
  const [localRows, remoteRows] = await Promise.all([
    local.documentCollaborator.findMany({ where: { createdAt: { gt: since } } }),
    remote.documentCollaborator.findMany({ where: { createdAt: { gt: since } } }),
  ]);

  let count = 0;

  for (const row of localRows) {
    const userId = mapUserId(row.userId, localToRemote);
    const addedById = mapUserId(row.addedById, localToRemote);
    if (!userId || !addedById) continue;

    await remote.documentCollaborator.upsert({
      where: {
        documentId_userId: { documentId: row.documentId, userId },
      },
      update: { permission: row.permission },
      create: {
        documentId: row.documentId,
        userId,
        permission: row.permission,
        addedById,
        createdAt: row.createdAt,
      },
    });
    count++;
  }

  for (const row of remoteRows) {
    const userId = mapUserId(row.userId, remoteToLocal);
    const addedById = mapUserId(row.addedById, remoteToLocal);
    if (!userId || !addedById) continue;

    await local.documentCollaborator.upsert({
      where: {
        documentId_userId: { documentId: row.documentId, userId },
      },
      update: { permission: row.permission },
      create: {
        documentId: row.documentId,
        userId,
        permission: row.permission,
        addedById,
        createdAt: row.createdAt,
      },
    });
    count++;
  }

  return count;
}

async function syncShareLinks(local: Db, remote: Db, since: Date): Promise<number> {
  const [localRows, remoteRows] = await Promise.all([
    local.shareLink.findMany({ where: { createdAt: { gt: since } } }),
    remote.shareLink.findMany({ where: { createdAt: { gt: since } } }),
  ]);

  let count = 0;

  for (const row of localRows) {
    await remote.shareLink.upsert({
      where: { id: row.id },
      update: {
        token: row.token,
        documentId: row.documentId,
        permission: row.permission,
        encrypted: row.encrypted,
        expiresAt: row.expiresAt,
      },
      create: {
        id: row.id,
        token: row.token,
        documentId: row.documentId,
        permission: row.permission,
        encrypted: row.encrypted,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
      },
    });
    count++;
  }

  for (const row of remoteRows) {
    await local.shareLink.upsert({
      where: { id: row.id },
      update: {
        token: row.token,
        documentId: row.documentId,
        permission: row.permission,
        encrypted: row.encrypted,
        expiresAt: row.expiresAt,
      },
      create: {
        id: row.id,
        token: row.token,
        documentId: row.documentId,
        permission: row.permission,
        encrypted: row.encrypted,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
      },
    });
    count++;
  }

  return count;
}

async function syncRevisions(
  local: Db,
  remote: Db,
  since: Date,
  localToRemote: UserIdMap,
  remoteToLocal: UserIdMap
): Promise<number> {
  const [localRows, remoteRows] = await Promise.all([
    local.documentRevision.findMany({ where: { createdAt: { gt: since } } }),
    remote.documentRevision.findMany({ where: { createdAt: { gt: since } } }),
  ]);

  let count = 0;

  for (const row of localRows) {
    const userId = mapUserId(row.userId, localToRemote) ?? row.userId;
    await remote.documentRevision.upsert({
      where: { id: row.id },
      update: {},
      create: {
        id: row.id,
        documentId: row.documentId,
        title: row.title,
        content: asJson(row.content),
        changeType: row.changeType,
        changeSummary: row.changeSummary,
        changeCount: row.changeCount,
        userId,
        userName: row.userName,
        createdAt: row.createdAt,
      },
    });
    count++;
  }

  for (const row of remoteRows) {
    const userId = mapUserId(row.userId, remoteToLocal) ?? row.userId;
    await local.documentRevision.upsert({
      where: { id: row.id },
      update: {},
      create: {
        id: row.id,
        documentId: row.documentId,
        title: row.title,
        content: asJson(row.content),
        changeType: row.changeType,
        changeSummary: row.changeSummary,
        changeCount: row.changeCount,
        userId,
        userName: row.userName,
        createdAt: row.createdAt,
      },
    });
    count++;
  }

  return count;
}

async function syncTombstones(local: Db, remote: Db, since: Date): Promise<number> {
  const [localRows, remoteRows] = await Promise.all([
    local.syncTombstone.findMany({ where: { deletedAt: { gt: since } } }),
    remote.syncTombstone.findMany({ where: { deletedAt: { gt: since } } }),
  ]);

  let count = 0;

  for (const row of localRows) {
    await remote.syncTombstone.upsert({
      where: {
        entityType_entityId: {
          entityType: row.entityType,
          entityId: row.entityId,
        },
      },
      update: { deletedAt: row.deletedAt },
      create: {
        entityType: row.entityType,
        entityId: row.entityId,
        deletedAt: row.deletedAt,
      },
    });

    if (row.entityType === "document") {
      await remote.document.deleteMany({ where: { id: row.entityId } });
    } else if (row.entityType === "folder") {
      await remote.folder.deleteMany({ where: { id: row.entityId } });
    }
    count++;
  }

  for (const row of remoteRows) {
    await local.syncTombstone.upsert({
      where: {
        entityType_entityId: {
          entityType: row.entityType,
          entityId: row.entityId,
        },
      },
      update: { deletedAt: row.deletedAt },
      create: {
        entityType: row.entityType,
        entityId: row.entityId,
        deletedAt: row.deletedAt,
      },
    });

    if (row.entityType === "document") {
      await local.document.deleteMany({ where: { id: row.entityId } });
    } else if (row.entityType === "folder") {
      await local.folder.deleteMany({ where: { id: row.entityId } });
    }
    count++;
  }

  return count;
}

export async function recordSyncTombstone(
  entityType: "document" | "folder",
  entityId: string
): Promise<void> {
  await prisma.syncTombstone.upsert({
    where: {
      entityType_entityId: { entityType, entityId },
    },
    update: { deletedAt: new Date() },
    create: { entityType, entityId },
  });
}

let syncInFlight: Promise<SyncRunResult> | null = null;

export async function runSyncCycle(): Promise<SyncRunResult> {
  if (syncInFlight) return syncInFlight;

  syncInFlight = runWithoutSyncHooks(async () => {
    const startedAt = new Date();
    const state = readSyncState();
    const since = sinceDate(state.lastSyncAt);
    const local = prisma;
    const remote = getRemotePrisma();

    try {
      const { localToRemote, remoteToLocal } = await buildUserIdMap(local, remote);

      const [documents, folders, snapshots, collaborators, shareLinks, revisions, tombstones] =
        await Promise.all([
          syncDocuments(local, remote, since),
          syncFolders(local, remote, since),
          syncSnapshots(local, remote, since),
          syncCollaborators(local, remote, since, localToRemote, remoteToLocal),
          syncShareLinks(local, remote, since),
          syncRevisions(local, remote, since, localToRemote, remoteToLocal),
          syncTombstones(local, remote, since),
        ]);

      const finishedAt = new Date();
      writeSyncState({ lastSyncAt: finishedAt.toISOString() });

      return {
        ok: true,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        documents,
        folders,
        snapshots,
        collaborators,
        shareLinks,
        revisions,
        tombstones,
      };
    } catch (error) {
      const finishedAt = new Date();
      return {
        ok: false,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        documents: 0,
        folders: 0,
        snapshots: 0,
        collaborators: 0,
        shareLinks: 0,
        revisions: 0,
        tombstones: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }).finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}
