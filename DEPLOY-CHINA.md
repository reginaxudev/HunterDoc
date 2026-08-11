# 国内访问说明

`*.vercel.app` 在国内常出现 **ERR_CONNECTION_TIMED_OUT**，这是网络可达性问题，不是登录 bug。

## 推荐：香港 / 新加坡 VPS + Docker

完整步骤见 **[DEPLOY.md](./DEPLOY.md)**。最短路径：

1. 购买香港/新加坡 VPS，开放 **80 / 443**
2. DNS：域名 A 记录指向服务器 IP
3. 服务器执行：

```bash
git clone https://github.com/reginaxudev/HunterDoc.git /opt/HunterDoc
cd /opt/HunterDoc
sudo bash scripts/server-bootstrap.sh
```

4. 初始化账号：

```bash
DATABASE_URL="postgresql://..." npm run deploy:seed
```

5. 团队使用 `https://你的域名/login`，不要再用 vercel.app

## 临时排查

| 现象 | 含义 |
|------|------|
| 手机热点能开、公司网不能 | 运营商到旧托管线路不通 |
| `/api/health` 也超时 | 纯网络问题 |
| health 通但登录失败 | 再查密码 / AUTH_SECRET |

## 备选

- **Cloudflare 自定义域名** 反代到旧站点：可改善部分线路，但仍受上游限制
- **Zeabur / Railway** 亚太区域：可用 Dockerfile 部署同一套镜像
