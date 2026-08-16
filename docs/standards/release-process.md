# 开发与发布流程

本文件为硬规则。改动 `.github/workflows/`、`deploy/` 下任意文件，或执行任何发布动作之前必须先读完。

## 分支模型

主干开发，分支发布。

| 分支 | 用途 | 谁能推 |
| --- | --- | --- |
| `main` | 唯一的开发主干，所有功能与修复都合到这里 | 日常开发 |
| `release/x.y.z` | 发布触发器，推送即启动发布流水线 | 仅在确认要发版时创建 |

不存在长期存活的 develop / staging 分支。`release/x.y.z` 是一次性的，发布完成后可以删除。

## 发布一个版本

三步，其中只有前两步需要人做：

```bash
# 1. 在 main 上把版本号改成目标版本
#    分支名与 package.json 的 version 必须完全一致，否则 CI 会拒绝
git checkout main && git pull
# 编辑 package.json 的 version 字段，例如改成 0.4.0
git add package.json && git commit -m "Bump version to 0.4.0."
git push origin main

# 2. 建发布分支并推送
git checkout -b release/0.4.0
git push origin release/0.4.0
```

推送后 `.github/workflows/release.yml` 全自动执行，无需任何人工干预：

1. **校验**：分支名符合 `x.y.z`、与 `package.json` 一致、`vx.y.z` tag 尚未存在
2. **构建**：在 GitHub 托管 runner 上 `npm ci` 与 `next build`，并校验产物中包含目标平台的 Prisma engine
3. **打 tag**：创建并推送 `vx.y.z`
4. **发布**：创建 GitHub Release，附上 `bundle.tar.gz`
5. **部署**：调用 `deploy.yml`，把该 Release 的产物推送到生产并重启，最后校验 `/api/health`

任一校验失败都在打 tag 之前中止，不会留下半个发布。

## 回滚

回滚不需要 revert 代码，也不重新构建：

在 GitHub 的 Actions 页面选 **Deploy** 工作流，点 Run workflow，填入要回退到的 tag（如 `v0.3.1`），运行。

它会取那个 tag 已发布的产物包重新部署。因为部署的是当初构建好的二进制产物而非重新构建，回滚结果与那个版本当时上线的状态完全一致。

数据库不会回滚。`prisma db push` 是向前收敛的，如果新版本引入了破坏性 schema 变更，回滚应用代码并不会撤销它——这种情况需要人工评估。

## 架构约束（改动前必读）

### 产物是推送的，不是拉取的

生产服务器到 GitHub 的连通性不对称：Actions artifact 端点可达，但 Release CDN（`objects.githubusercontent.com`）完全不通，实测 60 秒超时零字节。因此部署链路是 **CI 主动 SSH 推送**，服务器不主动拉取任何东西。

不要把部署改成服务器定时拉取或 webhook 触发拉取，那条路在这台机器上不通。

### 构建必须在 CI 完成，不能在服务器上

生产机可用内存约 1.1G，且同时跑着本应用、协作服务、PostgreSQL 和另一个项目 Orbiter。`next build` 打包 Univer 与 Tiptap 会 OOM。

### Prisma engine 的目标平台不能靠推断

`prisma/schema.prisma` 的 `binaryTargets` 必须包含生产机实际解析出的 target。该机是 OpenCloudOS（RHEL 系）配 OpenSSL 3.0.12，但 Prisma 解析出的是 `debian-openssl-1.0.x`，不是从系统特征推断的 `rhel-openssl-3.0.x`。

确认方式只有一种：在目标机器上执行 `npx prisma generate`，看它生成了哪个 engine 文件。CI 已把该 engine 的存在性作为打包前的硬校验，缺失直接中止。

### NEXT_PUBLIC_* 是构建期常量

这些值在 `next build` 时被内联进 JS，改动必须重新发一个版本，重启服务无效。它们定义在 `release.yml` 的 build 步骤，可被仓库 Variables 覆盖。

服务器 `.env.production` 里的同名变量对已构建的前端代码没有影响，只影响服务端运行时。

### 部署密钥的权限边界

CI 使用的密钥在服务器 `authorized_keys` 中通过 `command=` 锁定到 `deploy/ci-receive.sh`，并禁用 pty 与所有转发。客户端请求执行的任何命令都被忽略，唯一输入通道是 stdin 上的产物包。

不要为了图方便把这把密钥放开成普通 shell 登录。

## 紧急通道：绕过 CI 发布

CI 不可用时可从本机直接发布，产物布局与 CI 完全一致：

```bash
bash deploy/push-build.sh                          # 本机构建并传到服务器暂存区
ssh cloud-root 'bash /www/wwwroot/hunterdoc/deploy/server-deploy.sh'
```

代价是本机构建（macOS arm64）与生产（Linux x64）不同构，跨平台问题只能靠 `binaryTargets` 兜住。仅用于应急，不要作为常规手段。

## 服务器端关键路径

| 项 | 位置 |
| --- | --- |
| 部署目录 | `/www/wwwroot/hunterdoc` |
| 产物暂存区 | `/home/kyle/hunterdoc-stage` |
| 运行时环境变量 | `/www/wwwroot/hunterdoc/.env.production` 与 `.env`（AUTH_SECRET 必须一致） |
| CI 部署日志 | `/var/log/hunterdoc-ci-deploy.log` |
| 应用日志 | `pm2 logs hunterdoc` 与 `pm2 logs hunterdoc-collab` |
| nginx 站点配置 | `/www/server/panel/vhost/nginx/hunterdoc.expture.cn.conf` |

两个常驻进程由 root 的 pm2 管理，配置在 `deploy/ecosystem.config.cjs`：`hunterdoc`（3100）与 `hunterdoc-collab`（1999）。

## 故障排查

| 现象 | 原因与处理 |
| --- | --- |
| CI 在 Resolve and verify version 失败 | 分支名与 `package.json` 的 version 不一致，或该 tag 已存在。改版本号重新发 |
| CI 在 Assemble bundle 失败提示 engine missing | `binaryTargets` 被改动或 Prisma 升级改变了平台解析。在生产机跑 `npx prisma generate` 确认实际 target |
| 部署成功但页面 500 | 看 `pm2 logs hunterdoc`。Prisma engine 不匹配会在首次查询时抛 `PrismaClientInitializationError`，而非启动时 |
| 部署卡在 Ship and deploy | 跨境 SSH 传输 37MB 较慢，属正常。服务器端 `tail -f /var/log/hunterdoc-ci-deploy.log` 可见进度 |
| 任何 `EACCES` / `spawn ... EACCES` | 该机 `npm ci` 装出的原生二进制不带执行位（实测一次 npm ci 后有 59 个）。`server-deploy.sh` 每次部署会自动修复所有 `*/bin/*`。若手工排查：`find node_modules -type f -path "*/bin/*" ! -perm -u+x` |
| 协作服务 pm2 显示 online 但文档打不开 | 同上。esbuild 或 workerd 缺执行位会让 partykit 崩溃重启，pm2 的 online 状态具有欺骗性，要看 `restart_time` 是否在增长与 `logs/collab-error.log` |
| 未登录能看到工作台内容 | nginx 缓存越权。宝塔在 http 块全局启用 `proxy_cache` 且缓存键不含 Cookie，站点配置必须保留 `proxy_cache off` |

## 相关文档

- [docs/plans/cloud-deploy-plan.md](../plans/cloud-deploy-plan.md)：部署架构、服务器现状与部署过程中踩过的坑
- [docs/standards/docker-build.md](docker-build.md)：本地 Docker 栈的构建规则（生产不使用 Docker）
