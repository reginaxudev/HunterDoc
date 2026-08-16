# 云端部署方案

目标服务器 101.43.223.211（OpenCloudOS 9.4，宝塔面板），与既有 Orbiter 项目共存，两者互不影响。

## 目标架构

```
公网 hunterdoc.expture.cn (80/443)
  └── 宝塔 nginx vhost
        ├── /            → 127.0.0.1:3100    Next standalone
        └── /parties/    → 127.0.0.1:1999    协作服务 WebSocket

  PostgreSQL  127.0.0.1:5432   库与用户均为 hunterdoc
  部署目录     /www/wwwroot/hunterdoc.expture.cn
  进程管理     宝塔 Node 项目管理器（root 的 pm2 托管，www 用户运行），与 Orbiter 同构
  构建方式     服务器本地构建（不走 CI）

既有 dev.expture.cn → 127.0.0.1:3000 Orbiter，完全不动
```

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

### 约束 2：Prisma engine 是平台绑定的

`prisma/schema.prisma` 的 generator 未配 `binaryTargets`，只生成当前平台 engine（本地 macOS 实测只有 `libquery_engine-darwin-arm64.dylib.node`）。

本方案在服务器上构建，native target 恰好就是服务器平台，因此不需要改动。**但如果将来改走 CI 构建**（Ubuntu 上产出、RHEL 上运行），必须显式加 `binaryTargets = ["native", "rhel-openssl-3.0.x"]`，否则运行时找不到 engine。该 target 名已从 `@prisma/get-platform` 安装源码核实。

### 约束 3：PartyKit 没有自托管生产模式

PartyKit CLI 只有 `partykit dev`（miniflare 本地模拟）和 `partykit deploy`（推到官方平台）两条路，服务器自建等于长期跑开发服务器。

最终方向是替换为自建 y-websocket（Step 8），但分两阶段执行，理由见「执行次序」。

## 执行次序：先上线，再替换协作服务

第一阶段（Step 1 至 Step 7）不动协作相关代码，仍用现有 PartyKit，服务器上以 pm2 常驻 `partykit dev` 监听 1999，先把 nginx、证书、数据库、构建、进程托管整条链路验通。

第二阶段（Step 8）再做 y-websocket 替换。

这样拆的依据：两种后端的客户端连接地址都是 `wss://hunterdoc.expture.cn/parties/...`，靠 nginx 反代到 1999，所以 `NEXT_PUBLIC_PARTYKIT_HOST` 的值不变，第一阶段的证书、nginx 配置、数据库、pm2 配置在替换时全部复用，只需重新构建一次。

## 前置动作（用户在宝塔面板完成）

| 项 | 状态 |
| --- | --- |
| DNS：`hunterdoc.expture.cn` A 记录指向 101.43.223.211 | 已完成 |
| PostgreSQL 安装，建库建用户（均为 hunterdoc） | 已完成 |
| 宝塔新建站点 `hunterdoc.expture.cn`，PHP 选纯静态 | 待办 |
| 申请 Let's Encrypt 证书并开启强制 HTTPS | 待办，阻塞 Step 3 |
| 站点配置粘贴 nginx 反代（模板见 Step 2） | 待办 |

注意：DNS 虽已生效，但因为宝塔里还没有对应站点，nginx 匹配不到 server_name，当前 `http://hunterdoc.expture.cn` 返回的是 Orbiter 的页面。

## 实施步骤

### Step 1：代码同步与依赖安装

- 目标：服务器上的代码与 main 一致，依赖装好
- 操作：`/www/wwwroot/hunterdoc.expture.cn` 下 clone 仓库（或从 `/home/kyle/studio/HunterDoc` 迁移），Node 切到 v22.22.1，`npm ci`
- 验证：`node_modules/.prisma/client/` 下出现 `libquery_engine-rhel-openssl-3.0.x.so.node`
- 依赖：无

### Step 2：运行时配置

- 目标：产出 pm2 与 nginx 配置
- 文件：`deploy/ecosystem.hunterdoc.cjs`（两个 app：hunterdoc 3100 / hunterdoc-collab 1999）、`deploy/nginx-hunterdoc.conf.template`（`/` 反代 3100，`/parties/` 反代 1999 且带 WebSocket upgrade 头）
- 验证：端口、路径、upgrade 头与目标架构一致
- 依赖：无

### Step 3：环境变量与构建

