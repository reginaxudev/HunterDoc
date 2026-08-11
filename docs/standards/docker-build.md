# Docker 构建规范

本文件为强制阅读。修改 `Dockerfile`、`package.json` 的 scripts 段、或任意 `docker-compose*.yml` 之前必须先读完。

## 失败案例

2026-08-11，Docker 流水线自建立起从未成功过，`build-and-push` 每次都挂在第一层：

```
Error: Could not find Prisma Schema that is required for this command.
prisma/schema.prisma: file not found
npm error command sh -c prisma generate
```

Dockerfile 的 deps 层为了利用镜像缓存，只复制了依赖清单：

```dockerfile
COPY package.json package-lock.json ./
RUN npm ci
```

但 `package.json` 里声明了 `"postinstall": "prisma generate"`。`npm ci` 会执行 postinstall，而 `prisma generate` 需要读 `prisma/schema.prisma`，此时该文件还不在镜像里，于是整层失败。

影响面是全部三条构建路径，因为它们共用同一个 Dockerfile：GitHub Actions 推 GHCR、`npm run deploy:docker` 生产部署、`npm run docker:local` 本地一键栈。

## 根因

这不是「漏复制一个文件」，而是一类契约漂移：**deps 层的最小复制集是按「依赖解析需要什么」设计的，但 npm 的 install 生命周期脚本会在同一层执行，它需要的是「构建需要什么」。** 两个集合不相等时，缓存分层就会静默失效。

同类触发点不止 Prisma：`patch-package` 需要 `patches/`，`husky install` 需要 `.git/`，`node-gyp` 需要源码目录，任何 `prepare` / `postinstall` / `preinstall` 脚本都可能越出依赖清单的边界。

## 强制规则

1. deps 层最小复制集必须覆盖 install 生命周期脚本的全部输入。新增或修改 `preinstall` / `install` / `postinstall` / `prepare` 脚本时，同步检查 Dockerfile 的 deps 层是否已复制该脚本读取的文件。
2. 二选一，不允许含糊：要么把脚本依赖的文件 COPY 进 deps 层，要么 deps 层用 `npm ci --ignore-scripts` 并确保后续 builder 层显式补跑（本项目 builder 层已有 `npx prisma generate`，两种方案都成立；当前采用前者，因为它让 deps 层自身就是可用的）。
3. 往 `.dockerignore` 加规则时，必须反查该模式是否会命中 deps 层或 builder 层需要的文件。`prisma/**/*.db` 这类精确到扩展名的写法是对的，`prisma` 这种整目录排除会直接打爆构建。
4. 改完 Dockerfile 不允许只靠 push 到 CI 验证。先在本地跑下面的沙箱复现法。

## 本地验证方法（不需要 Docker 守护进程）

deps 层的失败模式可以脱离 Docker 精确复现——它本质上只是「在一个只含特定文件的空目录里跑 npm ci」：

```bash
SB=$(mktemp -d)
cp package.json package-lock.json "$SB"/
cp -R prisma "$SB"/prisma          # deps 层 COPY 了什么，这里就复制什么
cd "$SB" && npm ci; echo "EXIT: $?"
```

退出码 0 且 `node_modules/.prisma/client` 存在，才算 deps 层可用。

做修复验证时要跑对照组：把 `cp -R prisma` 这行去掉再跑一次，确认它复现出退出码 1。只看到修复后成功、没看到修复前失败，等于没有定位根因。

Docker 守护进程可用时，再补一次完整验证：

```bash
npm run docker:local
```

## 检查清单

改 Dockerfile 或 install 脚本后，逐条确认：

- [ ] deps 层复制的文件覆盖了所有 install 生命周期脚本的输入
- [ ] `.dockerignore` 的新规则不会命中构建所需文件
- [ ] 沙箱复现法退出码为 0，且对照组能复现失败
- [ ] `npm run lint` 与 `npx tsc --noEmit` 通过
- [ ] Docker 可用时 `npm run docker:local` 能起到健康检查通过
