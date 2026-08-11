#!/usr/bin/env bash
# 在香港/新加坡 VPS 上一键安装 Docker 并部署 HunterDoc
# 用法：curl -fsSL ... | bash   或   bash scripts/server-bootstrap.sh

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/reginaxudev/HunterDoc.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/HunterDoc}"

echo "==> HunterDoc 服务器初始化"
echo "    安装目录: $INSTALL_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "==> 安装 Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose 插件未找到，请升级 Docker 到 20.10+"
  exit 1
fi

if [ ! -d "$INSTALL_DIR/.git" ]; then
  echo "==> 克隆仓库..."
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone "$REPO_URL" "$INSTALL_DIR"
else
  echo "==> 更新仓库..."
  git -C "$INSTALL_DIR" pull --ff-only origin main
fi

cd "$INSTALL_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "==> 安装 Node.js 22..."
  if command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  else
    echo "请手动安装 Node.js 22+ 后重试"
    exit 1
  fi
fi

if [ ! -f .env.production ]; then
  echo "==> 生成 .env.production（交互式）..."
  node scripts/init-production-env.mjs
else
  echo "==> 已存在 .env.production，跳过"
fi

echo "==> 生成 Caddy 配置..."
node scripts/generate-caddyfile.mjs

echo "==> 拉取并启动容器..."
if grep -q "@postgres:5432" .env.production 2>/dev/null; then
  docker compose -f docker-compose.prod.yml --profile with-db up -d --build
else
  docker compose -f docker-compose.prod.yml up -d --build
fi

echo ""
echo "=========================================="
echo "  部署完成"
echo "=========================================="
echo "查看状态:  cd $INSTALL_DIR && docker compose -f docker-compose.prod.yml ps"
echo "查看日志:  docker compose -f docker-compose.prod.yml logs -f"
echo ""
echo "若尚未 seed 账号："
echo "  cd $INSTALL_DIR && DATABASE_URL=\"你的连接串\" npm run deploy:seed"
echo ""
echo "GitHub 自动部署：在仓库配置 SSH_DEPLOY_ENABLED=true 与 DEPLOY_* Secrets"
echo "  DEPLOY_PATH=$INSTALL_DIR"
