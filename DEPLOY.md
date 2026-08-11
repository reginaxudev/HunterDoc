# 公网部署指南（Docker）

将「猎头云文档」部署到自有服务器（推荐香港/新加坡 VPS），支持 **GitHub push 自动构建镜像**。

## 架构

| 组件 | 服务 | 说明 |
|------|------|------|
| Next.js 应用 | **Docker** | 网页、API、登录（无 Vercel 4.5MB 请求体限制） |
| 数据库 | **PostgreSQL** | 可用 Neon 云库，或 Compose 自带 Postgres |
| 实时协作 | **Partykit** | 多人同时编辑 WebSocket |
| CI/CD | **GitHub Actions** | push `main` → 构建镜像 → 可选 SSH 自动部署 |

---

## 一、准备数据库

**方式 A：Neon（免运维）**

1. [neon.tech](https://neon.tech) 创建项目，区域选 Singapore / Tokyo
2. 复制 Connection string，写入 `.env.production` 的 `DATABASE_URL`

**方式 B：Docker 自带 PostgreSQL**

`.env.production` 中设置：

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=强密码
POSTGRES_DB=headhunter
DATABASE_URL=postgresql://postgres:强密码@postgres:5432/headhunter
```

启动时加 profile：`npm run deploy:docker:db`

---

## 二、部署 Partykit

```bash
npm run deploy:partykit
```

记下 host，填入 `.env.production`：

```env
NEXT_PUBLIC_PARTYKIT_HOST=headhunter-docs-collab.xxx.partykit.dev
```

---

## 三、服务器 Docker 部署

### 3.1 准备环境文件

```bash
git clone https://github.com/reginaxudev/HunterDoc.git
cd HunterDoc
cp .env.docker.example .env.production
```

编辑 `.env.production`（至少修改）：

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_APP_URL` | 公网访问地址，如 `https://doc.example.com` |
| `DATABASE_URL` | PostgreSQL 连接串 |
| `AUTH_SECRET` | `npm run deploy:secret` 生成 |
| `DEFAULT_PASSWORD` | 团队成员默认密码 |
| `NEXT_PUBLIC_PARTYKIT_HOST` | Partykit 地址 |

### 3.2 首次启动

```bash
# 外部数据库（Neon）
npm run deploy:docker

# 或自带 PostgreSQL
npm run deploy:docker:db
```

容器启动时会自动执行 `prisma db push` 同步表结构。

### 3.3 初始化团队成员账号

在能访问生产数据库的机器上执行：

```bash
DATABASE_URL="postgresql://..." npm run deploy:seed
```

### 3.4 访问

```
http://服务器IP:3000/login
```

生产环境建议在前面加 **Nginx / Caddy** 配置 HTTPS 与反向代理。

---

## 四、GitHub 自动部署

### 4.1 镜像构建（默认开启）

每次 push 到 `main`，GitHub Actions 会：

1. 构建 Docker 镜像
2. 推送到 `ghcr.io/reginaxudev/hunterdoc:latest`

在 GitHub 仓库 → **Packages** 可查看镜像。

### 4.2 构建时注入前端变量（Repository Variables）

Settings → Secrets and variables → Actions → **Variables**：

| Variable | 示例 |
|----------|------|
| `NEXT_PUBLIC_APP_URL` | `https://doc.example.com` |
| `NEXT_PUBLIC_PARTYKIT_HOST` | `headhunter-docs-collab.xxx.partykit.dev` |

修改后需重新 push 触发构建（这些变量在 build 阶段写入前端）。

### 4.3 服务器自动拉取部署（可选）

1. 服务器安装 Docker，克隆仓库，配置好 `.env.production`
2. `.env.production` 中设置：

```env
DOCKER_IMAGE=ghcr.io/reginaxudev/hunterdoc:latest
```

3. GitHub → Settings → Secrets and variables → Actions → **Secrets**：

| Secret | 说明 |
|--------|------|
| `DEPLOY_HOST` | 服务器 IP 或域名 |
| `DEPLOY_USER` | SSH 用户名 |
| `DEPLOY_SSH_KEY` | SSH 私钥 |
| `DEPLOY_PATH` | 服务器上项目路径，如 `/opt/HunterDoc` |

4. **Variables** 中添加：

```env
SSH_DEPLOY_ENABLED=true
```

之后每次 push `main`，Actions 会 SSH 到服务器执行：

```bash
docker compose -f docker-compose.prod.yml pull app
docker compose -f docker-compose.prod.yml up -d
```

### 4.4 手动更新（不用 SSH 自动部署时）

```bash
cd /opt/HunterDoc
git pull
npm run deploy:docker:pull
```

---

## 五、常用命令

```bash
npm run deploy              # 显示部署检查清单
npm run deploy:docker       # 构建并启动（外部数据库）
npm run deploy:docker:db    # 构建并启动（含 Postgres）
npm run deploy:docker:pull  # 拉取最新镜像并重启
npm run deploy:partykit     # 部署 Partykit
npm run deploy:seed         # 本地初始化数据库账号
npm run deploy:secret       # 生成 AUTH_SECRET

# 查看日志
docker compose -f docker-compose.prod.yml logs -f app

# 重启
docker compose -f docker-compose.prod.yml restart app
```

---

## 六、本地开发

```bash
docker compose up -d          # 本地 PostgreSQL
npm run db:push && npm run db:seed
npm run dev                   # 终端 1
npm run party                 # 终端 2
```

---

## 七、故障排查

| 问题 | 处理 |
|------|------|
| 容器启动失败 | `docker compose -f docker-compose.prod.yml logs app` 查看 DATABASE_URL 是否正确 |
| 登录后立即退出 | 检查 `AUTH_SECRET` 是否配置且重启容器 |
| 表格保存 413 | Docker 无 Vercel 4.5MB 限制，确认已切到 Docker 而非 vercel.app |
| 协作不同步 | 确认 `NEXT_PUBLIC_PARTYKIT_HOST` 正确，需重新构建镜像 |
| GHCR 拉取失败 | 私有镜像需 `docker login ghcr.io`，或使用公开 Package 权限 |

---

## 附录：Vercel 部署（旧方案）

仍可使用 `npx vercel deploy --prod`，但大表格可能遇 413 限制，已不推荐。

详见 git 历史中的 `vercel.json` 配置。

---

## 附录：国内访问

见 **[DEPLOY-CHINA.md](./DEPLOY-CHINA.md)**：香港 VPS + Docker 部署，或自定义域名。
