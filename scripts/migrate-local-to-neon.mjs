#!/usr/bin/env node
/**
 * 将本地 SQLite (prisma/dev.db) 的文档、文件夹、历史记录等迁移到 Neon 生产库。
 *
 * 用法：
 *   DATABASE_URL="postgresql://..." node scripts/migrate-local-to-neon.mjs
 */

import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SQLITE = path.join(root, "prisma/dev.db");
const MAX_BUFFER = 256 * 1024 * 1024;

if (!process.env.DATABASE_URL?.startsWith("postgres")) {
  console.error("请设置 DATABASE_URL 为 Neon PostgreSQL 连接串");
  process.exit(1);
}

const prisma = new PrismaClient();

function sqlJson(query) {
  const out = execFileSync("sqlite3", ["-json", SQLITE, query], {
    maxBuffer: MAX_BUFFER,
    encoding: "utf8",
  });
  return JSON.parse(out || "[]");
}

function sqlScalar(query) {
  const tmp = path.join(
    os.tmpdir(),
    `workstudio-migrate-${process.pid}-${Date.now()}.txt`
  );
  try {
    execSync(
      `sqlite3 ${JSON.stringify(SQLITE)} ${JSON.stringify(query)} > ${JSON.stringify(tmp)}`,
      { stdio: "ignore", maxBuffer: MAX_BUFFER }
    );
    return fs.readFileSync(tmp, "utf8").trim();
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // ignore
    }
  }
}

function toDate(value) {
  if (value == null) return new Date();
  if (typeof value === "number") return new Date(value);
  const n = Number(value);
  if (!Number.isNaN(n) && n > 1e12) return new Date(n);
  return new Date(value);
}

function parseJsonField(value) {
  if (value == null || value === "") return null;
  if (typeof value === "object") return value;
  return JSON.parse(value);
}

async function migrateUsers() {
  const localUsers = sqlJson("SELECT * FROM User WHERE active=1");
  const prodUsers = await prisma.user.findMany();
  const prodByUsername = new Map(prodUsers.map((u) => [u.username, u]));
  const idMap = new Map();

  for (const lu of localUsers) {
    const existing = prodByUsername.get(lu.username);
    if (existing) {
      idMap.set(lu.id, existing.id);
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: lu.name,
          role: lu.role,
          color: lu.color,
          active: true,
        },
      });
      console.log(`✓ 用户 @${lu.username} → 已有账号 (${existing.id})`);
    } else {
      const created = await prisma.user.create({
        data: {
          username: lu.username,
          name: lu.name,
          passwordHash: lu.passwordHash,
          role: lu.role,
          color: lu.color,
          active: true,
        },
      });
      idMap.set(lu.id, created.id);
      console.log(`✓ 用户 @${lu.username} → 新建 (${created.id})`);
    }
  }

  return idMap;
}

async function migrateFolders() {
  const folders = sqlJson("SELECT * FROM Folder");
  for (const f of folders) {
    await prisma.folder.upsert({
      where: { id: f.id },
      update: {
        name: f.name,
        icon: f.icon,
        parentId: f.parentId,
      },
      create: {
        id: f.id,
        name: f.name,
        icon: f.icon,
        parentId: f.parentId,
        createdAt: toDate(f.createdAt),
      },
    });
    console.log(`✓ 文件夹 ${f.name}`);
  }
}

