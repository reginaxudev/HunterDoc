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

## 失败案例二：runner 层挑包

2026-08-16，deps 层修好之后，`npm run docker:local` 起来的 app 容器进入崩溃回环，连续踩了三个坑：

```
Error: ENOENT: no such file or directory, open '/app/node_modules/.bin/prisma_schema_build_bg.wasm'
Error: Cannot find module 'effect'      # require stack: @prisma/config -> prisma/build/index.js
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/app/lib/auth/password' imported from /app/prisma/seed.ts
```

三个坑同源：**runner 层是按「文件清单」拼出来的，而运行时要的是「布局 + 依赖闭包 + 解析规则」。**

1. **COPY 解引用符号链接**。`node_modules/.bin/prisma` 在宿主上是指向 `../prisma/build/index.js` 的软链，`COPY --from=builder .../.bin/prisma` 会把目标文件内容拷成普通文件。`build/index.js` 按自身目录找同级 `.wasm`，位置一变就 ENOENT。
2. **白名单挑包漏掉依赖闭包**。只 COPY `node_modules/{prisma,@prisma,.prisma}` 会漏掉 `@prisma/config` 的 `c12` / `deepmerge-ts` / `effect` / `empathic`（再往下还有 chokidar、jiti 等）。逐个补包是打地鼠，随上游版本必然复发。
3. **entrypoint 的 TS 解析规则和本地不同**。`docker-entrypoint.sh` 用 `node --experimental-strip-types` 跑 `prisma/seed.ts`，走的是 ESM 解析器，**不补扩展名**；本地 `npm run db:seed` 用 tsx 会补。于是 `import ... from "../lib/auth/password"` 只在容器里炸。

## 强制规则

1. deps 层最小复制集必须覆盖 install 生命周期脚本的全部输入。新增或修改 `preinstall` / `install` / `postinstall` / `prepare` 脚本时，同步检查 Dockerfile 的 deps 层是否已复制该脚本读取的文件。
2. 二选一，不允许含糊：要么把脚本依赖的文件 COPY 进 deps 层，要么 deps 层用 `npm ci --ignore-scripts` 并确保后续 builder 层显式补跑（本项目 builder 层已有 `npx prisma generate`，两种方案都成立；当前采用前者，因为它让 deps 层自身就是可用的）。
3. 往 `.dockerignore` 加规则时，必须反查该模式是否会命中 deps 层或 builder 层需要的文件。`prisma/**/*.db` 这类精确到扩展名的写法是对的，`prisma` 这种整目录排除会直接打爆构建。
4. 改完 Dockerfile 不允许只靠 push 到 CI 验证。先在本地跑下面的沙箱复现法。
5. runner 层需要某个 CLI 时，装一份完整的、自洽的树（独立 stage `npm install`，版本从 `package-lock.json` 读），不要从 builder 的 `node_modules` 里挑目录。挑包只在「该包零运行时依赖」时成立，而这一点必须验证过而不是假设。
6. 从 `node_modules` 复制任何 `.bin/` 条目后，必须在 runner 层用 `ln -sf` 重建软链。`COPY` 会解引用，把 bin 变成脱离原目录的普通文件，凡是按 `__dirname` 找同级资源的 CLI 都会碎。
7. entrypoint 里跑 `.ts` 用的是 `node --experimental-strip-types`，其 ESM 解析器不补扩展名、不认 tsconfig `paths`。被 entrypoint 直接或间接执行的 `.ts` 文件，相对导入必须写全 `.ts` 后缀（配套在 `tsconfig.json` 打开 `allowImportingTsExtensions`）。「本地 tsx 跑得通」不构成容器里跑得通的证据。

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
- [ ] runner 层的 CLI 来自独立 stage 的完整安装，没有手工挑包
- [ ] 复制过的 `.bin/` 条目在 runner 层重建了软链
- [ ] entrypoint 执行到的 `.ts` 相对导入都带 `.ts` 后缀
- [ ] `npm run lint` 与 `npx tsc --noEmit` 通过
- [ ] Docker 可用时 `npm run docker:local` 能起到健康检查通过，且 `docker compose -f docker-compose.local.yml ps` 显示 `healthy` 而非 `restarting`
