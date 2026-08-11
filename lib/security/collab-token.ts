import { SignJWT, jwtVerify } from "jose";

export const COLLAB_TOKEN_TTL_SEC = 15 * 60;

export type CollabAccess = "read" | "edit";

export interface CollabTokenPayload {
  documentId: string;
  userId: string;
  userName: string;
  color: string;
  access: CollabAccess;
}

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET must be set for collab tokens");
    }
    return new TextEncoder().encode("dev-auth-secret-change-me");
  }
  return new TextEncoder().encode(secret);
}

export function getDocumentIdFromCollabRoom(roomId: string): string | null {
  if (!roomId.startsWith("doc-")) return null;
  const id = roomId.slice(4);
  return id.length > 0 ? id : null;
}

export async function createCollabToken(
  payload: CollabTokenPayload
): Promise<string> {
  return new SignJWT({
    documentId: payload.documentId,
    userId: payload.userId,
    userName: payload.userName,
    color: payload.color,
    access: payload.access,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${COLLAB_TOKEN_TTL_SEC}s`)
    .sign(getSecret());
}

export async function verifyCollabToken(
  token: string
): Promise<CollabTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.documentId !== "string" ||
      typeof payload.userId !== "string" ||
      typeof payload.userName !== "string" ||
      typeof payload.color !== "string" ||
      (payload.access !== "read" && payload.access !== "edit")
    ) {
      return null;
    }
    return {
      documentId: payload.documentId,
      userId: payload.userId,
      userName: payload.userName,
      color: payload.color,
      access: payload.access,
    };
  } catch {
    return null;
  }
}

export function extractCollabTokenFromUrl(url: string): string | null {
  try {
    return new URL(url).searchParams.get("token");
  } catch {
    return null;
  }
}
