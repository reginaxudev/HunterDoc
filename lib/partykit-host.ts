/** 解析 Partykit WebSocket 连接地址 */
export function resolvePartyKitHost(): string {
  if (process.env.NEXT_PUBLIC_PARTYKIT_HOST) {
    return process.env.NEXT_PUBLIC_PARTYKIT_HOST;
  }
  if (typeof window !== "undefined") {
    return `${window.location.hostname}:1999`;
  }
  return "localhost:1999";
}

export function resolvePartyKitProtocol(host: string): "ws" | "wss" {
  if (
    host.includes("localhost") ||
    host.startsWith("127.") ||
    /:\d+$/.test(host)
  ) {
    return "ws";
  }
  return "wss";
}

export function buildPartyKitUrl(host: string): string {
  return `${resolvePartyKitProtocol(host)}://${host}`;
}
