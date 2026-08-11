# 安全防护说明

## 已启用能力

| 能力 | 说明 |
|------|------|
| 登录防暴力破解 | 同一 IP 15 分钟内最多 20 次失败；同一用户名 5 次失败后锁定 30 分钟 |
| 登录失败延迟 | 每次密码错误额外等待约 600ms |
| 分享链接限流 | 同一 IP 每分钟最多 60 次 token 查询 |
| 账号列表限流 | 登录页账号接口每分钟 30 次 |
| 登录页账号列表 | 已隐藏，生产环境 `/api/auth/accounts` 返回 404 |
| 健康检查限流 | `/api/health` 每分钟 20 次，且不暴露 DB 错误详情 |
| 管理员路由 | `/admin/*` 仅 ADMIN 角色可访问 |
| 权限修补 | AI 摘要、文件夹删除、文件上传需鉴权 |
| 安全响应头 | `X-Frame-Options`、`X-Content-Type-Options` 等 |
| 分享 token | 默认 24 位加密 token（更长、更难猜） |
| 管理员安全告警 | 批量复制拦截、账号/IP 连续登录失败 5 次锁定 |
| 批量复制违规 | 成员 24h 内 3 次复制 >5 条内容 → 安全告警 + 锁定登录 30 分钟 |

## 环境变量（可选）

```env
SECURITY_LOGIN_IP_LIMIT=20
SECURITY_LOGIN_USER_LIMIT=5
SECURITY_LOGIN_WINDOW_MS=900000
SECURITY_LOGIN_LOCKOUT_MS=1800000
SECURITY_SHARE_IP_LIMIT=60
SECURITY_BULK_COPY_VIOLATION_LIMIT=3
SECURITY_BULK_COPY_VIOLATION_WINDOW_MS=86400000
SECURITY_BULK_COPY_LOGIN_LOCKOUT_MS=1800000
```

## 部署后

生产库需执行一次 schema 更新（新增 `SecurityRateLimit` 表）：

```bash
npm run db:push
# 或 Vercel 构建时会自动 prisma db push
```

## 进一步建议

1. **强密码**：不要使用默认团队密码，成员首次登录后修改
2. **AUTH_SECRET**：生产环境使用 `npm run deploy:secret` 生成的随机值
3. **自定义域名 + Cloudflare**：在边缘层再加 WAF / Bot Fight（见 DEPLOY-CHINA.md）
4. **PartyKit 房间鉴权**：协作 WebSocket 需短期 token，见下方

## PartyKit 协作鉴权

文档实时协作（Yjs）已启用 **token 鉴权**：

- 登录用户通过 `GET /api/documents/{id}/collab-token` 获取 15 分钟有效 token
- 分享访客通过 `POST /api/share/collab-token` 获取 token（只读/可编辑与分享权限一致）
- PartyKit 在 `onBeforeConnect` 校验 token，**无法仅凭文档 ID 加入房间**

### 部署 PartyKit 时必须配置

PartyKit 与 Vercel 使用**相同的** `AUTH_SECRET`：

```bash
# 生成密钥（若尚未有）
npm run deploy:secret

# 写入 PartyKit 环境变量（与 Vercel 上 AUTH_SECRET 一致）
npx partykit env add AUTH_SECRET
npm run deploy:partykit
```

本地开发：`npm run party` 会读取项目根目录 `.env` 中的 `AUTH_SECRET`。
