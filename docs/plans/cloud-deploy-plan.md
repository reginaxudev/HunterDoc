# 云端部署方案

目标服务器 101.43.223.211（OpenCloudOS 9.4，宝塔面板），与既有 Orbiter 项目共存，两者互不影响。

## 目标架构

```
公网 hunterdoc.expture.cn (80/443)
  └── 宝塔 nginx vhost
        ├── /            → 127.0.0.1:3100    Next standalone
        └── /parties/    → 127.0.0.1:1999    协作服务 WebSocket

  PostgreSQL  127.0.0.1:5432   库与用户均为 hunterdoc
  部署目录     /www/wwwroot/hunterdoc
  进程管理     root 的 pm2，配置见 deploy/ecosystem.config.cjs
  构建方式     构建机（本地）构建，rsync 到服务器暂存区，服务器只组装

既有 dev.expture.cn → 127.0.0.1:3000 Orbiter，完全不动
```

宝塔在这套架构里只承担两件事：提供站点 vhost（nginx 反代入口）和签发续期 SSL 证书。进程不交给它管，因为宝塔的 Node 项目是一个项目一个进程，而本应用需要常驻两个。

顺带澄清一个容易误判的事实：宝塔的 Node 项目管理器**不使用 pm2**。Orbiter 的进程 PPID 为 1（spawn 后脱离，由 systemd 收养），既不在 root 的 pm2 列表里，www 用户也没有 pm2 实例。所以本项目的 pm2 与宝塔的机制互不干扰。

## 服务器现状与硬约束

| 约束 | 事实 | 对方案的影响 |
| --- | --- | --- |
| 无 Docker | `docker` command not found | 现有 Dockerfile / GHCR / deploy:docker 三条路径全部作废 |
| 内存 1.9G，可用 1.1G | 有 3G swap（`/www/swap` 1G + `/swapfile` 2G） | 服务器上跑 `next build` 有 OOM 风险，是本方案头号风险 |
| kyle 无 sudo，写不了 `/www/wwwroot` | `touch` 实测被拒 | 放代码、构建、配 Node 项目、配 nginx 全部需要用户在宝塔终端以 root 执行 |
| 3000 端口被 Orbiter 占用 | Orbiter 监听 0.0.0.0:3000，www 用户运行，root 的 pm2 托管 | HunterDoc 用 3100 |
| 系统为 RHEL 系 + OpenSSL 3.0.12 | glibc 2.38，SELinux Disabled | 服务器本地构建时 Prisma 的 native target 即 `rhel-openssl-3.0.x`，无需额外配置 |
| Node 版本 | nvm 有 v25.8.0，宝塔有 v22.22.1 / v24.14.0 | 用 v22.22.1（Next 15 官方支持范围内，v25 是 current 非 LTS） |

### 约束 1：必须先配 HTTPS 再构建

`lib/partykit-host.ts` 的 `resolvePartyKitProtocol()` 判定逻辑：host 含 `localhost` / `127.` 或以 `:端口` 结尾时用 `ws`，否则一律 `wss`。

因此 `NEXT_PUBLIC_PARTYKIT_HOST=hunterdoc.expture.cn` 会强制走 `wss://`，没有证书就连不上，文档页直接打不开（不是降级，是白屏报错）。

而 `NEXT_PUBLIC_*` 是构建期内联进 JS 的，先按 http 构建、后补 SSL 需要整个重新构建。所以证书必须在 Step 3 之前就位。

### 约束 2：Prisma engine 的目标平台必须实测，不能推断

产物在构建机上生成、在服务器上运行，因此 `binaryTargets` 必须显式声明服务器平台，否则运行时报 `PrismaClientInitializationError`。

**踩过的坑**：按系统特征推断（OpenCloudOS 属 RHEL 系，OpenSSL 3.0.12）配了 `rhel-openssl-3.0.x`，部署后首次查询即失败。Prisma 在这台机器上实际解析出的是 `debian-openssl-1.0.x`——服务器上 `npm ci` 自动生成的 native engine 就是这个名字，而用它执行的 `prisma db push` 是成功的，说明该判定虽反直觉但确实可用。

当前配置为 `["native", "debian-openssl-1.0.x", "rhel-openssl-3.0.x"]`，保留 rhel 是为了 Prisma 升级后判定变化时仍能落地。

正确的确认方式不是查系统信息，而是在目标机器上跑一次 `npx prisma generate`，看它生成了哪个 engine 文件。`deploy/push-build.sh` 已把该 engine 的存在性作为打包前的硬校验。

### 约束 3：PartyKit 没有自托管生产模式

PartyKit CLI 只有 `partykit dev`（miniflare 本地模拟）和 `partykit deploy`（推到官方平台）两条路，服务器自建等于长期跑开发服务器。

最终方向是替换为自建 y-websocket（Step 8），但分两阶段执行，理由见「执行次序」。

## 执行次序：先上线，再替换协作服务

第一阶段（Step 1 至 Step 7）不动协作相关代码，仍用现有 PartyKit，服务器上以 pm2 常驻 `partykit dev` 监听 1999，先把 nginx、证书、数据库、构建、进程托管整条链路验通。

