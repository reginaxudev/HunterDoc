# 猎头云文档

专为猎头团队设计的协作文档平台，类似飞书云文档，支持多人实时协作、分享权限、AI 摘要与云端部署。

## 功能特性

### 核心文档
- **四种内容类型**（类似飞书）：富文本文档、电子表格、思维导图、多维表格
- 富文本编辑 + **@提及**（成员/群组/文档/日期，拼音搜索、最近使用、实时协作通知、消息收件箱）
- 自定义团队成员管理 + Slash 快捷命令
- 文档大纲 + 实时字数统计
- 电子表格：多 Sheet、公式引擎、条件格式（色阶/数据条/高亮规则）
- 思维导图：画布布局、缩放平移、节点备注、折叠/展开
- 多维表格：排序/筛选/搜索、快捷筛选标签、记录详情侧栏、看板拖拽、CSV 导出
- 6 套猎头专用模板（候选人评估、职位分析、客户拜访等）
- 文件夹管理 + 文档搜索

### 多人实时协作
- 基于 **Yjs + Partykit** 的 CRDT 同步，类似飞书同时编辑
- 实时光标与在线用户头像展示
- 编辑内容自动持久化到数据库

### 分享与权限
- 一键生成分享链接
- **只读** / **可编辑** 两种权限
- 分享页独立访问，无需登录

### AI 辅助
- 一键生成候选人/项目摘要报告
- 支持 OpenAI API（未配置时自动降级为规则摘要）

### 云端部署（Docker + GitHub Actions）

完整步骤见 **[DEPLOY.md](./DEPLOY.md)**。

```bash
# 1. 查看部署检查清单
npm run deploy

# 2. 部署 Partykit 协作服务
npm run deploy:partykit

# 3. 服务器上 Docker 部署
cp .env.docker.example .env.production   # 编辑环境变量
npm run deploy:docker                    # 或 deploy:docker:db（含 Postgres）

# 4. 初始化生产数据库成员账号
DATABASE_URL="postgresql://..." npm run deploy:seed

# 5. push 到 GitHub main → 自动构建 ghcr.io 镜像
```

| 变量 | 说明 | 示例 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://...?sslmode=require` |
| `NEXT_PUBLIC_APP_URL` | 应用公网域名 | `https://doc.example.com` |
| `NEXT_PUBLIC_PARTYKIT_HOST` | Partykit 协作服务地址 | `headhunter-docs-collab.user.partykit.dev` |
| `AUTH_SECRET` | 登录会话密钥（≥16 位） | `npm run deploy:secret` 生成 |
| `DEFAULT_PASSWORD` | 成员默认登录密码 | `Lt@202607` |
| `OPENAI_API_KEY` | OpenAI API Key（可选） | `sk-...` |

---

## 快速开始（本地开发）

### 1. 环境要求

- Node.js 18+

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入 OPENAI_API_KEY（可选）
```

### 4. 初始化数据库

**方式 A：一键 Docker（推荐，无需本机 Node）**

```bash
npm run docker:local
# 打开 http://localhost:3000/login
# 管理员 yu / Lt@202607
```

**方式 B：本机 Node + Docker 仅跑 Postgres**

```bash
npm run db:local    # 启动本地 PostgreSQL（Docker）
npm run db:push
npm run db:seed
```

本地使用 PostgreSQL（见 `docker-compose.yml` / `docker-compose.local.yml`），也可使用 Neon 开发分支连接串。

### 5. 启动服务（方式 B 需要两个终端）

```bash
# 终端 1：Next.js 应用
npm run dev

# 终端 2：实时协作 WebSocket 服务
npm run party
```

打开 [http://localhost:3000](http://localhost:3000)

---

## 生产部署

详见 **[DEPLOY.md](./DEPLOY.md)**（Docker + Neon + Partykit + GitHub Actions）。
国内访问见 **[DEPLOY-CHINA.md](./DEPLOY-CHINA.md)**。

---

## 使用指南

### 多人协作
1. 打开任意文档
2. 右上角显示在线用户头像
3. 多人同时编辑，变更实时同步
4. 不同用户光标以不同颜色显示

### 分享文档
1. 点击文档页右上角「分享」
2. 选择权限：只读 / 可编辑
3. 点击「生成链接」，复制发给同事或客户
4. 对方打开链接即可查看或协作

### AI 摘要
1. 在文档编辑页点击工具栏「AI 摘要」
2. 点击「生成摘要」
3. 可复制摘要用于汇报

### 飞书文档导入
1. **直接粘贴**：在飞书文档中复制内容，在猎头云文档编辑器中 Ctrl+V / ⌘+V，自动识别并转换格式
2. **导入对话框**：点击工具栏「飞书导入」→「从剪贴板粘贴」或上传 .html 文件
3. 支持标题、列表、待办、引用、表格、加粗/斜体等格式保留
4. 可选择「插入到光标位置」或「替换全部内容」

### 文件上传
1. 点击工具栏 **「上传文件」**，或直接拖拽文件到编辑器
2. 支持格式：PNG/JPG 图片、PDF 文档、Excel (.xlsx/.xls/.csv)
3. **图片**：内联显示在文档中
4. **PDF**：嵌入预览 + 下载链接
5. **Excel**：自动解析为可编辑表格，并保留原文件下载

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 15 (App Router) |
| 文档编辑 | TipTap + Yjs |
| 表格 | Univer Sheets |
| 实时协作 | Partykit + y-partykit |
| 数据库 | PostgreSQL + Prisma |
| AI | OpenAI API（可选） |
| 部署 | Docker + Caddy + GitHub Actions + Neon |
| 样式 | Tailwind CSS 4 |

---

## 项目结构

```
├── app/                 # Next.js App Router（页面 + API）
├── components/          # UI 组件
├── config/              # 团队成员等配置
├── deploy/              # Caddy 配置模板
├── lib/                 # 业务逻辑、安全、存储、表格保存
├── party/               # Partykit 协作服务
├── prisma/              # Schema + seed
├── scripts/             # 开发 / 部署 / 运维脚本
├── types/               # 共享类型
├── docker-compose.yml          # 本地 Postgres
└── docker-compose.prod.yml     # 生产 App + Caddy (+可选 Postgres)
```

---

## 内置模板

| 模板 | 用途 |
|------|------|
| 候选人评估报告 | 结构化记录候选人背景与推荐意见 |
| 职位需求分析 | 梳理 JD、核心要求与搜索策略 |
| 客户拜访纪要 | 记录客户需求与后续行动 |
| 面试反馈表 | 各轮面试评价与录用建议 |
| 团队周会纪要 | KPI 回顾与 Pipeline 更新 |
| Offer 跟进表 | 跟踪 Offer 发放与入职状态 |
