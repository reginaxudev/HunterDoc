# 工程规范索引

本目录存放 HunterDoc 的工程规范。标记为强制阅读的文档，在触碰对应范围的代码之前必须先读完。

| 文档 | 范围 | 强制阅读 | 来源 |
| --- | --- | --- | --- |
| [docker-build.md](docker-build.md) | Dockerfile、`.dockerignore`、`docker-compose*.yml`、`package.json` 的 install 生命周期脚本 | 是 | 2026-08-11 Docker 构建全线失败复盘 |
| [release-process.md](release-process.md) | `.github/workflows/`、`deploy/`、任何发布或上线动作 | 是 | 2026-08-16 云端部署与发布流水线建设 |

新增规范时同步更新本表，并在项目根 `CLAUDE.md` 中登记，确保后续会话自动加载。
