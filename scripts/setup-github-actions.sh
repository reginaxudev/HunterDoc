#!/usr/bin/env bash
# 配置 GitHub Actions 变量（需已安装并登录 gh CLI）
# 用法：bash scripts/setup-github-actions.sh

set -euo pipefail

REPO="${GITHUB_REPO:-reginaxudev/HunterDoc}"

if ! command -v gh >/dev/null 2>&1; then
  echo "请先安装 GitHub CLI: https://cli.github.com/"
  echo "然后执行: gh auth login"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "请先登录: gh auth login"
  exit 1
fi

read -r -p "公网域名（如 doc.example.com，可先留空）: " APP_DOMAIN
read -r -p "Partykit Host [headhunter-docs-collab.reginaxudev-lgtm.partykit.dev]: " PARTY_HOST
PARTY_HOST="${PARTY_HOST:-headhunter-docs-collab.reginaxudev-lgtm.partykit.dev}"

if [ -n "$APP_DOMAIN" ]; then
  APP_URL="https://${APP_DOMAIN#https://}"
  APP_URL="${APP_URL#http://}"
  APP_URL="https://$APP_URL"
else
  APP_URL="http://localhost:3000"
fi

echo "==> 设置 Repository Variables"
gh variable set NEXT_PUBLIC_APP_URL --body "$APP_URL" --repo "$REPO"
gh variable set NEXT_PUBLIC_PARTYKIT_HOST --body "$PARTY_HOST" --repo "$REPO"

read -r -p "是否启用 SSH 自动部署？(y/N): " ENABLE_SSH
if [ "${ENABLE_SSH,,}" = "y" ]; then
  gh variable set SSH_DEPLOY_ENABLED --body "true" --repo "$REPO"

  read -r -p "服务器 IP/域名 (DEPLOY_HOST): " DEPLOY_HOST
  read -r -p "SSH 用户名 (DEPLOY_USER) [root]: " DEPLOY_USER
  DEPLOY_USER="${DEPLOY_USER:-root}"
  read -r -p "服务器项目路径 (DEPLOY_PATH) [/opt/HunterDoc]: " DEPLOY_PATH
  DEPLOY_PATH="${DEPLOY_PATH:-/opt/HunterDoc}"
  read -r -p "SSH 私钥文件路径 (~/.ssh/id_ed25519): " KEY_PATH
  KEY_PATH="${KEY_PATH:-$HOME/.ssh/id_ed25519}"

  gh secret set DEPLOY_HOST --body "$DEPLOY_HOST" --repo "$REPO"
  gh secret set DEPLOY_USER --body "$DEPLOY_USER" --repo "$REPO"
  gh secret set DEPLOY_PATH --body "$DEPLOY_PATH" --repo "$REPO"
  gh secret set DEPLOY_SSH_KEY < "$KEY_PATH" --repo "$REPO"

  echo ""
  echo "可选：若 GHCR 镜像为私有，创建 PAT(read:packages) 并执行："
  echo "  gh secret set GHCR_TOKEN --body \"ghp_xxx\" --repo $REPO"
fi

echo ""
echo "==> 完成。push 到 main 后将自动构建 Docker 镜像。"
echo "    Actions: https://github.com/$REPO/actions"
echo ""
echo "首次 push："
echo "  git push origin main"
