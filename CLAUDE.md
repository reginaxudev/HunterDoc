# HunterDoc

多人协同文档工作台。Next 15（App Router）+ React 19 + Prisma 6 / PostgreSQL，实时协同基于 Yjs + PartyKit，表格用 Univer，富文本用 Tiptap。

## 强制阅读的工程规范

触碰对应范围前必须先读完，索引见 [docs/standards/README.md](docs/standards/README.md)。

| 文档 | 触发条件 |
| --- | --- |
| [docs/standards/docker-build.md](docs/standards/docker-build.md) | 修改 Dockerfile、`.dockerignore`、`docker-compose*.yml`，或 `package.json` 的 install 生命周期脚本 |

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 本地开发（需先 `cp .env.example .env` 并起 Postgres） |
| `npm run db:local` | 起本地 Postgres 容器 |
| `npm run docker:local` | 一键 Docker 栈（App + Postgres），完整验证构建产物 |
| `npm run lint` | ESLint，改完文件必跑 |
| `npx tsc --noEmit` | 类型检查，项目没有配 test 脚本，这是主要的静态验证手段 |
| `npm run deploy:docker` | 生产部署（需 `.env.production`） |

## 需要知道的项目事实

- 数据库走 `prisma db push`，没有 `prisma/migrations` 目录。改 schema 不会产生版本化迁移记录，生产环境变更 schema 前要自行评估数据影响。
- 三条构建路径（GitHub Actions 推 GHCR、`deploy:docker`、`docker:local`）共用根目录同一个 Dockerfile。改它会同时影响 CI、生产部署和本地栈。
- CI 的 `deploy` job 由仓库变量 `SSH_DEPLOY_ENABLED` 控制，未设为 `true` 时会跳过（显示 0s，不是失败）。
- 项目没有测试。验证靠 lint、类型检查和实际跑起来，不要声称「测试通过」。
- Prisma 6 已警告 `package.json#prisma` 配置将在 Prisma 7 移除，后续需迁移到 `prisma.config.ts`。
