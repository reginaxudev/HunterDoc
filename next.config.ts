import type { NextConfig } from "next";

function getLocalIPs(): string[] {
  const ips = new Set<string>(["127.0.0.1", "localhost"]);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const os = require("os") as typeof import("os");
    const interfaces = os.networkInterfaces();
    for (const iface of Object.values(interfaces)) {
      for (const addr of iface ?? []) {
        if (addr.family === "IPv4" && !addr.internal) {
          ips.add(addr.address);
        }
      }
    }
  } catch {
    // 部分环境读取网卡会失败，忽略即可
  }
  return [...ips];
}

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: getLocalIPs(),
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [
      {
        source: "/login",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  transpilePackages: [
    "@univerjs/presets",
    "@univerjs/preset-sheets-core",
    "@univerjs/preset-sheets-filter",
    "@univerjs/preset-sheets-find-replace",
    "@univerjs/sheets-filter",
    "@univerjs/sheets-filter-ui",
    "@univerjs/find-replace",
    "@univerjs/sheets-find-replace",
    "@univerjs/core",
    "@univerjs/design",
    "@univerjs/ui",
    "@univerjs/docs",
    "@univerjs/docs-ui",
    "@univerjs/engine-formula",
    "@univerjs/engine-render",
    "@univerjs/sheets",
    "@univerjs/sheets-ui",
    "@univerjs/sheets-formula",
    "@univerjs/sheets-formula-ui",
    "@univerjs/sheets-numfmt",
    "@univerjs/sheets-numfmt-ui",
    "@univerjs/network",
    "@univerjs/rpc",
  ],
};

export default nextConfig;
