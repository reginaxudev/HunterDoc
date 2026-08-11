import { PrismaClient } from "@prisma/client";
import { isSyncEnabled } from "@/lib/sync/config";

let remoteClient: PrismaClient | null = null;

export function getRemotePrisma(): PrismaClient {
  if (!isSyncEnabled()) {
    throw new Error("SYNC_REMOTE_DATABASE_URL is not configured");
  }

  if (!remoteClient) {
    remoteClient = new PrismaClient({
      datasources: {
        db: { url: process.env.SYNC_REMOTE_DATABASE_URL },
      },
    });
  }

  return remoteClient;
}

export async function disconnectRemotePrisma(): Promise<void> {
  if (remoteClient) {
    await remoteClient.$disconnect();
    remoteClient = null;
  }
}
