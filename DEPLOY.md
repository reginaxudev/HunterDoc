# 公网部署指南

将「猎头云文档」部署到公网，供团队在外网登录使用。

## 架构

| 组件 | 服务 | 说明 |
|------|------|------|
| Next.js 应用 | **Vercel** | 网页、API、登录 |
| 数据库 | **Neon PostgreSQL** | 文档、用户、权限 |
| 实时协作 | **Partykit** | 多人同时编辑 WebSocket |

---

## 一、创建数据库（Neon，免费）

1. 打开 [neon.tech](https://neon.tech)，注册并登录
2. 点击 **New Project**，区域选 **Singapore** 或 **Tokyo**（离国内较近）
3. 进入项目 → **Connection Details** → 复制 **Connection string**
4. 确保连接串包含 `?sslmode=require`

示例：
```
postgresql://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

---

## 二、部署 Partykit 协作服务

在项目根目录执行：

```bash
npm run deploy:partykit
```

首次运行会打开浏览器，用 Cloudflare 账号登录 Partykit。

部署成功后终端会显示类似：
```
Deployed to https://headhunter-docs-collab.你的用户名.partykit.dev
```

**重要：** 将 `AUTH_SECRET`（与 Vercel 相同）配置到 PartyKit，否则协作连接会被拒绝：

```bash
npx partykit env add AUTH_SECRET
npm run deploy:partykit
```

记下 host（不含 `https://`）：
```
headhunter-docs-collab.你的用户名.partykit.dev
```

---

## 三、部署到 Vercel

```bash
npm run deploy:vercel
```

首次运行会要求：
1. 登录 Vercel 账号（浏览器授权）
2. 选择或创建项目
3. 确认部署设置

部署完成后会得到网址，例如：
```
https://headhunter-docs-xxx.vercel.app
```

---

## 四、配置 Vercel 环境变量

进入 [vercel.com](https://vercel.com) → 你的项目 → **Settings** → **Environment Variables**，添加：

| 变量 | 值 | 环境 |
|------|-----|------|
| `DATABASE_URL` | Neon 连接串 | Production |
| `AUTH_SECRET` | 随机字符串（见下方生成命令） | Production |
| `DEFAULT_PASSWORD` | 团队默认登录密码 | Production |
| `NEXT_PUBLIC_APP_URL` | `https://你的项目.vercel.app` | Production |
| `NEXT_PUBLIC_PARTYKIT_HOST` | `headhunter-docs-collab.xxx.partykit.dev` | Production |
| `OPENAI_API_KEY` | （可选）AI 摘要 | Production |

生成 AUTH_SECRET：
```bash
npm run deploy:secret
```

配置完成后，在 Vercel 项目页点击 **Deployments** → 最新部署 → **Redeploy**。

---

## 五、初始化生产数据库

在本地终端执行（将 `DATABASE_URL` 换成 Neon 连接串）：

```bash
DATABASE_URL="postgresql://..." npm run deploy:seed
```

这会创建团队成员账号。默认密码为 `DEFAULT_PASSWORD` 环境变量中的值（未设置则为 `Lt@202607`）。

管理员账号见 `config/team-members.ts`（默认用户名 `yu`）。

---

## 六、访问

打开：
```
https://你的项目.vercel.app/login
```

用团队成员账号登录即可。

---

## 本地开发（切换 PostgreSQL 后）

生产使用 PostgreSQL，本地也建议用 PostgreSQL：

**方式 A：Docker（推荐）**
```bash
docker compose up -d
```

`.env` 中设置：
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/headhunter"
```

**方式 B：Neon 开发分支**

在 Neon 创建 dev branch，本地 `.env` 使用 dev 连接串。

初始化本地库：
```bash
npm run db:push
npm run db:seed
```

启动：
```bash
npm run dev          # 终端 1（若启用 SYNC_* 会自动跑同步守护进程）
npm run party        # 终端 2（本地协作）
```

---

## 本地 ↔ 公网数据同步

若希望**本地开发库**与**公网 Neon 生产库**保持实时一致（文档、文件夹、权限、分享链接等），在 `.env` 中配置：

```env
SYNC_ENABLED="true"
SYNC_REMOTE_DATABASE_URL="postgresql://...neon...?sslmode=require"
SYNC_INTERVAL_MS="5000"

NEXT_PUBLIC_SYNC_ENABLED="true"
NEXT_PUBLIC_SYNC_POLL_INTERVAL_MS="5000"
```

说明：

- `DATABASE_URL`：本地 PostgreSQL（Docker 或 Neon dev branch）
- `SYNC_REMOTE_DATABASE_URL`：公网 Neon 连接串（与 Vercel 上 `DATABASE_URL` 相同）
- 本地保存/删除文档时会**立即推送**到公网；守护进程每 5 秒**双向拉取**增量变更
- 冲突策略：**最后更新时间（updatedAt）优先**
- 删除操作通过 `SyncTombstone` 表同步到对端
- 首次启用前，本地与公网都需执行 `npm run db:push`（新增 `SyncTombstone` 表）

单独运行同步（不启动 Next.js）：

```bash
npm run sync          # 守护进程
npm run sync:once     # 单次全量/增量同步
```

查看同步状态：`GET /api/sync/status`（仅本地开发环境有效）

**注意：** 同步守护进程仅在本地运行；公网 Vercel 上的编辑会通过拉取同步到本地。协作用户 ID 按 `username` 自动映射。

---

## 常用命令

```bash
npm run deploy              # 显示部署检查清单
npm run deploy:partykit     # 部署 Partykit
npm run deploy:vercel       # 部署 Vercel 生产环境
npm run deploy:seed         # 初始化生产数据库（需 DATABASE_URL）
npm run deploy:secret       # 生成 AUTH_SECRET
npm run sync                # 本地↔公网同步守护进程
npm run sync:once           # 单次同步
```

---

## 自定义域名（可选）

1. Vercel 项目 → **Settings** → **Domains** → 添加你的域名
2. 按提示在 DNS 添加 CNAME 记录
3. 更新 `NEXT_PUBLIC_APP_URL` 为新域名并 Redeploy

---

## 故障排查

| 问题 | 处理 |
|------|------|
| 登录后立即退出 | 检查 `AUTH_SECRET` 是否已在 Vercel 配置并 Redeploy |
| 协作不同步 | 确认 `NEXT_PUBLIC_PARTYKIT_HOST` 正确，且 Partykit 已部署 |
| 分享链接不对 | 确认 `NEXT_PUBLIC_APP_URL` 为公网域名 |
| 构建失败 | 确认 Vercel 已配置 `DATABASE_URL`，构建时会执行 `prisma db push` |
| 国内打不开 / ERR_CONNECTION_TIMED_OUT | 见 **[DEPLOY-CHINA.md](./DEPLOY-CHINA.md)**：绑定自定义域名或 Docker 部署到香港 |
