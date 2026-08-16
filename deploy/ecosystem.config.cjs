/**
 * PM2 config for the hunterdoc deployment (hunterdoc.expture.cn).
 *
 * Usage (as root, on the server):
 *   cd /www/wwwroot/hunterdoc
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 save
 *
 * Two processes:
 *   hunterdoc         Next standalone server on 3100
 *   hunterdoc-collab  Yjs collaboration server on 1999
 *
 * AUTH_SECRET must be identical in .env.production and .env: the Next app
 * signs collab tokens, the collaboration server verifies them, and the
 * PartyKit CLI only reads .env.
 */

const path = require("node:path");

const appDir = path.resolve(__dirname, "..");
const envFile = path.join(appDir, ".env.production");

module.exports = {
  apps: [
    {
      name: "hunterdoc",
      cwd: path.join(appDir, ".next", "standalone"),
      script: "server.js",
      node_args: `--env-file=${envFile}`,
      env: {
        NODE_ENV: "production",
        PORT: "3100",
        HOSTNAME: "127.0.0.1",
      },
      // the standalone server manages its own listener; cluster mode adds
      // nothing here and Orbiter runs fork too
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "500M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: path.join(appDir, "logs", "hunterdoc-error.log"),
      out_file: path.join(appDir, "logs", "hunterdoc.log"),
      merge_logs: true,
    },
    {
      name: "hunterdoc-collab",
      cwd: appDir,
      script: path.join(appDir, "node_modules", "partykit", "dist", "bin.mjs"),
      args: "dev --port 1999",
      env: {
        NODE_ENV: "production",
      },
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "300M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: path.join(appDir, "logs", "collab-error.log"),
      out_file: path.join(appDir, "logs", "collab.log"),
      merge_logs: true,
    },
  ],
};
