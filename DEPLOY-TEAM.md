# 团队稳定访问部署（香港服务器）

目标：同事用固定链接登录，不依赖你的 Mac 开机。

## 你需要准备（二选一）

### 方案 A：香港 / 新加坡 VPS（推荐）

购买任意一家，系统选 **Ubuntu 22.04**，配置约 **2 核 2G** 即可：

- 阿里云香港、腾讯云香港、AWS Lightsail 新加坡、Bandwagon / DMIT 等

开通后发给我（或自己执行下面命令）：

1. **公网 IP**
2. **SSH 账号**（一般是 `root`）
3. **登录方式**：密码 或 把你的 SSH 公钥加到服务器
4. **域名**（可选但强烈建议）  
   - 有域名：DNS 里加 A 记录指向服务器 IP，例如 `doc.你的公司.com`  
   - 暂时没域名：先用 `http://服务器IP` 访问（无 HTTPS）

### 方案 B：Zeabur 等亚太 PaaS

用现成 Dockerfile 部署，连同一套 Neon 数据库。需要你有 Zeabur 账号并授权部署。

---

## 我这边已准备好的能力

仓库已支持：

- `Dockerfile` + `docker-compose.prod.yml`（App + Caddy HTTPS + 可选 Postgres）
- `scripts/server-bootstrap.sh`（服务器一键安装 Docker 并启动）
- GitHub Actions 构建镜像到 `ghcr.io/reginaxudev/hunterdoc`

服务器上最终访问形态：

```text
https://你的域名/login
账号：yu / （你设置的 DEFAULT_PASSWORD）
```

---

## 有服务器后怎么做（我可以代做）

把 IP / SSH / 域名发我后，我会：

1. SSH 登录服务器，安装 Docker  
2. 拉取 `HunterDoc` 仓库并写入 `.env.production`  
3. 启动容器（可用现有 Neon，或服务器自带 Postgres）  
4. 初始化账号（seed）  
5. 把固定登录链接发给团队  

你自己做也可以，SSH 登录后执行：

```bash
git clone https://github.com/reginaxudev/HunterDoc.git /opt/HunterDoc
cd /opt/HunterDoc
sudo bash scripts/server-bootstrap.sh
```

---

## 现在请回复这几项

```text
服务器 IP：
SSH 用户：root
SSH 方式：密码 / 密钥
域名（没有就写「暂无」）：
数据库：继续用现有 Neon / 服务器新建 Postgres
```

收到后我即可继续远程部署。
