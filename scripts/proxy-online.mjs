#!/usr/bin/env node
/**
 * 本地入口：经 HTTP 代理反代线上 Vercel，缓解国内直连超时。
 * 用法：PROXY_PORT=3456 node scripts/proxy-online.mjs
 */
import http from "node:http";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const LISTEN_PORT = Number(process.env.PROXY_PORT || 3456);
const UPSTREAM = (process.env.UPSTREAM_ORIGIN || "https://workstudio-xi.vercel.app").replace(
  /\/*$/,
  ""
);
const PROXY =
  process.env.https_proxy ||
  process.env.HTTPS_PROXY ||
  "http://127.0.0.1:7890";
const agent = new ProxyAgent(PROXY);

const DROP_REQ = new Set([
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
  "accept-encoding", // 让 undici 自己处理，避免二次压缩错乱
]);

const DROP_RES = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  // undici 已自动解压，绝不能再把 gzip 头传给浏览器，否则 JS 解压失败 → 白屏
  "content-encoding",
  "content-length",
]);

const server = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);

    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (v == null || DROP_REQ.has(k.toLowerCase())) continue;
      headers[k] = Array.isArray(v) ? v.join(",") : v;
    }

    const upstreamUrl = new URL(UPSTREAM);
    headers.host = upstreamUrl.host;

    const upstreamRes = await undiciFetch(`${UPSTREAM}${req.url || "/"}`, {
      method: req.method || "GET",
      headers,
      body: ["GET", "HEAD"].includes(req.method || "GET") ? undefined : body,
      dispatcher: agent,
      redirect: "manual",
    });

    const outHeaders = {};
    upstreamRes.headers.forEach((value, key) => {
      if (DROP_RES.has(key.toLowerCase())) return;
      // 避免把跳转带回 vercel.app（国内打不开）
      if (key.toLowerCase() === "location") {
        try {
          const loc = new URL(value, UPSTREAM);
          if (loc.hostname.endsWith("vercel.app")) {
            outHeaders[key] = loc.pathname + loc.search + loc.hash;
            return;
          }
        } catch {
          // keep original
        }
      }
      outHeaders[key] = value;
    });

    const buf = Buffer.from(await upstreamRes.arrayBuffer());
    outHeaders["content-length"] = String(buf.length);
    res.writeHead(upstreamRes.status, outHeaders);
    res.end(buf);
  } catch (error) {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end(
      `入口代理失败: ${error instanceof Error ? error.message : String(error)}\n请确认本机代理 ${PROXY} 已开启，且 Terminal 窗口未关闭。\n`
    );
  }
});

server.listen(LISTEN_PORT, "0.0.0.0", () => {
  console.log(`[proxy-online] http://127.0.0.1:${LISTEN_PORT} -> ${UPSTREAM}`);
  console.log(`[proxy-online] via ${PROXY}`);
  console.log(`[proxy-online] 打开: http://127.0.0.1:${LISTEN_PORT}/login`);
});