async function migrateDocuments() {
  const docs = sqlJson(
    "SELECT id, title, contentType, folderId, icon, createdBy, createdAt, updatedAt, permissionSettings FROM Document"
  );

  for (const d of docs) {
    const contentRaw = sqlScalar(
      `SELECT content FROM Document WHERE id=${JSON.stringify(d.id)}`
    );
    const content = parseJsonField(contentRaw);
    const permissionSettings = parseJsonField(d.permissionSettings);

    await prisma.document.upsert({
      where: { id: d.id },
      update: {
        title: d.title,
        content,
        contentType: d.contentType,
        folderId: d.folderId,
        icon: d.icon,
        createdBy: d.createdBy,
        permissionSettings,
        updatedAt: toDate(d.updatedAt),
      },
      create: {
        id: d.id,
        title: d.title,
        content,
        contentType: d.contentType,
        folderId: d.folderId,
        icon: d.icon,
        createdBy: d.createdBy,
        permissionSettings,
        createdAt: toDate(d.createdAt),
        updatedAt: toDate(d.updatedAt),
      },
    });
    console.log(`✓ 文档 ${d.title} (${d.contentType})`);
  }
}

async function migrateCollaborators(userIdMap) {
  const rows = sqlJson("SELECT * FROM DocumentCollaborator");
  for (const row of rows) {
    const userId = userIdMap.get(row.userId) ?? row.userId;
    await prisma.documentCollaborator.upsert({
      where: {
        documentId_userId: {
          documentId: row.documentId,
          userId,
        },
      },
      update: {
        permission: row.permission,
        addedById: userIdMap.get(row.addedById) ?? row.addedById,
      },
      create: {
        documentId: row.documentId,
        userId,
        permission: row.permission,
        addedById: userIdMap.get(row.addedById) ?? row.addedById,
        createdAt: toDate(row.createdAt),
      },
    });
    console.log(`✓ 协作者 document=${row.documentId} user=${userId}`);
  }
}

async function migrateShareLinks() {
  const rows = sqlJson("SELECT * FROM ShareLink");
  for (const row of rows) {
    await prisma.shareLink.upsert({
      where: { id: row.id },
      update: {
        token: row.token,
        documentId: row.documentId,
        permission: row.permission,
        encrypted: !!row.encrypted,
        expiresAt: row.expiresAt ? toDate(row.expiresAt) : null,
      },
      create: {
        id: row.id,
        token: row.token,
        documentId: row.documentId,
        permission: row.permission,
        encrypted: !!row.encrypted,
        createdAt: toDate(row.createdAt),
        expiresAt: row.expiresAt ? toDate(row.expiresAt) : null,
      },
    });
    console.log(`✓ 分享链接 ${row.token}`);
  }
}

async function migrateRevisions(userIdMap) {
  const rows = sqlJson(
    "SELECT id, documentId, title, changeType, changeSummary, changeCount, userId, userName, createdAt FROM DocumentRevision ORDER BY createdAt ASC"
  );

  let count = 0;
  for (const row of rows) {
    const contentRaw = sqlScalar(
      `SELECT content FROM DocumentRevision WHERE id=${JSON.stringify(row.id)}`
    );
    const content = parseJsonField(contentRaw);

    await prisma.documentRevision.upsert({
      where: { id: row.id },
      update: {
        documentId: row.documentId,
        title: row.title,
        content,
        changeType: row.changeType,
        changeSummary: row.changeSummary,
        changeCount: row.changeCount,
        userId: userIdMap.get(row.userId) ?? row.userId,
        userName: row.userName,
      },
      create: {
        id: row.id,
        documentId: row.documentId,
        title: row.title,
        content,
        changeType: row.changeType,
        changeSummary: row.changeSummary,
        changeCount: row.changeCount,
        userId: userIdMap.get(row.userId) ?? row.userId,
        userName: row.userName,
        createdAt: toDate(row.createdAt),
      },
    });
    count++;
  }
  console.log(`✓ 历史版本 ${count} 条`);
}

async function main() {
  console.log("从本地 SQLite 迁移到 Neon...\n");

  const userIdMap = await migrateUsers();
  console.log("");
  await migrateFolders();
  console.log("");
  await migrateDocuments();
  console.log("");
  await migrateCollaborators(userIdMap);
  console.log("");
  await migrateShareLinks();
  console.log("");
  await migrateRevisions(userIdMap);

  console.log("\n迁移完成。");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