第二阶段（Step 8）再做 y-websocket 替换。

这样拆的依据：两种后端的客户端连接地址都是 `wss://hunterdoc.expture.cn/parties/...`，靠 nginx 反代到 1999，所以 `NEXT_PUBLIC_PARTYKIT_HOST` 的值不变，第一阶段的证书、nginx 配置、数据库、pm2 配置在替换时全部复用，只需重新构建一次。


## 部署结果

第一阶段已完成，`https://hunterdoc.expture.cn` 可用。验证覆盖：未登录访问根路径正确重定向到登录页、登录、新建文档、双端协同编辑实时同步、刷新后内容持久化、静态资源、Orbiter 共存未受影响。

实际落地与原计划的差异：

| 项 | 计划 | 实际 |
| --- | --- | --- |
| 构建位置 | 服务器本地构建 | 构建机构建后 rsync 产物，服务器只组装。绕开 1.1G 内存的 OOM 风险 |
| Prisma target | `rhel-openssl-3.0.x` | `debian-openssl-1.0.x`（见约束 2） |
| 站点类型 | 宝塔 Node 项目 | 宝塔普通站点仅提供 vhost 与证书，进程由 pm2 管 |

## 运维手册

### 发布新版本

构建机执行，产物自动传到服务器暂存区：

```bash
bash deploy/push-build.sh
```

服务器执行（root），组装并重启：

```bash
bash /www/wwwroot/hunterdoc/deploy/server-deploy.sh            # 含 prisma db push
bash /www/wwwroot/hunterdoc/deploy/server-deploy.sh --skip-db  # 跳过库变更
```

`push-build.sh` 会在打包前校验产物里存在目标平台的 Prisma engine，缺失直接中止，不会把跑不起来的包传上去。

### 关键路径

| 项 | 位置 |
| --- | --- |
| 部署目录 | `/www/wwwroot/hunterdoc` |
| 产物暂存区 | `/home/kyle/hunterdoc-stage` |
| 环境变量 | `/www/wwwroot/hunterdoc/.env.production` 与 `.env`（两者 AUTH_SECRET 必须一致） |
| nginx vhost | `/www/server/panel/vhost/nginx/hunterdoc.expture.cn.conf` |
| vhost 备份 | `/root/hunterdoc.vhost.with-proxy.bak` |
| 日志 | `/www/wwwroot/hunterdoc/logs/` 与 `pm2 logs hunterdoc` |

### 修改配置后是否需要重新构建

`NEXT_PUBLIC_*` 在构建期被内联进 JS，改这些值必须重新走 `push-build.sh`。其余运行时变量（`DATABASE_URL`、`AUTH_SECRET`、`PORT`）改完 `pm2 reload hunterdoc --update-env` 即可。

## 部署中踩到的坑

按类别归档，均已修复并验证。

### nginx 全局缓存导致鉴权绕过（最严重）

宝塔在 `proxy.conf` 的 http 块启用了 `proxy_cache cache_one`，且未定义 `proxy_cache_key`，用的是不含 Cookie 的默认键。全站需要鉴权的应用被这样缓存，等于把某个用户的页面响应发给所有访问者——现象是未登录访问首页却拿到工作台布局。

已在两个 proxy 块加 `proxy_cache off` 并清空缓存目录。**同机的 Orbiter 未做此处理**，若其存在鉴权接口需同样处理。

### middleware 重定向指向内部地址

`new URL(path, request.url)` 在反代后拿到的是内部监听地址，浏览器被送往 `localhost:3100`。`request.nextUrl` 同样不可用；相对 `Location` 也不行，middleware 运行时会对它做 `new URL()` 并抛 `ERR_INVALID_URL`。

最终改为锚定 `NEXT_PUBLIC_APP_URL`。中途曾用 `Host` / `X-Forwarded-Host` 重建 origin，但那是开放重定向——nginx 不覆盖 `X-Forwarded-Host`，请求可以用合法 Host 通过 `server_name` 匹配，同时在转发头里夹带攻击者域名。现已在应用与 nginx 两层封堵。

### 前端未校验响应状态码

`WorkspaceProvider.refresh()` 直接把响应体当 Workspace 存入 state，401 的 `{error}` 会让 `documents` 字段消失，所有读 `.length` 的地方抛错。本地开发从不触发，因为 middleware 总是先重定向。

### 其余

- **pm2 不认配置文件名**：pm2 只把匹配 `.config.cjs` 模式的文件当 ecosystem，`ecosystem.hunterdoc.cjs` 被当普通脚本执行
- **宝塔站点 root 指向部署目录**：源码树暴露在 web 根下，需改到独立空目录；但 ACME 验证文件仍写在面板记录的原路径，`/.well-known/` 要单独指定 root
- **面板生成的正则 location 抢占静态资源**：`location ~ .*\.(js|css)?$` 优先级高于前缀 `/`，会让 `/_next/static/*.js` 走文件系统返回 404
- **`.user.ini` 带 immutable 属性**：面板为 PHP 站点生成，`chattr +i` 使 root 也无法 `chown -R`，会中断部署脚本。脚本已加解除与清理

