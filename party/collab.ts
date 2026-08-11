import type * as Party from "partykit/server";
import { onConnect } from "y-partykit";
import {
  verifyCollabToken,
  extractCollabTokenFromUrl,
  getDocumentIdFromCollabRoom,
} from "../lib/security/collab-token";

function unauthorized(message = "Unauthorized") {
  return new Response(message, { status: 401 });
}

export default {
  async onBeforeConnect(request: Party.Request) {
    const token = extractCollabTokenFromUrl(request.url);
    if (!token) {
      return unauthorized("Missing collab token");
    }

    const payload = await verifyCollabToken(token);
    if (!payload) {
      return unauthorized("Invalid or expired collab token");
    }

    const pathParts = new URL(request.url).pathname.split("/");
    const roomId = pathParts[pathParts.length - 1] ?? "";
    const documentId = getDocumentIdFromCollabRoom(roomId);

    if (!documentId || documentId !== payload.documentId) {
      return unauthorized("Token does not match room");
    }

    return request;
  },

  onConnect(conn: Party.Connection, room: Party.Room) {
    const token = extractCollabTokenFromUrl(conn.uri);
    if (!token) {
      conn.close(4401, "Missing collab token");
      return;
    }

    return verifyCollabToken(token).then((payload) => {
      if (!payload) {
        conn.close(4401, "Invalid collab token");
        return;
      }

      const documentId = getDocumentIdFromCollabRoom(room.id);
      if (!documentId || documentId !== payload.documentId) {
        conn.close(4403, "Forbidden");
        return;
      }

      return onConnect(conn, room, {
        persist: { mode: "snapshot" },
        readOnly: payload.access === "read",
      });
    });
  },
} satisfies Party.Server;
