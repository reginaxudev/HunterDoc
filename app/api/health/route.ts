import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordRateLimitHit, rateLimitResponse } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/client-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 公网可达性探针（限流，不暴露内部错误细节） */
export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limited = await recordRateLimitHit(`health:ip:${ip}`, {
    limit: 20,
    windowMs: 60 * 1000,
    lockoutMs: 5 * 60 * 1000,
  });

  if (!limited.allowed) {
    const res = rateLimitResponse(limited.retryAfterSec);
    return NextResponse.json(res.body, { status: res.status, headers: res.headers });
  }

  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      latencyMs: Date.now() - started,
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
