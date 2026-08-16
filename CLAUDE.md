# HunterDoc

多人协同文档工作台。Next 15（App Router）+ React 19 + Prisma 6 / PostgreSQL，实时协同基于 Yjs + PartyKit，表格用 Univer，富文本用 Tiptap。

## 强制阅读的工程规范

触碰对应范围前必须先读完，索引见 [docs/standards/README.md](docs/standards/README.md)。

| 文档 | 触发条件 |
| --- | --- |
| [docs/standards/release-process.md](docs/standards/release-process.md) | 修改 `.github/workflows/` 或 `deploy/`，或执行任何发布、上线、回滚动作 |
| [docs/standards/docker-build.md](docs/standards/docker-build.md) | 修改 Dockerfile、`.dockerignore`、`docker-compose*.yml`，或 `package.json` 的 install 生命周期脚本 |

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 本地开发（需先 `cp .env.example .env` 并起 Postgres） |
| `npm run db:local` | 起本地 Postgres 容器 |
| `npm run docker:local` | 一键 Docker 栈（App + Postgres），完整验证构建产物 |
| `npm run lint` | ESLint，改完文件必跑 |
| `npx tsc --noEmit` | 类型检查，项目没有配 test 脚本，这是主要的静态验证手段 |

## 发布

推 `release/x.y.z` 分支即触发全自动流水线：构建、打 tag、发 Release、部署到生产。分支名必须与 `package.json` 的 version 一致。完整规则见 [docs/standards/release-process.md](docs/standards/release-process.md)。

## 需要知道的项目事实

- **生产环境不使用 Docker**。线上是 `hunterdoc.expture.cn`，跑在宝塔面板管理的 nginx 后面，两个 pm2 进程（应用 3100 + 协作服务 1999）。Dockerfile 与 `docker-compose*.yml` 仅供本地 `docker:local` 栈使用，`deploy:docker` 与 `.github/workflows/docker-deploy.yml` 都不参与线上部署。
- **构建必须在 CI 完成**。生产机可用内存约 1.1G 且同时承载另一个项目，`next build` 会 OOM。
- 数据库走 `prisma db push`，没有 `prisma/migrations` 目录。改 schema 不会产生版本化迁移记录，生产环境变更 schema 前要自行评估数据影响。
- `NEXT_PUBLIC_*` 在构建期被内联进 JS，改这些值必须重新发版本，改服务器 env 并重启无效。
- 项目没有测试。验证靠 lint、类型检查和实际跑起来，不要声称「测试通过」。
- Prisma 6 已警告 `package.json#prisma` 配置将在 Prisma 7 移除，后续需迁移到 `prisma.config.ts`。