- 目标：产出可运行的 standalone
- 环境变量（`.env.production`，不入库）：`DATABASE_URL`、`AUTH_SECRET`（32 字节随机，协作服务共用同一值）、`NEXT_PUBLIC_APP_URL=https://hunterdoc.expture.cn`、`NEXT_PUBLIC_PARTYKIT_HOST=hunterdoc.expture.cn`、`PORT=3100`
- 操作：`npx prisma generate && npm run build`
- OOM 应对：构建前先 `pm2 stop` 掉非必要进程腾内存；仍失败则给 node 加 `--max-old-space-size` 限制，或临时扩 swap；再不行退回本地/CI 构建后上传产物（此时需按约束 2 加 binaryTargets）
- 验证：`.next/standalone/server.js` 存在，`free -h` 构建期间未耗尽
- 依赖：前置动作中的 SSL 必须先完成（约束 1）

### Step 4：数据库初始化

- 目标：建表并写入团队账号
- 操作：`npx prisma db push`，然后跑 seed
- 注意：seed 在容器里踩过 Node 类型剥离不补扩展名的坑（见 `docs/standards/docker-build.md` 失败案例二第 3 条），服务器上有 tsx 可用，走 `npm run db:seed` 更稳
- 验证：`psql` 查 User 表有 11 条记录
- 依赖：Step 1、Step 3

### Step 5：进程托管

- 目标：两个进程常驻并开机自启
- 操作：宝塔 Node 项目管理器添加项目，启动文件 `.next/standalone/server.js`，端口 3100；协作服务用 pm2 另起一个跑 `partykit dev --port 1999`
- 验证：`curl 127.0.0.1:3100/api/health` 返回 ok，1999 端口监听
- 依赖：Step 3、Step 4

### Step 6：nginx 反代与 HTTPS

- 目标：`https://hunterdoc.expture.cn` 可访问，WebSocket 正常升级
- 操作：用户在宝塔站点配置粘贴 Step 2 的模板
- 验证：`curl -I https://hunterdoc.expture.cn/api/health` 返回 200；浏览器打开文档页，Network 里 `/parties/` 请求返回 101 Switching Protocols
- 依赖：Step 2、Step 5

### Step 7：端到端验收

- 检查项：登录、建文档、协同编辑、刷新后内容持久化；`http://dev.expture.cn` 仍然 200；`free -h` 内存余量健康；重启机器后两个服务自启
- 依赖：Step 6

### Step 8：协作服务替换为自建 y-websocket

第二阶段，勘察结论如下（改动面比预期小）：

- 客户端只有一个接入点：`components/CollaborativeEditor.tsx:154` 的 `YPartyKitProvider`。表格、思维导图、多维表格都没有接协作 provider
- `y-partykit/provider` 本身 fork 自 y-websocket，`connect` / `params` / `awareness` / `on("synced")` / `on("connection-error")` 基本同名
- **服务端不需要实现 Yjs 持久化**：`CollaborativeEditor.tsx:447-452` 在 synced 后判断 Yjs fragment 为空就用 DB 的 `initialContent` 填充，因此全员离线导致协作状态丢失可从 Postgres 重建。自建服务端只需做「鉴权 + 房间广播」

涉及文件：

- 新增：`server/collab-server.ts`（upgrade 阶段复用 `lib/security/collab-token.ts` 的 `verifyCollabToken` 校验 token 与 room 匹配）
- 修改：`components/CollaborativeEditor.tsx`、`lib/partykit-host.ts`、`package.json`（加 `y-websocket` + `ws`，移除 `y-partykit` / `partykit`）
- 删除：`party/collab.ts`、`partykit.json`、`party` / `deploy:partykit` 脚本

两个不能省的实现难点：

1. **async params**：现在 token 获取是异步函数（`params: async () => ...`），而 y-websocket 的 `params` 只接受同步对象。需要把 token 获取提到 provider 构造之前
2. **只读权限**：PartyKit 版靠 `onConnect(..., { readOnly: payload.access === "read" })` 实现分享链接只读，y-websocket 的 `setupWSConnection` 没有内置等价能力，需自行实现（拒绝该连接发来的 update 消息）。这是分享功能的权限边界，不能省

验证标准：两个浏览器同时编辑同一文档能实时同步；只读分享链接无法写入；断开全部连接后重新打开内容仍在

依赖：Step 7 完成后进行

## 风险

- **服务器构建 OOM 是头号风险**。可用内存仅 1.1G，Next 15 要打包 Univer 全家桶 + Tiptap + Yjs。应对手段见 Step 3
- 运行期三者叠加（Next + PostgreSQL + Orbiter）内存紧张，需给 pm2 配 `max_memory_restart` 并观察
- 第一阶段的协作服务是常驻的 `partykit dev`，属开发模式，稳定性无承诺，这也是 Step 8 存在的原因
- 项目无测试，验收依赖 lint、类型检查与实际访问
- 数据库走 `prisma db push` 而非版本化迁移，生产改 schema 前需人工评估数据影响