## 遗留事项

- `dev.expture.cn` 的证书只覆盖 `orbiter.expture.cn`，而 Orbiter 的 vhost 绑定了两个域名且强制 HTTPS，从前者访问会有证书告警。需重新申请时勾选两个域名
- 协作服务当前是常驻的 `partykit dev`（开发模式），替换为自建 y-websocket 见下方 Step 8
- 尚未接入 CI 构建。服务器无法从 GitHub artifact CDN 下载（实测 60s 超时零字节），若要自动化需采用 CI 侧 scp 推送，部署脚本本身无需改动

## Step 8：协作服务替换为自建 y-websocket

第二阶段任务，勘察结论：

- 客户端只有一个接入点：`components/CollaborativeEditor.tsx` 的 `YPartyKitProvider`。表格、思维导图、多维表格都未接协作 provider
- `y-partykit/provider` 本身 fork 自 y-websocket，`connect` / `params` / `awareness` / `on("synced")` / `on("connection-error")` 基本同名
- **服务端无需实现 Yjs 持久化**：`CollaborativeEditor.tsx` 在 synced 后判断 Yjs fragment 为空即用 DB 的 `initialContent` 填充，因此协作状态丢失可从 Postgres 重建。自建服务端只需做鉴权与房间广播

涉及文件：新增 `server/collab-server.ts`（复用 `lib/security/collab-token.ts` 的 `verifyCollabToken`）；修改 `components/CollaborativeEditor.tsx`、`lib/partykit-host.ts`、`package.json`；删除 `party/collab.ts`、`partykit.json` 及相关脚本。

两个不能省的实现难点：

1. **async params**：现在 token 获取是异步函数，而 y-websocket 的 `params` 只接受同步对象，需把 token 获取提到 provider 构造之前
2. **只读权限**：PartyKit 版靠 `onConnect(..., { readOnly })` 实现分享链接只读，y-websocket 的 `setupWSConnection` 无等价能力，需自行拒绝该连接的 update 消息。这是分享功能的权限边界

验证标准：两个浏览器同时编辑能实时同步；只读分享链接无法写入；断开全部连接后重新打开内容仍在。

## CI/CD 发布流程

主干开发，分支发布。构建在 GitHub 托管 runner 上完成，产物通过一把受限 SSH 密钥推送到服务器。

### 发布一个版本

```bash
# 1. 在 main 上把 package.json 的 version 改成目标版本并提交
# 2. 建发布分支并推送，分支名必须与 version 一致
git checkout -b release/0.4.0
git push origin release/0.4.0
```

推送后 `.github/workflows/release.yml` 自动执行：

1. 校验分支名格式、与 `package.json` 的 version 一致、tag 未占用
2. 构建 standalone，校验产物包含目标平台的 Prisma engine
3. 打并推送 `v0.4.0` tag
4. **停在 production environment 等待审批**
5. 审批后把产物经 SSH 推到服务器，服务器执行 `db push` 并重启
6. 创建 GitHub Release 并附带产物

任一校验失败都会在打 tag 之前中止，不会留下半个发布。

### 需要在 GitHub 配置的内容

仓库 Settings 中：

| 类型 | 名称 | 值 |
| --- | --- | --- |
| Secret | `DEPLOY_SSH_KEY` | 服务器 `/root/.ssh/hunterdoc_ci` 的私钥全文 |
| Secret | `DEPLOY_HOST` | 服务器 IP |
| Secret | `DEPLOY_USER` | `root` |
| Secret | `DEPLOY_HOST_KEY` | `ssh-keyscan` 得到的主机公钥行，用于固定 host key |
| Environment | `production` | 添加 required reviewers，这是发布闸门 |
| Variable（可选） | `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_PARTYKIT_HOST` | 不设则用 workflow 内的默认值 |

### 部署密钥的权限边界

密钥在服务器 `authorized_keys` 中用 `command="..."` 锁定到 `deploy/ci-receive.sh`，并禁用 pty 与各类转发。客户端请求执行的任何命令都会被忽略，唯一的输入通道是 stdin 上的产物包。已实测：持该密钥执行 `cat /etc/shadow` 不会读到任何内容，只会触发部署脚本。

即便密钥泄露，攻击者能做的上限是推送一个产物包触发一次部署，无法获得 shell、无法读取任意文件。

### 为什么产物是推送而不是拉取

服务器到 GitHub 的连通性是不对称的：Actions artifact 端点可达，但 Release CDN（`objects.githubusercontent.com`）完全不通，实测 60s 超时零字节，且 `github.com` 本身响应在 1s 到 12s 之间波动。让服务器主动拉会把发布成功率绑在这条不稳定的链路上。

同时也评估过在服务器上跑 self-hosted runner：它省去暴露密钥，但需要常驻约 100MB 内存，而该机可用内存仅约 1.1G 且已承载两个应用与数据库。

### 本地构建仍然可用

`deploy/push-build.sh` 保留，用于绕过 CI 的紧急发布或调试。它与 CI 产出相同布局的产物，服务器端 `server-deploy.sh` 对两者一视同仁。
