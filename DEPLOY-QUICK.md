# 一键部署速查

## 本地 / 首次配置（3 条命令）

```bash
# 1. 生成本地生产配置（域名、数据库、AUTH_SECRET）
npm run deploy:init-env

# 2. 配置 GitHub Actions（需 gh auth login）
bash scripts/setup-github-actions.sh

# 3. 推送代码 → 自动构建 Docker 镜像
git push origin main
```

## 香港 / 新加坡 VPS（服务器上一条命令）

DNS 先把域名 A 记录指到服务器 IP，然后：

```bash
curl -fsSL https://raw.githubusercontent.com/reginaxudev/HunterDoc/main/scripts/server-bootstrap.sh | sudo bash
```

或已克隆仓库时：

```bash
sudo bash scripts/server-bootstrap.sh
```

## 环境变量要点（`.env.production`）

| 变量 | 示例 |
|------|------|
| `APP_DOMAIN` | `doc.yourcompany.com` |
| `ACME_EMAIL` | 你的邮箱（Let's Encrypt） |
| `NEXT_PUBLIC_APP_URL` | `https://doc.yourcompany.com` |
| `DATABASE_URL` | Neon PostgreSQL 连接串 |
| `NEXT_PUBLIC_PARTYKIT_HOST` | `headhunter-docs-collab.reginaxudev-lgtm.partykit.dev` |

## 日常更新

- **自动**：push `main` → GitHub Actions 构建 → SSH 部署（需配置 Secrets）
- **手动**：`npm run deploy:docker:pull`

## 端口

| 端口 | 用途 |
|------|------|
| 80 / 443 | Caddy（对外） |
| 3000 | App（仅 Docker 内网） |

防火墙放行：`ufw allow 80,443/tcp`
