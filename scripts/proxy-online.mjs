#!/usr/bin/env node
/**
 * 本地入口：经 HTTP 代理反代线上 Vercel，缓解国内直连超时。
 * 用法：node scripts/proxy-online.mjs
 */
import http from "node:http";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const LISTEN_PORT = Number(process.env.PROXY_PORT || 3000);
const UPSTREAM = (process.env.UPSTREAM_ORIGIN || "https://workstudio-xi.vercel.app").replace(/\/$/, "");
const PROXY = process.env.https_proxy || process.env.HTTPS_PROXY || "http://127.0.0.1:7890";
const agent = new ProxyAgent(PROXY);

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

const server = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);

    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (v == null || HOP_BY_HOP.has(k.toLowerCase())) continue;
      headers[k] = v;
    }

    const upstreamRes = await undiciFetch(`${UPSTREAM}${req.url || "/"}`, {
      method: req.method || "GET",
      headers,
      body: ["GET", "HEAD"].includes(req.method || "GET") ? undefined : body,
      dispatcher: agent,
      redirect: "manual",
    });

    const outHeaders = {};
    upstreamRes.headers.forEach((value, key) => {
      if (HOP_BY_HOP.has(key.toLowerCase())) return;
      outHeaders[key] = value;
    });

    res.writeHead(upstreamRes.status, outHeaders);
    const buf = Buffer.from(await upstreamRes.arrayBuffer());
    res.end(buf);
  } catch (error) {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end(
      `入口代理失败: ${error instanceof Error ? error.message : String(error)}\n请确认本机代理 ${PROXY} 已开启。\n`
    );
  }
});

server.listen(LISTEN_PORT, "0.0.0.0", () => {
  console.log(`[proxy-online] http://127.0.0.1:${LISTEN_PORT} -> ${UPSTREAM}`);
  console.log(`[proxy-online] via ${PROXY}`);
});
