# 国内访问 / ERR_CONNECTION_TIMED_OUT 解决方案

## 这是什么问题？

截图里的 **`ERR_CONNECTION_TIMED_OUT`（响应时间太长）** 表示：浏览器**根本连不上** `workstudio-xi.vercel.app` 的服务器。

这不是密码错误或登录 bug，而是**网络层**问题：

- 国内很多运营商对 `*.vercel.app` 域名**不稳定或直接超时**
- 应用本身在 Vercel 香港节点是 **Ready** 的，海外/部分网络可以打开
- 你本地能开、同事打不开，正是这种「线路/地区差异」

---

## 方案 A：自定义域名 + Cloudflare（推荐，继续用 Vercel）

**原理**：不用 `xxx.vercel.app`，改用自己的域名，经 Cloudflare 加速，国内成功率更高。

### 步骤

1. **准备一个域名**（阿里云/腾讯云/Cloudflare 购买均可）

2. **域名 DNS 托管到 Cloudflare**
   - 添加站点 → 按提示改 NS 记录

3. **在 Vercel 绑定域名**
   - [vercel.com](https://vercel.com) → 项目 `workstudio` → **Settings → Domains**
   - 添加域名，如 `docs.yourcompany.com`
   - 按 Vercel 提示在 Cloudflare 添加 **CNAME** 记录

4. **Cloudflare 设置**
   - 代理状态：**已代理（橙色云）**
   - SSL/TLS：**完全（严格）**

5. **更新 Vercel 环境变量**
   ```
   NEXT_PUBLIC_APP_URL=https://docs.yourcompany.com
   ```
   然后 **Redeploy**

6. **把新域名发给团队**，不要再发 `workstudio-xi.vercel.app`

---

## 方案 B：Docker 部署到香港/新加坡服务器

适合：有云服务器（阿里云 HK、腾讯云 HK、AWS SG 等），国内访问通常比 vercel.app 稳定。

### 1. 服务器准备

- 系统：Ubuntu 22+ / Debian 12+
- 开放端口：80、443（或 3000 内网 + Nginx 反代）
- 安装 Docker：`curl -fsSL https://get.docker.com | sh`

### 2. 配置环境变量

在服务器创建 `/opt/workstudio/.env`：

```env
DATABASE_URL=postgresql://...你的 Neon 连接串...
AUTH_SECRET=随机长字符串至少16位
DEFAULT_PASSWORD=Lt@202607
GRAY_PASSWORD=Gr@y202608
NEXT_PUBLIC_APP_URL=https://你的服务器域名或IP
NEXT_PUBLIC_PARTYKIT_HOST=headhunter-docs-collab.reginaxudev-lgtm.partykit.dev
```

### 3. 构建并运行

```bash
git clone <你的仓库> /opt/workstudio
cd /opt/workstudio
docker build -t workstudio .
docker run -d --name workstudio --restart unless-stopped \
  -p 3000:3000 --env-file .env workstudio
```

### 4. Nginx + HTTPS（推荐）

用 **Certbot** 或 **Cloudflare** 给域名配 HTTPS，反代到 `127.0.0.1:3000`。

---

## 方案 C：Zeabur / Railway 等亚太 PaaS

- [Zeabur](https://zeabur.com) 支持 Dockerfile，可选 **香港** 区域，国内开发者常用
- 连接同一套 **Neon 数据库 + Partykit**，只换应用托管位置
- 部署后同样设置 `NEXT_PUBLIC_APP_URL` 为平台给的域名

---

## 如何确认是网络问题？

让打不开的同事试：

1. **手机 4G/5G 热点**（换运营商）再打开链接  
2. 打开：`https://workstudio-xi.vercel.app/api/health`  
   - 同样超时 → 网络到 Vercel 不通  
   - 能返回 JSON → 网络通，再查登录/密码  
3. 你在能打开的 network 下访问 health，对比结果

---

## 当前链接说明

| 链接 | 国内可用性 |
|------|-----------|
| `https://workstudio-xi.vercel.app` | 很多地区 **超时**，不推荐作为主链接 |
| 自定义域名 + Cloudflare | **推荐** |
| 香港服务器 Docker | **推荐** |

**结论**：需要换「入口域名/部署位置」，无法在代码里单独修复 `ERR_CONNECTION_TIMED_OUT`。
