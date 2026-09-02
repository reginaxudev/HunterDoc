#!/usr/bin/env bash
# 在系统 Terminal 中常驻启动登录入口（避免被 Cursor 结束后杀掉）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PROXY_PORT:-3456}"

osascript <<APPLESCRIPT
tell application "Terminal"
  activate
  do script "export PATH=\"/Users/regina/.workbuddy/binaries/node/versions/22.22.2/bin:\\\$PATH\"; export PROXY_PORT=$PORT https_proxy=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890; cd \"$ROOT\"; lsof -ti :$PORT | xargs kill -9 2>/dev/null; echo \"登录入口启动中...\"; node scripts/proxy-online.mjs"
end tell
APPLESCRIPT

sleep 3
if curl --noproxy '*' -fsS --connect-timeout 8 "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
  echo "本地入口 OK: http://127.0.0.1:${PORT}/login"
  open "http://127.0.0.1:${PORT}/login" || true
else
  echo "启动失败：请确认 Clash 代理 7890 已开启，并查看弹出的 Terminal 窗口报错"
  exit 1
fi

echo ""
echo "若本机 127.0.0.1 仍打不开（系统代理拦截），再开公网隧道："
echo "  cd $ROOT && ./.tools/cloudflared tunnel --url http://127.0.0.1:${PORT}"
echo "然后打开终端里打印的 https://xxxx.trycloudflare.com/login"
